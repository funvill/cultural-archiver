#!/usr/bin/env node

/**
 * CLI for Surrey Public Art Collection Scraper
 *
 * Usage:
 *   npx tsx cli.ts [options]
 *
 * Options:
 *   --output <path>     Output directory (default: ./output)
 *   --limit <num>       Maximum number of artworks to scrape
 *   --verbose           Enable verbose logging
 */

import { Command } from 'commander';
import { SurreyCAScraper } from './scraper.js';
import { logger } from '../shared/logger.js';

const program = new Command();

program
  .name('surrey-ca-scraper')
  .description('Scrape public art data from City of Surrey collection')
  .option('-o, --output <path>', 'Output directory', './output')
  .option('-l, --limit <number>', 'Maximum number of artworks to scrape', parseInt)
  .option('-v, --verbose', 'Enable verbose logging')
  .parse(process.argv);

const options = program.opts();

// Configure logger
if (options.verbose) {
  logger.setLevel('debug');
}

async function main(): Promise<void> {
  try {
    logger.info('Surrey Public Art Collection Scraper');
    logger.info('=====================================');
    logger.info(`Output directory: ${options.output}`);
    if (options.limit) {
      logger.info(`Limit: ${options.limit} artworks`);
    }
    logger.info('');

    const scraper = new SurreyCAScraper();
    
    if (options.limit) {
      scraper.setLimit(options.limit);
    }

    await scraper.run({
      outputDir: options.output,
      verbose: options.verbose,
    });

    logger.info('');
    logger.info('Scraping complete!');
    logger.info(`Output saved to ${options.output}`);
    
    process.exit(0);
  } catch (error) {
    logger.error('Fatal error:', error as Record<string, unknown>);
    process.exit(1);
  }
}

main();

