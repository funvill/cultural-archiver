#!/usr/bin/env node

/**
 * Vancouver Public Art Import Script
 * 
 * This script demonstrates how to use the Mass Import System
 * to import Vancouver Public Art data from the city's open data portal.
 * 
 * Usage:
 *   node vancouver-import.js [--dry-run] [--config=path] [--output=path]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { 
  MassImportLibrary,
  mapVancouverRecord,
  isValidVancouverRecord,
  getVancouverDataQuality,
  VANCOUVER_BOUNDS
} from '../dist/index.js';

// Configuration
const DEFAULT_CONFIG_PATH = './config.example.json';
const DEFAULT_DATA_PATH = '../../tasks/public-art.json';
const DEFAULT_OUTPUT_DIR = './import-reports';

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    configPath: DEFAULT_CONFIG_PATH,
    dataPath: DEFAULT_DATA_PATH,
    outputDir: DEFAULT_OUTPUT_DIR,
    help: false,
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--config=')) {
      options.configPath = arg.split('=')[1];
    } else if (arg.startsWith('--data=')) {
      options.dataPath = arg.split('=')[1];
    } else if (arg.startsWith('--output=')) {
      options.outputDir = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    }
  }

  return options;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
Vancouver Public Art Import Script

USAGE:
  node vancouver-import.js [options]

OPTIONS:
  --dry-run           Run validation only (no API calls)
  --config=<path>     Path to configuration file (default: ${DEFAULT_CONFIG_PATH})
  --data=<path>       Path to Vancouver data file (default: ${DEFAULT_DATA_PATH})
  --output=<path>     Output directory for reports (default: ${DEFAULT_OUTPUT_DIR})
  --help, -h          Show this help message

EXAMPLES:
  # Dry-run validation
  node vancouver-import.js --dry-run

  # Full import with custom config
  node vancouver-import.js --config=./production-config.json

  # Import with custom data file
  node vancouver-import.js --data=./latest-vancouver-data.json

CONFIGURATION:
  Create a configuration file with your API credentials:
  {
    "apiBaseUrl": "https://art-api.abluestar.com",
    "apiToken": "your-mass-import-token",
    "source": "vancouver-public-art"
  }
`);
}

/**
 * Load configuration file
 */
function loadConfig(configPath) {
  if (!existsSync(configPath)) {
    console.error(`Configuration file not found: ${configPath}`);
    console.error('Create a config file based on config.example.json');
    process.exit(1);
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading configuration: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Load Vancouver data file
 */
function loadVancouverData(dataPath) {
  if (!existsSync(dataPath)) {
    console.error(`Data file not found: ${dataPath}`);
    console.error('Download Vancouver public art data or specify a different path');
    process.exit(1);
  }

  try {
    const content = readFileSync(dataPath, 'utf-8');
    const rawData = JSON.parse(content);
    
    if (!Array.isArray(rawData)) {
      console.error('Data file must contain an array of Vancouver records');
      process.exit(1);
    }

    // Filter valid records
    const validRecords = rawData.filter(isValidVancouverRecord);
    const filteredCount = rawData.length - validRecords.length;

    console.info(`Loaded ${validRecords.length} valid Vancouver records`);
    if (filteredCount > 0) {
      console.warn(`Filtered out ${filteredCount} invalid records`);
    }

    // Show data quality statistics
    const quality = getVancouverDataQuality(validRecords);
    console.info(`Data Quality Summary:`);
    console.info(`  - Photos: ${quality.withPhotos}/${quality.total} (${Math.round(100 * quality.withPhotos / quality.total)}%)`);
    console.info(`  - Descriptions: ${quality.withDescriptions}/${quality.total} (${Math.round(100 * quality.withDescriptions / quality.total)}%)`);
    console.info(`  - Artists: ${quality.withArtists}/${quality.total} (${Math.round(100 * quality.withArtists / quality.total)}%)`);
    console.info(`  - Materials: ${quality.withMaterial}/${quality.total} (${Math.round(100 * quality.withMaterial / quality.total)}%)`);
    console.info(`  - Installation Years: ${quality.withYear}/${quality.total} (${Math.round(100 * quality.withYear / quality.total)}%)`);

    if (quality.missingCoordinates > 0) {
      console.warn(`  - Missing coordinates: ${quality.missingCoordinates}/${quality.total}`);
    }

    return validRecords;
  } catch (error) {
    console.error(`Error loading data file: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Save import results
 */
function saveResults(result, outputDir, isDryRun) {
  try {
    // Create output directory if needed
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const prefix = isDryRun ? 'vancouver-dry-run' : 'vancouver-import';
    
    // Save summary
    const summaryFile = resolve(outputDir, `${prefix}-${timestamp}-summary.json`);
    const summary = {
      timestamp: new Date().toISOString(),
      mode: isDryRun ? 'dry-run' : 'import',
      source: 'vancouver-public-art',
      results: {
        totalRecords: result.totalRecords,
        successCount: result.successCount,
        failureCount: result.failureCount,
        skippedCount: result.skippedCount,
      },
      statistics: result.statistics,
    };
    
    writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    console.info(`Summary saved to: ${summaryFile}`);

    // Save errors if any
    if (result.errors.length > 0) {
      const errorsFile = resolve(outputDir, `${prefix}-${timestamp}-errors.json`);
      writeFileSync(errorsFile, JSON.stringify(result.errors, null, 2));
      console.info(`Errors saved to: ${errorsFile}`);
    }

    // Save warnings if any
    if (result.warnings.length > 0) {
      const warningsFile = resolve(outputDir, `${prefix}-${timestamp}-warnings.json`);
      writeFileSync(warningsFile, JSON.stringify(result.warnings, null, 2));
      console.info(`Warnings saved to: ${warningsFile}`);
    }

  } catch (error) {
    console.error(`Error saving results: ${error.message}`);
  }
}

/**
 * Main import function
 */
async function main() {
  try {
    const options = parseArgs();

    if (options.help) {
      showHelp();
      return;
    }

    console.info('Vancouver Public Art Import Script');
    console.info('===================================');
    console.info('');

    // Load configuration
    const config = loadConfig(options.configPath);
    config.dryRun = options.dryRun;
    config.source = 'vancouver-public-art';

    // Apply Vancouver geographic bounds
    config.bounds = VANCOUVER_BOUNDS;

    console.info(`Mode: ${options.dryRun ? 'DRY-RUN (validation only)' : 'IMPORT (with API calls)'}`);
    console.info(`API Base URL: ${config.apiBaseUrl}`);
    console.info(`Source: ${config.source}`);
    console.info(`Geographic Bounds: Vancouver area`);
    console.info('');

    // Load and validate data
    const vancouverRecords = loadVancouverData(options.dataPath);
    const importRecords = vancouverRecords.map(mapVancouverRecord);

    console.info('');
    console.info(`Processing ${importRecords.length} records...`);
    
    // Start import process
    const startTime = Date.now();
    const importer = new MassImportLibrary(config);
    const result = await importer.processImport(importRecords);
    const duration = Math.round((Date.now() - startTime) / 1000);

    // Show results
    console.info('');
    console.info('IMPORT COMPLETED');
    console.info('================');
    console.info(`Duration: ${duration} seconds`);
    console.info(`Total Records: ${result.totalRecords}`);
    console.info(`✓ Successful: ${result.successCount}`);
    console.info(`✗ Failed: ${result.failureCount}`);
    console.info(`⊘ Skipped: ${result.skippedCount}`);

    if (result.errors.length > 0) {
      console.error(`${result.errors.length} errors occurred during processing`);
    }

    if (result.warnings.length > 0) {
      console.warn(`${result.warnings.length} warnings generated`);
    }

    // Geographic statistics
    const bounds = result.statistics.geographicBounds;
    console.info('');
    console.info('Geographic Coverage:');
    console.info(`  North: ${bounds.north.toFixed(6)}`);
    console.info(`  South: ${bounds.south.toFixed(6)}`);
    console.info(`  East: ${bounds.east.toFixed(6)}`);
    console.info(`  West: ${bounds.west.toFixed(6)}`);

    // Save results
    console.info('');
    saveResults(result, options.outputDir, options.dryRun);

    // Exit with appropriate code
    process.exit(result.failureCount > 0 ? 1 : 0);

  } catch (error) {
    console.error('Import failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the import
main();