/**
 * Web Scraper for Richmond Public Art Registry
 * 
 * Handles HTTP requests with retry logic, rate limiting, and ASP.NET ViewState support
 */

import * as https from 'node:https';
import * as http from 'node:http';
import * as zlib from 'node:zlib';
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
  private lastRequestTime = 0;
  private config: ScraperConfig;

  constructor(config: ScraperConfig) {
    this.config = config;
  }

  /**
   * Rate limiting delay
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Apply rate limiting based on last request time
   */
  private async applyRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const delayNeeded = this.config.delayBetweenRequestsMs - timeSinceLastRequest;
    
    if (delayNeeded > 0) {
      logger.debug(`Rate limiting: waiting ${delayNeeded}ms`);
      await this.delay(delayNeeded);
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Fetch HTML content with retry logic
   */
  async fetch(url: string, options?: { method?: string; body?: string; headers?: Record<string, string> }): Promise<string> {
    const method = options?.method || 'GET';
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const backoffMs = this.config.retryBackoffBaseMs * Math.pow(this.config.retryBackoffMultiplier, attempt - 1);
          logger.warn(`Retry attempt ${attempt + 1}/${this.config.maxRetries} after ${backoffMs}ms`);
          await this.delay(backoffMs);
        }

        await this.applyRateLimit();

        const html = await this.makeRequest(url, method, options?.body, options?.headers);
        logger.debug(`Successfully fetched: ${url}`);
        return html;

      } catch (error) {
        lastError = error as Error;
        logger.warn(`Request failed (attempt ${attempt + 1}/${this.config.maxRetries}): ${lastError.message}`);
      }
    }

    throw new Error(`Failed to fetch ${url} after ${this.config.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Make HTTP/HTTPS request
   */
  private makeRequest(url: string, method: string, body?: string, customHeaders?: Record<string, string>): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const headers: Record<string, string> = {
        'User-Agent': this.config.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        ...customHeaders,
      };

      if (method === 'POST' && body) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        headers['Content-Length'] = Buffer.byteLength(body).toString();
      }

      const options: http.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers,
        timeout: this.config.requestTimeoutMs,
      };

      const req = client.request(options, (res) => {
        // Handle redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, url).toString();
          logger.debug(`Following redirect to: ${redirectUrl}`);
          resolve(this.makeRequest(redirectUrl, method, body, customHeaders));
          return;
        }

        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          chunks.push(Buffer.from(chunk));
        });

        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const encoding = (res.headers['content-encoding'] || '').toLowerCase();

          if (encoding.includes('gzip')) {
            zlib.gunzip(buffer, (err, decoded) => {
              if (err) return reject(err);
              resolve(decoded.toString('utf8'));
            });
          } else if (encoding.includes('deflate')) {
            zlib.inflate(buffer, (err, decoded) => {
              if (err) return reject(err);
              resolve(decoded.toString('utf8'));
            });
          } else {
            resolve(buffer.toString('utf8'));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (method === 'POST' && body) {
        req.write(body);
      }

      req.end();
    });
  }

  /**
   * POST request with form data (for ASP.NET pagination)
   */
  async post(url: string, formData: Record<string, string>): Promise<string> {
    const body = new URLSearchParams(formData).toString();
    return this.fetch(url, {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }
}
