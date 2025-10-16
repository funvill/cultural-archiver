const Database = require('better-sqlite3');
const path = require('path');

const artworkId = process.argv[2];
if (!artworkId) {
  console.error('Usage: node scripts/inspect-artwork-links.cjs <artwork-id>');
  process.exit(2);
}

const dbPath = path.resolve(__dirname, '../src/workers/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/26ccfce70347272a160a190e15af00a5be60b91de3a9b470cbd884bc797e6b3d.sqlite');

try {
  const db = new Database(dbPath, { readonly: true });
  const artStmt = db.prepare('SELECT id, title, tags, status, created_at FROM artwork WHERE id = ?');
  const art = artStmt.get(artworkId);
  if (!art) {
    console.log(`No artwork found with id ${artworkId}`);
  } else {
    console.log('Artwork:');
    console.table([art]);
  }

  const linksStmt = db.prepare('SELECT artwork_id, artist_id, role, created_at FROM artwork_artists WHERE artwork_id = ?');
  const links = linksStmt.all(artworkId);
  if (!links || links.length === 0) {
    console.log('No artwork_artists links found for this artwork.');
  } else {
    console.log('Artwork artist links:');
    console.table(links);

    // Fetch artist names for linked IDs
    const artistIds = links.map(l => l.artist_id);
    const artistStmt = db.prepare(`SELECT id, name, status FROM artists WHERE id IN (${artistIds.map(()=>'?').join(',')})`);
    const artists = artistStmt.all(...artistIds);
    console.log('Linked artists:');
    console.table(artists);
  }

  db.close();
} catch (err) {
  console.error('DB error:', err.message);
  process.exitCode = 2;
}
