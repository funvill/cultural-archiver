#!/usr/bin/env node
/**
 * List all artworks in the local database
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

console.log('📂 Using database:', dbPath);

const db = new Database(dbPath, { readonly: true });

try {
  const artworks = db.prepare('SELECT id, title, status, created_at FROM artwork ORDER BY created_at DESC LIMIT 10').all();
  
  if (artworks.length === 0) {
    console.log('\n❌ No artworks found in database');
  } else {
    console.log(`\n✅ Found ${artworks.length} artwork(s):\n`);
    console.table(artworks);
  }
} catch (error) {
  console.error('❌ Error querying database:', error.message);
  process.exit(1);
} finally {
  db.close();
}
