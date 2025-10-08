#!/usr/bin/env node
const { spawnSync } = require('child_process');

const file = process.env.IMPORT_FILE;
if (!file) {
  console.error('Set IMPORT_FILE env var to path of .sql file');
  process.exit(2);
}

console.log('WARNING: This will execute SQL against PRODUCTION database cultural-archiver.');
const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
readline.question('Type YES to continue: ', (answer) => {
  readline.close();
  if (answer !== 'YES') {
    console.log('Aborted.');
    process.exit(1);
  }
  const cmd = `npx wrangler d1 execute cultural-archiver --env production --config src/workers/wrangler.toml --file ${file}`;
  const r = spawnSync(cmd, { shell: true, stdio: 'inherit' });
  process.exit(r.status || 0);
});
