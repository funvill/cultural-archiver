#!/usr/bin/env node

/**
 * Run all local mass import data sources in dry-run mode.
 *
 * This script enumerates importers from the ImporterRegistry and runs a
 * dry-run validation for each available local data file. It supports a
 * photo cache directory to avoid remote image downloads during validation.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { ImporterRegistry } from '../lib/mass-import-system/lib/importer-registry.js';
import { MassImportProcessor } from '../lib/mass-import-system/cli/processor.js';
import type { MassImportConfig } from '../lib/mass-import-system/types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  const photoCacheDirIndex = args.indexOf('--photo-cache-dir');
  const photoCacheDirArg =
    photoCacheDirIndex >= 0 && typeof args[photoCacheDirIndex + 1] === 'string'
      ? args[photoCacheDirIndex + 1]
      : undefined;
  const photoCacheDir: string = photoCacheDirArg
    ? path.resolve(process.cwd(), photoCacheDirArg)
    : path.resolve(process.cwd(), '.cache', 'mass-import-photos');

  const limitIndex = args.indexOf('--limit');
  const limit: number | undefined =
    limitIndex >= 0 && typeof args[limitIndex + 1] === 'string'
      ? parseInt(args[limitIndex + 1], 10)
      : undefined;

  const offsetIndex = args.indexOf('--offset');
  const offset: number | undefined =
    offsetIndex >= 0 && typeof args[offsetIndex + 1] === 'string'
      ? parseInt(args[offsetIndex + 1], 10)
      : undefined;

  // Base config shared across runs
  const baseConfig: MassImportConfig = {
    apiEndpoint: 'https://api.publicartregistry.com',
    massImportUserToken: 'a0000000-1000-4000-8000-000000000002',
    batchSize: 50,
    maxRetries: 3,
    retryDelay: 1000,
    duplicateDetectionRadius: 50,
    titleSimilarityThreshold: 0.8,
    dryRun: true,
    photoCacheDir,
  };

  console.log(chalk.blue('🔎 Discovering available importers...'));
  const importers = ImporterRegistry.getInfo();

  if (importers.length === 0) {
    console.log(chalk.yellow('No importers registered.'));
    process.exit(0);
  }

  // Ensure cache dir exists
  try {
    await fs.mkdir(photoCacheDir, { recursive: true });
    console.log(chalk.gray(`Photo cache dir: ${photoCacheDir}`));
  } catch (err) {
    console.error(chalk.red('Failed to create photo cache dir'), err);
    process.exit(1);
  }

  // Consolidated run log to collect per-importer records
  const consolidatedLog: {
    runId: string;
    startedAt: string;
    entries: Array<Record<string, unknown>>;
  } = {
    runId: `run_${Date.now()}`,
    startedAt: new Date().toISOString(),
    entries: [],
  };

  for (const imp of importers) {
    const importerName = imp.name;
    console.log(chalk.cyan(`\n➡️  Running importer: ${importerName}`));

    // Resolve default data path relative to repo root if present
    const defaultPath = imp.defaultDataPath;
    let inputPath: string | undefined;

    if (defaultPath) {
      inputPath = path.resolve(process.cwd(), defaultPath);
      if (!(await pathExists(inputPath))) {
        // Try relative to src folder (for data-collection samples)
        const alt = path.resolve(__dirname, '..', '..', defaultPath);
        if (await pathExists(alt)) {
          inputPath = alt;
        } else {
          console.log(
            chalk.yellow(`  ⚠️  Default data file not found: ${defaultPath} — skipping importer.`)
          );
          continue;
        }
      }
    } else {
      console.log(chalk.yellow(`  ⚠️  Importer ${importerName} has no default data path — skipping.`));
      continue;
    }

    // Load input file
    let data: unknown[] = [];
    let parsed: unknown = null;
    try {
      const content = await fs.readFile(inputPath, 'utf-8');
      parsed = JSON.parse(content);
    } catch (err) {
      console.log(chalk.red(`  ❌ Failed to load data file ${inputPath}:`), err instanceof Error ? err.message : err);
      continue;
    }

    // Handle three common shapes:
    // - Array (standard JSON array of records)
    // - GeoJSON FeatureCollection { type: 'FeatureCollection', features: [...] }
    // - Single-object (e.g., mapped output) where we attempt to wrap or map
    if (Array.isArray(parsed)) {
      data = parsed;
    } else if (parsed && typeof parsed === 'object' && (parsed as any).type === 'FeatureCollection' && Array.isArray((parsed as any).features)) {
      // For GeoJSON FeatureCollections, prefer to let the OSM mapper handle full-file mapping.
      // Other importers expect an array of records, so use the features array directly.
      if (importerName === 'osm') {
        const mapper = ImporterRegistry.getMapper(importerName);
        if (mapper && typeof (mapper as any).mapData === 'function') {
          try {
            // Provide a minimal config that the OSM mapper expects so it can map features
            const mapped = await (mapper as any).mapData(parsed, {
              preset: 'vancouver',
              includeFeatureTypes: ['artwork'],
              tagMappings: {},
              descriptionFields: [],
              artistFields: [],
              yearFields: [],
            });
            if (Array.isArray(mapped)) data = mapped;
            else data = (parsed as any).features;
          } catch (err) {
            console.log(chalk.yellow(`  ⚠️  OSM mapper failed: ${err instanceof Error ? err.message : String(err)} — using features array.`));
            data = (parsed as any).features;
          }
        } else {
          data = (parsed as any).features;
        }
      } else {
        data = (parsed as any).features;
      }
    } else if (parsed && typeof parsed === 'object') {
      // Single object - try to detect an artists.json file (array expected) or wrap
      // If it has an "features" property use that, otherwise attempt to wrap into array
      if (Array.isArray((parsed as any).features)) {
        data = (parsed as any).features;
      } else {
        data = [parsed as any];
      }
    } else {
      console.log(chalk.yellow(`  ⚠️  Unrecognized data shape in ${inputPath} — skipping.`));
      continue;
    }

    // Build run config
    const runConfig: MassImportConfig = {
      ...baseConfig,
      dryRun: true,
      photoCacheDir,
    };

    // If the registered importer exposes an async mapData that returns
    // an array of RawImportData, run it now and pass the mapped records to
    // the processor. The MassImportProcessor expects each input record to
    // already be RawImportData when no DataSourceMapper is provided.
    const registered = ImporterRegistry.get(importerName);
    const mapper = registered?.mapper;

    let preMappedData = data;

    if (mapper && typeof (mapper as any).mapData === 'function') {
      try {
        // Prefer mapper-provided defaults when available
        let cfg = {};
        try {
          if (typeof (mapper as any).getDefaultConfig === 'function') {
            cfg = (mapper as any).getDefaultConfig() || {};
          }
        } catch {
          cfg = {};
        }

        // Provide sensible OSM-specific fallback defaults when running locally
        if (importerName === 'osm') {
          cfg = {
            ...cfg,
            preset: (cfg as any).preset || 'vancouver',
            includeFeatureTypes: (cfg as any).includeFeatureTypes || ['artwork', 'waypoint'],
            tagMappings: (cfg as any).tagMappings || {},
            descriptionFields: (cfg as any).descriptionFields || ['description', 'note', 'remarks'],
            artistFields: (cfg as any).artistFields || ['artist', 'creator', 'author'],
            yearFields: (cfg as any).yearFields || ['year', 'date'],
            minConfidence: (cfg as any).minConfidence || 0.0,
          };
        }

        // Attempt to call plugin-style mapData(sourceData, config)
        const maybe = (mapper as any).mapData(parsed, cfg);
        const result = maybe instanceof Promise ? await maybe : maybe;

        if (Array.isArray(result)) {
          console.log(chalk.gray(`  ℹ️  Importer '${importerName}' mapped ${result.length} records via its plugin.mapData()`));
          preMappedData = result;
        } else {
          // If the mapper returned a ValidationResult-style object, we cannot
          // use it as pre-mapped data. Fall back to the previously-determined
          // `data` (features array or parsed array).
          console.log(chalk.gray(`  ℹ️  Importer '${importerName}' mapData returned non-array; falling back to raw input shape.`));
        }
      } catch (err) {
        console.log(chalk.yellow(`  ⚠️  Importer '${importerName}' failed to map input: ${err instanceof Error ? err.message : String(err)} — falling back to raw input shape.`));
      }
    }

    const processor = new MassImportProcessor(runConfig);

    // Only set a mapper on the processor when a registered mapper explicitly
    // matches the DataSourceMapper interface (legacy mappers). For plugin
    // style importers that we've pre-mapped above we should NOT set the
    // mapper because the processor expects a different return shape.
    if (mapper && !(mapper as any).getDefaultConfig && typeof (mapper as any).mapData !== 'function') {
      processor.setMapper(mapper as any);
    }

    // Apply offset/limit windowing
    let windowed = preMappedData;
    if (typeof offset === 'number' && !isNaN(offset) && offset > 0) windowed = windowed.slice(offset);
    if (typeof limit === 'number' && !isNaN(limit) && limit > 0) windowed = windowed.slice(0, limit);

    // Prepare per-import run record for consolidated logging
    const runRecord: any = {
      importer: importerName,
      inputPath,
      startedAt: new Date().toISOString(),
      status: 'pending',
      error: null,
      reportPath: null,
      summary: null,
    };

    try {
      const session = await processor.processData(windowed, {
        source: importerName,
        dryRun: true,
        continueOnError: true,
      });

      // Save detailed report
      const reportPath = path.resolve(process.cwd(), `mass-import-${importerName}-dryrun-${Date.now()}.json`);
      await fs.writeFile(reportPath, JSON.stringify(session, null, 2));
      console.log(chalk.green(`  ✅ Report saved: ${reportPath}`));

      runRecord.status = 'completed';
      runRecord.endedAt = new Date().toISOString();
      runRecord.reportPath = reportPath;
      runRecord.summary = session.summary || null;
    } catch (err) {
      console.error(chalk.red(`  ❌ Importer ${importerName} failed:`), err instanceof Error ? err.message : err);
      runRecord.status = 'failed';
      runRecord.endedAt = new Date().toISOString();
      runRecord.error = err instanceof Error ? { message: err.message, stack: err.stack } : String(err);
    }

    // Append run record to consolidated log data structure
    consolidatedLog.entries.push(runRecord);
  }

  console.log(chalk.blue('\nAll importers processed.'));

  // Write consolidated logs (JSON + simple text summary)
  try {
    consolidatedLog['endedAt'] = new Date().toISOString();
    const logJsonPath = path.resolve(process.cwd(), `mass-import-runlog-${Date.now()}.json`);
    await fs.writeFile(logJsonPath, JSON.stringify(consolidatedLog, null, 2), 'utf-8');

    const textLines: string[] = [];
    textLines.push(`Mass import run: ${consolidatedLog.runId}`);
    textLines.push(`Started: ${consolidatedLog.startedAt}`);
    textLines.push(`Ended: ${consolidatedLog['endedAt']}`);
    textLines.push('');
    for (const e of consolidatedLog.entries) {
      textLines.push(`Importer: ${(e as any).importer} — Status: ${(e as any).status}`);
      if ((e as any).reportPath) textLines.push(`  Report: ${(e as any).reportPath}`);
      if ((e as any).error) textLines.push(`  Error: ${(e as any).error.message || (e as any).error}`);
      if ((e as any).summary) textLines.push(`  Summary: ${JSON.stringify((e as any).summary)}`);
      textLines.push('');
    }

    const logTextPath = path.resolve(process.cwd(), `mass-import-run-${Date.now()}.log`);
    await fs.writeFile(logTextPath, textLines.join('\n'), 'utf-8');

    console.log(chalk.green(`\nConsolidated run log saved: ${logJsonPath}`));
    console.log(chalk.green(`Consolidated run summary saved: ${logTextPath}`));
  } catch (err) {
    console.error(chalk.red('Failed to write consolidated run log:'), err);
  }
}

run().catch(err => {
  console.error('Runner failed:', err);
  process.exit(1);
});
