#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const pagesDir = path.join(__dirname, '..', 'public', 'pages');
const outFile = path.join(pagesDir, '..', 'pages-manifest.json');

function getFirstHeading(content) {
  const m = content.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

function buildManifest() {
  if (!fs.existsSync(pagesDir)) {
    console.warn('No pages directory found, manifest will be empty:', pagesDir);
    fs.writeFileSync(outFile, JSON.stringify([]));
    return;
  }

  const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.md'));
  const pages = files.map(file => {
    const filePath = path.join(pagesDir, file);
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = matter(raw);
    const data = parsed.data || {};

    let title = data.title ? String(data.title) : null;
    if (!title) title = getFirstHeading(parsed.content);

    return {
      slug: file.replace(/\.md$/, ''),
      title: title || file.replace(/\.md$/, ''),
      date: data.date ? String(data.date) : null,
    };
  });

  // Sort as spec: undated first, then dated newest-first, then title
  pages.sort((a, b) => {
    if (!a.date && b.date) return -1;
    if (a.date && !b.date) return 1;
    if (!a.date && !b.date) return a.title.localeCompare(b.title);
    // both have dates - newest first
    const dc = b.date.localeCompare(a.date);
    if (dc !== 0) return dc;
    return a.title.localeCompare(b.title);
  });

  fs.writeFileSync(outFile, JSON.stringify(pages, null, 2), 'utf8');
  console.log('Wrote pages manifest to', outFile);
}

buildManifest();
