#!/usr/bin/env node
// Runs the manifest watcher and the vite dev server together.
const { spawn } = require('child_process');
const path = require('path');

const cwd = path.resolve(__dirname, '..');

function spawnProcess(cmd, args, name) {
  const proc = spawn(cmd, args, { cwd, stdio: 'inherit', shell: true });
  proc.on('exit', (code) => {
    console.log(`${name} exited with code ${code}`);
    // If one process exits, kill the whole script
    process.exit(code);
  });
  return proc;
}

// Start watcher
const node = process.execPath;
const watcherScript = path.join(__dirname, 'watch-generate-pages-manifest.cjs');
const watcher = spawnProcess(node, [watcherScript], 'manifest-watcher');

// Start vite dev
const vite = spawnProcess('npm', ['run', 'dev:vite-raw'], 'vite');

// Forward SIGINT/SIGTERM
['SIGINT', 'SIGTERM'].forEach((sig) => {
  process.on(sig, () => {
    watcher.kill('SIGTERM');
    vite.kill('SIGTERM');
    process.exit();
  });
});
