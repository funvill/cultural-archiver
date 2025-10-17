#!/usr/bin/env node

/**
 * CLI for Township of Langley Public Art Scraper
 *
 * Usage:
 *   npx tsx src/mass-import/scraper/township-langley/cli.ts [options]
 *
 * Options:
 *   --output <path>     Output directory (default: ./output)
 *   --limit <num>       Maximum number of artworks to scrape
 *   --verbose           Enable verbose logging
 */

import { Command } from 'commander';
import { TownshipLangleyScraper } from './scraper.js';
import { logger } from '../shared/logger.js';

const program = new Command();

program
  .name('township-langley-scraper')
  .description('Scrape public art data from Township of Langley page')
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
    logger.info('Township of Langley Public Art Scraper');
    logger.info('======================================');
    logger.info(`Output directory: ${options.output}`);
    if (options.limit) {
      logger.info(`Limit: ${options.limit} artworks`);
    }
    logger.info('');

    const scraper = new TownshipLangleyScraper();

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
