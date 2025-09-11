#!/usr/bin/env node
/**
 * OSM Mass Import CLI Tool
 * 
 * Command-line interface for importing OpenStreetMap GeoJSON artwork data
 * into the Cultural Archiver platform via the mass-import API.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const DEFAULT_CONFIG = {
  apiUrl: 'http://localhost:8787',
  configFile: '../src/config/osm-import-config.json',
  batchSize: 50,
  dryRun: false,
  preset: 'default',
  verbose: false
};

// CLI argument parsing
function parseArgs() {
  const args = process.argv.slice(2);
  const config = { ...DEFAULT_CONFIG };
  
  let inputFile = null;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      
      switch (key) {
        case 'input':
        case 'file':
          inputFile = value || args[++i];
          break;
        case 'api-url':
        case 'url':
          config.apiUrl = value || args[++i];
          break;
        case 'config':
          config.configFile = value || args[++i];
          break;
        case 'batch-size':
          config.batchSize = parseInt(value || args[++i], 10);
          break;
        case 'preset':
          config.preset = value || args[++i];
          break;
        case 'dry-run':
          config.dryRun = value !== 'false';
          break;
        case 'verbose':
        case 'v':
          config.verbose = value !== 'false';
          break;
        case 'help':
        case 'h':
          showHelp();
          process.exit(0);
          break;
        default:
          console.warn(`Unknown option: --${key}`);
      }
    } else if (!inputFile) {
      inputFile = arg;
    }
  }
  
  return { config, inputFile };
}

// Help text
function showHelp() {
  console.log(`
OSM Mass Import Tool

Usage:
  node osm-import.js <geojson-file> [options]

Options:
  --input <file>         GeoJSON file to import (can be positional)
  --api-url <url>        API base URL (default: http://localhost:8787)
  --config <file>        Configuration file path  
  --preset <name>        Configuration preset (default, vancouver, strict, permissive)
  --batch-size <num>     Items per batch (default: 50)
  --dry-run              Validate only, don't import (default: false)
  --verbose, -v          Verbose logging
  --help, -h             Show this help

Examples:
  # Dry run validation
  node osm-import.js merged-artworks.geojson --dry-run
  
  # Import with Vancouver preset
  node osm-import.js merged-artworks.geojson --preset vancouver
  
  # Import with custom batch size
  node osm-import.js merged-artworks.geojson --batch-size 25
  
  # Import to production API
  node osm-import.js data.geojson --api-url https://art-api.abluestar.com

Configuration presets:
  default     - Standard validation and settings
  vancouver   - Optimized for Vancouver dataset
  strict      - High-quality imports only
  permissive  - Include incomplete records
`);
}

// Load and validate GeoJSON file
function loadGeoJSON(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  console.log(`Loading GeoJSON from: ${filePath}`);
  const raw = fs.readFileSync(filePath, 'utf-8');
  
  let geoJSON;
  try {
    geoJSON = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in file: ${error.message}`);
  }
  
  if (geoJSON.type !== 'FeatureCollection') {
    throw new Error('GeoJSON must be a FeatureCollection');
  }
  
  if (!Array.isArray(geoJSON.features)) {
    throw new Error('GeoJSON features must be an array');
  }
  
  console.log(`Loaded ${geoJSON.features.length} features from GeoJSON`);
  return geoJSON;
}

// Load configuration
function loadConfig(configFile, preset) {
  const configPath = path.resolve(__dirname, configFile);
  
  if (!fs.existsSync(configPath)) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }
  
  const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  
  let config;
  if (preset === 'default') {
    config = configData.defaultConfig;
  } else if (configData.presets && configData.presets[preset]) {
    config = configData.presets[preset];
  } else {
    throw new Error(`Configuration preset not found: ${preset}`);
  }
  
  console.log(`Using configuration preset: ${preset}`);
  return config;
}

// Progress tracking
function createProgressTracker(total) {
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  
  return {
    update: (batchSucceeded, batchFailed) => {
      processed += batchSucceeded + batchFailed;
      succeeded += batchSucceeded;
      failed += batchFailed;
      
      const percent = ((processed / total) * 100).toFixed(1);
      const successRate = processed > 0 ? ((succeeded / processed) * 100).toFixed(1) : '0.0';
      
      console.log(`Progress: ${processed}/${total} (${percent}%) | Success rate: ${successRate}% | Succeeded: ${succeeded}, Failed: ${failed}`);
    },
    getStats: () => ({ processed, succeeded, failed, total })
  };
}

// Main import function
async function performImport(geoJSON, importConfig, apiConfig) {
  const payload = {
    geoJSON,
    config: importConfig,
    batchSize: apiConfig.batchSize,
    dryRun: apiConfig.dryRun
  };
  
  const endpoint = apiConfig.dryRun 
    ? `${apiConfig.apiUrl}/api/mass-import/osm/validate`
    : `${apiConfig.apiUrl}/api/mass-import/osm`;
  
  console.log(`${apiConfig.dryRun ? 'Validating' : 'Importing'} to: ${endpoint}`);
  
  if (apiConfig.verbose) {
    console.log('Request payload summary:');
    console.log(`- Features: ${geoJSON.features.length}`);
    console.log(`- Batch size: ${apiConfig.batchSize}`);
    console.log(`- Duplicate threshold: ${importConfig.duplicateThreshold}`);
    console.log(`- User UUID: ${importConfig.user_uuid}`);
  }
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    
    if (apiConfig.verbose) {
      console.log('API Response:', JSON.stringify(result, null, 2));
    }
    
    if (!result.data || !result.data.success) {
      throw new Error(`Import failed: ${result.message || 'Unknown error'}`);
    }
    
    return result.data;
    
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error(`Could not connect to API at ${apiConfig.apiUrl}. Is the server running?`);
    }
    throw error;
  }
}

// Format and display results
function displayResults(result, verbose) {
  console.log('\n' + '='.repeat(50));
  
  if (result.dry_run) {
    console.log('VALIDATION RESULTS');
  } else {
    console.log('IMPORT RESULTS');
  }
  
  console.log('='.repeat(50));
  
  const { summary } = result;
  console.log(`Total features: ${summary.total_features}`);
  console.log(`Valid imports: ${summary.valid_imports}`);
  console.log(`Skipped records: ${summary.skipped_records}`);
  console.log(`Errors: ${summary.error_count}`);
  console.log(`Success rate: ${summary.success_rate}`);
  
  if (result.batch_info) {
    console.log(`Batch size: ${result.batch_info.batch_size}`);
    console.log(`Batch count: ${result.batch_info.batch_count}`);
    console.log(`Processing mode: ${result.batch_info.processing_mode}`);
  }
  
  if (result.errors && result.errors.length > 0) {
    console.log(`\nErrors (${result.errors.length}):`);
    result.errors.slice(0, verbose ? undefined : 10).forEach(error => {
      console.log(`  - ${error.feature_id}: ${error.error}`);
    });
    if (!verbose && result.errors.length > 10) {
      console.log(`  ... and ${result.errors.length - 10} more errors (use --verbose to see all)`);
    }
  }
  
  if (result.import_results && verbose) {
    console.log('\nBatch Results:');
    result.import_results.forEach(batch => {
      console.log(`  Batch ${batch.batch_id}: ${batch.succeeded}/${batch.processed} successful`);
    });
  }
  
  console.log('='.repeat(50));
}

// Main execution
async function main() {
  try {
    const { config, inputFile } = parseArgs();
    
    if (!inputFile) {
      console.error('Error: No input file specified');
      showHelp();
      process.exit(1);
    }
    
    // Load input data and configuration
    const geoJSON = loadGeoJSON(inputFile);
    const importConfig = loadConfig(config.configFile, config.preset);
    
    // Perform the import
    console.log(`Starting ${config.dryRun ? 'validation' : 'import'} with ${geoJSON.features.length} features...`);
    const startTime = Date.now();
    
    const result = await performImport(geoJSON, importConfig, config);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);
    
    // Display results
    displayResults(result, config.verbose);
    console.log(`\nCompleted in ${duration} seconds`);
    
    // Exit with appropriate code
    const hasErrors = result.summary.error_count > 0;
    const successRate = parseFloat(result.summary.success_rate);
    
    if (config.dryRun) {
      process.exit(hasErrors ? 1 : 0);
    } else {
      process.exit(successRate < 80 ? 1 : 0); // Fail if success rate < 80%
    }
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    
    if (error.stack && process.env.DEBUG) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// Run if called directly
const currentModuleUrl = import.meta.url;
const expectedUrl = `file:///${process.argv[1].replace(/\\/g, '/')}`;

if (currentModuleUrl === expectedUrl || process.argv[1].includes('osm-import.js')) {
  main();
}