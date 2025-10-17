/**
 * Rate limiter with jitter for polite scraping
 */

export class RateLimiter {
	constructor(
		private delayMs: number = 1000,
		private jitterMs: number = 500
	) {}

	async wait(): Promise<void> {
		const jitter = Math.random() * this.jitterMs;
		const delay = this.delayMs + jitter;
		await new Promise((resolve) => setTimeout(resolve, delay));
	}

	setDelay(delayMs: number): void {
		this.delayMs = delayMs;
	}

	setJitter(jitterMs: number): void {
		this.jitterMs = jitterMs;
	}
}
