#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: run_and_log.js <command...> <logfile>');
  process.exit(2);
}

const logFile = args[args.length - 1];
const cmd = args.slice(0, -1).join(' ');

console.log('Running:', cmd);
const out = fs.createWriteStream(logFile, { flags: 'a' });
const child = spawn(cmd, { shell: true, stdio: ['inherit', 'pipe', 'pipe'] });

child.stdout.on('data', (d) => {
  process.stdout.write(d);
  out.write(d);
});
child.stderr.on('data', (d) => {
  process.stderr.write(d);
  out.write(d);
});

child.on('close', (code) => {
  out.end();
  process.exit(code);
});
