/**
 * Quick test script to verify the Surrey scraper can correctly extract metadata
 * from the "Abstract Mountains" page
 */

import { SurreyCAScraper } from './scraper.js';

async function test(): Promise<void> {
  const scraper = new SurreyCAScraper();
  const url = 'https://www.surrey.ca/arts-culture/public-art/permanent-public-art-collection/abstract-mountains';
  
  console.log('Testing scraper on Abstract Mountains page...');
  console.log('URL:', url);
  console.log('');
  
  try {
    // @ts-expect-error - accessing private method for testing
    const artwork = await scraper.scrapeArtworkPage(url);
    
    console.log('✅ Successfully scraped artwork:');
    console.log('');
    console.log('Title:', artwork.title);
    console.log('Slug:', artwork.slug);
    console.log('Artists:', artwork.artists);
    console.log('Location:', artwork.location);
    console.log('Year:', artwork.year);
    console.log('Description:', artwork.description.substring(0, 100) + '...');
    console.log('Photo URLs:', artwork.photoUrls.length, 'photos');
    console.log('');
    
    // Verify the fix
    if (artwork.artists.length > 0 && artwork.artists[0] === 'Marie Khouri') {
      console.log('✅ Artist correctly extracted: Marie Khouri');
    } else {
      console.error('❌ Artist missing or incorrect:', artwork.artists);
    }
    
    if (artwork.location.includes('City Centre 2') && artwork.location.includes('9639 137A Street')) {
      console.log('✅ Location correctly extracted');
    } else {
      console.error('❌ Location missing or incorrect:', artwork.location);
    }
    
  } catch (error) {
    console.error('❌ Error scraping:', error);
    process.exit(1);
  }
}

test();
