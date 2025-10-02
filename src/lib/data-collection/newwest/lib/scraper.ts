/**
 * HTTP Client and Web Scraper for New Westminster Public Art Registry
 *
 * Implements rate-limited HTTP requests using Node.js built-in fetch
 * with retry logic and exponential backoff.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
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
  private debugOutputDir: string | undefined;

  constructor(config: ScraperConfig, debugOutputDir?: string) {
    this.config = config;
    this.debugOutputDir = debugOutputDir;
  }

  /**
   * Fetch a URL with rate limiting and retry logic
   */
  async fetch(url: string, retries?: number): Promise<string> {
    await this.enforceRateLimit();
    
    const maxRetries = retries ?? this.config.maxRetries;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(`Fetching: ${url} (attempt ${attempt})`);
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': this.config.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Cache-Control': 'max-age=0'
          }
        });

        if (!response.ok) {
          // Save debug snapshot for non-200 responses
          if (this.debugOutputDir) {
            await this.saveDebugSnapshot(url, `HTTP ${response.status}`, await response.text());
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        logger.debug(`Fetched ${html.length} bytes from ${url}`);
        return html;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn(`Fetch attempt ${attempt} failed for ${url}: ${errorMessage}`);

        if (attempt < maxRetries) {
          const backoffTime = this.config.retryBackoffBaseMs * Math.pow(this.config.retryBackoffMultiplier, attempt - 1);
          logger.debug(`Waiting ${backoffTime}ms before retry...`);
          await this.sleep(backoffTime);
        } else {
          // Save debug snapshot on final failure
          if (this.debugOutputDir) {
            await this.saveDebugSnapshot(url, errorMessage, '');
          }
        }
      }
    }

    throw new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
  }

  /**
   * Save HTML snapshot for debugging
   */
  private async saveDebugSnapshot(url: string, reason: string, html: string): Promise<void> {
    if (!this.debugOutputDir) return;

    try {
      await fs.mkdir(this.debugOutputDir, { recursive: true });
      
      // Create a safe filename from the URL
      const urlObj = new URL(url);
      const filename = `${urlObj.pathname.replace(/\//g, '_')}_${Date.now()}.html`;
      const filepath = path.join(this.debugOutputDir, filename);
      
      const content = `<!-- Saved at ${new Date().toISOString()} -->\n<!-- URL: ${url} -->\n<!-- Reason: ${reason} -->\n\n${html}`;
      await fs.writeFile(filepath, content, 'utf-8');
      
      logger.debug(`Saved debug snapshot: ${filepath}`);
    } catch (error) {
      logger.error('Failed to save debug snapshot', error);
    }
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
