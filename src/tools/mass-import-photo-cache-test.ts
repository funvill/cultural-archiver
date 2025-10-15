#!/usr/bin/env tsx
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { DryRunAPIClient } from '../lib/mass-import-system/lib/api-client.js';
import type { ProcessedImportData, PhotoInfo } from '../lib/mass-import-system/types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadBurnabyArtworks(): Promise<any[]> {
  const outDir = path.join(__dirname, '..', 'lib', 'data-collection', 'burnabyartgallery', 'output');
  const artworksPath = path.resolve(outDir, 'artworks.geojson');
  try {
    const raw = await fs.readFile(artworksPath, 'utf-8');
    const geo = JSON.parse(raw);
    if (!geo || !Array.isArray(geo.features)) return [];

    // Each feature.properties.originalArtwork may contain the parsed artwork, but
    // to be robust, we'll collect any photo URLs found in properties.photos or
    // properties.original.photos depending on how the exporter wrote them.
    const records: any[] = [];
    for (const f of geo.features) {
      const props = f.properties || {};
      const photos: string[] = [];
      if (Array.isArray(props.photos)) photos.push(...props.photos);
      if (props.original && Array.isArray(props.original.photos)) photos.push(...props.original.photos);
      // dedupe
      const uniq = Array.from(new Set(photos)).filter(Boolean);
      records.push({ id: props.id || props.external_id || props.source_url || f.id || Math.random().toString(36).slice(2), title: props.title || props.name || 'untitled', photos: uniq });
    }
    return records;
  } catch (err) {
    console.error('Failed to load Burnaby artworks from', artworksPath, err);
    return [];
  }
}

async function run() {
  console.log('Mass-import photo cache test starting...');

  // Prepare temporary cache directory under project root
  const cacheDir = path.resolve(process.cwd(), '.cache', 'mass-import-photos');
  await fs.mkdir(cacheDir, { recursive: true });

  // Build a minimal MassImportConfig inline to avoid importing the library index
  const config = {
    apiEndpoint: 'https://api.publicartregistry.com',
    massImportUserToken: 'a0000000-1000-4000-8000-000000000002',
    batchSize: 50,
    maxRetries: 3,
    retryDelay: 1000,
    duplicateDetectionRadius: 50,
    titleSimilarityThreshold: 0.8,
    dryRun: true,
    photoCacheDir: cacheDir,
    // seconds
    download_timeout: 15,
  } as any;

  const client = new DryRunAPIClient(config);

  const records = await loadBurnabyArtworks();
  console.log(`Loaded ${records.length} artwork records from Burnaby output`);

  // We'll build a tiny ProcessedImportData-like object per record with photos mapped
  let totalPhotos = 0;
  let validPhotos = 0;
  let invalidPhotos = 0;
  const warnings: string[] = [];

  // Iterate records and validate photos via dry-run client
  for (const rec of records) {
    if (!rec.photos || rec.photos.length === 0) continue;
    totalPhotos += rec.photos.length;

    // Map to PhotoInfo shape { url }
    const photos: PhotoInfo[] = rec.photos.map((u: string) => ({ url: u } as PhotoInfo));

    // Use the client's dry-run method indirectly by calling submitImportRecord with a small ProcessedImportData
    const data: Partial<ProcessedImportData> = {
      externalId: rec.id,
      title: rec.title,
      lat: 0,
      lon: 0,
      photos: photos as any,
      source: 'burnabyartgallery',
    };

    // The DryRunAPIClient.submitImportRecord will call validatePhotos and return counts
    // Use try/catch to continue on single failures
    try {
      const res = await client.submitImportRecord(data as ProcessedImportData);
      validPhotos += res.photosProcessed || 0;
      invalidPhotos += res.photosFailed || 0;
      if (res.warnings && res.warnings.length > 0) warnings.push(...res.warnings);
    } catch (err) {
      console.warn('Record validation failed for', rec.id, err);
    }
  }

  console.log('\nPhoto validation summary:');
  console.log(`  Total photos discovered: ${totalPhotos}`);
  console.log(`  Valid photos (per dry-run): ${validPhotos}`);
  console.log(`  Invalid photos (per dry-run): ${invalidPhotos}`);
  if (warnings.length > 0) {
    console.log('\nWarnings (sample):');
    console.log(warnings.slice(0, 20).join('\n'));
  }

  console.log(`\nCache directory used: ${cacheDir}`);
  try {
    const files = await fs.readdir(cacheDir);
    console.log(`Cached files count: ${files.length}`);
    if (files.length > 0) console.log(files.slice(0, 20).join('\n'));
  } catch (err) {
    console.warn('Failed to list cache dir', err);
  }

  console.log('\nDone');
}

run().catch(err => {
  console.error('Fatal error in test runner', err);
  process.exit(1);
});
