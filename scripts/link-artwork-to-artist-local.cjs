const Database = require('better-sqlite3');
const path = require('path');

const artworkId = process.argv[2];
const artistId = process.argv[3];
if (!artworkId || !artistId) {
  console.error('Usage: node scripts/link-artwork-to-artist-local.cjs <artwork-id> <artist-id>');
  process.exit(2);
}

const dbPath = path.resolve(__dirname, '../src/workers/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/26ccfce70347272a160a190e15af00a5be60b91de3a9b470cbd884bc797e6b3d.sqlite');

try {
  const db = new Database(dbPath);
  const now = new Date().toISOString();
  const id = require('crypto').randomUUID();
  const stmt = db.prepare('INSERT INTO artwork_artists (artwork_id, artist_id, role, created_at) VALUES (?, ?, ?, ?)');
  const info = stmt.run(artworkId, artistId, 'primary', now);
  console.log('Link created, changes:', info.changes);
  db.close();
} catch (err) {
  console.error('DB error:', err.message);
  process.exitCode = 2;
}
