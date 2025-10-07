/**
 * Mass Import Plugin System - CLI Interface
 *
 * This module provides a modular CLI interface that supports the new plugin
 * architecture with --importer and --exporter flags, replacing hardcoded commands.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { PluginRegistry } from '../lib/plugin-registry.js';
import { DataPipeline } from '../lib/data-pipeline.js';
import { registerCoreExporters } from '../exporters/index.js';
import { registerCoreImporters } from '../importers/index.js';
import type { ProcessingOptions } from '../types/plugin.js';

// ================================
// CLI Configuration Types
// ================================

interface CLIOptions {
  importer: string;
  exporter: string;
  input?: string;
  config?: string;
  output?: string;
  batchSize?: number;
  limit?: number;
  offset?: number;
  dryRun?: boolean;
  verbose?: boolean;
  generateReport?: boolean;
  reportPath?: string;
  listPlugins?: boolean;
  validateConfig?: boolean;
  locationEnhancement?: boolean;
  locationCache?: string;
  maxConsecutiveErrors?: number;
}

// ================================
// Plugin CLI Manager
// ================================

export class PluginCLI {
  private registry: PluginRegistry;
  private program: Command;

  constructor() {
    this.registry = new PluginRegistry();
    this.program = new Command();
    this.setupCommands();
    this.registerCorePlugins();
  }

  /**
   * Register core plugins with the registry
   */
  private async registerCorePlugins(): Promise<void> {
    registerCoreExporters(this.registry);
    registerCoreImporters(this.registry);
  }

  /**
   * Setup CLI commands and options
   */
  private setupCommands(): void {
    this.program
      .name('mass-import')
      .description('Mass Import Plugin System - Modular data import and export')
      .version('2.0.0');

    // Main import command
    this.program
      .command('import')
      .description('Import data using specified importer and exporter plugins')
      .requiredOption('--importer <name>', 'Importer plugin name (e.g., vancouver, osm)')
      .requiredOption('--exporter <name>', 'Exporter plugin name (json, console, api)')
      .option('--input <path>', 'Input file or data source path')
      .option('--config <path>', 'Plugin configuration file path')
      .option('--output <path>', 'Output file path (for file-based exporters)')
      .option('--batch-size <number>', 'Batch size for processing', '50')
      .option('--limit <number>', 'Limit the number of records to process')
      .option('--offset <number>', 'Skip the first N records before processing')
      .option('--dry-run', 'Run in dry-run mode without making changes', false)
      .option('--verbose', 'Enable verbose logging', false)
      .option('--generate-report', 'Generate processing report', false)
      .option('--report-path <path>', 'Path for generated report')
      .option('--location-enhancement', 'Enable location enhancement (adds human-readable location fields)', false)
      .option('--location-cache <path>', 'Path to location cache database', './_data/location-cache.sqlite')
      .option('--max-consecutive-errors <number>', 'Maximum consecutive errors before aborting', '5')
      .action(async (options: CLIOptions) => {
        await this.handleImportCommand(options);
      });

    // List available plugins
    this.program
      .command('list-plugins')
      .description('List all available importer and exporter plugins')
      .option('--type <type>', 'Filter by plugin type (importer, exporter)', 'all')
      .action(async options => {
        await this.handleListPlugins(options.type);
      });

    // Validate plugin configuration
    this.program
      .command('validate-config')
      .description('Validate plugin configuration files')
      .requiredOption('--importer <name>', 'Importer plugin name')
      .requiredOption('--exporter <name>', 'Exporter plugin name')
      .option('--config <path>', 'Configuration file path')
      .action(async (options: CLIOptions) => {
        await this.handleValidateConfig(options);
      });

    // Plugin information command
    this.program
      .command('plugin-info')
      .description('Show detailed information about a specific plugin')
      .requiredOption('--name <name>', 'Plugin name')
      .option('--type <type>', 'Plugin type (importer, exporter)', 'importer')
      .action(async options => {
        await this.handlePluginInfo(options.name, options.type);
      });
  }

  /**
   * Handle the main import command
   */
  private async handleImportCommand(options: CLIOptions): Promise<void> {
    const spinner = ora('Initializing import process...').start();

    try {
      // Validate required plugins exist
      const importer = this.registry.getImporter(options.importer);
      if (!importer) {
        spinner.fail(`Importer plugin "${options.importer}" not found`);
        await this.suggestAvailablePlugins('importer');
        process.exit(1);
      }

      const exporter = this.registry.getExporter(options.exporter);
      if (!exporter) {
        spinner.fail(`Exporter plugin "${options.exporter}" not found`);
        await this.suggestAvailablePlugins('exporter');
        process.exit(1);
      }

      spinner.text = 'Loading configuration...';

      // Load configuration files
      const { importerConfig, exporterConfig } = await this.loadConfigurations(options);

      // Provide default configuration for osm-artwork importer if none provided
      const finalImporterConfig =
        options.importer === 'osm-artwork' && Object.keys(importerConfig).length === 0
          ? {
              preset: 'general',
              includeFeatureTypes: [
                'artwork',
                'monument',
                'sculpture',
                'statue',
                'mural',
                'installation',
              ],
              tagMappings: {
                artwork_type: 'artwork_type',
                material: 'material',
                subject: 'subject',
                style: 'style',
              },
              descriptionFields: ['description', 'inscription', 'subject'],
              artistFields: ['artist_name', 'artist', 'created_by'],
              yearFields: ['start_date', 'year', 'date'],
            }
          : importerConfig;

      // Provide default configuration for api exporter if none provided
      let finalExporterConfig = exporterConfig;
      if (options.exporter === 'api' && Object.keys(exporterConfig).length === 0) {
        try {
          // Try to load the api-config.json file from the source directory
          const currentDir = path.dirname(fileURLToPath(import.meta.url));
          const apiConfigPath = path.resolve(currentDir, '../exporters/api-config.json');
          const apiConfigContent = await fs.readFile(apiConfigPath, 'utf-8');
          finalExporterConfig = JSON.parse(apiConfigContent);
          console.log('📄 Loaded default API configuration from api-config.json');
        } catch (error) {
          throw new Error(
            `API exporter requires configuration. Please provide --config file or ensure api-config.json exists. Error: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      // Setup processing options
      const processingOptions: ProcessingOptions = {
        ...(options.dryRun !== undefined && { dryRun: options.dryRun }),
        batchSize: parseInt(options.batchSize?.toString() ?? '50'),
        ...(options.limit !== undefined && { limit: parseInt(options.limit.toString()) }),
        ...(options.offset !== undefined && { offset: parseInt(options.offset.toString()) }),
        ...(options.generateReport !== undefined && { generateReport: options.generateReport }),
        ...(options.reportPath !== undefined && { reportPath: options.reportPath }),
        ...(options.input !== undefined && { inputFile: options.input }),
        ...(options.maxConsecutiveErrors !== undefined && { 
          maxConsecutiveErrors: parseInt(options.maxConsecutiveErrors.toString()) 
        }),
        ...(options.verbose !== undefined && {
          exporterOptions: {
            verbose: options.verbose,
          },
        }),
        importerConfig: finalImporterConfig,
        exporterConfig: {
          ...finalExporterConfig,
          ...(options.output && { outputPath: options.output }),
        },
        // Location enhancement configuration
        ...(options.locationEnhancement && {
          locationEnhancement: {
            enabled: true,
            cacheDbPath: options.locationCache ?? './_data/location-cache.sqlite',
            requestTimeout: 10000,
            failOnErrors: false,
            tagFields: {
              displayName: 'location_display_name',
              country: 'location_country',
              state: 'location_state',
              city: 'location_city',
              suburb: 'location_suburb',
              neighbourhood: 'location_neighbourhood',
            },
          },
        }),
      };

      spinner.text = 'Creating data pipeline...';

      // Create and execute pipeline
      const pipeline = new DataPipeline(importer, exporter);

      spinner.succeed('Pipeline initialized');

      if (options.verbose) {
        console.log(chalk.blue('📋 Processing Options:'), processingOptions);
        console.log(chalk.blue('🔧 Importer:'), importer.name, `(${importer.metadata.version})`);
        console.log(chalk.blue('📤 Exporter:'), exporter.name, `(${exporter.metadata.version})`);
      }

      // Load input data
      let inputData: unknown;
      if (options.input) {
        const inputSpinner = ora(`Loading input data from ${options.input}...`).start();
        inputData = await this.loadInputData(options.input);
        inputSpinner.succeed(
          `Loaded input data: ${Array.isArray(inputData) ? inputData.length : 'unknown'} records`
        );
      } else {
        // For importers that don't require input files (e.g., API-based importers)
        inputData = {};
      }

      // Execute pipeline
      const processingSpinner = ora('Processing data through pipeline...').start();
      const result = await pipeline.process(inputData, processingOptions);

      // Always show detailed results regardless of success/failure
      const { exportResult, summary } = result;
      const successful = exportResult.recordsSuccessful || 0;
      const failed = exportResult.recordsFailed || 0;
      const skipped = exportResult.recordsSkipped || 0;
      const duplicates = exportResult.recordsDuplicate || 0;
      const total = result.importedCount || 0;

      if (successful > 0) {
        processingSpinner.succeed(`Import completed: ${successful}/${total} records successful`);
      } else if (total > 0) {
        processingSpinner.fail(`Import failed: 0/${total} records successful`);
      } else {
        processingSpinner.warn('No records were processed');
      }

      // Always show detailed breakdown
      console.log(chalk.blue('\n📊 Import Results:'));
      console.log(`  ${chalk.green('✅ Successful:')} ${successful}`);
      console.log(`  ${chalk.red('❌ Failed:')} ${failed}`);
      console.log(`  ${chalk.yellow('⏭️  Skipped:')} ${skipped}`);
      console.log(`  ${chalk.cyan('🔄 Duplicates:')} ${duplicates}`);
      console.log(`  ${chalk.blue('📊 Total Processed:')} ${total}`);
      console.log(`  ${chalk.magenta('⏱️  Processing Time:')} ${summary.processingTime}ms`);

      if (successful > 0) {
        const successRate = ((successful / total) * 100).toFixed(1);
        console.log(`  ${chalk.green('📈 Success Rate:')} ${successRate}%`);
      }

      if (options.verbose) {
        console.log(chalk.gray('\n🔍 Detailed Information:'));
        console.log(`  • Pipeline Success: ${result.exportResult.success}`);
        console.log(`  • Average Record Time: ${summary.averageRecordTime}ms`);

        if (result.report && options.generateReport) {
          console.log(
            chalk.cyan(`  • Report Generated: ${result.report.metadata?.operation.endTime}`)
          );
        }

        if (exportResult.errors && exportResult.errors.length > 0) {
          console.log(chalk.red('\n❌ Export Errors:'));
          exportResult.errors.slice(0, 5).forEach((error, index) => {
            console.log(`  ${index + 1}. ${error.message}`);
          });
          if (exportResult.errors.length > 5) {
            console.log(`  ... and ${exportResult.errors.length - 5} more errors`);
          }
        }
      }
    } catch (error) {
      spinner.fail('Import process failed');
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : String(error));

      if (options.verbose && error instanceof Error) {
        console.error(chalk.gray('Stack trace:'), error.stack);
      }

      process.exit(1);
    }
  }

  /**
   * Handle list plugins command
   */
  private async handleListPlugins(type: string = 'all'): Promise<void> {
    console.log(chalk.blue('📦 Available Plugins\\n'));

    if (type === 'all' || type === 'importer') {
      console.log(chalk.yellow('🔽 Importers:'));
      const importers = this.registry.getAllImporters();

      if (importers.length === 0) {
        console.log(chalk.gray('  No importers registered'));
        console.log(chalk.gray('  Note: Core importers will be available after Task 6 migration'));
      } else {
        importers.forEach(importer => {
          console.log(`  • ${chalk.green(importer.name)} - ${importer.description}`);
          console.log(`    Version: ${importer.metadata.version || 'unknown'}`);
          console.log(`    Author: ${importer.metadata.author || 'unknown'}`);
        });
      }
      console.log();
    }

    if (type === 'all' || type === 'exporter') {
      console.log(chalk.yellow('🔼 Exporters:'));
      const exporters = this.registry.getAllExporters();

      if (exporters.length === 0) {
        console.log(chalk.gray('  No exporters registered'));
      } else {
        exporters.forEach(exporter => {
          console.log(`  • ${chalk.green(exporter.name)} - ${exporter.description}`);
          console.log(`    Version: ${exporter.metadata.version || 'unknown'}`);
          console.log(
            `    Output: ${exporter.outputType} | Network: ${exporter.requiresNetwork ? 'Yes' : 'No'}`
          );
          console.log(`    Formats: ${exporter.supportedFormats.join(', ')}`);
        });
      }
    }
  }

  /**
   * Handle validate config command
   */
  private async handleValidateConfig(options: CLIOptions): Promise<void> {
    console.log(chalk.blue('🔍 Validating plugin configurations...\\n'));

    try {
      // Load configurations
      const { exporterConfig } = await this.loadConfigurations(options);

      // Validate importer config
      const importer = this.registry.getImporter(options.importer);
      if (importer) {
        console.log(chalk.yellow(`Validating ${options.importer} importer configuration...`));

        // Note: Importer validation will be implemented when importers are migrated
        console.log(chalk.green('✅ Importer configuration valid'));
      }

      // Validate exporter config
      const exporter = this.registry.getExporter(options.exporter);
      if (exporter) {
        console.log(chalk.yellow(`Validating ${options.exporter} exporter configuration...`));

        const validation = await exporter.validate(exporterConfig);
        if (validation.isValid) {
          console.log(chalk.green('✅ Exporter configuration valid'));
        } else {
          console.log(chalk.red('❌ Exporter configuration invalid:'));
          validation.errors?.forEach(error => {
            console.log(`  • ${error.message}`);
          });
          process.exit(1);
        }
      }

      console.log(chalk.green('\\n🎉 All configurations are valid!'));
    } catch (error) {
      console.error(
        chalk.red('❌ Configuration validation failed:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  }

  /**
   * Handle plugin info command
   */
  private async handlePluginInfo(name: string, type: string): Promise<void> {
    console.log(chalk.blue(`📋 Plugin Information: ${name}\\n`));

    try {
      if (type === 'importer') {
        const importer = this.registry.getImporter(name);
        if (!importer) {
          console.log(chalk.red(`❌ Importer "${name}" not found`));
          await this.suggestAvailablePlugins('importer');
          return;
        }

        console.log(chalk.yellow('🔽 Importer Details:'));
        console.log(`Name: ${chalk.green(importer.name)}`);
        console.log(`Description: ${importer.description}`);
        console.log(`Version: ${importer.metadata.version || 'unknown'}`);
        console.log(`Author: ${importer.metadata.author || 'unknown'}`);
        console.log(`Supported Formats: ${importer.metadata.supportedFormats.join(', ')}`);
        console.log(`Required Fields: ${importer.metadata.requiredFields.join(', ')}`);
        console.log(`Optional Fields: ${importer.metadata.optionalFields.join(', ')}`);
      } else if (type === 'exporter') {
        const exporter = this.registry.getExporter(name);
        if (!exporter) {
          console.log(chalk.red(`❌ Exporter "${name}" not found`));
          await this.suggestAvailablePlugins('exporter');
          return;
        }

        console.log(chalk.yellow('🔼 Exporter Details:'));
        console.log(`Name: ${chalk.green(exporter.name)}`);
        console.log(`Description: ${exporter.description}`);
        console.log(`Version: ${exporter.metadata.version || 'unknown'}`);
        console.log(`Author: ${exporter.metadata.author || 'unknown'}`);
        console.log(`Output Type: ${exporter.outputType}`);
        console.log(`Requires Network: ${exporter.requiresNetwork ? 'Yes' : 'No'}`);
        console.log(`Supported Formats: ${exporter.supportedFormats.join(', ')}`);
        console.log(`Required Fields: ${exporter.metadata.requiredFields.join(', ')}`);
        console.log(`Optional Fields: ${exporter.metadata.optionalFields.join(', ')}`);
      }
    } catch (error) {
      console.error(
        chalk.red('❌ Failed to get plugin info:'),
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Load plugin configuration files
   */
  private async loadConfigurations(
    options: CLIOptions
  ): Promise<{ importerConfig: Record<string, unknown>; exporterConfig: Record<string, unknown> }> {
    let importerConfig = {};
    let exporterConfig = {};

    // Load configuration file if provided
    if (options.config) {
      try {
        const configPath = path.resolve(options.config);
        const configContent = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(configContent);

        importerConfig = config.importer || {};
        exporterConfig = config.exporter || {};

        if (options.verbose) {
          console.log(chalk.blue(`📄 Loaded configuration from: ${configPath}`));
        }
      } catch (error) {
        throw new Error(
          `Failed to load configuration file: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return { importerConfig, exporterConfig };
  }

  /**
   * Load input data from file
   */
  private async loadInputData(inputPath: string): Promise<unknown> {
    try {
      const filePath = path.resolve(inputPath);
      const content = await fs.readFile(filePath, 'utf-8');

      // Try to parse as JSON first
      try {
        return JSON.parse(content);
      } catch {
        // If not JSON, return as string for text-based importers
        return content;
      }
    } catch (error) {
      throw new Error(
        `Failed to load input data: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Suggest available plugins when a plugin is not found
   */
  private async suggestAvailablePlugins(type: 'importer' | 'exporter'): Promise<void> {
    console.log(chalk.yellow(`\\n💡 Available ${type}s:`));

    if (type === 'importer') {
      const importers = this.registry.listImporters();
      if (importers.length === 0) {
        console.log(chalk.gray('  No importers available yet'));
        console.log(chalk.gray('  Core importers will be available after Task 6 migration'));
      } else {
        importers.forEach(importerName => {
          console.log(`  • ${chalk.green(importerName)}`);
        });
      }
    } else {
      const exporters = this.registry.listExporters();
      exporters.forEach(exporterName => {
        console.log(`  • ${chalk.green(exporterName)}`);
      });
    }
  }

  /**
   * Parse command line arguments and execute
   */
  async run(argv?: string[]): Promise<void> {
    try {
      await this.program.parseAsync(argv || process.argv);
    } catch (error) {
      console.error(
        chalk.red('❌ CLI Error:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  }
}

// ================================
// CLI Entry Point
// ================================

/**
 * Create and run CLI instance
 */
export async function createCLI(): Promise<PluginCLI> {
  return new PluginCLI();
}

/**
 * Main CLI execution function
 */
export async function runCLI(argv?: string[]): Promise<void> {
  const cli = await createCLI();
  await cli.run(argv);
}

// ================================
// Main Execution (when run as script)
// ================================

// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI().catch(error => {
    console.error('CLI execution failed:', error);
    process.exit(1);
  });
}
