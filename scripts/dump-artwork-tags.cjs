const Database = require('better-sqlite3');
const path = require('path');

const artworkId = process.argv[2];
if (!artworkId) {
  console.error('Usage: node scripts/dump-artwork-tags.cjs <artwork-id>');
  process.exit(2);
}

const dbPath = path.resolve(__dirname, '../src/workers/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/26ccfce70347272a160a190e15af00a5be60b91de3a9b470cbd884bc797e6b3d.sqlite');

try {
  const db = new Database(dbPath, { readonly: true });
  const artStmt = db.prepare('SELECT tags FROM artwork WHERE id = ?');
  const row = artStmt.get(artworkId);
  if (!row) {
    console.log(`No artwork with id ${artworkId}`);
    process.exit(0);
  }
  try {
    const tags = JSON.parse(row.tags);
    console.log('tags keys:', Object.keys(tags).join(', '));
    if (tags.artists) {
      console.log('artists property:', JSON.stringify(tags.artists, null, 2));
    } else if (tags.artist) {
      console.log('artist property:', tags.artist);
    } else {
      console.log('No artist(s) found in tags');
    }
  } catch (err) {
    console.log('Failed to parse tags JSON:', err.message);
    console.log('tags raw:', row.tags);
  }
  db.close();
} catch (err) {
  console.error('DB error:', err.message);
}
