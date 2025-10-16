#!/usr/bin/env node
const fetch = require('node-fetch');

const artworkId = process.argv[2];
if (!artworkId) {
  console.error('Usage: node fetch-artwork-api.cjs <artwork_id>');
  process.exit(1);
}

const apiUrl = `http://localhost:8787/api/artworks/${artworkId}`;

fetch(apiUrl)
  .then(res => res.json())
  .then(data => {
    console.log(JSON.stringify(data, null, 2));
  })
  .catch(err => {
    console.error('Error fetching artwork:', err.message);
    process.exit(1);
  });
