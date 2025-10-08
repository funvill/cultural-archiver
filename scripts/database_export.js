#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

const env = process.argv[2] || 'development';
const localFlag = process.argv[3] === 'local' ? '--local' : '';
const timestamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
const outName = `_backup_database/database_${env}_${timestamp}.sql`;

const cmd = `npx wrangler d1 export public-art-registry --output ${outName} --env ${env} ${localFlag} --config src/workers/wrangler.toml`;
console.log('Running:', cmd);
const r = spawnSync(cmd, { shell: true, stdio: 'inherit' });
process.exit(r.status || 0);
