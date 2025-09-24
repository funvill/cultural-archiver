#!/usr/bin/env node

/**
 * Test script for the location cache system
 * This script tests the basic functionality of the location cache
 */

import { LocationService } from '../src/lib/location/service.js';

async function testLocationCache(): Promise<void> {
  console.log('🧪 Testing Location Cache System...\n');

  const locationService = new LocationService();

  try {
    // Test coordinates for Vancouver, BC
    const testCoordinates = [
      { lat: 49.2827, lon: -123.1207, name: 'Downtown Vancouver' },
      { lat: 49.2476, lon: -123.1336, name: 'VanDusen Botanical Garden' },
      { lat: 49.2606, lon: -123.246, name: 'UBC Campus' },
    ];

    console.log('📊 Initial cache stats:');
    console.log(locationService.getCacheStats());
    console.log();

    console.log('🗺️  Testing location lookups...\n');

    for (const coord of testCoordinates) {
      console.log(`Testing ${coord.name} (${coord.lat}, ${coord.lon}):`);

      // Check if already in cache
      const inCache = locationService.hasLocationInCache(coord.lat, coord.lon);
      console.log(`  In cache: ${inCache}`);

      try {
        const result = await locationService.getLocation(coord.lat, coord.lon);
        console.log(`  Result: ${result.display_name}`);
        console.log(`  Source: ${result.source}`);
        console.log(`  City: ${result.city || 'N/A'}`);
        console.log(`  Country: ${result.country || 'N/A'}`);
      } catch (error) {
        console.error(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      console.log();
    }

    console.log('📊 Final cache stats:');
    console.log(locationService.getCacheStats());
  } catch (error) {
    console.error('💥 Test failed:', error instanceof Error ? error.message : 'Unknown error');
  } finally {
    locationService.close();
  }
}

// Run the test
testLocationCache().catch(console.error);
