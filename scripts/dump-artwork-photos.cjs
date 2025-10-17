#!/usr/bin/env node
/**
 * Dump artwork photos from the local database
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Find the local D1 SQLite database
const wranglerStateDir = path.join(__dirname, '..', 'src', 'workers', '.wrangler', 'state', 'v3', 'd1');

function findDatabaseFile(dir) {
  if (!fs.existsSync(dir)) {
    console.error('❌ Wrangler state directory not found:', dir);
    console.error('💡 Have you run the dev server at least once?');
    process.exit(1);
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const dbFile = findDatabaseFile(fullPath);
      if (dbFile) return dbFile;
    } else if (entry.name.endsWith('.sqlite')) {
      return fullPath;
    }
  }
  
  return null;
}

const dbPath = findDatabaseFile(wranglerStateDir);

if (!dbPath) {
  console.error('❌ No SQLite database file found');
  console.error('💡 Have you run the dev server at least once?');
  process.exit(1);
}

const artworkId = process.argv[2];

if (!artworkId) {
  console.error('Usage: node scripts/dump-artwork-photos.cjs <artwork_id>');
  process.exit(1);
}

console.log('📂 Using database:', dbPath);

const db = new Database(dbPath, { readonly: true });

try {
  const artwork = db.prepare('SELECT id, title, photos FROM artwork WHERE id = ?').get(artworkId);
  
  if (!artwork) {
    console.log(`\n❌ No artwork found with id: ${artworkId}`);
    process.exit(1);
  }

  console.log(`\nArtwork: ${artwork.title} (${artwork.id})\n`);
  
  if (!artwork.photos) {
    console.log('❌ No photos field in artwork record');
  } else {
    try {
      const photos = JSON.parse(artwork.photos);
      console.log(`✅ Found ${photos.length} photo(s):\n`);
      console.log(JSON.stringify(photos, null, 2));
    } catch (error) {
      console.error('❌ Error parsing photos JSON:', error.message);
      console.log('Raw photos value:', artwork.photos);
    }
  }
} catch (error) {
  console.error('❌ Error querying database:', error.message);
  process.exit(1);
} finally {
  db.close();
}
