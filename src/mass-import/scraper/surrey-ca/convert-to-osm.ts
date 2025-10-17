/**
 * Convert Surrey scraper GeoJSON to OSM-compatible format
 *
 * Transforms Surrey's custom property names to OSM tags that
 * the osm-artwork importer can process.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

interface SurreyFeature {
  type: 'Feature';
  id: string;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    title: string;
    artists: string[];
    location?: string;
    description?: string;
    photos?: string[];
    source: string;
    source_url: string;
    start_date?: string;
    notes?: string;
  };
}

interface OSMFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    '@id': string;
    tourism?: string;
    name: string;
    artist_name?: string;
    start_date?: string;
    description?: string;
    'image'?: string;
    'addr:full'?: string;
    source: string;
    source_url: string;
    notes?: string;
  };
}

async function convertSurreyToOSM(inputFile: string, outputFile: string): Promise<void> {
  console.log(`Reading Surrey GeoJSON from: ${inputFile}`);
  const input = await fs.readFile(inputFile, 'utf-8');
  const geoJson = JSON.parse(input) as {
    type: 'FeatureCollection';
    features: SurreyFeature[];
  };

  console.log(`Converting ${geoJson.features.length} Surrey features to OSM format...`);

  const osmFeatures: OSMFeature[] = geoJson.features.map((feature) => {
    const props = feature.properties;

    // Combine artists into a single string
    const artistName = props.artists.length > 0 ? props.artists.join(', ') : undefined;

    // Use first photo if available
    const image = props.photos && props.photos.length > 0 ? props.photos[0] : undefined;

    return {
      type: 'Feature',
      geometry: feature.geometry,
      properties: {
        '@id': feature.id,
        tourism: 'artwork',  // OSM tag for artwork
        name: props.title,
        artist_name: artistName,
        start_date: props.start_date,
        description: props.description,
        'image': image,
        'addr:full': props.location,
        source: props.source,
        source_url: props.source_url,
        notes: props.notes,
      },
    };
  });

  const outputGeoJson = {
    type: 'FeatureCollection' as const,
    features: osmFeatures,
  };

  // Ensure output directory exists
  await fs.mkdir(path.dirname(outputFile), { recursive: true });

  // Write output file
  await fs.writeFile(outputFile, JSON.stringify(outputGeoJson, null, 2));

  console.log(`✅ Converted ${osmFeatures.length} features`);
  console.log(`📄 Saved OSM-compatible GeoJSON to: ${outputFile}`);
}

// Main execution
const inputFile = process.argv[2] || 'src/mass-import/scraper/output/surrey-ca-artworks.geojson';
const outputFile = process.argv[3] || 'src/mass-import/scraper/output/surrey-ca-artworks-osm.geojson';

convertSurreyToOSM(inputFile, outputFile)
  .then(() => {
    console.log('\n✨ Conversion complete!');
  })
  .catch((error) => {
    console.error('❌ Conversion failed:', error);
    process.exit(1);
  });
