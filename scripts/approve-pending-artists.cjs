const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../src/workers/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/26ccfce70347272a160a190e15af00a5be60b91de3a9b470cbd884bc797e6b3d.sqlite');

try {
  const db = new Database(dbPath);
  const pendingRows = db.prepare("SELECT id, name, status, created_at FROM artists WHERE status != 'approved' ORDER BY created_at DESC").all();

  if (!pendingRows || pendingRows.length === 0) {
    console.log('No non-approved artist rows found.');
    process.exit(0);
  }

  console.log('Found pending/non-approved artist rows:');
  pendingRows.forEach(r => console.log('-', r.id, r.name, r.status));

  const now = Date.now().toString();
  const stmt = db.prepare("UPDATE artists SET status = 'approved', updated_at = ? WHERE status != 'approved'");
  const info = stmt.run(now);
  console.log('Updated rows to approved:', info.changes);

  const updatedIds = pendingRows.map(r => r.id);
  console.log('Approved IDs:');
  updatedIds.forEach(id => console.log('-', id));

  db.close();
} catch (err) {
  console.error('Error updating database:', err.message);
  process.exitCode = 2;
}
