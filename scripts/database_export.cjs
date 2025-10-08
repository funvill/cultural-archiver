#!/usr/bin/env node
const { spawnSync } = require('child_process');

const env = process.argv[2] || 'development';
const mode = process.argv[3] || 'remote'; // Default to remote for safety
const modeFlag = mode === 'local' ? '--local' : '--remote';
const timestamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
const outName = `_backup_database/database_${env}_${timestamp}.sql`;

const cmd = `npx wrangler d1 export public-art-registry --output ${outName} --env ${env} ${modeFlag} --config src/workers/wrangler.toml`;
console.log('Running:', cmd);
console.log(`Exporting ${env} database (${mode} mode) to ${outName}`);
const r = spawnSync(cmd, { shell: true, stdio: 'inherit' });
process.exit(r.status || 0);
