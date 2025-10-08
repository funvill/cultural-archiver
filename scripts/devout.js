#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd, args, options = {}) {
  return spawn(cmd, args, { stdio: ['inherit', 'pipe', 'pipe'], shell: true, ...options });
}

async function main() {
  const logPath = path.resolve(process.cwd(), 'dev-server-logs.txt');
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });

  console.log('Running build...');
  await new Promise((resolve, reject) => {
    const p = run('npm', ['run', 'build']);
    p.stdout.pipe(process.stdout);
    p.stderr.pipe(process.stderr);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error('build failed'))));
  });

  console.log('Starting dev (combined) and writing logs to', logPath);
  const dev = run('npm', ['run', 'dev']);
  dev.stdout.pipe(process.stdout);
  dev.stderr.pipe(process.stderr);
  dev.stdout.pipe(logStream);
  dev.stderr.pipe(logStream);

  dev.on('close', (code) => {
    console.log('dev process exited with', code);
    logStream.end();
    process.exit(code);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
