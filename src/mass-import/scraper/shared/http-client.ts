/**
 * HTTP client with retry logic and exponential backoff
 */

import { logger } from './logger';

export interface FetchOptions {
	maxRetries?: number;
	initialDelayMs?: number;
	timeoutMs?: number;
}

export class HttpClient {
	private maxRetries: number;
	private initialDelayMs: number;
	private timeoutMs: number;

	constructor(options: FetchOptions = {}) {
		this.maxRetries = options.maxRetries ?? 3;
		this.initialDelayMs = options.initialDelayMs ?? 1000;
		this.timeoutMs = options.timeoutMs ?? 30000;
	}

	/**
	 * Fetch with retry logic and exponential backoff
	 */
	async fetch(url: string): Promise<string> {
		let lastError: Error | null = null;

		for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
			try {
				logger.debug(`Fetching URL (attempt ${attempt + 1}/${this.maxRetries + 1})`, { url });

				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

				const response = await fetch(url, {
					signal: controller.signal,
					headers: {
						'User-Agent':
							'PublicArtRegistry-Scraper/1.0 (https://publicartregistry.com; educational/research purposes)',
					},
				});

				clearTimeout(timeoutId);

				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				// Check for rate limit header
				const retryAfter = response.headers.get('retry-after');
				if (retryAfter) {
					const delaySeconds = parseInt(retryAfter, 10);
					if (!isNaN(delaySeconds)) {
						logger.warn(`Rate limit detected, waiting ${delaySeconds}s`, { url });
						await this.sleep(delaySeconds * 1000);
					}
				}

				const text = await response.text();
				logger.debug(`Successfully fetched URL`, { url, size: text.length });

				return text;
			} catch (error) {
				lastError = error as Error;
				logger.warn(`Fetch attempt ${attempt + 1} failed`, {
					url,
					error: lastError.message,
				});

				// Don't retry on last attempt
				if (attempt < this.maxRetries) {
					// Exponential backoff
					const delay = this.initialDelayMs * Math.pow(2, attempt);
					logger.debug(`Waiting ${delay}ms before retry`);
					await this.sleep(delay);
				}
			}
		}

		throw new Error(
			`Failed to fetch after ${this.maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`
		);
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
