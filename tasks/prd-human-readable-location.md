Example: 

https://nominatim.openstreetmap.org/reverse?lat=49.266235&lon=-123.005677

```xml
<reversegeocode timestamp="Mon, 22 Sep 2025 21:02:12 +00:00" attribution="Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright" querystring="lat=49.266235&lon=-123.005677&format=xml">
<result place_id="416190473" osm_type="node" osm_id="13101188534" ref="Earth Grove" lat="49.2662345" lon="-123.0056766" boundingbox="49.2661845,49.2662845,-123.0057266,-123.0056266" place_rank="30" address_rank="30">Earth Grove, Lougheed Highway, West Central Valley, Brentwood, Burnaby, Metro Vancouver Regional District, British Columbia, V5C 6R6, Canada</result>
<addressparts>
<tourism>Earth Grove</tourism>
<road>Lougheed Highway</road>
<neighbourhood>West Central Valley</neighbourhood>
<suburb>Brentwood</suburb>
<city>Burnaby</city>
<county>Metro Vancouver Regional District</county>
<state>British Columbia</state>
<ISO3166-2-lvl4>CA-BC</ISO3166-2-lvl4>
<postcode>V5C 6R6</postcode>
<country>Canada</country>
<country_code>ca</country_code>
</addressparts>
</reversegeocode>
```

# PRD: Human-Readable Location Endpoint

## Executive Summary

We need an **internal HTTP endpoint** that converts raw GPS coordinates
into **human-readable place descriptions**, adapted to the map zoom
level. This will improve usability by showing users meaningful location
names (e.g., *"Mount Pleasant, Vancouver"* instead of raw lat/lon).

The service will use **Nominatim (OSM reverse geocoding)** as a backend,
with results cached in **Cloudflare D1 (SQLite-based DB)** to minimize
API calls and respect rate limits.

------------------------------------------------------------------------

## Problem Statement

GPS coordinates are not human-readable. We need to resolve them into
names, consistent with zoom-level context, so artworks and locations can
be displayed in a way that matches how people understand places.

------------------------------------------------------------------------

## Goals & Non-Goals

### Goals

-   Provide a **single-coordinate reverse geocoding endpoint**.\
-   Return **structured JSON** with normalized fields.\
-   Cache results in **Cloudflare D1**.\
-   Always return results in **English**.\
-   Generate our own **"pretty display string"** instead of using raw
    Nominatim `display_name`.\
-   Fallback to **region** when district/suburb is unavailable, and then
    fallback further as needed.\
-   Handle missing data gracefully with fallbacks.\
-   Implement **schema versioning** for stability.\
-   Support **cache warmup jobs** for known artwork locations.\
-   Hardcode simple zoom → place mappings, with **configurable display
    string rules per zoom**.

### Non-Goals

-   Batch lookups.\
-   Self-hosting Nominatim.\
-   Configurable zoom-to-place mappings beyond display string rules.\
-   Street-level handling (`zoom 18+`) --- not needed for MVP.

------------------------------------------------------------------------

## API Design

### Endpoint

    GET /api/location?lat={latitude}&lon={longitude}&zoom={zoom}

### Parameters

-   **lat** (required, float) -- Latitude of the point.\
-   **lon** (required, float) -- Longitude of the point.\
-   **zoom** (optional, int, default = 5).

### Zoom → Place Mapping

-   `zoom 3–5` → Country\
-   `zoom 6–9` → State / Province\
-   `zoom 10–13` → City / Town\
-   `zoom 14–17` → Suburb / District (fallback to Region if not
    available)\
-   `zoom 18+` → Not supported (future option)

### Response Format

``` json
{
  "version": "1.0",
  "country_code": "CA",
  "country": "Canada",
  "state": "British Columbia",
  "city": "Vancouver",
  "district": "Mount Pleasant",
  "region": null,
  "neighbourhood": null,
  "display_name": "Mount Pleasant, Vancouver, British Columbia, Canada",
  "source": "cache" | "nominatim",
  "last_updated": "2025-09-22T12:34:56Z"
}
```

------------------------------------------------------------------------

## Data & Storage

-   **Database**: Cloudflare D1 (SQLite).\
-   **Cache Key**: `lat:lon:zoom` rounded to 6 decimals.\
-   **Eviction**: Permanent storage, no TTL.\
-   **Warmup Jobs**: Batch import script pre-populates cache for known
    artworks.\
-   **Schema Versioning**: Store schema version in DB alongside results
    to protect against API changes.

------------------------------------------------------------------------

## External Dependencies

-   **Nominatim Public API**
    -   Respect rate limit: **1 request/sec**.\
    -   Always request in English (`accept-language=en`).\
    -   Include proper `User-Agent`.\
    -   Aggressively cache results to minimize load.

------------------------------------------------------------------------

## Attribution

-   Must display: *"Geocoding © OpenStreetMap contributors"* in any UI
    that shows resolved names.

------------------------------------------------------------------------

## Security

-   Internal-only endpoint (no external auth needed).\
-   Trusted services only.

------------------------------------------------------------------------

## Decisions on Open Questions

1.  **Fallback Depth** → Yes, always fallback further (e.g., from
    district → region → city → state → country).\
2.  **Cache Invalidation** → Not required for MVP.\
3.  **Pretty Display String Rules** → Configurable per zoom level.\
4.  **Street-level Handling** → Excluded from MVP.

------------------------------------------------------------------------

✅ This PRD is now **finalized for MVP**.
