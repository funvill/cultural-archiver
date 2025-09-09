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
import { MassImportProcessor } from './processor.js';
import { VancouverMapper } from '../importers/vancouver.js';
import type { MassImportConfig, DryRunReport } from '../types/index.js';

const program = new Command();

// ================================
// CLI Configuration
// ================================

program
  .name('mass-import')
  .description('Cultural Archiver Mass Import System - Import public art data from external sources')
  .version('1.0.0');

// ================================
// Global Options
// ================================

program
  .option('--api-endpoint <url>', 'API endpoint URL', 'https://art-api.abluestar.com')
  .option('--token <token>', 'Mass import user token', '00000000-0000-0000-0000-000000000002')
  .option('--batch-size <number>', 'Batch size for processing', '50')
  .option('--max-retries <number>', 'Maximum retry attempts', '3')
  .option('--retry-delay <number>', 'Delay between retries in ms', '1000')
  .option('--duplicate-radius <number>', 'Duplicate detection radius in meters', '50')
  .option('--similarity-threshold <number>', 'Title similarity threshold (0-1)', '0.8')
  .option('--limit <number>', 'Limit number of records processed (testing / first-record import)')
  .option('--offset <number>', 'Skip first N records before processing (windowing)')
  .option('--new-artwork-report <file>', 'Write list of newly created artwork URLs to file (non-dry-run only)')
  .option('--frontend-base <url>', 'Frontend base URL for artwork links (defaults to https://art.abluestar.com)')
  .option('--config <file>', 'Configuration file path')
  .option('--verbose', 'Enable verbose logging', false);

// ================================
// Import Command
// ================================

program
  .command('import')
  .description('Import public art data from a JSON file')
  .argument('<file>', 'Input JSON file path')
  .option('--source <name>', 'Data source name', 'unknown')
  .option('--dry-run', 'Perform validation only without importing', false)
  .option('--output <file>', 'Output report file path')
  .option('--continue-on-error', 'Continue processing when individual records fail', false)
  .action(async (file, options) => {
    try {
  // Merge global options (defined on root program) with command options so flags
  // like --batch-size propagate correctly. Commander only passes command-local
  // options to the action handler by default.
  const globalOptions = program.opts();
  const mergedOptions = { ...globalOptions, ...options };
  const config = await loadConfig(mergedOptions);
      const processor = new MassImportProcessor(config);

      console.log(chalk.blue('🚀 Starting mass import process...'));
      console.log(chalk.gray(`Source: ${options.source}`));
      console.log(chalk.gray(`File: ${file}`));
      console.log(chalk.gray(`Mode: ${options.dryRun ? 'DRY RUN' : 'IMPORT'}`));

      // Load and parse input file
      const spinner = ora('Loading input file...').start();
      const data = await loadInputFile(file);
      // Apply optional record limit
      let limitedData = data;
      const offset = mergedOptions.offset ? parseInt(mergedOptions.offset, 10) : 0;
      if (!isNaN(offset) && offset > 0) {
        if (offset >= data.length) {
          console.log(chalk.red(`⚠️ Offset ${offset} exceeds dataset length (${data.length}). No records to process.`));
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
          console.log(chalk.yellow(`⚠️ Record limit applied: processing ${limit} records (window ${offset}-${offset + limit - 1})`));
        }
      }
      spinner.succeed(`Loaded ${data.length} records from ${file}`);

      // Process data
  const results = await processor.processData(limitedData, {
        source: options.source,
        dryRun: options.dryRun,
        continueOnError: options.continueOnError,
      });

      // Display results
      displayResults(results);

      // Save newly created artwork URL list if requested
      if (!options.dryRun && mergedOptions.newArtworkReport) {
        await saveNewArtworkReport(results, mergedOptions, 'import');
      }

      // Save report if requested
      if (options.output) {
        await saveReport(results, options.output);
        console.log(chalk.green(`📄 Report saved to ${options.output}`));
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
          console.log(chalk.red(`⚠️ Offset ${offset} exceeds dataset length (${data.length}). No records to validate.`));
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
          console.log(chalk.yellow(`⚠️ Record limit applied: validating ${limit} records (window ${offset}-${offset + limit - 1})`));
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

      // Save report if requested
      if (options.output) {
        await saveReport(results, options.output);
        console.log(chalk.green(`📄 Validation report saved to ${options.output}`));
      }

    } catch (error) {
      console.error(chalk.red('❌ Validation failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ================================
// Vancouver Import Command
// ================================

program
  .command('vancouver')
  .description('Import Vancouver Open Data public art dataset')
  .option('--input <file>', 'Vancouver JSON data file', './public-art.json')
  .option('--dry-run', 'Perform validation only without importing', false)
  .option('--output <file>', 'Output report file path')
  .action(async (options) => {
    try {
  const globalOptions = program.opts();
  const mergedOptions = { ...globalOptions, ...options };
  const config = await loadConfig(mergedOptions);
      const processor = new MassImportProcessor(config);

      console.log(chalk.blue('🏢 Starting Vancouver Open Data import...'));
      console.log(chalk.gray(`Input: ${options.input}`));
      console.log(chalk.gray(`Mode: ${options.dryRun ? 'DRY RUN' : 'IMPORT'}`));

      // Load Vancouver data
      const spinner = ora('Loading Vancouver data...').start();
      const data = await loadInputFile(options.input);
      let limitedData = data;
      const offset = mergedOptions.offset ? parseInt(mergedOptions.offset, 10) : 0;
      if (!isNaN(offset) && offset > 0) {
        if (offset >= data.length) {
          console.log(chalk.red(`⚠️ Offset ${offset} exceeds Vancouver dataset length (${data.length}). No records to process.`));
          limitedData = [];
        } else {
          limitedData = data.slice(offset);
          console.log(chalk.yellow(`⚠️ Offset applied: skipping first ${offset} Vancouver records`));
        }
      }
      if (mergedOptions.limit) {
        const limit = parseInt(mergedOptions.limit, 10);
        if (!isNaN(limit) && limit > 0 && limitedData.length > limit) {
          limitedData = limitedData.slice(0, limit);
          console.log(chalk.yellow(`⚠️ Record limit applied: processing ${limit} Vancouver records (window ${offset}-${offset + limit - 1})`));
        }
      }
      spinner.succeed(`Loaded ${data.length} Vancouver artworks`);

      // Use Vancouver-specific mapper
      processor.setMapper(VancouverMapper);

      // Process Vancouver data
  const results = await processor.processData(limitedData, {
        source: 'vancouver-opendata',
        dryRun: options.dryRun,
        continueOnError: true,
      });

      // Display results
      displayResults(results);

      if (!options.dryRun && mergedOptions.newArtworkReport) {
        await saveNewArtworkReport(results, mergedOptions, 'vancouver');
      }

      // Save report if requested
      if (options.output) {
        await saveReport(results, options.output);
        console.log(chalk.green(`📄 Report saved to ${options.output}`));
      }

    } catch (error) {
      console.error(chalk.red('❌ Vancouver import failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

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
          console.log(chalk.red(`⚠️ Offset ${offset} exceeds dataset length (${data.length}). No records for dry-run.`));
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
          console.log(chalk.yellow(`⚠️ Record limit applied: dry-run on ${limit} records (window ${offset}-${offset + limit - 1})`));
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

      // Save report if requested
      if (options.output) {
        await saveDryRunReport(report, options.output);
        console.log(chalk.green(`📄 Dry run report saved to ${options.output}`));
      }

    } catch (error) {
      console.error(chalk.red('❌ Dry run failed:'), error instanceof Error ? error.message : error);
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
  .action(async (options) => {
    try {
      const globalOptions = program.opts();
      const mergedOptions = { ...globalOptions, ...options };
      const config = await loadConfig(mergedOptions);

      console.log(chalk.blue('🔍 Bulk Approval Process...'));
      console.log(chalk.gray(`API Endpoint: ${config.apiEndpoint}`));
      console.log(chalk.gray(`Mode: ${options.dryRun ? 'DRY RUN' : 'APPROVE'}`));
      
      if (options.source) {
        console.log(chalk.gray(`Source Filter: ${options.source}`));
      }
      if (options.userToken) {
        console.log(chalk.gray(`User Token Filter: ${options.userToken}`));
      }

      // Get pending submissions
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
      const pendingSubmissions = await fetchPendingSubmissions(config, fetchOptions);
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
      const submissionsBySource = pendingSubmissions.reduce((acc, sub) => {
        const source = extractSourceFromTags(sub.tags) || 'unknown';
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

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
        
        const answer = await new Promise<string>((resolve) => {
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
        
        const batchSpinner = ora(`Processing batch ${i + 1}/${batches.length} (${batch.length} items)`).start();
        
        try {
          const batchResult = await processBulkApproval(config, batch);
          batchSpinner.succeed(`Batch ${i + 1}: ${batchResult.approved} approved, ${batchResult.errors.length} errors`);
          
          totalApproved += batchResult.approved;
          totalErrors += batchResult.errors.length;
          
          if (batchResult.errors.length > 0) {
            console.log(chalk.red(`❌ Batch ${i + 1} errors:`));
            batchResult.errors.forEach(error => {
              console.log(chalk.red(`  - Submission ${error.submission_id}: ${error.error}`));
            });
          }
        } catch (error) {
          batchSpinner.fail(`Batch ${i + 1} failed: ${error instanceof Error ? error.message : error}`);
          totalErrors += batch.length;
        }
      }

      // Final summary
      console.log(chalk.blue('\n🎯 Bulk Approval Complete:'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.green(`✅ Successfully approved: ${totalApproved}`));
      console.log(chalk.red(`❌ Errors: ${totalErrors}`));
      console.log(chalk.blue(`📈 Success rate: ${((totalApproved / (totalApproved + totalErrors)) * 100).toFixed(1)}%`));

    } catch (error) {
      console.error(chalk.red('❌ Bulk approval failed:'), error instanceof Error ? error.message : error);
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
  }
): Promise<any[]> {
  const url = new URL('/api/review/queue', config.apiEndpoint);
  url.searchParams.set('status', 'pending');
  url.searchParams.set('limit', String(filters.maxSubmissions || 1000));

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${config.massImportUserToken}`,
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
  submissions: any[]
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
      'Authorization': `Bearer ${config.massImportUserToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(approvalData),
  });

  if (!response.ok) {
    throw new Error(`Bulk approval request failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result;
}

/**
 * Load configuration from options and config file
 */
async function loadConfig(options: any): Promise<MassImportConfig> {
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

  // Override with CLI options
  return {
    apiEndpoint: options.apiEndpoint || config.apiEndpoint || 'https://art-api.abluestar.com',
    massImportUserToken: options.token || config.massImportUserToken || '00000000-0000-0000-0000-000000000002',
    batchSize: parseInt(options.batchSize || config.batchSize || '50'),
    maxRetries: parseInt(options.maxRetries || config.maxRetries || '3'),
    retryDelay: parseInt(options.retryDelay || config.retryDelay || '1000'),
    duplicateDetectionRadius: parseInt(options.duplicateRadius || config.duplicateDetectionRadius || '50'),
    titleSimilarityThreshold: parseFloat(options.similarityThreshold || config.titleSimilarityThreshold || '0.8'),
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
 * Display import results
 */
function displayResults(results: any): void {
  console.log('\n' + chalk.blue('📊 Import Results:'));
  console.log(chalk.green(`✅ Successful: ${results.summary.successfulImports}`));
  console.log(chalk.red(`❌ Failed: ${results.summary.failedImports}`));
  console.log(chalk.yellow(`⚠️ Skipped (duplicates): ${results.summary.skippedDuplicates}`));
  console.log(chalk.blue(`📷 Photos processed: ${results.summary.successfulPhotos}/${results.summary.totalPhotos}`));
}

/**
 * Display validation results
 */
function displayValidationResults(results: any): void {
  console.log('\n' + chalk.blue('🔍 Validation Results:'));
  console.log(chalk.green(`✅ Valid records: ${results.summary.successfulImports}`));
  console.log(chalk.red(`❌ Invalid records: ${results.summary.failedImports}`));
  console.log(chalk.yellow(`⚠️ Potential duplicates: ${results.summary.skippedDuplicates}`));
  console.log(chalk.blue(`📷 Valid photos: ${results.summary.successfulPhotos}/${results.summary.totalPhotos}`));
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
  console.log(chalk.green(`✅ Valid records: ${report.summary.validRecords}/${report.summary.totalRecords}`));
  console.log(chalk.red(`❌ Invalid records: ${report.summary.invalidRecords}`));
  console.log(chalk.yellow(`🔄 Potential duplicates: ${report.summary.duplicateRecords}`));
  console.log(chalk.blue(`📷 Valid photos: ${report.summary.validPhotos}/${report.summary.totalPhotos}`));
  
  if (report.summary.invalidRecords > 0) {
    console.log(chalk.red(`\n🚫 Found ${report.summary.invalidRecords} invalid records that would be skipped`));
  }
  
  if (report.summary.duplicateRecords > 0) {
    console.log(chalk.yellow(`\n⚠️ Found ${report.summary.duplicateRecords} potential duplicates that would be skipped`));
  }
  
  const successRate = ((report.summary.validRecords / report.summary.totalRecords) * 100).toFixed(1);
  console.log(chalk.blue(`\n📈 Success rate: ${successRate}%`));
}

/**
 * Save results report to file
 */
async function saveReport(results: any, filePath: string): Promise<void> {
  const report = {
    timestamp: new Date().toISOString(),
    summary: results.summary,
    batches: results.batches,
  };

  await fs.writeFile(filePath, JSON.stringify(report, null, 2));
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
  const frontendBase: string = (options.frontendBase as string) || 'https://art.abluestar.com';

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
  console.log(chalk.green(`🔗 New artwork URL report written: ${filePath} (${newIds.length} entries)`));
}

// ================================
// Error Handling
// ================================

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('❌ Unhandled Rejection at:'), promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(chalk.red('❌ Uncaught Exception:'), error);
  process.exit(1);
});

// ================================
// Run CLI
// ================================

program.parse();