#!/usr/bin/env node
// Watches src/frontend/public/pages and re-runs the generate script when files change.
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const pagesDir = path.resolve(__dirname, '..', 'public', 'pages');
const script = path.resolve(__dirname, 'generate-pages-manifest.cjs');

function runGenerator() {
  const proc = spawn(process.execPath, [script], { stdio: 'inherit' });
  proc.on('exit', (code) => {
    if (code !== 0) console.error('generate-pages-manifest exited with', code);
  });
}

// Initial run
runGenerator();

// Watch for changes in the pages directory
fs.watch(pagesDir, { recursive: true }, (eventType, filename) => {
  if (!filename) return;
  // Debounce rapid changes
  if (watchGenerator._timeout) clearTimeout(watchGenerator._timeout);
  watchGenerator._timeout = setTimeout(() => {
    console.log(`Detected change (${eventType}) in ${filename}, regenerating pages manifest...`);
    runGenerator();
  }, 150);
});

function watchGenerator() {}

// keep the process alive
process.on('SIGINT', () => process.exit());
