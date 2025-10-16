const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../src/workers/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/26ccfce70347272a160a190e15af00a5be60b91de3a9b470cbd884bc797e6b3d.sqlite');

try {
  const db = new Database(dbPath, { readonly: true });
  const stmt = db.prepare(`SELECT id, name, status, created_at, updated_at FROM artists ORDER BY created_at DESC LIMIT 10`);
  const rows = stmt.all();
  if (!rows || rows.length === 0) {
    console.log('No artist rows found in DB.');
  } else {
    console.table(rows);
  }
  db.close();
} catch (err) {
  console.error('Error opening database or running query:', err.message);
  process.exitCode = 2;
}
