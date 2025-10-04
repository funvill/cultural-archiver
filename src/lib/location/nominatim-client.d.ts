import type { NominatimResponse, LocationResult, LocationLookupOptions } from '../../shared/types.js';
export declare class NominatimApiClient {
    private readonly baseUrl;
    private readonly userAgent;
    private lastRequestTime;
    private readonly rateLimitDelay;
    /**
     * Ensure we don't exceed Nominatim's rate limit of 1 request per second
     */
    private enforceRateLimit;
    /**
     * Perform reverse geocoding lookup using Nominatim
     */
    reverseGeocode(lat: number, lon: number, options?: LocationLookupOptions): Promise<LocationResult>;
    /**
     * Parse Nominatim response into our LocationResult format
     */
    private parseNominatimResponse;
    /**
     * Convert LocationResult to LocationCacheRecord format for storage
     */
    static toLocationCacheRecord(locationResult: LocationResult, rawResponse: NominatimResponse): {
        lat: number;
        lon: number;
        version: string;
        display_name: string;
        country_code: string | null;
        country: string | null;
        state: string | null;
        city: string | null;
        suburb: string | null;
        neighbourhood: string | null;
        road: string | null;
        postcode: string | null;
        raw_response: string;
    };
    /**
     * Get the rate limit delay in milliseconds
     */
    getRateLimitDelay(): number;
    /**
     * Get time until next request is allowed
     */
    getTimeUntilNextRequest(): number;
}
//# sourceMappingURL=nominatim-client.d.ts.map