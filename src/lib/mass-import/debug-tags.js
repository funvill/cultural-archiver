import { VancouverMapper } from './src/importers/vancouver.js';
import fs from 'fs';

// Load the sample data
const data = JSON.parse(fs.readFileSync('./public-art.json', 'utf-8'));

// Test with the specific artwork that was imported (offset 1 = index 1)
const artworkData = data[1]; // This should be the "Untitled (Mural)" artwork

console.log('=== Vancouver Artwork Sample (Index 1) ===');
console.log('Registry ID:', artworkData.registryid);
console.log('Title:', artworkData.title_of_work);

// Map the data using our mapper
const result = VancouverMapper.mapData(artworkData);

if (result.isValid && result.data) {
  console.log('\n=== Generated Raw Import Data ===');
  console.log('Title:', result.data.title);
  console.log('Tags object:', JSON.stringify(result.data.tags, null, 2));
  console.log('Note:', result.data.note);
  console.log('Total tags:', Object.keys(result.data.tags || {}).length);
} else {
  console.log('\n=== Validation Errors ===');
  result.errors?.forEach(error => console.log(`- ${error.message}`));
}
