import { osmImporter } from '../src/mass-import/importers/osm-artwork';
import * as fs from 'fs/promises';

async function main() {
  const data = await fs.readFile('src/mass-import/scraper/output/burnaby-art-gallery-artworks.geojson', 'utf-8');
  const config = {
    preset: 'general',
    includeFeatureTypes: ['artwork','sculpture','mural'],
    tagMappings: {},
    descriptionFields: ['description'],
    artistFields: ['artist_name','artist','created_by'],
  } as any;

  const mapped = await osmImporter.mapData(data, config);
  console.log('Mapped records (first 3):');
  console.dir(mapped.slice(0,3), { depth: 4 });
}

main().catch(err => { console.error(err); process.exit(1); });
