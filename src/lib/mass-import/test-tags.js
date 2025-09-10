import { VancouverMapper } from './src/importers/vancouver.js';
import fs from 'fs';

// Load the sample data
const data = JSON.parse(fs.readFileSync('./public-art-one.json', 'utf-8'));
const sampleArtwork = data[0];

console.log('=== Vancouver Artwork Sample ===');
console.log('Title:', sampleArtwork.title_of_work);
console.log('Registry ID:', sampleArtwork.registryid);
console.log('Original Fields:', Object.keys(sampleArtwork));

// Map the data using our mapper
const result = VancouverMapper.mapData(sampleArtwork);

if (result.isValid && result.data) {
  console.log('\n=== Generated Tags ===');
  const tags = result.data.tags || {};
  for (const [key, value] of Object.entries(tags)) {
    console.log(`${key}: ${value}`);
  }
  
  console.log('\n=== Logbook Entry Info ===');
  console.log('Note length:', result.data.note?.length || 0);
  console.log('Total tags:', Object.keys(tags).length);
} else {
  console.log('\n=== Validation Errors ===');
  result.errors?.forEach(error => console.log(`- ${error.message}`));
}
