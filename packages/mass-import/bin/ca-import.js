#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { 
  MassImportLibrary,
  mapVancouverRecord,
  isValidVancouverRecord,
  getVancouverDataQuality,
} from '../dist/index.js';

/**
 * Cultural Archiver Mass Import CLI
 * 
 * Command-line interface for importing public art data from various sources
 * with validation, dry-run capabilities, and detailed reporting.
 */

/**
 * Parse command line arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    command: 'help',
    outputDir: './import-reports',
    batchSize: 50,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case 'import':
      case 'dry-run':
      case 'validate':
      case 'bulk-approve':
        options.command = arg;
        break;

      case '--source':
        if (i + 1 < args.length) {
          options.source = args[++i];
        } else {
          console.error('Error: --source requires a source identifier');
          process.exit(1);
        }
        break;

      case '--config':
        if (i + 1 < args.length) {
          options.config = resolve(args[++i]);
        } else {
          console.error('Error: --config requires a configuration file path');
          process.exit(1);
        }
        break;

      case '--data':
        if (i + 1 < args.length) {
          options.dataFile = resolve(args[++i]);
        } else {
          console.error('Error: --data requires a data file path');
          process.exit(1);
        }
        break;

      case '--output-dir':
        if (i + 1 < args.length) {
          options.outputDir = resolve(args[++i]);
        } else {
          console.error('Error: --output-dir requires a directory path');
          process.exit(1);
        }
        break;

      case '--batch-size':
        if (i + 1 < args.length) {
          const size = parseInt(args[++i], 10);
          if (isNaN(size) || size < 1 || size > 1000) {
            console.error('Error: --batch-size must be between 1 and 1000');
            process.exit(1);
          }
          options.batchSize = size;
        } else {
          console.error('Error: --batch-size requires a number');
          process.exit(1);
        }
        break;

      case '--bounds':
        if (i + 1 < args.length) {
          options.bounds = args[++i];
        } else {
          console.error('Error: --bounds requires coordinate bounds');
          process.exit(1);
        }
        break;

      case '--confirm':
        options.confirm = true;
        break;

      case '--verbose':
        options.verbose = true;
        break;

      case '--help':
      case '-h':
        options.command = 'help';
        break;

      default:
        console.error(`Error: Unknown option "${arg}"`);
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
Cultural Archiver Mass Import CLI

USAGE:
  ca-import <command> [options]

COMMANDS:
  import              Execute mass import with API calls
  dry-run             Validate data without making API calls
  validate            Validate configuration and data files
  bulk-approve        Bulk approve imported artworks (admin only)
  help                Show this help message

OPTIONS:
  --source <id>       Source identifier (e.g., 'vancouver-public-art')
  --config <file>     Configuration file path (JSON format)
  --data <file>       Data file path (JSON format)
  --output-dir <dir>  Directory for reports (default: ./import-reports)
  --batch-size <n>    Records per batch, 1-1000 (default: 50)
  --bounds <coords>   Geographic bounds: "north,south,east,west"
  --confirm           Confirm bulk operations without prompts
  --verbose           Enable detailed logging
  --help, -h          Show this help message

EXAMPLES:
  # Dry-run validation for Vancouver data
  ca-import dry-run --source vancouver-public-art --config ./config.json --data ./public-art.json

  # Execute import with custom batch size
  ca-import import --source vancouver-public-art --config ./config.json --data ./public-art.json --batch-size 25

  # Validate data file format
  ca-import validate --data ./public-art.json --source vancouver-public-art

  # Bulk approve all Vancouver imports
  ca-import bulk-approve --source vancouver-public-art --config ./config.json --confirm

  # Bulk approve with geographic bounds
  ca-import bulk-approve --source vancouver-public-art --config ./config.json --bounds "49.3,-123.2,49.2,-123.1" --confirm

CONFIGURATION FILE FORMAT:
  {
    "apiBaseUrl": "https://art-api.abluestar.com",
    "apiToken": "your-mass-import-token",
    "source": "vancouver-public-art"
  }
`);
}

/**
 * Load and validate configuration
 */
function loadConfig(options) {
  if (!options.config) {
    console.error('Error: Configuration file is required');
    process.exit(1);
  }

  if (!existsSync(options.config)) {
    console.error(`Error: Configuration file not found: ${options.config}`);
    process.exit(1);
  }

  try {
    const configContent = readFileSync(options.config, 'utf-8');
    const config = JSON.parse(configContent);

    // Override with CLI options
    if (options.source) config.source = options.source;
    if (options.batchSize) config.batchSize = options.batchSize;
    if (options.command === 'dry-run') config.dryRun = true;

    // Parse bounds if provided
    if (options.bounds) {
      const coords = options.bounds.split(',').map(n => parseFloat(n.trim()));
      if (coords.length !== 4 || coords.some(isNaN)) {
        console.error('Error: --bounds must be "north,south,east,west" coordinates');
        process.exit(1);
      }
      config.bounds = {
        north: coords[0],
        south: coords[1],
        east: coords[2],
        west: coords[3],
      };
    }

    // Validate configuration
    if (!config.apiBaseUrl || !config.apiToken || !config.source) {
      console.error('Error: Configuration must include apiBaseUrl, apiToken, and source');
      process.exit(1);
    }

    return config;

  } catch (error) {
    console.error(`Error loading configuration: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Load data file
 */
function loadDataFile(filePath, source) {
  if (!existsSync(filePath)) {
    console.error(`Error: Data file not found: ${filePath}`);
    process.exit(1);
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const rawData = JSON.parse(content);

    // Handle Vancouver Open Data format
    if (source.includes('vancouver')) {
      if (!Array.isArray(rawData)) {
        console.error('Error: Vancouver data must be an array of records');
        process.exit(1);
      }

      const vancouverRecords = rawData.filter(isValidVancouverRecord);
      if (vancouverRecords.length === 0) {
        console.error('Error: No valid Vancouver records found in data file');
        process.exit(1);
      }

      console.info(`Loaded ${vancouverRecords.length} Vancouver records (${rawData.length - vancouverRecords.length} filtered)`);
      
      // Show data quality statistics
      const quality = getVancouverDataQuality(vancouverRecords);
      console.info(`Data Quality: ${quality.withPhotos}/${quality.total} with photos, ${quality.withDescriptions}/${quality.total} with descriptions`);

      return vancouverRecords.map(mapVancouverRecord);
    }

    // Handle generic import format
    if (!Array.isArray(rawData)) {
      console.error('Error: Data file must contain an array of records');
      process.exit(1);
    }

    return rawData;

  } catch (error) {
    console.error(`Error loading data file: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Save processing results
 */
function saveResults(
  result,
  outputDir,
  source,
  command
) {
  try {
    // Ensure output directory exists
    import('node:fs').then(fs => {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
    });

    const timestamp = new Date().toISOString().split('T')[0];
    const baseFilename = `${source}-${command}-${timestamp}`;

    // Save summary report
    const summaryFile = resolve(outputDir, `${baseFilename}-summary.json`);
    const summary = {
      command,
      source,
      timestamp: new Date().toISOString(),
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
      const errorsFile = resolve(outputDir, `${baseFilename}-errors.json`);
      writeFileSync(errorsFile, JSON.stringify(result.errors, null, 2));
      console.info(`Errors saved to: ${errorsFile}`);
    }

    // Save warnings if any
    if (result.warnings.length > 0) {
      const warningsFile = resolve(outputDir, `${baseFilename}-warnings.json`);
      writeFileSync(warningsFile, JSON.stringify(result.warnings, null, 2));
      console.info(`Warnings saved to: ${warningsFile}`);
    }

  } catch (error) {
    console.error(`Error saving results: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Execute import command
 */
async function executeImport(options) {
  const config = loadConfig(options);
  const data = loadDataFile(options.dataFile, config.source);

  console.info(`Starting ${options.command} for ${data.length} records...`);
  const startTime = performance.now();

  const importer = new MassImportLibrary(config);
  const result = await importer.processImport(data);

  const endTime = performance.now();
  const duration = Math.round((endTime - startTime) / 1000);

  // Show results
  console.info(`\n${options.command.toUpperCase()} COMPLETED in ${duration}s`);
  console.info(`Total: ${result.totalRecords} | Success: ${result.successCount} | Failed: ${result.failureCount} | Skipped: ${result.skippedCount}`);
  
  if (result.errors.length > 0) {
    console.error(`${result.errors.length} errors occurred during processing`);
  }
  
  if (result.warnings.length > 0) {
    console.warn(`${result.warnings.length} warnings generated during processing`);
  }

  // Save results
  saveResults(result, options.outputDir, config.source, options.command);

  // Exit with appropriate code
  process.exit(result.failureCount > 0 ? 1 : 0);
}

/**
 * Execute validate command
 */
async function executeValidate(options) {
  if (!options.dataFile) {
    console.error('Error: --data file is required for validation');
    process.exit(1);
  }

  if (!options.source) {
    console.error('Error: --source is required for validation');
    process.exit(1);
  }

  try {
    const data = loadDataFile(options.dataFile, options.source);
    console.info(`✓ Successfully validated ${data.length} records`);
    console.info(`✓ Data format is compatible with source: ${options.source}`);
    
    // Show basic statistics
    const bounds = data.reduce((acc, record) => ({
      north: Math.max(acc.north, record.lat),
      south: Math.min(acc.south, record.lat),
      east: Math.max(acc.east, record.lon),
      west: Math.min(acc.west, record.lon),
    }), { north: -90, south: 90, east: -180, west: 180 });
    
    console.info(`Geographic bounds: N${bounds.north.toFixed(4)} S${bounds.south.toFixed(4)} E${bounds.east.toFixed(4)} W${bounds.west.toFixed(4)}`);
    
    const withPhotos = data.filter(r => r.photoUrls?.length).length;
    const withDescriptions = data.filter(r => r.description).length;
    console.info(`${withPhotos}/${data.length} records have photos, ${withDescriptions}/${data.length} have descriptions`);

    process.exit(0);
  } catch (error) {
    console.error('Validation failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Execute bulk approve command
 */
async function executeBulkApprove(options) {
  if (!options.source) {
    console.error('Error: --source is required for bulk approval');
    process.exit(1);
  }

  if (!options.confirm) {
    console.error('Error: --confirm is required for bulk approval operations');
    console.error('This is a safety measure to prevent accidental bulk approvals.');
    process.exit(1);
  }

  const config = loadConfig(options);
  
  console.info('Fetching pending submissions for bulk approval...');
  
  try {
    // First, get list of pending submissions filtered by source
    const submissionsResponse = await fetch(
      `${config.apiBaseUrl}/api/review/submissions?status=pending&limit=1000`,
      {
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!submissionsResponse.ok) {
      throw new Error(`Failed to fetch submissions: ${submissionsResponse.status} ${submissionsResponse.statusText}`);
    }

    const submissionsData = await submissionsResponse.json();
    let submissions = submissionsData.submissions || [];

    // Filter by source if it's from mass import
    if (options.source) {
      // Look for submissions that have source attribution tags
      submissions = submissions.filter(sub => {
        if (sub.tags && typeof sub.tags === 'object') {
          return sub.tags.source === options.source || 
                 sub.tags.source === `source:${options.source}` ||
                 sub.tags['source:type'] === options.source;
        }
        return false;
      });
    }

    if (submissions.length === 0) {
      console.info(`No pending submissions found for source: ${options.source}`);
      process.exit(0);
    }

    console.info(`Found ${submissions.length} pending submissions for source: ${options.source}`);
    
    // Apply bounds filter if specified
    if (options.bounds) {
      const coords = options.bounds.split(',').map(n => parseFloat(n.trim()));
      if (coords.length !== 4 || coords.some(isNaN)) {
        console.error('Error: --bounds must be "north,south,east,west" coordinates');
        process.exit(1);
      }
      const [north, south, east, west] = coords;
      
      const originalCount = submissions.length;
      submissions = submissions.filter(sub => 
        sub.lat >= south && sub.lat <= north &&
        sub.lon >= west && sub.lon <= east
      );
      
      console.info(`Filtered to ${submissions.length} submissions within bounds (${originalCount - submissions.length} excluded)`);
    }

    if (submissions.length === 0) {
      console.info('No submissions match the specified criteria');
      process.exit(0);
    }

    // Show summary before approval
    console.info('\n=== BULK APPROVAL SUMMARY ===');
    console.info(`Source: ${options.source}`);
    console.info(`Submissions to approve: ${submissions.length}`);
    console.info(`Batch size: ${options.batchSize}`);
    if (options.bounds) {
      console.info(`Geographic bounds: ${options.bounds}`);
    }
    console.info('================================\n');

    // Process in batches
    const results = {
      approved: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < submissions.length; i += options.batchSize) {
      const batch = submissions.slice(i, i + options.batchSize);
      const batchNum = Math.floor(i / options.batchSize) + 1;
      const totalBatches = Math.ceil(submissions.length / options.batchSize);
      
      console.info(`Processing batch ${batchNum}/${totalBatches} (${batch.length} submissions)...`);

      try {
        const batchData = batch.map(sub => ({
          id: sub.id,
          action: 'approve'
        }));

        const response = await fetch(
          `${config.apiBaseUrl}/api/review/batch`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${config.apiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ submissions: batchData }),
          }
        );

        if (!response.ok) {
          throw new Error(`Batch approval failed: ${response.status} ${response.statusText}`);
        }

        const batchResult = await response.json();
        results.approved += batchResult.results.approved;
        results.failed += batchResult.results.errors.length;
        
        if (batchResult.results.errors.length > 0) {
          results.errors.push(...batchResult.results.errors);
        }

        console.info(`  ✓ Approved: ${batchResult.results.approved}, Failed: ${batchResult.results.errors.length}`);

        // Rate limiting delay between batches
        if (i + options.batchSize < submissions.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`  ✗ Batch ${batchNum} failed:`, error instanceof Error ? error.message : String(error));
        results.failed += batch.length;
        results.errors.push({
          batch: batchNum,
          error: error instanceof Error ? error.message : String(error),
          submission_ids: batch.map(s => s.id),
        });
      }
    }

    // Final summary
    console.info('\n=== BULK APPROVAL COMPLETED ===');
    console.info(`Total submissions processed: ${submissions.length}`);
    console.info(`Successfully approved: ${results.approved}`);
    console.info(`Failed: ${results.failed}`);
    
    if (results.errors.length > 0) {
      console.error(`\n${results.errors.length} errors occurred:`);
      results.errors.forEach((error, index) => {
        console.error(`  ${index + 1}. ${error.error || error.message || JSON.stringify(error)}`);
      });
      
      // Save error details
      const timestamp = new Date().toISOString().split('T')[0];
      const errorFile = resolve(options.outputDir, `bulk-approve-errors-${timestamp}.json`);
      
      // Ensure output directory exists
      const fs = await import('node:fs');
      if (!fs.existsSync(options.outputDir)) {
        fs.mkdirSync(options.outputDir, { recursive: true });
      }
      
      writeFileSync(errorFile, JSON.stringify(results.errors, null, 2));
      console.error(`Detailed errors saved to: ${errorFile}`);
    }

    console.info('================================\n');

    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('Bulk approval failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Main CLI entry point
 */
async function main() {
  try {
    const options = parseArguments();

    switch (options.command) {
      case 'help':
        showHelp();
        break;

      case 'import':
      case 'dry-run':
        if (!options.dataFile) {
          console.error(`Error: --data file is required for ${options.command}`);
          process.exit(1);
        }
        await executeImport(options);
        break;

      case 'validate':
        await executeValidate(options);
        break;

      case 'bulk-approve':
        if (!options.config) {
          console.error(`Error: --config file is required for ${options.command}`);
          process.exit(1);
        }
        await executeBulkApprove(options);
        break;

      default:
        console.error(`Error: Unknown command "${options.command}"`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('CLI Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the CLI
main();