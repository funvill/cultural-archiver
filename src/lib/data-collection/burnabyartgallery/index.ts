#!/usr/bin/env node
/**
 * Burnaby Art Gallery Data Collector
 *
 * Main entry point for scraping artwork data from the Burnaby Art Gallery website.
 *
 * Usage:
 *   npx tsx src/lib/data-collection/burnabyartgallery/index.ts
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebScraper } from './lib/scraper.js';
import { HTMLParser } from './lib/parser.js';
import { DataMapper } from './lib/mapper.js';
import { ArtistHandler } from './lib/artist-handler.js';
import { logger } from './lib/logger.js';
import type { ArtworkData } from './lib/parser.js';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Config {
  baseUrl: string;
  endpoints: {
    artworkIndex: string;
    artworkDetail: string;
    artistDetail: string;
  };
  output: {
    directory: string;
    artworksFile: string;
    artistsFile: string;
  };
  scraping: {
    delayBetweenRequestsMs: number;
    maxRetries: number;
    retryBackoffBaseMs: number;
    retryBackoffMultiplier: number;
    requestTimeoutMs: number;
    userAgent: string;
  };
  pagination: {
    startPage: number;
    resultsPerPage: number;
  };
  validation: {
    expectedArtworkCount: number;
    requireCoordinates: boolean;
    limitArtworks: number | null;
  };
  source: {
    name: string;
    attribution: string;
  };
}

/**
 * Load configuration
 */
async function loadConfig(): Promise<Config> {
  const configPath = path.join(__dirname, 'config.json');
  const configData = await fs.readFile(configPath, 'utf-8');
  const config = JSON.parse(configData) as Config;
  
  // Check for command line limit argument
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  if (limitArg) {
    const limitValue = limitArg.split('=')[1];
    if (limitValue) {
      const limit = parseInt(limitValue, 10);
      if (!isNaN(limit) && limit > 0) {
        config.validation.limitArtworks = limit;
        logger.info(`Command line limit set: ${limit} artworks`);
      }
    }
  }
  
  return config;
}

/**
 * Main execution workflow
 */
async function main(): Promise<void> {
  logger.info('🎨 Burnaby Art Gallery Data Collector Starting...');
  logger.info('='.repeat(60));

  try {
    // Load configuration
    logger.info('Loading configuration...');
    const config = await loadConfig();
    logger.info(`Base URL: ${config.baseUrl}`);
    logger.info(`Expected artworks: ${config.validation.expectedArtworkCount}`);
    if (config.validation.limitArtworks) {
      logger.info(`⚠️  LIMITED MODE: Processing only ${config.validation.limitArtworks} artworks`);
    }
    // Initialize components
    const scraper = new WebScraper(config.scraping);
    const parser = new HTMLParser();
    const mapper = new DataMapper();
    const artistHandler = new ArtistHandler();

    // Step 1: Fetch artwork index and discover all URLs
    logger.info('\n📖 Step 1: Fetching artwork index...');
    const indexUrl = config.baseUrl + config.endpoints.artworkIndex.replace('{page}', String(config.pagination.startPage));
    const indexHtml = await scraper.fetch(indexUrl);

    // Detect total pages
    const totalPages = parser.detectTotalPages(indexHtml);
    logger.info(`Detected ${totalPages} total pages`);

    // Collect all artwork URLs from all pages
    logger.info('\n🔍 Step 2: Collecting artwork URLs...');
    const allArtworkUrls: string[] = [];

    for (let page = config.pagination.startPage; page <= totalPages; page++) {
      const pageUrl = config.baseUrl + config.endpoints.artworkIndex.replace('{page}', String(page));
      logger.info(`Fetching page ${page}/${totalPages}...`);
      
      const pageHtml = await scraper.fetch(pageUrl);
      const urls = parser.parseArtworkIndex(pageHtml, config.baseUrl);
      
      allArtworkUrls.push(...urls);
      logger.info(`  Found ${urls.length} artworks on page ${page} (total: ${allArtworkUrls.length})`);
    }

    // Deduplicate URLs
    const uniqueArtworkUrls = Array.from(new Set(allArtworkUrls));
    logger.info(`\n✅ Collected ${uniqueArtworkUrls.length} unique artwork URLs`);

    if (uniqueArtworkUrls.length !== config.validation.expectedArtworkCount) {
      logger.warn(`⚠️  Expected ${config.validation.expectedArtworkCount} artworks but found ${uniqueArtworkUrls.length}`);
    }

    // Apply limit if specified
    const artworkUrlsToProcess = config.validation.limitArtworks 
      ? uniqueArtworkUrls.slice(0, config.validation.limitArtworks)
      : uniqueArtworkUrls;
    
    if (config.validation.limitArtworks) {
      logger.info(`⚠️  Processing limited to first ${artworkUrlsToProcess.length} artworks`);
    }

    // Step 3: Scrape artwork details
    logger.info('\n🖼️  Step 3: Scraping artwork details...');
    const artworks: Array<Partial<ArtworkData>> = [];
    const artistUrls: Set<string> = new Set();

    for (let i = 0; i < artworkUrlsToProcess.length; i++) {
      const url = artworkUrlsToProcess[i];
      if (!url) continue;

      logger.info(`\nArtwork ${i + 1}/${artworkUrlsToProcess.length}: ${url}`);

      try {
        const html = await scraper.fetch(url);
        const artworkData = parser.parseArtworkDetail(html, url);

        // Track artist URLs for later scraping
        if (artworkData.artistLinks) {
          artworkData.artistLinks.forEach((artistUrl) => artistUrls.add(artistUrl));
        }

        artworks.push(artworkData);

        // Log warnings for missing required fields
        if (!artworkData.coordinates) {
          logger.warn(`  ⚠️  Missing coordinates (will be excluded from output)`);
        }
        if (!artworkData.title) {
          logger.warn(`  ⚠️  Missing title`);
        }
        if (!artworkData.medium) {
          logger.warn(`  ⚠️  Missing medium`);
        }
      } catch (error) {
        logger.error(`Failed to scrape artwork ${url}`, error);
      }
    }

    logger.info(`\n✅ Successfully scraped ${artworks.length} artworks`);

    // Step 4: Scrape artist details
    logger.info(`\n👤 Step 4: Scraping ${artistUrls.size} unique artists...`);

    for (const artistUrl of artistUrls) {
      if (artistHandler.hasArtist(artistUrl)) {
        logger.debug(`Artist already processed: ${artistUrl}`);
        continue;
      }

      try {
        const html = await scraper.fetch(artistUrl);
        const artistData = parser.parseArtistDetail(html, artistUrl);
        
        // If we found a permalink different from the search URL, fetch the actual artist page
        if (artistData.sourceUrl && artistData.sourceUrl !== artistUrl) {
          logger.debug(`  Found artist permalink, fetching full page: ${artistData.sourceUrl}`);
          const artistPageHtml = await scraper.fetch(artistData.sourceUrl);
          const fullArtistData = parser.parseArtistDetail(artistPageHtml, artistData.sourceUrl);
          artistHandler.addArtist(fullArtistData);
        } else {
          artistHandler.addArtist(artistData);
        }
      } catch (error) {
        logger.error(`Failed to scrape artist ${artistUrl}`, error);
      }
    }

    logger.info(`✅ Collected ${artistHandler.getCount()} unique artists`);

    // Step 5: Transform to GeoJSON
    logger.info('\n🗺️  Step 5: Transforming to GeoJSON...');
    const geoJSON = mapper.createFeatureCollection(artworks);
    logger.info(`Created GeoJSON with ${geoJSON.features.length} features`);

    // Step 6: Write output files
    logger.info('\n💾 Step 6: Writing output files...');
    const outputDir = path.join(__dirname, config.output.directory);
    
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Write artworks GeoJSON
    const artworksPath = path.join(outputDir, config.output.artworksFile);
    await fs.writeFile(artworksPath, JSON.stringify(geoJSON, null, 2), 'utf-8');
    logger.info(`✅ Wrote ${artworksPath}`);

    // Write artists JSON
    const artists = artistHandler.getAllArtists();
    const artistsPath = path.join(outputDir, config.output.artistsFile);
    await fs.writeFile(artistsPath, JSON.stringify(artists, null, 2), 'utf-8');
    logger.info(`✅ Wrote ${artistsPath}`);

    // Print final summary
    logger.printSummary({
      artworksFound: geoJSON.features.length,
      artistsFound: artists.length,
      filesWritten: [artworksPath, artistsPath],
    });

    // Validation
    if (geoJSON.features.length < config.validation.expectedArtworkCount) {
      logger.warn(`\n⚠️  Warning: Expected ${config.validation.expectedArtworkCount} artworks but only exported ${geoJSON.features.length}`);
      logger.warn('   This may be due to artworks missing coordinates or other required fields.');
    }

    logger.info('\n✨ Data collection complete!');
    process.exit(0);
  } catch (error) {
    logger.error('Fatal error during execution', error);
    console.error('\n❌ Data collection failed');
    console.error(error);
    process.exit(1);
  }
}

// Execute main function
main();
