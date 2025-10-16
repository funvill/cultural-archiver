
I have run the "burnaby-art-gallery" scraper

`npx tsx src/mass-import/scraper/burnaby-art-gallery/cli.ts --verbose --output src\mass-import\scraper\output`

It produced the following outputs

- Artist output: `src\mass-import\scraper\output\burnaby-art-gallery-artists.json`
- Artwork output: `src\mass-import\scraper\output\burnaby-art-gallery-artworks.geojson`

I have reset the local database `database:reset:local`

I have started the local dev server `npm run devout`

Artist
`npx tsx src/mass-import/cli/cli-entry.ts import --importer artist-json --exporter api --input src\mass-import\scraper\output\burnaby-art-gallery-artists-flat.json --verbose --config src/mass-import/config/api-config-dev-v3.json`

Artwork
`npx tsx src/mass-import/cli/cli-entry.ts import --importer osm-artwork --exporter api --input src\mass-import\scraper\output\burnaby-art-gallery-artworks.geojson --verbose --config src/mass-import/config/api-config-dev-v3.json --limit 3 offset 0`