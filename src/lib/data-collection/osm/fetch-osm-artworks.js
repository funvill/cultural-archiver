#!/usr/bin/env node
/**
 * Fetch OSM public artworks (tourism=artwork) by tiling a bounding box.
 * Node 18+ (uses built-in fetch).
 *
 * Outputs:
 *   ./output/tiles/{z}-{x}-{y}.geojson     (per-tile features)
 *   ./output/merged/merged-artworks.geojson (deduped FeatureCollection)
 *
 * New:
 *   - Skips requesting tiles that already exist locally.
 *   - --force=true to override skipping.
 *   - --maxAgeHours=NN to refetch tiles older than NN hours.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------- Config (defaults) ----------------------
const DEFAULTS = {
  minLat: 49.15,
  minLon: -123.27,
  maxLat: 49.32,
  maxLon: -123.02,
  zoom: 14,
  overpassUrl: "https://overpass-api.de/api/interpreter",
  concurrency: 2,
  sleepMs: 1000,
  maxRetries: 5,
  backoffBaseMs: 1000,
  outDir: "./output",

  // Resume controls
  force: false,          // if true, fetch even if tile file exists
  maxAgeHours: null,     // number: refetch if older than this (null = never refetch)
};

// ---------------------- CLI arg parsing ----------------------
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [k, v] = arg.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);

function numArg(name, fallback) {
  if (args[name] === undefined) return fallback;
  const n = Number(args[name]);
  return Number.isFinite(n) ? n : fallback;
}

function boolArg(name, fallback) {
  if (args[name] === undefined) return fallback;
  const v = String(args[name]).toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

const cfg = {
  minLat: numArg("minLat", DEFAULTS.minLat),
  minLon: numArg("minLon", DEFAULTS.minLon),
  maxLat: numArg("maxLat", DEFAULTS.maxLat),
  maxLon: numArg("maxLon", DEFAULTS.maxLon),
  zoom: numArg("zoom", DEFAULTS.zoom),
  concurrency: numArg("concurrency", DEFAULTS.concurrency),
  sleepMs: numArg("sleepMs", DEFAULTS.sleepMs),
  maxRetries: numArg("maxRetries", DEFAULTS.maxRetries),
  backoffBaseMs: numArg("backoffBaseMs", DEFAULTS.backoffBaseMs),
  overpassUrl: args.overpassUrl ?? DEFAULTS.overpassUrl,
  outDir: args.outDir ?? DEFAULTS.outDir,

  force: boolArg("force", DEFAULTS.force),
  maxAgeHours:
    args.maxAgeHours === undefined || args.maxAgeHours === null
      ? DEFAULTS.maxAgeHours
      : Number(args.maxAgeHours),
};

// ---------------------- Helpers ----------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function lon2tileX(lon, z) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
}
function lat2tileY(lat, z) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
      Math.pow(2, z)
  );
}
function tileX2lon(x, z) {
  return (x / Math.pow(2, z)) * 360 - 180;
}
function tileY2lat(y, z) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function bboxFromTile(x, y, z) {
  const minLon = tileX2lon(x, z);
  const maxLon = tileX2lon(x + 1, z);
  const maxLat = tileY2lat(y, z);
  const minLat = tileY2lat(y + 1, z);
  return { minLat, minLon, maxLat, maxLon };
}

function clampBBoxTo(b, clamp) {
  return {
    minLat: Math.max(b.minLat, clamp.minLat),
    minLon: Math.max(b.minLon, clamp.minLon),
    maxLat: Math.min(b.maxLat, clamp.maxLat),
    maxLon: Math.min(b.maxLon, clamp.maxLon),
  };
}

function overpassQuery(bbox) {
  const { minLat, minLon, maxLat, maxLon } = bbox;
  return `
[out:json][timeout:60];
(
  node["tourism"="artwork"](${minLat},${minLon},${maxLat},${maxLon});
  way["tourism"="artwork"](${minLat},${minLon},${maxLat},${maxLon});
  relation["tourism"="artwork"](${minLat},${minLon},${maxLat},${maxLon});
);
out center tags;
`;
}

function elementsToGeoJSON(elements) {
  return elements
    .map((el) => {
      let geometry = null;
      if (el.type === "node") {
        geometry = { type: "Point", coordinates: [el.lon, el.lat] };
      } else if (el.center && typeof el.center.lon === "number") {
        geometry = {
          type: "Point",
          coordinates: [el.center.lon, el.center.lat],
        };
      } else {
        return null;
      }
      return {
        type: "Feature",
        id: `${el.type}/${el.id}`,
        properties: { osm_type: el.type, osm_id: el.id, ...el.tags },
        geometry,
      };
    })
    .filter(Boolean);
}

async function fetchOverpass(query, { maxRetries, backoffBaseMs, endpoint }) {
  let attempt = 0;
  while (true) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }),
      });
      if (!res.ok) {
        const text = await res.text();
        if ([429, 504, 502, 503].includes(res.status) && attempt < maxRetries) {
          attempt++;
          const wait = backoffBaseMs * Math.pow(2, attempt - 1);
          console.warn(
            `Overpass ${res.status}. Retry ${attempt}/${maxRetries} in ${wait}ms`
          );
          await sleep(wait);
          continue;
        }
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt < maxRetries) {
        attempt++;
        const wait = backoffBaseMs * Math.pow(2, attempt - 1);
        console.warn(
          `Network/error: ${err?.message || err}. Retry ${attempt}/${maxRetries} in ${wait}ms`
        );
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
}

// Should we skip fetching this tile?
function shouldSkip(tilePath, { force, maxAgeHours }) {
  if (force) return false;
  if (!fs.existsSync(tilePath)) return false;

  // zero-byte or corrupt file? re-fetch
  try {
    const stat = fs.statSync(tilePath);
    if (stat.size === 0) return false;
    if (maxAgeHours == null) return true; // exists & ok => skip

    const ageMs = Date.now() - stat.mtimeMs;
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    return ageMs < maxAgeMs; // skip if younger than maxAge
  } catch {
    return false;
  }
}

// ---------------------- Main workflow ----------------------
async function main() {
  const bbox = {
    minLat: Math.min(cfg.minLat, cfg.maxLat),
    minLon: Math.min(cfg.minLon, cfg.maxLon),
    maxLat: Math.max(cfg.minLat, cfg.maxLat),
    maxLon: Math.max(cfg.minLon, cfg.maxLon),
  };

  const outTilesDir = path.resolve(__dirname, cfg.outDir, "tiles");
  const outMergedDir = path.resolve(__dirname, cfg.outDir, "merged");
  ensureDir(outTilesDir);
  ensureDir(outMergedDir);

  const minX = lon2tileX(bbox.minLon, cfg.zoom);
  const maxX = lon2tileX(bbox.maxLon, cfg.zoom);
  const minY = lat2tileY(bbox.maxLat, cfg.zoom);
  const maxY = lat2tileY(bbox.minLat, cfg.zoom);

  const tiles = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      const tB = clampBBoxTo(bboxFromTile(x, y, cfg.zoom), bbox);
      if (tB.minLat >= tB.maxLat || tB.minLon >= tB.maxLon) continue;
      tiles.push({ x, y, z: cfg.zoom, bbox: tB });
    }
  }

  console.log(
    `Will process ${tiles.length} tiles at z=${cfg.zoom} (force=${cfg.force}, maxAgeHours=${cfg.maxAgeHours ?? "none"})`
  );

  const queue = [...tiles];
  const perTileResults = new Map();

  let processed = 0;
  let fetched = 0;
  let skipped = 0;
  let inFlight = 0;

  async function worker(workerId) {
    while (queue.length) {
      const tile = queue.shift();
      if (!tile) break;
      inFlight++;
      const key = `${tile.z}-${tile.x}-${tile.y}`;
      const tilePath = path.join(outTilesDir, `${key}.geojson`);

      try {
        if (shouldSkip(tilePath, { force: cfg.force, maxAgeHours: cfg.maxAgeHours })) {
          skipped++;
          if (processed % 20 === 0) await sleep(10); // tiny yield
          console.log(`[tile ${key}] skipped (exists${cfg.maxAgeHours ? ` & fresh` : ""})`);
        } else {
          await sleep(cfg.sleepMs * Math.random()); // polite stagger
          const query = overpassQuery(tile.bbox);
          const data = await fetchOverpass(query, {
            maxRetries: cfg.maxRetries,
            backoffBaseMs: cfg.backoffBaseMs,
            endpoint: cfg.overpassUrl,
          });
          const features = elementsToGeoJSON(data.elements || []);
          perTileResults.set(key, features);

          fs.writeFileSync(
            tilePath,
            JSON.stringify({ type: "FeatureCollection", features }, null, 2),
            "utf-8"
          );
          // touch mtime -> now (useful for freshness checks)
          fs.utimesSync(tilePath, new Date(), new Date());

          fetched++;
          console.log(`[tile ${key}] fetched features: ${features.length}`);
        }
      } catch (err) {
        console.error(`[tile ${key}] ERROR:`, err?.message || err);
      } finally {
        processed++;
        inFlight--;
      }
    }
  }

  const workers = Array.from({ length: cfg.concurrency }, (_, i) => worker(i + 1));
  await Promise.all(workers);

  // Merge & dedupe (reads both fetched-in-this-run and previously existing tiles)
  const seen = new Set();
  const merged = [];

  // Read all existing tile files under outTilesDir (so skipped ones count too)
  const allFiles = fs
    .readdirSync(outTilesDir)
    .filter((f) => f.endsWith(".geojson"));

  for (const f of allFiles) {
    try {
      const raw = fs.readFileSync(path.join(outTilesDir, f), "utf-8");
      const json = JSON.parse(raw);
      const feats = json?.features ?? [];
      for (const feat of feats) {
        const id =
          feat?.id ||
          `${feat?.properties?.osm_type}/${feat?.properties?.osm_id}`;
        if (!id) continue;
        if (seen.has(id)) continue;
        seen.add(id);
        merged.push(feat);
      }
    } catch (e) {
      console.warn(`[merge] skipped unreadable file ${f}: ${e.message}`);
    }
  }

  const mergedPath = path.join(outMergedDir, "merged-artworks.geojson");
  fs.writeFileSync(
    mergedPath,
    JSON.stringify({ type: "FeatureCollection", features: merged }, null, 2),
    "utf-8"
  );

  console.log(
    `Done. Tiles processed: ${processed}/${tiles.length}. fetched=${fetched}, skipped=${skipped}. Deduped features: ${merged.length}.`
  );
  console.log(`Merged GeoJSON: ${mergedPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
