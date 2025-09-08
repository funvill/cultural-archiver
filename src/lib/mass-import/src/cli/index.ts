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
import { MassImportProcessor } from './processor';
import { VancouverMapper } from '../importers/vancouver';
import type { MassImportConfig, DryRunReport } from '../types';

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
      const config = await loadConfig(options);
      const processor = new MassImportProcessor(config);

      console.log(chalk.blue('🚀 Starting mass import process...'));
      console.log(chalk.gray(`Source: ${options.source}`));
      console.log(chalk.gray(`File: ${file}`));
      console.log(chalk.gray(`Mode: ${options.dryRun ? 'DRY RUN' : 'IMPORT'}`));

      // Load and parse input file
      const spinner = ora('Loading input file...').start();
      const data = await loadInputFile(file);
      spinner.succeed(`Loaded ${data.length} records from ${file}`);

      // Process data
      const results = await processor.processData(data, {
        source: options.source,
        dryRun: options.dryRun,
        continueOnError: options.continueOnError,
      });

      // Display results
      displayResults(results);

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
      const config = await loadConfig(options);
      config.dryRun = true; // Force dry-run mode for validation
      
      const processor = new MassImportProcessor(config);

      console.log(chalk.blue('🔍 Validating data file...'));
      console.log(chalk.gray(`File: ${file}`));

      // Load and parse input file
      const spinner = ora('Loading input file...').start();
      const data = await loadInputFile(file);
      spinner.succeed(`Loaded ${data.length} records from ${file}`);

      // Validate data
      const results = await processor.processData(data, {
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
      const config = await loadConfig(options);
      const processor = new MassImportProcessor(config);

      console.log(chalk.blue('🏢 Starting Vancouver Open Data import...'));
      console.log(chalk.gray(`Input: ${options.input}`));
      console.log(chalk.gray(`Mode: ${options.dryRun ? 'DRY RUN' : 'IMPORT'}`));

      // Load Vancouver data
      const spinner = ora('Loading Vancouver data...').start();
      const data = await loadInputFile(options.input);
      spinner.succeed(`Loaded ${data.length} Vancouver artworks`);

      // Use Vancouver-specific mapper
      processor.setMapper(VancouverMapper);

      // Process Vancouver data
      const results = await processor.processData(data, {
        source: 'vancouver-opendata',
        dryRun: options.dryRun,
        continueOnError: true,
      });

      // Display results
      displayResults(results);

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
      const config = await loadConfig(options);
      config.dryRun = true;
      
      const processor = new MassImportProcessor(config);

      console.log(chalk.blue('🧪 Performing dry run...'));
      console.log(chalk.gray(`File: ${file}`));

      // Load and process data in dry-run mode
      const spinner = ora('Loading input file...').start();
      const data = await loadInputFile(file);
      spinner.succeed(`Loaded ${data.length} records from ${file}`);

      const results = await processor.processData(data, {
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
// Helper Functions
// ================================

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