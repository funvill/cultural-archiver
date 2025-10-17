#!/usr/bin/env node
/**
 * CLI entry point for Burnaby Art Gallery scraper
 */

import { Command } from 'commander';
import { BurnabyArtGalleryScraper } from './scraper';
import { logger } from '../shared/logger';

const program = new Command();

program
	.name('burnaby-art-gallery-scraper')
	.description('Scrape artwork and artist data from Burnaby Art Gallery Public Art Registry')
	.version('1.0.0')
	.option('-o, --output <directory>', 'Output directory for generated files', './output')
	.option('-m, --max-pages <number>', 'Maximum pages to scrape (for testing)', parseInt)
	.option('-l, --limit <number>', 'Maximum artworks to scrape (for testing)', parseInt)
	.option('-v, --verbose', 'Enable verbose logging (DEBUG level)')
	.action(
		async (options: { output: string; maxPages?: number; limit?: number; verbose?: boolean }) => {
			try {
				const scraper = new BurnabyArtGalleryScraper();

			if (options.verbose) {
				logger.setLevel('debug');
			}

			if (options.maxPages) {
				scraper.setMaxPages(options.maxPages);
			}

			if (options.limit) {
				scraper.setLimit(options.limit);
			}

			await scraper.run({
				outputDir: options.output,
				verbose: options.verbose ?? false,
			});

			process.exit(0);
		} catch (error) {
			logger.error('Scraper failed', { error: (error as Error).message });
			process.exit(1);
		}
	}
);

program.parse(process.argv);
