export class NominatimApiClient {
    baseUrl = 'https://nominatim.openstreetmap.org';
    userAgent = 'cultural-archiver/1.0 (https://api.publicartregistry.com)';
    lastRequestTime = 0;
    rateLimitDelay = 1000; // 1 second between requests
    /**
     * Ensure we don't exceed Nominatim's rate limit of 1 request per second
     */
    async enforceRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.rateLimitDelay) {
            const waitTime = this.rateLimitDelay - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        this.lastRequestTime = Date.now();
    }
    /**
     * Perform reverse geocoding lookup using Nominatim
     */
    async reverseGeocode(lat, lon, options = {}) {
        await this.enforceRateLimit();
        const timeout = options.timeout || 10000; // 10 second default timeout
        const url = new URL(`${this.baseUrl}/reverse`);
        url.searchParams.set('lat', lat.toString());
        url.searchParams.set('lon', lon.toString());
        url.searchParams.set('format', 'json');
        url.searchParams.set('addressdetails', '1');
        url.searchParams.set('accept-language', 'en');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url.toString(), {
                headers: {
                    'User-Agent': this.userAgent,
                    Accept: 'application/json',
                },
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`Nominatim API error: ${response.status} ${response.statusText}`);
            }
            const data = (await response.json());
            if (!data || !data.display_name) {
                throw new Error('Invalid response from Nominatim API');
            }
            return this.parseNominatimResponse(data);
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    throw new Error(`Nominatim request timed out after ${timeout}ms`);
                }
                throw error;
            }
            throw new Error('Unknown error occurred during Nominatim request');
        }
    }
    /**
     * Parse Nominatim response into our LocationResult format
     */
    parseNominatimResponse(data) {
        const address = data.address || {};
        return {
            lat: parseFloat(data.lat),
            lon: parseFloat(data.lon),
            display_name: data.display_name,
            country_code: address.country_code || null,
            country: address.country || null,
            state: address.state || address.state_district || null,
            city: address.city || address.city_district || null,
            suburb: address.suburb || address.neighbourhood || null,
            neighbourhood: address.neighbourhood || null,
            road: address.road || null,
            postcode: address.postcode || null,
            source: 'nominatim',
            last_updated: new Date().toISOString(),
        };
    }
    /**
     * Convert LocationResult to LocationCacheRecord format for storage
     */
    static toLocationCacheRecord(locationResult, rawResponse) {
        return {
            lat: locationResult.lat,
            lon: locationResult.lon,
            version: '1.0',
            display_name: locationResult.display_name,
            country_code: locationResult.country_code,
            country: locationResult.country,
            state: locationResult.state,
            city: locationResult.city,
            suburb: locationResult.suburb,
            neighbourhood: locationResult.neighbourhood,
            road: locationResult.road,
            postcode: locationResult.postcode,
            raw_response: JSON.stringify(rawResponse),
        };
    }
    /**
     * Get the rate limit delay in milliseconds
     */
    getRateLimitDelay() {
        return this.rateLimitDelay;
    }
    /**
     * Get time until next request is allowed
     */
    getTimeUntilNextRequest() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        return Math.max(0, this.rateLimitDelay - timeSinceLastRequest);
    }
}
//# sourceMappingURL=nominatim-client.js.map