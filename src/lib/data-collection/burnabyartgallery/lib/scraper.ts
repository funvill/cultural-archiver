/**
 * HTTP Client and Web Scraper for Burnaby Art Gallery
 *
 * Implements rate-limited HTTP requests using Node.js built-in fetch
 * with retry logic and exponential backoff.
 */

import { logger } from './logger.js';

export interface ScraperConfig {
  delayBetweenRequestsMs: number;
  maxRetries: number;
  retryBackoffBaseMs: number;
  retryBackoffMultiplier: number;
  requestTimeoutMs: number;
  userAgent: string;
}

export class WebScraper {
  private config: ScraperConfig;
  private lastRequestTime: number = 0;

  constructor(config: ScraperConfig) {
    this.config = config;
  }

  /**
   * Fetch a URL with rate limiting and retry logic
   */
  async fetch(url: string, retries = 3): Promise<string> {
    await this.enforceRateLimit();

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        logger.debug(`Fetching: ${url} (attempt ${attempt})`);
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Referer': 'https://collections.burnabyartgallery.ca/',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-User': '?1',
            'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'Cache-Control': 'max-age=0'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        logger.debug(`Fetched ${html.length} bytes from ${url}`);
        return html;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn(`Fetch attempt ${attempt} failed for ${url}: ${errorMessage}`);

        if (attempt < retries) {
          const backoffTime = this.config.retryBackoffBaseMs * Math.pow(2, attempt - 1);
          logger.debug(`Waiting ${backoffTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
    }

    throw new Error(`Failed to fetch ${url} after ${retries} attempts`);
  }

  /**
   * Enforce rate limiting between requests
   */
  private async enforceRateLimit(): Promise<void> {
    if (this.lastRequestTime > 0) {
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      const remainingDelay = this.config.delayBetweenRequestsMs - timeSinceLastRequest;

      if (remainingDelay > 0) {
        logger.debug(`Rate limiting: waiting ${remainingDelay}ms`);
        await this.sleep(remainingDelay);
      }
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Fetch multiple URLs sequentially with rate limiting
   */
  async fetchAll(urls: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    logger.info(`Fetching ${urls.length} URLs sequentially...`);

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      if (!url) continue;
      
      logger.info(`Progress: ${i + 1}/${urls.length} - ${url}`);

      try {
        const html = await this.fetch(url);
        results.set(url, html);
      } catch (error) {
        logger.error(`Failed to fetch ${url}`, error);
        // Continue with remaining URLs
      }
    }

    logger.info(`Successfully fetched ${results.size}/${urls.length} URLs`);
    return results;
  }
}
