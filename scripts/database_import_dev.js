#!/usr/bin/env node
const { spawnSync } = require('child_process');

console.log('Generating DROP TABLE statements for development database...');
const listCmd = `npx wrangler d1 execute cultural-archiver --env development --local --config src/workers/wrangler.toml --command "SELECT name FROM sqlite_master WHERE type=\"table\" AND name NOT LIKE \"sqlite_%\";" --json`;
const child = spawnSync(listCmd, { shell: true, encoding: 'utf8' });
if (child.status !== 0) {
  console.error('Failed to list tables');
  process.exit(child.status || 1);
}

let out;
try {
  out = JSON.parse(child.stdout);
} catch (err) {
  console.error('Failed to parse output:', err);
  console.error(child.stdout);
  process.exit(1);
}

const tables = (out.results || []).flatMap(r => r.results || []).map(r => r.name).filter(Boolean);
const fs = require('fs');
const dropPath = '_backup_database/drop_tables.sql';
const stmts = tables.map(t => `DROP TABLE IF EXISTS [${t}];`).join('\n');
fs.writeFileSync(dropPath, stmts, 'utf8');
console.log('Wrote', dropPath);

let r = spawnSync(`npx wrangler d1 execute cultural-archiver --env development --local --config src/workers/wrangler.toml --file ${dropPath}`, { shell: true, stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status);

r = spawnSync(`npx wrangler d1 execute cultural-archiver --env development --local --config src/workers/wrangler.toml`, { shell: true, stdio: 'inherit' });
process.exit(r.status || 0);
