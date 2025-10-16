const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../src/workers/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/26ccfce70347272a160a190e15af00a5be60b91de3a9b470cbd884bc797e6b3d.sqlite');
const ids = [
  'ab37dd64-8e07-4266-91e0-e81db4fce499',
  '82c84213-07c0-4127-8612-3f73c5552ee5',
  '6cdc8c14-2c87-4faf-a6fd-9ca961cd3184'
];

try {
  const db = new Database(dbPath, { readonly: true });
  const stmt = db.prepare(`SELECT id, name, status, created_at, updated_at FROM artists WHERE id IN (${ids.map(()=>'?').join(',')})`);
  const rows = stmt.all(...ids);
  if (!rows || rows.length === 0) {
    console.log('No rows found for provided IDs.');
  } else {
    console.table(rows);
  }
  db.close();
} catch (err) {
  console.error('Error opening database or running query:', err.message);
  process.exitCode = 2;
}
