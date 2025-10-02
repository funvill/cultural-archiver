#!/usr/bin/env node
/**
 * Richmond Public Art Registry Data Collector
 *
 * Main entry point for scraping artwork data from the City of Richmond website.
 *
 * Usage:
 *   npx tsx src/lib/data-collection/richmond/index.ts
 *   npx tsx src/lib/data-collection/richmond/index.ts --limit=10
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
    debugDirectory: string;
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
    expectedArtworkCount: number | null;
    requireCoordinates: boolean;
    limitArtworks: number | null;
  };
  source: {
    name: string;
    attribution: string;
    url: string;
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
 * Ensure output directories exist
 */
async function ensureDirectories(config: Config): Promise<void> {
  const outputPath = path.join(__dirname, config.output.directory);
  const debugPath = path.join(__dirname, config.output.debugDirectory);
  
  await fs.mkdir(outputPath, { recursive: true });
  await fs.mkdir(debugPath, { recursive: true });
  
  logger.debug(`Output directory: ${outputPath}`);
  logger.debug(`Debug directory: ${debugPath}`);
}

/**
 * Collect all artwork URLs from index pages
 */
async function collectArtworkUrls(
  config: Config,
  scraper: WebScraper,
  parser: HTMLParser
): Promise<string[]> {
  logger.info('Collecting artwork URLs from index pages...');
  
  const indexUrl = config.baseUrl + config.endpoints.artworkIndex;
  const allUrls: string[] = [];
  
  // Fetch first page to get total count
  logger.info(`Fetching first page: ${indexUrl}`);
  const firstPageHtml = await scraper.fetch(indexUrl);
  
  // Extract total results
  const totalResults = parser.extractResultsCount(firstPageHtml);
  if (totalResults) {
    logger.info(`Total artworks available: ${totalResults}`);
  }
  
  // Extract URLs from first page
  const firstPageUrls = parser.parseArtworkIndex(firstPageHtml, config.baseUrl);
  allUrls.push(...firstPageUrls);
  logger.info(`  Page 1: Found ${firstPageUrls.length} artworks (total: ${allUrls.length})`);
  
  // Check if we need to paginate
  const limit = config.validation.limitArtworks;
  if (limit && allUrls.length >= limit) {
    logger.info(`Reached limit of ${limit} artworks, stopping pagination`);
    return allUrls.slice(0, limit);
  }
  
  // Calculate total pages needed
  const resultsPerPage = config.pagination.resultsPerPage;
  const maxResults = limit || totalResults || 381;
  const totalPages = Math.ceil(maxResults / resultsPerPage);
  
  logger.info(`Need to fetch ${totalPages} pages to get ${maxResults} artworks`);
  
  // Fetch remaining pages using ViewState-based postback (ASP.NET)
  // Extract initial viewstate
  const firstViewState = parser.extractViewState(firstPageHtml);
  if (!firstViewState) {
    logger.warn('Could not extract ViewState from first page; pagination unavailable');
    return allUrls.slice(0, limit || allUrls.length);
  }

  // Build a map of pageNumber -> { target, argument } by scanning for __doPostBack links
  const pageMap: Record<number, { target: string; arg: string }> = {};
  // Handle both ' and &#39; (HTML entity encoding) or &quot; for quotes
  const doPostRegex = /<a[^>]*href=["']javascript:__doPostBack\((&#39;|')\s*([^'&#]+?)\s*\1,(&#39;|')\s*([^'&#]*?)\s*\3\)['"][^>]*>([\s\S]*?)<\/a>/gi;
  let dpMatch;
  while ((dpMatch = doPostRegex.exec(firstPageHtml)) !== null) {
    try {
      const target = String(dpMatch[2] || '');
      const arg = String(dpMatch[4] || '');
      const labelHtml = dpMatch[5] || '';
      const label = labelHtml.replace(/<[^>]+>/g, '').trim();
      const pageNum = parseInt(label, 10);
      if (!isNaN(pageNum)) {
        pageMap[pageNum] = { target, arg };
        logger.debug(`Page map: ${pageNum} -> target="${target}", arg="${arg}"`);
      }
    } catch (err) {
      // ignore
    }
  }

  // If no pager links found, try onclick-based matches as fallback
  if (Object.keys(pageMap).length === 0) {
    const onclickRegex = /<a[^>]*onclick=["'][^\)]*__doPostBack\((&#39;|')\s*([^'&#]+?)\s*\1,(&#39;|')\s*([^'&#]*?)\s*\3\)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
    while ((dpMatch = onclickRegex.exec(firstPageHtml)) !== null) {
      try {
        const target = String(dpMatch[2] || '');
        const arg = String(dpMatch[4] || '');
        const labelHtml = dpMatch[5] || '';
        const label = labelHtml.replace(/<[^>]+>/g, '').trim();
        const pageNum = parseInt(label, 10);
        if (!isNaN(pageNum)) {
          pageMap[pageNum] = { target, arg };
          logger.debug(`Page map (onclick): ${pageNum} -> target="${target}", arg="${arg}"`);
        }
      } catch (err) {
        // ignore
      }
    }
  }

  if (Object.keys(pageMap).length === 0) {
    logger.warn('Could not find pager __doPostBack links on first page; pagination may not work');
    return allUrls.slice(0, limit || allUrls.length);
  }

  // Iterate pages and post back using extracted viewstate
  let currentViewState = firstViewState;
  for (let page = 2; page <= totalPages && (!limit || allUrls.length < limit); page++) {
    logger.info(`Processing page ${page}/${totalPages}...`);

    const mapping = pageMap[page];
    if (!mapping) {
      logger.warn(`No postback mapping for page ${page}; stopping pagination`);
      break;
    }

    const formData: Record<string, string> = {
      '__VIEWSTATE': currentViewState.viewState || '',
      '__VIEWSTATEGENERATOR': currentViewState.viewStateGenerator || '',
      '__EVENTVALIDATION': currentViewState.eventValidation || '',
      '__EVENTTARGET': mapping.target,
      '__EVENTARGUMENT': mapping.arg || '',
    };

    try {
      const pageHtml = await scraper.post(indexUrl, formData);
      // Update viewstate for next iteration
      const nextViewState = parser.extractViewState(pageHtml);
      if (nextViewState) currentViewState = nextViewState;

      // Extract URLs from this page
      const pageUrls = parser.parseArtworkIndex(pageHtml, config.baseUrl);
      logger.info(`  Page ${page}: Found ${pageUrls.length} artworks (total before add: ${allUrls.length})`);
      allUrls.push(...pageUrls);

      if (limit && allUrls.length >= limit) {
        logger.info(`Reached limit of ${limit} artworks, stopping pagination`);
        break;
      }
    } catch (err) {
      logger.warn(`Failed to fetch page ${page} via postback: ${String(err)}; stopping pagination`);
      break;
    }
  }
  
  if (limit && allUrls.length > limit) {
    return allUrls.slice(0, limit);
  }
  
  return allUrls;
}

/**
 * Fetch and parse artwork details
 */
async function fetchArtworkDetails(
  urls: string[],
  config: Config,
  scraper: WebScraper,
  parser: HTMLParser
): Promise<ArtworkData[]> {
  logger.info(`Fetching details for ${urls.length} artworks...`);
  
  const artworks: ArtworkData[] = [];
  let processedCount = 0;
  
  for (const url of urls) {
    processedCount++;
    logger.info(`[${processedCount}/${urls.length}] Fetching: ${url}`);
    
    try {
      const html = await scraper.fetch(url);
      const artwork = parser.parseArtworkDetail(html, url, config.baseUrl);
      
      if (artwork) {
        artworks.push(artwork);
        logger.debug(`  ✓ ${artwork.title} (${artwork.year || 'unknown year'})`);
        if (artwork.coordinates) {
          logger.debug(`    GPS: ${artwork.coordinates.lat}, ${artwork.coordinates.lon}`);
        } else {
          logger.debug(`    No GPS coordinates`);
        }
        logger.debug(`    Artists: ${artwork.artistNames.join(', ')}`);
      } else {
        logger.warn(`  ✗ Failed to parse artwork detail`);
      }
      
    } catch (error) {
      logger.error(`  ✗ Error fetching artwork: ${error}`);
    }
  }
  
  logger.info(`Successfully fetched ${artworks.length} artworks`);
  return artworks;
}

/**
 * Fetch and parse artist details
 */
async function fetchArtistDetails(
  artworks: ArtworkData[],
  scraper: WebScraper,
  parser: HTMLParser,
  artistHandler: ArtistHandler
): Promise<void> {
  logger.info('Collecting artist information...');
  
  // Collect all unique artist URLs
  const allArtistUrls: string[] = [];
  for (const artwork of artworks) {
    allArtistUrls.push(...artwork.artistLinks);
  }
  
  const uniqueUrls = artistHandler.getUrlsToFetch(allArtistUrls);
  logger.info(`Found ${uniqueUrls.length} unique artists to fetch`);
  
  let processedCount = 0;
  
  for (const url of uniqueUrls) {
    processedCount++;
    logger.info(`[${processedCount}/${uniqueUrls.length}] Fetching artist: ${url}`);
    
    try {
      const html = await scraper.fetch(url);
      const artist = parser.parseArtistDetail(html, url);
      
      if (artist) {
        artistHandler.addArtist(artist);
        logger.debug(`  ✓ ${artist.name}`);
      } else {
        logger.warn(`  ✗ Failed to parse artist detail`);
      }
      
    } catch (error) {
      logger.error(`  ✗ Error fetching artist: ${error}`);
    }
  }
  
  logger.info(`Successfully fetched ${artistHandler.getCount()} artists`);
}

/**
 * Write output files
 */
async function writeOutputFiles(
  artworks: ArtworkData[],
  artistHandler: ArtistHandler,
  config: Config,
  mapper: DataMapper
): Promise<void> {
  logger.info('Writing output files...');
  
  const outputDir = path.join(__dirname, config.output.directory);
  
  // Write artworks GeoJSON
  const featureCollection = mapper.createFeatureCollection(artworks);
  const artworksPath = path.join(outputDir, config.output.artworksFile);
  await fs.writeFile(artworksPath, JSON.stringify(featureCollection, null, 2), 'utf-8');
  logger.info(`✓ Wrote ${featureCollection.features.length} artworks to ${config.output.artworksFile}`);
  
  // Write artists JSON
  const artists = artistHandler.getArtists();
  const artistsPath = path.join(outputDir, config.output.artistsFile);
  await fs.writeFile(artistsPath, JSON.stringify(artists, null, 2), 'utf-8');
  logger.info(`✓ Wrote ${artists.length} artists to ${config.output.artistsFile}`);
}

/**
 * Main execution workflow
 */
async function main(): Promise<void> {
  logger.info('🎨 Richmond Public Art Registry Data Collector Starting...');
  logger.info('='.repeat(60));

  try {
    // Load configuration
    logger.info('Loading configuration...');
    const config = await loadConfig();
    logger.info(`Base URL: ${config.baseUrl}`);
    if (config.validation.expectedArtworkCount) {
      logger.info(`Expected artworks: ${config.validation.expectedArtworkCount}`);
    }
    if (config.validation.limitArtworks) {
      logger.info(`Limit: ${config.validation.limitArtworks} artworks`);
    }

    // Ensure output directories exist
    await ensureDirectories(config);

    // Initialize components
    const scraper = new WebScraper(config.scraping);
    const parser = new HTMLParser();
    const mapper = new DataMapper(config.source.name);
    const artistHandler = new ArtistHandler();

    // Step 1: Collect artwork URLs
    const artworkUrls = await collectArtworkUrls(config, scraper, parser);
    logger.info(`Collected ${artworkUrls.length} artwork URLs`);

    // Step 2: Fetch artwork details
    const artworks = await fetchArtworkDetails(artworkUrls, config, scraper, parser);

    // Step 3: Fetch artist details
    await fetchArtistDetails(artworks, scraper, parser, artistHandler);

    // Step 4: Write output files
    await writeOutputFiles(artworks, artistHandler, config, mapper);

    // Final summary
    logger.info('='.repeat(60));
    logger.info('✓ Data collection complete!');
    logger.info(`  Artworks: ${artworks.length}`);
    logger.info(`  Artists: ${artistHandler.getCount()}`);
    
    const withCoords = artworks.filter(a => a.coordinates).length;
    logger.info(`  With coordinates: ${withCoords}/${artworks.length}`);
    
    if (config.validation.expectedArtworkCount && artworks.length !== config.validation.expectedArtworkCount) {
      logger.warn(`  Warning: Expected ${config.validation.expectedArtworkCount} artworks but got ${artworks.length}`);
    }

  } catch (error) {
    logger.error('Fatal error during execution:');
    logger.error(String(error));
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  logger.error('Unhandled error:');
  logger.error(String(error));
  process.exit(1);
});
