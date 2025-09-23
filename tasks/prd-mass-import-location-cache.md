# PRD: Mass Import Location Name Caching Module

## Executive Summary

This document outlines a new module for the `mass-import-system` to manage reverse geocoding of GPS coordinates into human-readable location names. The core of this module is a **local cache database** that stores results from the **Nominatim (OpenStreetMap) API**.

This system has two primary components:

1. A **cache-warming script** that runs in the background, processing existing import files to pre-populate the location database. This is necessary to respect Nominatim's rate limit of one request per second without slowing down imports.
2. An **integration with the mass-import system** that first checks the local cache for a location. If the location is not found, it will be fetched from Nominatim on-demand and stored for future use.

This module will eventually serve other parts of the application, such as the public-facing submission form.

---

## Problem Statement

The mass-import system processes thousands of artworks, each with GPS coordinates that need to be converted into human-readable addresses (e.g., "Mount Pleasant, Vancouver"). The primary external service for this, Nominatim, imposes a strict rate limit of **1 request per second**.

Performing these lookups in real-time during an import is not feasible, as it would make the process incredibly slow (e.g., importing 10,000 records would take over 2.7 hours on API calls alone). We need a robust, persistent caching mechanism to handle these lookups efficiently and reliably.

---

## Goals & Non-Goals

### Goals

- **Create a persistent local cache** for reverse geocoding results, stored in a local SQLite database.
- **Develop a cache-warming script** that can run in the background to populate the database from existing data sources (e.g., CSV or JSON import files).
- **Integrate the cache** into the `mass-import-system`. The system must query the local cache first before attempting to call the Nominatim API.
- **On-demand fetching**: If a location is not in the cache during an import, the system should fetch it from Nominatim, save it to the cache, and then proceed.
- **Graceful rate-limiting**: All requests to Nominatim must strictly adhere to the 1 request/second limit.
- **Reusability**: The module should be designed to be used by other parts of the application, like the main website's submission flow.
- **Structured Data**: The cache will store the structured address components from Nominatim, not just the display string.

### Non-Goals

- **Self-hosting Nominatim**: We will continue to use the public API.
- **Real-time cache invalidation**: For the MVP, cached results are considered permanent. We will not build a mechanism to refresh stale data.
- **Batch API lookups**: The system will fetch coordinates one by one.

---

## System Design

### 1. Local Cache Database

- **Technology**: A local SQLite database file (`location-cache.sqlite`).
- **Location**: The database file will be stored in a designated data directory, outside of the main source code (e.g., `_data/`). It should be added to `.gitignore`.
- **Schema**: The database will contain a table to store structured location data, keyed by latitude and longitude.

### 2. Cache Warming Script

- **Purpose**: To pre-populate the cache database before running a mass import.
- **Functionality**:
  - The script will be a standalone utility (e.g., `scripts/warm-location-cache.ts`).
  - It will accept an import file as input.
  - It will extract all unique GPS coordinate pairs from the file.
  - For each unique coordinate pair, it will check if an entry already exists in `location-cache.sqlite`.
  - If an entry does not exist, it will call the Nominatim API.
  - It will wait for 1 second between each API request to respect rate limits.
  - The fetched result will be saved into the SQLite database.
  - The script must be resumable, so if it's interrupted, it can continue where it left off without re-fetching existing entries.

### 3. Mass Import System Integration

- **Workflow**:
  1. During a mass import, when processing an artwork, the system will read its GPS coordinates.
  2. It will query the `location-cache.sqlite` database for a matching entry.
  3. **Cache Hit**: If a result is found, it is used immediately.
  4. **Cache Miss**: If no result is found, the system will: a. Call the Nominatim API to fetch the location data. b. Adhere to the 1-second delay. c. Save the new result into `location-cache.sqlite`. d. Use the result to proceed with the import.

---

## Data Schema

### `location_cache` Table

A single table in the `location-cache.sqlite` database will store the results.

| Column          | Type | Description                                                  |
| --------------- | ---- | ------------------------------------------------------------ |
| `lat`           | REAL | Latitude, rounded to 6 decimal places. Part of primary key.  |
| `lon`           | REAL | Longitude, rounded to 6 decimal places. Part of primary key. |
| `version`       | TEXT | Schema version of the stored result (e.g., "1.0").           |
| `display_name`  | TEXT | Full display name from Nominatim.                            |
| `country_code`  | TEXT | Two-letter country code (e.g., "ca").                        |
| `country`       | TEXT | Country name.                                                |
| `state`         | TEXT | State or province.                                           |
| `city`          | TEXT | City or town.                                                |
| `suburb`        | TEXT | Suburb or district.                                          |
| `neighbourhood` | TEXT | Neighbourhood name.                                          |
| `road`          | TEXT | Road name.                                                   |
| `postcode`      | TEXT | Postal code.                                                 |
| `raw_response`  | TEXT | The full JSON response from Nominatim, for future use.       |
| `created_at`    | TEXT | Timestamp (ISO 8601) of when the record was created.         |

**Primary Key**: `(lat, lon)`

An index will be created on `(lat, lon)` for fast lookups.

---

## Future Considerations

- **Cloud-based Cache**: For the production website, this local cache will need to be migrated to a cloud-native solution, likely using Cloudflare D1, to be accessible from the Cloudflare Worker that handles user submissions. The schema and logic should be easily portable.
- **Error Handling**: The system must gracefully handle API errors from Nominatim (e.g., 404 Not Found, 429 Too Many Requests) and network issues.
- **Attribution**: As per Nominatim's requirements, any UI that displays this data must include the attribution: "Geocoding © OpenStreetMap contributors".

---

✅ This PRD is now **finalized for MVP**.
