const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../src/workers/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/26ccfce70347272a160a190e15af00a5be60b91de3a9b470cbd884bc797e6b3d.sqlite');
// IDs from the most recent import (adjusted for this run)
const ids = [
  '3071bad1-5076-40ec-b7b4-c9a3a5eabbc1',
  '23ba7b50-8053-432d-84ce-3dddf07197b8',
  '6a26d5e0-bcd3-450a-b4c2-8b7846c4aca4'
];

try {
  const db = new Database(dbPath);
  const now = Date.now().toString();
  const stmt = db.prepare(`UPDATE artists SET status = 'approved', updated_at = ? WHERE id IN (${ids.map(()=>'?').join(',')})`);
  const info = stmt.run(now, ...ids);
  console.log('Updated rows:', info.changes);
  console.log('Approved IDs:');
  ids.forEach(id => console.log('-', id));
  db.close();
} catch (err) {
  console.error('Error updating database:', err.message);
  process.exitCode = 2;
}
