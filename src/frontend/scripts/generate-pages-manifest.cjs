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
      category: data.category ? String(data.category) : null,
    };
  });

  // Sort by category first, then by date (newest first), then by title
  pages.sort((a, b) => {
    // Uncategorized pages first
    if (!a.category && b.category) return -1;
    if (a.category && !b.category) return 1;
    
    // Both have categories, sort by category alphabetically
    if (a.category && b.category) {
      const categoryCompare = a.category.localeCompare(b.category);
      if (categoryCompare !== 0) return categoryCompare;
    }
    
    // Same category (or both uncategorized), sort by date
    if (!a.date && b.date) return -1;
    if (a.date && !b.date) return 1;
    if (!a.date && !b.date) return a.title.localeCompare(b.title);
    const dc = b.date.localeCompare(a.date);
    if (dc !== 0) return dc;
    return a.title.localeCompare(b.title);
  });

  fs.writeFileSync(outFile, JSON.stringify(pages, null, 2), 'utf8');
  console.log('Wrote pages manifest to', outFile);
}

buildManifest();
