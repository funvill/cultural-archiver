#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { ImporterRegistry } from '../mass-import/lib/importer-registry.js';
import { MassImportProcessor } from '../mass-import/cli/processor.js';
import type { MassImportConfig } from '../mass-import/types/index.js';

async function run(): Promise<void> {
  const importerName = 'artist-json';
  const imp = ImporterRegistry.get(importerName);
  if (!imp) {
    console.error(chalk.red(`Importer '${importerName}' not registered.`));
    process.exit(1);
  }

  const defaultPath = imp.defaultDataPath || (imp as any).info?.defaultDataPath;
  if (!defaultPath) {
    console.error(chalk.red(`Importer '${importerName}' has no default data path configured.`));
    process.exit(1);
  }

  // Resolve the input path using a few sensible candidates because this
  // script may be executed from different working directories (repo root,
  // src/workers, etc.). Try each candidate until we can read the file.
  // Resolve __dirname for ESM modules in a cross-platform way
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));

  const candidates = [
    path.resolve(process.cwd(), defaultPath),
    path.resolve(scriptDir, '..', defaultPath),
    path.resolve(scriptDir, '..', '..', defaultPath),
    path.resolve(process.cwd(), '..', defaultPath),
    path.resolve(defaultPath),
    defaultPath,
  ];

  let content: string | undefined;
  let foundPath: string | undefined;
  for (const p of candidates) {
    try {
      content = await fs.readFile(p, 'utf-8');
      foundPath = p;
      break;
    } catch (e) {
      // ignore and try next candidate
    }
  }

  if (!content || !foundPath) {
    console.error(chalk.red(`Failed to read input file. Tried paths:\n${candidates.join('\n')}`));
    process.exit(1);
  }

  console.log(chalk.gray(`Using input file: ${foundPath}`));

  // Parse source data
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    console.error(chalk.red(`Failed to parse JSON in ${foundPath}:`), err);
    process.exit(1);
  }

  // Use the importer's mapper to convert source data into RawImportData
  // The importer implementation exposes a mapper; we keep this typed loosely
  // because importers live in several locations (dist and src).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapper = (imp as any).mapper as any;
  if (!mapper || typeof mapper.mapData !== 'function') {
    console.error(chalk.red(`Importer '${importerName}' does not expose a mapper.mapData function.`));
    process.exit(1);
  }

  const runConfig: MassImportConfig = {
    apiEndpoint: 'https://api.publicartregistry.com',
    massImportUserToken: 'a0000000-1000-4000-8000-000000000002',
    batchSize: 50,
    maxRetries: 3,
    retryDelay: 1000,
    duplicateDetectionRadius: 50,
    titleSimilarityThreshold: 0.8,
    dryRun: true,
    photoCacheDir: path.resolve(process.cwd(), '.cache', 'mass-import-photos'),
  };

  const processor = new MassImportProcessor(runConfig);

  try {
    console.log(chalk.blue('Mapping source data via importer mapper...'));
    const mapped = await mapper.mapData(parsed, mapper.getDefaultConfig ? mapper.getDefaultConfig() : {});
    if (!Array.isArray(mapped)) {
      console.error(chalk.red('Importer mapper.mapData did not return an array of records.'));
      process.exit(1);
    }

    console.log(chalk.blue(`Running artist import dry-run for ${mapped.length} mapped records...`));
    const session = await processor.processData(mapped, { source: importerName, dryRun: true, continueOnError: true });
    const reportPath = path.resolve(process.cwd(), `mass-import-artist-json-dryrun-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(session, null, 2), 'utf-8');
    console.log(chalk.green(`Report saved: ${reportPath}`));
    console.log(chalk.green(`Summary: ${JSON.stringify(session.summary)}`));
  } catch (err) {
    console.error(chalk.red('Artist import failed:'), err);
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
