#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

type Coord = { lat: number; lon: number };

function extractCoordinates(filePath: string): Coord[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    console.error('Failed to parse JSON:', e);
    process.exit(1);
  }

  const coords: Coord[] = [];

  if (parsed && typeof parsed === 'object') {
    // GeoJSON FeatureCollection
    if (
      'type' in (parsed as Record<string, unknown>) &&
      (parsed as Record<string, unknown>)['type'] === 'FeatureCollection'
    ) {
      const features = ((parsed as Record<string, unknown>)['features'] as unknown[]) || [];
      for (const f of features) {
        if (typeof f === 'object' && f !== null) {
          const geom = (f as Record<string, unknown>)['geometry'];
          if (
            typeof geom === 'object' &&
            geom !== null &&
            (geom as Record<string, unknown>)['type'] === 'Point'
          ) {
            const c = (geom as Record<string, unknown>)['coordinates'] as unknown[];
            if (Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number')
              coords.push({ lon: c[0] as number, lat: c[1] as number });
          }
        }
      }
      return coords;
    }

    // Assume top-level array of records
    const arr = Array.isArray(parsed) ? (parsed as unknown[]) : [parsed];
    for (const r of arr) {
      if (typeof r !== 'object' || r === null) continue;
      const rec = r as Record<string, unknown>;
      // geo_point_2d
      if ('geo_point_2d' in rec) {
        const gp = rec['geo_point_2d'] as Record<string, unknown>;
        const lat = gp?.['lat'] as number;
        const lon = gp?.['lon'] as number;
        if (typeof lat === 'number' && typeof lon === 'number') coords.push({ lat, lon });
        continue;
      }
      // geom.geometry.coordinates or geometry.coordinates
      const maybeGeom = rec['geom'] ?? rec['geometry'];
      if (maybeGeom && typeof maybeGeom === 'object') {
        const inner = (maybeGeom as Record<string, unknown>)['geometry'] ?? maybeGeom;
        if (
          inner &&
          typeof inner === 'object' &&
          (inner as Record<string, unknown>)['type'] === 'Point'
        ) {
          const c = (inner as Record<string, unknown>)['coordinates'] as unknown[];
          if (Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number')
            coords.push({ lat: c[1] as number, lon: c[0] as number });
          continue;
        }
      }

      // fallback lat/lon fields
      const lat =
        rec['lat'] ??
        rec['latitude'] ??
        (rec['location'] && (rec['location'] as Record<string, unknown>)['lat']);
      const lon =
        rec['lon'] ??
        rec['longitude'] ??
        (rec['location'] && (rec['location'] as Record<string, unknown>)['lon']);
      if (typeof lat === 'number' && typeof lon === 'number') coords.push({ lat, lon });
    }
  }

  return coords;
}

const file = process.argv[2] ?? 'src/lib/mass-import-system/importers/public-art.json';
const full = path.resolve(file);
console.log('Previewing coordinates from', full);
const c = extractCoordinates(full);
console.log(`Found ${c.length} coordinates`);
console.log('Sample (first 10):', c.slice(0, 10));
