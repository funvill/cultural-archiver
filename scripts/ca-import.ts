#!/usr/bin/env node
/**
 * Cultural Archiver Mass Import CLI Tool
 * 
 * Command-line interface for importing artwork data from external sources
 * with duplicate detection, structured tagging, and bulk approval workflows.
 * 
 * Usage:
 *   ca-import --source vancouver-public-art --config ./config.json --dry-run
 *   ca-import --source vancouver-public-art --config ./config.json
 *   ca-import approve --source vancouver-public-art --all --confirm
 *   ca-import retry-photos --source vancouver-public-art
 */

import * as fs from 'fs';
import * as path from 'path';
import { program } from 'commander';
import chalk from 'chalk';
import * as ora from 'ora';
import * as inquirer from 'inquirer';

import { MassImportLibrary } from '../lib/mass-import';
import { 
  MassImportConfig, 
  ImportContext, 
  ImportProgress,
  ImportError,
  MassImportResults,
  BulkApprovalConfig,
  MASS_IMPORT_CONSTANTS 
} from '../../shared/mass-import';

// CLI-specific interfaces
interface ImportOptions {
  source?: string;
  config?: string;
  dryRun?: boolean;
  verbose?: boolean;
  all?: boolean;
  confirm?: boolean;
}

/**
 * CLI Application Class
 */
class MassImportCLI {
  private library: MassImportLibrary;
  private spinner: unknown;
  private verbose: boolean = false;

  constructor() {
    this.library = new MassImportLibrary({
      apiBaseUrl: process.env.API_BASE_URL || 'https://art-api.abluestar.com'
    });
  }

  /**
   * Main CLI entry point
   */
  async run(): Promise<void> {
    program
      .name('ca-import')
      .description('Cultural Archiver Mass Import Tool')
      .version('1.0.0');

    // Main import command
    program
      .option('-s, --source <source>', 'Data source identifier')
      .option('-c, --config <path>', 'Configuration file path')
      .option('-d, --dry-run', 'Execute dry run without making changes')
      .option('-v, --verbose', 'Enable verbose logging')
      .option('-o, --output <path>', 'Output directory for reports', './import-reports')
      .action(this.executeImport.bind(this));

    // Approval subcommand
    program
      .command('approve')
      .description('Bulk approve imported artworks')
      .requiredOption('-s, --source <source>', 'Data source to approve')
      .option('--all', 'Approve all records from source')
      .option('--confirm', 'Skip confirmation prompt')
      .option('--batch-size <size>', 'Batch size for approval', '100')
      .action(this.executeBulkApproval.bind(this));

    // Photo retry subcommand  
    program
      .command('retry-photos')
      .description('Retry failed photo downloads from previous import')
      .requiredOption('-s, --source <source>', 'Data source identifier')
      .requiredOption('-i, --import-id <id>', 'Import session ID')
      .action(this.executePhotoRetry.bind(this));

    // Validate config subcommand
    program
      .command('validate')
      .description('Validate import configuration')
      .requiredOption('-c, --config <path>', 'Configuration file path')
      .action(this.validateConfiguration.bind(this));

    await program.parseAsync();
  }

  /**
   * Execute import operation
   */
  private async executeImport(options: ImportOptions): Promise<void> {
    try {
      this.verbose = options.verbose;

      // Validate required options
      if (!options.source) {
        this.error('Source identifier is required. Use --source <source>');
        return;
      }

      if (!options.config) {
        this.error('Configuration file is required. Use --config <path>');
        return;
      }

      // Load configuration
      const config = await this.loadConfiguration(options.config);
      const data = await this.loadDataFile(config.data_file);

      // Validate API token
      const apiToken = process.env.MASS_IMPORT_TOKEN;
      if (!apiToken) {
        this.error('MASS_IMPORT_TOKEN environment variable is required');
        return;
      }

      // Create import context
      const context: ImportContext = {
        config,
        api_token: apiToken,
        api_base_url: process.env.API_BASE_URL || 'https://art-api.abluestar.com',
        import_id: this.generateImportId(options.source),
        dry_run: !!options.dryRun,
        onProgress: this.handleProgress.bind(this),
        onError: this.handleError.bind(this)
      };

      this.log(chalk.blue(`Starting ${options.dryRun ? 'dry run' : 'import'} for source: ${options.source}`));
      this.log(chalk.gray(`Records to process: ${data.length}`));
      this.log(chalk.gray(`Import ID: ${context.import_id}`));

      // Execute import
      let results: MassImportResults;

      if (options.dryRun) {
        this.spinner = ora('Executing dry run validation...').start();
        results = await this.library.dryRun(data, context);
      } else {
        // Confirm actual import
        const confirmImport = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceed',
            message: `Proceed with importing ${data.length} records?`,
            default: false
          }
        ]);

        if (!confirmImport.proceed) {
          this.log(chalk.yellow('Import cancelled by user'));
          return;
        }

        this.spinner = ora('Executing import...').start();
        results = await this.library.processImport(data, context);
      }

      this.spinner.succeed(`${options.dryRun ? 'Dry run' : 'Import'} completed successfully`);

      // Display results
      await this.displayResults(results, options.output);
      
      // Save detailed reports
      await this.saveReports(results, options.output);

    } catch (error) {
      if (this.spinner) {
        this.spinner.fail('Import failed');
      }
      this.error(error instanceof Error ? error.message : 'Unknown error occurred');
      process.exit(1);
    }
  }

  /**
   * Execute bulk approval
   */
  private async executeBulkApproval(options: ImportOptions): Promise<void> {
    try {
      this.verbose = options.verbose;

      const apiToken = process.env.MASS_IMPORT_TOKEN;
      if (!apiToken) {
        this.error('MASS_IMPORT_TOKEN environment variable is required');
        return;
      }

      if (!options.confirm) {
        const confirmApproval = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceed',
            message: `Are you sure you want to bulk approve all records from source '${options.source}'? This action cannot be easily undone.`,
            default: false
          }
        ]);

        if (!confirmApproval.proceed) {
          this.log(chalk.yellow('Bulk approval cancelled by user'));
          return;
        }
      }

      const bulkConfig: BulkApprovalConfig = {
        source: options.source,
        batch_size: parseInt(options.batchSize) || 100,
        confirm: true
      };

      const context: ImportContext = {
        config: {} as MassImportConfig, // Not needed for approval
        api_token: apiToken,
        api_base_url: process.env.API_BASE_URL || 'https://art-api.abluestar.com',
        import_id: '',
        dry_run: false
      };

      this.spinner = ora(`Bulk approving records from source: ${options.source}`).start();
      
      const results = await this.library.bulkApprove(bulkConfig, context);
      
      this.spinner.succeed('Bulk approval completed');
      
      this.log(chalk.green(`Approved: ${results.approved_count} records`));
      if (results.failed_count > 0) {
        this.log(chalk.red(`Failed: ${results.failed_count} records`));
      }
      
      this.log(chalk.gray(`Rollback ID: ${results.rollback_info.rollback_id}`));
      this.log(chalk.gray(`Rollback expires: ${results.rollback_info.expires_at}`));

    } catch (error) {
      if (this.spinner) {
        this.spinner.fail('Bulk approval failed');
      }
      this.error(error instanceof Error ? error.message : 'Unknown error occurred');
      process.exit(1);
    }
  }

  /**
   * Execute photo retry
   */
  private async executePhotoRetry(_options: ImportOptions): Promise<void> {
    this.error('Photo retry functionality not yet implemented');
  }

  /**
   * Validate configuration file
   */
  private async validateConfiguration(options: ImportOptions): Promise<void> {
    try {
      const config = await this.loadConfiguration(options.config);
      const validation = await this.library.validateConfig(config);

      if (validation.valid) {
        this.log(chalk.green('✓ Configuration is valid'));
      } else {
        this.log(chalk.red('✗ Configuration has errors:'));
        validation.errors.forEach(error => {
          this.log(chalk.red(`  • ${error}`));
        });
      }

      if (validation.warnings.length > 0) {
        this.log(chalk.yellow('Warnings:'));
        validation.warnings.forEach(warning => {
          this.log(chalk.yellow(`  • ${warning}`));
        });
      }

      // Display configuration summary
      this.log(chalk.blue('\nConfiguration Summary:'));
      this.log(chalk.gray(`Required fields mapped: ${validation.summary.required_fields_mapped ? '✓' : '✗'}`));
      this.log(chalk.gray(`Tag mappings valid: ${validation.summary.tag_mappings_valid ? '✓' : '✗'}`));
      this.log(chalk.gray(`Photo config valid: ${validation.summary.photo_config_valid ? '✓' : '✗'}`));

      if (!validation.valid) {
        process.exit(1);
      }

    } catch (error) {
      this.error(`Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  }

  /**
   * Load configuration file
   */
  private async loadConfiguration(configPath: string): Promise<MassImportConfig> {
    try {
      if (!fs.existsSync(configPath)) {
        throw new Error(`Configuration file not found: ${configPath}`);
      }

      const configData = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configData) as MassImportConfig;

      // Apply defaults
      config.duplicate_radius_meters = config.duplicate_radius_meters || MASS_IMPORT_CONSTANTS.DEFAULT_DUPLICATE_RADIUS_METERS;
      config.processing_mode = config.processing_mode || 'sequential';

      if (!config.batch_config) {
        config.batch_config = {
          batch_size: MASS_IMPORT_CONSTANTS.DEFAULT_BATCH_SIZE,
          batch_delay_ms: 1000,
          max_concurrent: MASS_IMPORT_CONSTANTS.DEFAULT_MAX_CONCURRENT
        };
      }

      return config;

    } catch (error) {
      throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load data file
   */
  private async loadDataFile(dataPath: string): Promise<unknown[]> {
    try {
      if (!fs.existsSync(dataPath)) {
        throw new Error(`Data file not found: ${dataPath}`);
      }

      const dataContent = fs.readFileSync(dataPath, 'utf-8');
      const data = JSON.parse(dataContent);

      if (!Array.isArray(data)) {
        throw new Error('Data file must contain a JSON array');
      }

      return data;

    } catch (error) {
      throw new Error(`Failed to load data file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle progress updates
   */
  private handleProgress(progress: ImportProgress): void {
    const percentage = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;
    
    if (this.spinner) {
      this.spinner.text = `${progress.message} (${progress.processed}/${progress.total} - ${percentage}%)`;
    }

    if (this.verbose && progress.current_record) {
      this.log(chalk.gray(`Processing: ${progress.current_record.title} [${progress.current_record.external_id}]`));
    }
  }

  /**
   * Handle error events
   */
  private handleError(error: ImportError): void {
    if (error.severity === 'critical') {
      this.error(`Critical error: ${error.message}`);
    } else if (this.verbose || error.severity === 'error') {
      const color = error.severity === 'error' ? chalk.red : chalk.yellow;
      this.log(color(`${error.type.toUpperCase()}: ${error.message}`));
    }
  }

  /**
   * Display import results
   */
  private async displayResults(results: MassImportResults, outputDir: string): Promise<void> {
    this.log(chalk.blue('\n=== Import Results ==='));
    this.log(chalk.gray(`Import ID: ${results.import_id}`));
    this.log(chalk.gray(`Source: ${results.source}`));
    this.log(chalk.gray(`Mode: ${results.dry_run ? 'Dry Run' : 'Live Import'}`));
    this.log(chalk.gray(`Processing Time: ${(results.statistics.processing_time_ms / 1000).toFixed(2)}s`));

    this.log(chalk.blue('\n--- Statistics ---'));
    this.log(chalk.gray(`Total Records: ${results.statistics.total_records}`));
    this.log(chalk.green(`Successful: ${results.statistics.successful}`));
    
    if (results.statistics.failed > 0) {
      this.log(chalk.red(`Failed: ${results.statistics.failed}`));
    }
    
    if (results.statistics.skipped_duplicates > 0) {
      this.log(chalk.yellow(`Skipped Duplicates: ${results.statistics.skipped_duplicates}`));
    }
    
    if (results.statistics.photo_failures > 0) {
      this.log(chalk.yellow(`Photo Failures: ${results.statistics.photo_failures}`));
    }
    
    if (results.statistics.tag_warnings > 0) {
      this.log(chalk.yellow(`Tag Warnings: ${results.statistics.tag_warnings}`));
    }

    if (results.tag_validation_summary.total_tags > 0) {
      this.log(chalk.blue('\n--- Tag Validation ---'));
      this.log(chalk.gray(`Total Tags: ${results.tag_validation_summary.total_tags}`));
      this.log(chalk.green(`Valid: ${results.tag_validation_summary.valid_tags}`));
      
      if (results.tag_validation_summary.warning_tags > 0) {
        this.log(chalk.yellow(`Warnings: ${results.tag_validation_summary.warning_tags}`));
      }
      
      if (results.tag_validation_summary.invalid_tags > 0) {
        this.log(chalk.red(`Invalid: ${results.tag_validation_summary.invalid_tags}`));
      }
    }

    if (results.duplicate_matches.length > 0) {
      this.log(chalk.blue('\n--- Duplicate Detection ---'));
      this.log(chalk.gray(`Potential Duplicates Found: ${results.duplicate_matches.length}`));
      
      if (this.verbose) {
        results.duplicate_matches.forEach(match => {
          this.log(chalk.yellow(`  ${match.external_id}: ${(match.similarity_score * 100).toFixed(1)}% similar to ${match.existing_artwork_id}`));
        });
      }
    }

    this.log(chalk.blue(`\nDetailed reports saved to: ${outputDir}`));
  }

  /**
   * Save detailed reports
   */
  private async saveReports(results: MassImportResults, outputDir: string): Promise<void> {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const reportType = results.dry_run ? 'dry-run' : 'import';

    // Summary report
    const summaryPath = path.join(outputDir, `${results.source}-${reportType}-summary-${timestamp}.json`);
    fs.writeFileSync(summaryPath, JSON.stringify({
      import_id: results.import_id,
      source: results.source,
      dry_run: results.dry_run,
      started_at: results.started_at,
      completed_at: results.completed_at,
      statistics: results.statistics,
      tag_validation_summary: results.tag_validation_summary,
      duplicate_matches: results.duplicate_matches
    }, null, 2));

    // Error details report
    if (results.failed_records.length > 0) {
      const errorsPath = path.join(outputDir, `${results.source}-${reportType}-errors-${timestamp}.json`);
      fs.writeFileSync(errorsPath, JSON.stringify(results.failed_records, null, 2));
    }

    // Successful records report
    if (results.successful_records.length > 0) {
      const successPath = path.join(outputDir, `${results.source}-${reportType}-success-${timestamp}.json`);
      fs.writeFileSync(successPath, JSON.stringify(results.successful_records, null, 2));
    }
  }

  /**
   * Utility methods
   */
  private generateImportId(source: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${source}-${timestamp}`;
  }

  private log(message: string): void {
    console.log(message);
  }

  private error(message: string): void {
    console.error(chalk.red(`Error: ${message}`));
  }
}

/**
 * Main execution
 */
if (require.main === module) {
  const cli = new MassImportCLI();
  cli.run().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

export default MassImportCLI;