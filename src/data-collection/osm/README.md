# OSM Public Artwork Fetcher



This tool systematically downloads **public artworks** (`tourism=artwork`) from [OpenStreetMap](https://www.openstreetmap.org/) by breaking a bounding box into smaller **map tiles** and querying the [Overpass API](https://overpass-api.de/).  

It is designed for **resume-friendly bulk import** into your own system:  
- Each tile’s results are saved as a standalone `.geojson` file.  
- A merged, **deduplicated GeoJSON** of all artworks is also created.  
- Existing tiles are skipped by default so you can safely re-run the script.  

Build with: https://chatgpt.com/share/68c22ce0-7cb8-800f-87c4-1a00b1d2a5cd

---

## How it Works

1. Define a bounding box (by latitude/longitude).  
2. Split it into slippy-map tiles at the chosen **zoom level**.  
3. For each tile:  
   - Query Overpass for `tourism=artwork`.  
   - Save results to `output/tiles/{z}-{x}-{y}.geojson`.  
4. Merge all tiles (fetched + skipped) into `output/merged/merged-artworks.geojson`.  
5. Skip tiles that already exist unless `--force` or `--maxAgeHours` is used.  

---

## Usage

```bash
node fetch-osm-artworks.js [options]
```

### Common Examples

- **Fetch artworks in Vancouver (default bbox)**  
  ```bash
  node fetch-osm-artworks.js
  ```

- **Force refresh all tiles, even if they already exist**  
  ```bash
  node fetch-osm-artworks.js --force=true
  ```

- **Refresh tiles older than 24 hours**  
  ```bash
  node fetch-osm-artworks.js --maxAgeHours=24
  ```

- **Custom bounding box + lower zoom (bigger tiles, fewer requests)**  
  ```bash
  node fetch-osm-artworks.js     --minLat 49.15 --minLon -123.27     --maxLat 49.32 --maxLon -123.02     --zoom 13
  ```

---

## Options

| Option          | Type    | Default       | Description |
|-----------------|---------|---------------|-------------|
| `--minLat`      | number  | 49.15         | Minimum latitude of bounding box |
| `--minLon`      | number  | -123.27       | Minimum longitude |
| `--maxLat`      | number  | 49.32         | Maximum latitude |
| `--maxLon`      | number  | -123.02       | Maximum longitude |
| `--zoom`        | number  | 14            | Tile zoom level (higher = smaller tiles, more API calls) |
| `--concurrency` | number  | 2             | How many tile requests run in parallel |
| `--sleepMs`     | number  | 1000          | Randomized base delay between requests (per tile, ms) |
| `--overpassUrl` | string  | `https://overpass-api.de/api/interpreter` | Overpass API endpoint |
| `--force`       | boolean | false         | Always fetch tiles, even if already saved |
| `--maxAgeHours` | number  | null          | Refetch only tiles older than this age (hours) |
| `--outDir`      | string  | `./output`    | Base output directory |

---

## Output

The script writes two kinds of files:

- **Per-tile GeoJSON**:  
  ```
  output/tiles/{zoom}-{x}-{y}.geojson
  ```
  Each contains a `FeatureCollection` of artworks for that tile.

- **Merged GeoJSON**:  
  ```
  output/merged/merged-artworks.geojson
  ```
  A deduplicated collection of all artworks across all tiles.

---

## Data Format

Each artwork is a GeoJSON `Feature` with:  

- `id`: OSM element identifier (`node/123`, `way/456`, `relation/789`)  
- `geometry`: Always a `Point` (nodes directly; ways/relations by `center`)  
- `properties`:  
  - `osm_type`: `"node"`, `"way"`, or `"relation"`  
  - `osm_id`: Numeric OSM ID  
  - **Tags** from OSM (`name`, `artwork_type`, `artist_name`, `material`, etc.)  

Example:

```json
{
  "type": "Feature",
  "id": "node/123456789",
  "geometry": {
    "type": "Point",
    "coordinates": [-123.116, 49.284]
  },
  "properties": {
    "osm_type": "node",
    "osm_id": 123456789,
    "tourism": "artwork",
    "artwork_type": "sculpture",
    "name": "Orca",
    "artist_name": "Douglas Coupland"
  }
}
```

---

## Notes

- **Attribution**: OSM data is licensed under [ODbL](https://www.openstreetmap.org/copyright). Always credit “© OpenStreetMap contributors”.  
- **API Load**: Be polite to Overpass servers. Use low concurrency and reasonable zoom levels. For heavy use, consider hosting your own Overpass instance.  
- **Geometry**: This script simplifies ways/relations to their centroid. For full geometry (polygons/lines), you’ll need heavier queries and parsers.  

---

## Next Steps

- Add support for **other OSM tags** (e.g., `artwork_type=mural`).  
- Write results into a **database** (e.g., SQLite, Postgres) instead of GeoJSON.  
- Integrate with **Cloudflare D1** or other storage.  
- Add `--skipEmpty` option to avoid saving zero-feature tiles.  

---
