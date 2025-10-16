#!/usr/bin/env node

/**
 * Mass Import System - CLI Tool
 *
 * Command-line interface for the Cultural Archiver mass import system.
 * Provides commands for importing, validating, and managing public art data.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import { MassImportProcessor, setCancellationState } from './processor.js';
import { loadOSMData, getOSMProcessingStats } from '../importers/osm.js';
import { ImporterRegistry } from '../lib/importer-registry.js';
import type { MassImportConfig, DryRunReport } from '../types/index.js';

const program = new Command();

// ================================
// Global Cancellation Handling
// ================================

let isCancelled = false;
let currentSpinner: ReturnType<typeof ora> | null = null;

const handleCancellation = (signal: string): void => {
  if (isCancelled) {
    // Force exit if already cancelled once
    console.log(chalk.red('\n🛑 Force termination'));
    process.exit(1);
  }

  isCancelled = true;
  setCancellationState(true);

  if (currentSpinner) {
    currentSpinner.fail(chalk.yellow('Operation cancelled'));
    currentSpinner = null;
  }

  console.log(chalk.yellow(`\n⚠️ Received ${signal} signal. Cancelling operation...`));
  console.log(chalk.gray('Press Ctrl+C again to force exit'));

  // Give a brief moment for cleanup then exit
  setTimeout(() => {
    console.log(chalk.blue('👋 Graceful shutdown complete'));
    process.exit(0);
  }, 1000);
};

// Register signal handlers
process.on('SIGINT', () => handleCancellation('SIGINT'));
process.on('SIGTERM', () => handleCancellation('SIGTERM'));

// Export cancellation state for use in processor
export { isCancelled };

// ================================
// CLI Configuration
// ================================

program
  .name('mass-import')
  .description(
    'Cultural Archiver Mass Import System - Import public art data from external sources'
  )
  .version('1.0.0');

// ================================
// Global Options
// ================================

program
  .option('--api-endpoint <url>', 'API endpoint URL', 'https://api.publicartregistry.com')
  .option('--token <token>', 'Mass import user token', 'a0000000-1000-4000-8000-000000000002') // MASS_IMPORT_USER_UUID
  .option('--batch-size <number>', 'Batch size for processing', '50')
  .option('--max-retries <number>', 'Maximum retry attempts', '3')
  .option('--retry-delay <number>', 'Delay between retries in ms', '1000')
  .option('--duplicate-radius <number>', 'Duplicate detection radius in meters', '50')
  .option('--similarity-threshold <number>', 'Title similarity threshold (0-1)', '0.8')
  .option('--limit <number>', 'Limit number of records processed (testing / first-record import)')
  .option('--offset <number>', 'Skip first N records before processing (windowing)')
  .option(
    '--new-artwork-report <file>',
    'Write list of newly created artwork URLs to file (non-dry-run only)'
  )
  .option(
    '--frontend-base <url>',
    'Frontend base URL for artwork links (defaults to https://api.publicartregistry.com)'
  )
  .option('--config <file>', 'Configuration file path')
  .option('--verbose', 'Enable verbose logging', false);

// ================================
// Import Command
// ================================

program
  .command('import')
  .description('Import public art data using specified importer')
  .argument('<file>', 'Input data file path')
  .option(
    '--importer <name>',
    'Data source importer (required). Use "all" to run all importers. Available: ' +
      ImporterRegistry.getAll().join(', ')
  )
  .option('--source <name>', 'Data source name override')
  .option('--dry-run', 'Perform validation only without importing', false)
  .option('--output <file>', 'Output report file path')
  .option(
    '--stop-on-error',
    'Stop processing when batch failures occur (default is to continue)',
    false
  )
  .action(async (file: string, options: any) => {
    try {
      // Validate importer selection
      if (!options.importer) {
        console.error(chalk.red('❌ Error: Importer is required.'));
        console.log(chalk.yellow(ImporterRegistry.getHelpMessage()));
        process.exit(1);
      }

      const importerValidation = ImporterRegistry.validateImporter(options.importer);
      if (!importerValidation.valid) {
        console.error(chalk.red('❌ Error: ' + importerValidation.message));
        if (importerValidation.suggestions) {
          console.log(
            chalk.yellow('💡 Did you mean: ' + importerValidation.suggestions.join(', ') + '?')
          );
        }
        process.exit(1);
      }

      // Merge global options with command options
      const globalOptions = program.opts();
      const mergedOptions = { ...globalOptions, ...options };
      const config = await loadConfig(mergedOptions);

      if (options.importer === 'all') {
        // Run all importers sequentially
        const allImporters = ImporterRegistry.getAll();
        console.log(
          chalk.blue(`🚀 Running all importers sequentially: ${allImporters.join(', ')}`)
        );

        for (const importerName of allImporters) {
          console.log(chalk.cyan(`\n📦 Processing with ${importerName} importer...`));
          await runSingleImporter(importerName, file, mergedOptions, config);
        }
      } else {
        // Run single importer
        await runSingleImporter(options.importer, file, mergedOptions, config);
      }
    } catch (error) {
      console.error(chalk.red('❌ Import failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ================================
// Validate Command
// ================================

program
  .command('validate')
  .description('Validate data format and structure without importing')
  .argument('<file>', 'Input JSON file path')
  .option('--source <name>', 'Data source name', 'unknown')
  .option('--output <file>', 'Output validation report file path')
  .action(async (file, options) => {
    try {
      const globalOptions = program.opts();
      const mergedOptions = { ...globalOptions, ...options };
      const config = await loadConfig(mergedOptions);
      config.dryRun = true; // Force dry-run mode for validation

      const processor = new MassImportProcessor(config);

      console.log(chalk.blue('🔍 Validating data file...'));
      console.log(chalk.gray(`File: ${file}`));

      // Load and parse input file
      const spinner = ora('Loading input file...').start();
      const data = await loadInputFile(file);
      let limitedData = data;
      const offset = mergedOptions.offset ? parseInt(mergedOptions.offset, 10) : 0;
      if (!isNaN(offset) && offset > 0) {
        if (offset >= data.length) {
          console.log(
            chalk.red(
              `⚠️ Offset ${offset} exceeds dataset length (${data.length}). No records to validate.`
            )
          );
          limitedData = [];
        } else {
          limitedData = data.slice(offset);
          console.log(chalk.yellow(`⚠️ Offset applied: skipping first ${offset} records`));
        }
      }
      if (mergedOptions.limit) {
        const limit = parseInt(mergedOptions.limit, 10);
        if (!isNaN(limit) && limit > 0 && limitedData.length > limit) {
          limitedData = limitedData.slice(0, limit);
          console.log(
            chalk.yellow(
              `⚠️ Record limit applied: validating ${limit} records (window ${offset}-${offset + limit - 1})`
            )
          );
        }
      }
      spinner.succeed(`Loaded ${data.length} records from ${file}`);

      // Validate data
      const results = await processor.processData(limitedData, {
        source: options.source,
        dryRun: true,
        continueOnError: true,
      });

      // Display validation results
      displayValidationResults(results);

      // Always save a detailed validation report (auto-generate filename if not specified)
      const reportFile = options.output || `validation-report-${Date.now()}.json`;
      await saveDetailedReport(results, reportFile, 'validation');
      console.log(chalk.green(`📄 Detailed validation report saved to ${reportFile}`));
    } catch (error) {
      console.error(
        chalk.red('❌ Validation failed:'),
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  });

// ================================
// Vancouver Import Command
// ================================

// Legacy Vancouver command removed - use plugin system instead with 'import' command
// program
//   .command('vancouver')
//   ...

// ================================
// Dry Run Command
// ================================

program
  .command('dry-run')
  .description('Perform a dry run validation of import data')
  .argument('<file>', 'Input JSON file path')
  .option('--source <name>', 'Data source name', 'unknown')
  .option('--output <file>', 'Output report file path')
  .action(async (file, options) => {
    try {
      const globalOptions = program.opts();
      const mergedOptions = { ...globalOptions, ...options };
      const config = await loadConfig(mergedOptions);
      config.dryRun = true;

      const processor = new MassImportProcessor(config);

      console.log(chalk.blue('🧪 Performing dry run...'));
      console.log(chalk.gray(`File: ${file}`));

      // Load and process data in dry-run mode
      const spinner = ora('Loading input file...').start();
      const data = await loadInputFile(file);
      let limitedData = data;
      const offset = mergedOptions.offset ? parseInt(mergedOptions.offset, 10) : 0;
      if (!isNaN(offset) && offset > 0) {
        if (offset >= data.length) {
          console.log(
            chalk.red(
              `⚠️ Offset ${offset} exceeds dataset length (${data.length}). No records for dry-run.`
            )
          );
          limitedData = [];
        } else {
          limitedData = data.slice(offset);
          console.log(chalk.yellow(`⚠️ Offset applied: dry-run skipping first ${offset} records`));
        }
      }
      if (mergedOptions.limit) {
        const limit = parseInt(mergedOptions.limit, 10);
        if (!isNaN(limit) && limit > 0 && limitedData.length > limit) {
          limitedData = limitedData.slice(0, limit);
          console.log(
            chalk.yellow(
              `⚠️ Record limit applied: dry-run on ${limit} records (window ${offset}-${offset + limit - 1})`
            )
          );
        }
      }
      spinner.succeed(`Loaded ${data.length} records from ${file}`);

      const results = await processor.processData(limitedData, {
        source: options.source,
        dryRun: true,
        continueOnError: true,
      });

      // Generate dry-run report
      const report = generateDryRunReport(results);
      displayDryRunReport(report);

      // Always save both detailed report and dry-run specific report
      const reportFile = options.output || `dry-run-report-${Date.now()}.json`;
      await saveDetailedReport(results, reportFile, 'dry-run');
      console.log(chalk.green(`📄 Detailed dry-run report saved to ${reportFile}`));

      // Also save the traditional dry-run format if different filename requested
      if (options.output && options.output !== reportFile) {
        await saveDryRunReport(report, options.output);
        console.log(chalk.green(`📄 Traditional dry-run report saved to ${options.output}`));
      }
    } catch (error) {
      console.error(
        chalk.red('❌ Dry run failed:'),
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  });

// ================================
// Bulk Approve Command
// ================================

program
  .command('bulk-approve')
  .description('Bulk approve pending submissions from import sources (admin only)')
  .option('--source <name>', 'Filter by data source name')
  .option('--batch-size <number>', 'Batch size for approval processing', '25')
  .option('--dry-run', 'Show what would be approved without making changes', false)
  .option('--auto-confirm', 'Skip confirmation prompts (use with caution)', false)
  .option('--user-token <token>', 'Filter by user token (e.g., mass-import token)')
  .option('--max-submissions <number>', 'Maximum number of submissions to process')
  .option('--admin-token <token>', 'Administrator token for approval operations (required)')
  .action(async options => {
    try {
      const globalOptions = program.opts();
      const mergedOptions = { ...globalOptions, ...options };
      const config = await loadConfig(mergedOptions);

      // Validate admin token for approval operations
      if (!options.dryRun && !options.adminToken) {
        console.error(chalk.red('❌ Admin token is required for approval operations.'));
        console.error(chalk.yellow('Use --admin-token <token> or --dry-run to preview.'));
        console.error(
          chalk.gray(
            'The mass import token cannot be used for approvals - admin/moderator permissions required.'
          )
        );
        process.exit(1);
      }

      // Use admin token for approval operations, mass import token for fetching
      const approvalToken = options.adminToken || config.massImportUserToken;

      console.log(chalk.blue('🔍 Bulk Approval Process...'));
      console.log(chalk.gray(`API Endpoint: ${config.apiEndpoint}`));
      console.log(chalk.gray(`Mode: ${options.dryRun ? 'DRY RUN' : 'APPROVE'}`));
      console.log(
        chalk.gray(`Token: ${options.dryRun ? 'Mass Import (fetch only)' : 'Admin (approval)'}`)
      );

      if (options.source) {
        console.log(chalk.gray(`Source Filter: ${options.source}`));
      }
      if (options.userToken) {
        console.log(chalk.gray(`User Token Filter: ${options.userToken}`));
      }

      // Get pending submissions (use mass import token for read access)
      const spinner = ora('Fetching pending submissions...').start();
      const fetchOptions: {
        source?: string;
        userToken?: string;
        maxSubmissions?: number;
      } = {
        source: options.source,
        userToken: options.userToken,
      };
      if (options.maxSubmissions) {
        fetchOptions.maxSubmissions = parseInt(options.maxSubmissions, 10);
      }
      const pendingSubmissions = await fetchPendingSubmissions(config, fetchOptions, approvalToken);
      spinner.succeed(`Found ${pendingSubmissions.length} pending submissions`);

      if (pendingSubmissions.length === 0) {
        console.log(chalk.yellow('⚠️ No pending submissions found matching criteria'));
        return;
      }

      // Display summary
      console.log(chalk.blue('\n📊 Approval Summary:'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.green(`✅ Submissions to approve: ${pendingSubmissions.length}`));

      // Group by source for reporting
      const submissionsBySource = pendingSubmissions.reduce(
        (acc, sub) => {
          const source = extractSourceFromTags(sub.tags) || 'unknown';
          acc[source] = (acc[source] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      console.log(chalk.blue('\n📋 By Source:'));
      for (const [source, count] of Object.entries(submissionsBySource)) {
        console.log(chalk.gray(`  ${source}: ${count} submissions`));
      }

      if (options.dryRun) {
        console.log(chalk.yellow('\n🧪 DRY RUN - No changes will be made'));
        return;
      }

      // Confirmation prompt
      if (!options.autoConfirm) {
        console.log(chalk.red('\n⚠️ WARNING: This will approve all matching submissions!'));
        console.log(chalk.yellow('Type "YES" to continue with bulk approval:'));

        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise<string>(resolve => {
          rl.question('', resolve);
        });
        rl.close();

        if (answer !== 'YES') {
          console.log(chalk.yellow('❌ Bulk approval cancelled'));
          return;
        }
      }

      // Process approvals in batches
      const batchSize = parseInt(options.batchSize, 10) || 25;
      const batches = chunkArray(pendingSubmissions, batchSize);

      console.log(chalk.blue(`\n🔄 Processing ${batches.length} batches...`));

      let totalApproved = 0;
      let totalErrors = 0;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        if (!batch) continue;

        const batchSpinner = ora(
          `Processing batch ${i + 1}/${batches.length} (${batch.length} items)`
        ).start();

        try {
          const batchResult = await processBulkApproval(config, batch, approvalToken);
          batchSpinner.succeed(
            `Batch ${i + 1}: ${batchResult.approved} approved, ${batchResult.errors.length} errors`
          );

          totalApproved += batchResult.approved;
          totalErrors += batchResult.errors.length;

          if (batchResult.errors.length > 0) {
            console.log(chalk.red(`❌ Batch ${i + 1} errors:`));
            batchResult.errors.forEach(error => {
              console.log(chalk.red(`  - Submission ${error.submission_id}: ${error.error}`));
            });
          }
        } catch (error) {
          batchSpinner.fail(
            `Batch ${i + 1} failed: ${error instanceof Error ? error.message : error}`
          );
          totalErrors += batch.length;
        }
      }

      // Final summary
      console.log(chalk.blue('\n🎯 Bulk Approval Complete:'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.green(`✅ Successfully approved: ${totalApproved}`));
      console.log(chalk.red(`❌ Errors: ${totalErrors}`));
      console.log(
        chalk.blue(
          `📈 Success rate: ${((totalApproved / (totalApproved + totalErrors)) * 100).toFixed(1)}%`
        )
      );
    } catch (error) {
      console.error(
        chalk.red('❌ Bulk approval failed:'),
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Check system status and configuration health')
  .option('--config-only', 'Only check configuration, skip API connectivity')
  .action(async options => {
    try {
      const globalOptions = program.opts();
      const mergedOptions = { ...globalOptions, ...options };
      const config = await loadConfig(mergedOptions);

      console.log(chalk.blue('🔍 Mass Import System Status'));
      console.log(chalk.gray('═'.repeat(60)));

      // Configuration check
      console.log(chalk.blue('\n📋 Configuration:'));
      console.log(chalk.green('✅ Configuration loaded successfully'));
      console.log(chalk.gray(`   API Endpoint: ${config.apiEndpoint}`));
      console.log(
        chalk.gray(
          `   User Token: ${config.massImportUserToken ? config.massImportUserToken.substring(0, 8) + '...' : 'Not set'}`
        )
      );
      console.log(chalk.gray(`   Batch Size: ${config.batchSize}`));
      console.log(chalk.gray(`   Max Retries: ${config.maxRetries}`));
      console.log(chalk.gray(`   Retry Delay: ${config.retryDelay}ms`));
      console.log(chalk.gray(`   Duplicate Detection Radius: ${config.duplicateDetectionRadius}m`));
      console.log(chalk.gray(`   Title Similarity Threshold: ${config.titleSimilarityThreshold}`));

      if (options.configOnly) {
        console.log(chalk.yellow('\n⚠️ Skipping API connectivity check (--config-only)'));
        return;
      }

      // API connectivity check
      console.log(chalk.blue('\n🌐 API Connectivity:'));
      const connectivitySpinner = ora('Testing API connection...').start();

      try {
        // Simple health check - try to access API endpoint
        const response = await fetch(`${config.apiEndpoint}/health`, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mass-Import-CLI/1.0.0',
          },
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });

        if (response.ok) {
          connectivitySpinner.succeed('API endpoint is accessible');
        } else {
          connectivitySpinner.warn(`API endpoint responded with status: ${response.status}`);
        }
      } catch (error) {
        connectivitySpinner.fail(
          `API endpoint is not accessible: ${error instanceof Error ? error.message : error}`
        );
      }

      // Library status
      console.log(chalk.blue('\n📦 Library Status:'));
      console.log(chalk.green('✅ Mass Import library loaded'));
      console.log(chalk.gray(`   Version: 1.0.0`));
      console.log(chalk.gray(`   Supported sources: vancouver-opendata, generic`));

      // Environment checks
      console.log(chalk.blue('\n🔧 Environment:'));
      console.log(chalk.gray(`   Node.js: ${process.version}`));
      console.log(chalk.gray(`   Platform: ${process.platform}`));
      console.log(chalk.gray(`   Architecture: ${process.arch}`));

      // Configuration validation
      console.log(chalk.blue('\n✅ Configuration Validation:'));
      const validationResults = [];

      if (
        !config.massImportUserToken ||
        config.massImportUserToken === 'a0000000-1000-4000-8000-000000000002'
      ) {
        // MASS_IMPORT_USER_UUID
        validationResults.push(
          chalk.yellow('⚠️ Using default mass import user token - consider setting custom token')
        );
      } else {
        validationResults.push(chalk.green('✅ Custom user token configured'));
      }

      if (config.batchSize > 100) {
        validationResults.push(chalk.yellow('⚠️ Large batch size may cause performance issues'));
      } else if (config.batchSize < 5) {
        validationResults.push(chalk.yellow('⚠️ Very small batch size may be inefficient'));
      } else {
        validationResults.push(chalk.green('✅ Batch size is appropriate'));
      }

      if (config.duplicateDetectionRadius > 500) {
        validationResults.push(
          chalk.yellow('⚠️ Large duplicate detection radius may cause false positives')
        );
      } else {
        validationResults.push(chalk.green('✅ Duplicate detection radius is reasonable'));
      }

      validationResults.forEach(result => console.log(result));

      console.log(chalk.blue('\n🎯 System Status: Ready for import operations'));
    } catch (error) {
      console.error(
        chalk.red('❌ Status check failed:'),
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  });

// ================================
// Helper Functions
// ================================

/**
 * Chunk array into smaller arrays of specified size
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Extract source from tags JSON string
 */
function extractSourceFromTags(tagsJson: string | null): string | null {
  if (!tagsJson) return null;
  try {
    const tags = JSON.parse(tagsJson);
    return tags.source || tags['data-source'] || null;
  } catch {
    return null;
  }
}

/**
 * Fetch pending submissions with filtering
 */
async function fetchPendingSubmissions(
  config: MassImportConfig,
  filters: {
    source?: string;
    userToken?: string;
    maxSubmissions?: number;
  },
  adminToken: string
): Promise<any[]> {
  const url = new URL('/api/review/queue', config.apiEndpoint);
  url.searchParams.set('status', 'pending');
  url.searchParams.set('limit', String(filters.maxSubmissions || 1000));

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch pending submissions: ${response.statusText}`);
  }

  const data = await response.json();
  let submissions = data.submissions || [];

  // Apply filters
  if (filters.source) {
    submissions = submissions.filter((sub: any) => {
      const source = extractSourceFromTags(sub.tags);
      return source === filters.source;
    });
  }

  if (filters.userToken) {
    submissions = submissions.filter((sub: any) => sub.user_token === filters.userToken);
  }

  return submissions;
}

/**
 * Process bulk approval via API
 */
async function processBulkApproval(
  config: MassImportConfig,
  submissions: any[],
  adminToken: string
): Promise<{
  approved: number;
  rejected: number;
  errors: Array<{ submission_id: string; error: string }>;
}> {
  const approvalData = {
    submissions: submissions.map(sub => ({
      id: sub.id,
      action: 'approve',
    })),
  };

  const response = await fetch(`${config.apiEndpoint}/api/review/batch`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(approvalData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Bulk approval request failed: ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();

  // Ensure the result has the expected structure
  return {
    approved: result.results?.approved || 0,
    rejected: result.results?.rejected || 0,
    errors: Array.isArray(result.results?.errors) ? result.results.errors : [],
  };
}

/**
 * Run import process with a single importer
 */
async function runSingleImporter(
  importerName: string,
  file: string,
  options: any,
  _baseConfig: MassImportConfig
): Promise<void> {
  const importer = ImporterRegistry.get(importerName);
  if (!importer) {
    throw new Error(`Importer '${importerName}' not found`);
  }

  // Reload config with importer-specific settings
  const config = await loadConfig(options, importerName);

  // Set dry-run mode based on options
  config.dryRun = options.dryRun || false;

  const processor = new MassImportProcessor(config);

  console.log(chalk.blue(`🚀 Starting ${importerName} import process...`));
  console.log(chalk.gray(`Importer: ${importer.description}`));
  console.log(chalk.gray(`File: ${file}`));
  console.log(chalk.gray(`Mode: ${options.dryRun ? 'DRY RUN' : 'IMPORT'}`));

  // Set the mapper for this importer
  processor.setMapper(importer.mapper);

  // Load and parse input file based on importer type
  const spinner = ora('Loading input file...').start();
  let data: any[];

  if (importerName === 'osm') {
    // Use OSM-specific data loading
    data = loadOSMData(file);

    // Display OSM-specific statistics
    const stats = getOSMProcessingStats(data);
    console.log(chalk.cyan('\n📊 OSM Dataset Statistics:'));
    for (const [key, value] of Object.entries(stats)) {
      console.log(chalk.gray(`  ${key}: ${value}`));
    }
  } else {
    // Use generic data loading
    data = await loadInputFile(file);
  }

  // Apply optional record limit
  let limitedData = data;
  const offset = options.offset ? parseInt(options.offset, 10) : 0;
  if (!isNaN(offset) && offset > 0) {
    if (offset >= data.length) {
      console.log(
        chalk.red(
          `⚠️ Offset ${offset} exceeds dataset length (${data.length}). No records to process.`
        )
      );
      limitedData = [];
    } else {
      limitedData = data.slice(offset);
      console.log(chalk.yellow(`⚠️ Offset applied: skipping first ${offset} records`));
    }
  }
  if (options.limit) {
    const limit = parseInt(options.limit, 10);
    if (!isNaN(limit) && limit > 0 && limitedData.length > limit) {
      limitedData = limitedData.slice(0, limit);
      console.log(
        chalk.yellow(
          `⚠️ Record limit applied: processing ${limit} records (window ${offset}-${offset + limit - 1})`
        )
      );
    }
  }
  spinner.succeed(`Loaded ${data.length} records from ${file}`);

  // Process data
  const results = await processor.processData(limitedData, {
    source: options.source || importerName,
    dryRun: options.dryRun,
    continueOnError: !options.stopOnError, // Default to true, unless --stop-on-error is set
  });

  // Display results
  displayResults(results);

  // Always save a detailed report (auto-generate filename if not specified)
  const reportFile = options.output || `${importerName}-report-${Date.now()}.json`;
  await saveDetailedReport(results, reportFile, options.dryRun ? 'validation' : 'import', {
    importerName,
    inputFile: file,
    options: options,
    config,
    totalAvailableRecords: data.length,
  });
  console.log(chalk.green(`📄 Detailed ${importerName} report saved to ${reportFile}`));

  // Save newly created artwork URL list if requested
  if (!options.dryRun && options.newArtworkReport) {
    await saveNewArtworkReport(results, options, importerName);
  }
}

/**
 * Load configuration from options and config file
 */
async function loadConfig(options: any, importerName?: string): Promise<MassImportConfig> {
  let config: Partial<MassImportConfig> = {};

  // Load from config file if specified
  if (options.config) {
    try {
      const configFile = await fs.readFile(options.config, 'utf-8');
      config = JSON.parse(configFile);
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to load config file ${options.config}: ${error}`));
    }
  }

  // Load importer-specific configuration
  if (importerName === 'osm') {
    try {
      // Import the OSM config loader
      const { loadOSMConfig } = await import('../importers/osm.js');
      const osmConfig = loadOSMConfig();

      // Use OSM-specific settings if not overridden
      if (!config.duplicateDetectionRadius && osmConfig.defaultConfig.duplicateDetectionRadius) {
        config.duplicateDetectionRadius = osmConfig.defaultConfig.duplicateDetectionRadius;
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to load OSM config: ${error}`));
    }
  }

  // Override with CLI options
  return {
    apiEndpoint: options.apiEndpoint || config.apiEndpoint || 'https://api.publicartregistry.com',
    massImportUserToken:
      options.token || config.massImportUserToken || 'a0000000-1000-4000-8000-000000000002', // MASS_IMPORT_USER_UUID
    batchSize: parseInt(options.batchSize || config.batchSize || '50'),
    maxRetries: parseInt(options.maxRetries || config.maxRetries || '3'),
    retryDelay: parseInt(options.retryDelay || config.retryDelay || '1000'),
    duplicateDetectionRadius: parseInt(
      options.duplicateRadius || config.duplicateDetectionRadius || '50'
    ),
    titleSimilarityThreshold: parseFloat(
      options.similarityThreshold || config.titleSimilarityThreshold || '0.8'
    ),
    dryRun: false, // Will be set by individual commands
  };
}

/**
 * Load and parse input file
 */
async function loadInputFile(filePath: string): Promise<any[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    if (!Array.isArray(data)) {
      throw new Error('Input file must contain an array of records');
    }

    return data;
  } catch (error) {
    if (error instanceof Error && error.message.includes('ENOENT')) {
      throw new Error(`Input file not found: ${filePath}`);
    }
    throw error;
  }
}

/**
 * Display import results with detailed breakdown
 */
function displayResults(results: any): void {
  console.log('\n' + chalk.blue('📊 Import Results:'));
  console.log(chalk.green(`✅ Successful: ${results.summary.successfulImports}`));
  console.log(chalk.red(`❌ Failed: ${results.summary.failedImports}`));
  console.log(chalk.yellow(`⚠️ Skipped (duplicates): ${results.summary.skippedDuplicates}`));
  console.log(
    chalk.blue(
      `📷 Photos processed: ${results.summary.successfulPhotos}/${results.summary.totalPhotos}`
    )
  );

  // Show success rate
  const successRate = (
    (results.summary.successfulImports / results.summary.totalRecords) *
    100
  ).toFixed(1);
  console.log(chalk.blue(`📈 Success rate: ${successRate}%`));

  // Show first few created artworks
  let createdCount = 0;
  let failedCount = 0;

  for (const batch of results.batches || []) {
    for (const result of batch.results || []) {
      if (result.success && createdCount < 3) {
        if (createdCount === 0) {
          console.log(chalk.green('\n🎨 Sample Created Artworks:'));
        }
        createdCount++;
        console.log(
          chalk.green(
            `  ✅ "${result.title || 'Unknown'}" (ID: ${result.submissionId || result.id})`
          )
        );
        if (result.externalId) {
          console.log(chalk.gray(`     External ID: ${result.externalId}`));
        }
      } else if (!result.success && !result.duplicateDetection?.isDuplicate && failedCount < 3) {
        if (failedCount === 0) {
          console.log(chalk.red('\n❌ Sample Failed Records:'));
        }
        failedCount++;
        console.log(
          chalk.red(`  ❌ "${result.title || 'Unknown'}": ${result.error || 'Unknown error'}`)
        );
        if (result.externalId) {
          console.log(chalk.gray(`     External ID: ${result.externalId}`));
        }
      }
    }
  }

  if (results.summary.successfulImports > 3) {
    console.log(
      chalk.green(`  ... and ${results.summary.successfulImports - 3} more successful imports`)
    );
  }

  if (results.summary.failedImports > 3) {
    console.log(chalk.red(`  ... and ${results.summary.failedImports - 3} more failed imports`));
  }

  if (results.summary.skippedDuplicates > 0) {
    console.log(
      chalk.yellow(
        `\n⚠️ ${results.summary.skippedDuplicates} records skipped as potential duplicates`
      )
    );
  }
}

/**
 * Display validation results
 */
function displayValidationResults(results: any): void {
  console.log('\n' + chalk.blue('🔍 Validation Results:'));
  console.log(chalk.green(`✅ Valid records: ${results.summary.successfulImports}`));
  console.log(chalk.red(`❌ Invalid records: ${results.summary.failedImports}`));
  console.log(chalk.yellow(`⚠️ Potential duplicates: ${results.summary.skippedDuplicates}`));
  console.log(
    chalk.blue(
      `📷 Valid photos: ${results.summary.successfulPhotos}/${results.summary.totalPhotos}`
    )
  );
}

/**
 * Generate dry-run report
 */
function generateDryRunReport(results: any): DryRunReport {
  // Convert processor results to dry-run report format
  return {
    summary: {
      totalRecords: results.summary.totalRecords,
      validRecords: results.summary.successfulImports,
      invalidRecords: results.summary.failedImports,
      duplicateRecords: results.summary.skippedDuplicates,
      totalPhotos: results.summary.totalPhotos,
      validPhotos: results.summary.successfulPhotos,
      invalidPhotos: results.summary.totalPhotos - results.summary.successfulPhotos,
    },
    errors: [],
    duplicates: [],
    photosIssues: [],
  };
}

/**
 * Display dry-run report
 */
function displayDryRunReport(report: DryRunReport): void {
  console.log('\n' + chalk.blue('🧪 Dry Run Report:'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(
    chalk.green(`✅ Valid records: ${report.summary.validRecords}/${report.summary.totalRecords}`)
  );
  console.log(chalk.red(`❌ Invalid records: ${report.summary.invalidRecords}`));
  console.log(chalk.yellow(`🔄 Potential duplicates: ${report.summary.duplicateRecords}`));
  console.log(
    chalk.blue(`📷 Valid photos: ${report.summary.validPhotos}/${report.summary.totalPhotos}`)
  );

  if (report.summary.invalidRecords > 0) {
    console.log(
      chalk.red(`\n🚫 Found ${report.summary.invalidRecords} invalid records that would be skipped`)
    );
  }

  if (report.summary.duplicateRecords > 0) {
    console.log(
      chalk.yellow(
        `\n⚠️ Found ${report.summary.duplicateRecords} potential duplicates that would be skipped`
      )
    );
  }

  const successRate = ((report.summary.validRecords / report.summary.totalRecords) * 100).toFixed(
    1
  );
  console.log(chalk.blue(`\n📈 Success rate: ${successRate}%`));
}

/**
 * Save detailed results report to file
 */
async function saveDetailedReport(
  results: any,
  filePath: string,
  mode: string,
  auditInfo?: {
    importerName: string;
    inputFile: string;
    options: any;
    config: any;
    totalAvailableRecords: number;
  }
): Promise<void> {
  const timestamp = new Date().toISOString();

  // Extract successful artworks with details
  const createdArtworks: Array<{
    ExternalID: string;
    submissionId?: string;
    title?: string;
    url?: string;
    location?: { lat: number; lon: number };
    tags?: Record<string, any>;
    externalId?: string;
  }> = [];

  // Extract failed records with detailed reasons
  const failedRecords: Array<{
    id: string;
    title?: string;
    error: string;
    location?: { lat: number; lon: number };
    externalId?: string;
    duplicateCandidates?: any[];
  }> = [];

  // Extract duplicate records
  const duplicateRecords: Array<{
    id: string;
    title?: string;
    reason: string;
    candidates: any[];
    location?: { lat: number; lon: number };
    externalId?: string;
  }> = [];

  // Process each batch to extract detailed information
  for (const batch of results.batches || []) {
    for (const result of batch.results || []) {
      if (result.success) {
        const baseUrl = 'https://api.publicartregistry.com';
        // Only generate URL for actual artwork IDs (submissionId), not for dry-run external IDs
        const artworkUrl = result.submissionId
          ? `${baseUrl}/artwork/${result.submissionId}`
          : undefined;

        createdArtworks.push({
          ExternalID: result.id, // Always use the external ID here (OSM node ID)
          submissionId: result.submissionId,
          title: result.title || 'Unknown Title',
          ...(artworkUrl && { url: artworkUrl }),
          location: result.location,
          tags: result.tags,
          externalId: result.externalId,
        });
      } else if (result.duplicateDetection?.isDuplicate) {
        duplicateRecords.push({
          id: result.id,
          title: result.title || 'Unknown Title',
          reason: result.duplicateDetection.bestMatch?.reason || 'Duplicate detected',
          candidates: result.duplicateDetection.candidates || [],
          location: result.location,
          externalId: result.externalId,
        });
      } else {
        failedRecords.push({
          id: result.id,
          title: result.title || 'Unknown Title',
          error: result.error || 'Unknown error',
          location: result.location,
          externalId: result.externalId,
          duplicateCandidates: result.duplicateDetection?.candidates,
        });
      }
    }
  }

  const detailedReport = {
    metadata: {
      timestamp,
      mode,
      sessionId: results.sessionId,
      startTime: results.startTime,
      endTime: results.endTime,
    },
    parameters: auditInfo
      ? {
          importer: auditInfo.importerName,
          inputFile: auditInfo.inputFile,
          totalAvailableRecords: auditInfo.totalAvailableRecords,
          configuration: {
            // CLI options (excluding sensitive data)
            dryRun: auditInfo.options.dryRun,
            batchSize: auditInfo.options.batchSize,
            limit: auditInfo.options.limit,
            offset: auditInfo.options.offset,
            stopOnError: auditInfo.options.stopOnError,
            source: auditInfo.options.source,
            verbose: auditInfo.options.verbose,
            // Config settings (excluding sensitive data)
            apiEndpoint: auditInfo.config.apiEndpoint,
            duplicateDetectionRadius: auditInfo.config.duplicateDetectionRadius,
            titleSimilarityThreshold: auditInfo.config.titleSimilarityThreshold,
            maxRetries: auditInfo.config.maxRetries,
            retryDelay: auditInfo.config.retryDelay,
          },
        }
      : null,
    summary: {
      ...results.summary,
      successRate:
        ((results.summary.successfulImports / results.summary.totalRecords) * 100).toFixed(1) + '%',
      processingTime:
        results.endTime && results.startTime
          ? `${((new Date(results.endTime).getTime() - new Date(results.startTime).getTime()) / 1000 / 60).toFixed(1)} minutes`
          : 'Unknown',
    },
    created_artworks: createdArtworks,
    failed_records: failedRecords,
    duplicate_records: duplicateRecords,
    raw_batches: results.batches, // Include raw batch data for debugging
  };

  await fs.writeFile(filePath, JSON.stringify(detailedReport, null, 2));
}

/**
 * Save dry-run report to file
 */
async function saveDryRunReport(report: DryRunReport, filePath: string): Promise<void> {
  const fullReport = {
    timestamp: new Date().toISOString(),
    type: 'dry-run',
    ...report,
  };

  await fs.writeFile(filePath, JSON.stringify(fullReport, null, 2));
}

/**
 * Save list of newly created artwork URLs
 */
async function saveNewArtworkReport(results: any, options: any, mode: string): Promise<void> {
  const filePath = options.newArtworkReport as string;
  const frontendBase: string = (options.frontendBase as string) || 'https://api.publicartregistry.com';

  // Collect submission IDs from successful import results
  const newIds: string[] = [];
  for (const batch of results.batches || []) {
    for (const r of batch.results) {
      if (r.success && r.submissionId) {
        newIds.push(r.submissionId);
      }
    }
  }

  if (newIds.length === 0) {
    await fs.writeFile(filePath, '# No new artwork submissions created\n');
    console.log(chalk.yellow(`⚠️ No new artwork URLs to write (${mode})`));
    return;
  }

  // Build URL list (frontend uses /artwork/:id)
  const lines = [
    '# Newly Created Artwork URLs',
    `# Mode: ${mode}`,
    `# Generated: ${new Date().toISOString()}`,
    ...newIds.map(id => `${frontendBase.replace(/\/$/, '')}/artwork/${id}`),
    '',
  ];

  await fs.writeFile(filePath, lines.join('\n'));
  console.log(
    chalk.green(`🔗 New artwork URL report written: ${filePath} (${newIds.length} entries)`)
  );
}

// ================================
// Error Handling
// ================================

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('❌ Unhandled Rejection at:'), promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', error => {
  console.error(chalk.red('❌ Uncaught Exception:'), error);
  process.exit(1);
});

// ================================
// Run CLI
// ================================

program.parse(process.argv);
