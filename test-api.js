#!/usr/bin/env node
/**
 * Simple API testing script for Cultural Archiver Worker endpoints
 * Run with: node test-api.js
 */

const BASE_URL = 'http://127.0.0.1:8787';

async function testAPI() {
  console.log('🧪 Testing Cultural Archiver API endpoints...\n');

  // Test 1: Health check
  console.log('1️⃣ Testing health endpoint...');
  try {
    const response = await fetch(`${BASE_URL}/health`);
    console.log(`   Response status: ${response.status}`);
    console.log(`   Response headers: ${JSON.stringify([...response.headers.entries()])}`);
    
    const text = await response.text();
    console.log(`   Response body (first 200 chars): ${text.substring(0, 200)}`);
    
    try {
      const data = JSON.parse(text);
      console.log(`✅ Health check: ${response.status} - ${data.status}`);
      console.log(`   Environment: ${data.environment}`);
      console.log(`   Version: ${data.version}\n`);
    } catch (parseError) {
      console.log(`❌ Health check - JSON parse failed: ${parseError.message}`);
      console.log(`   Raw response: ${text.substring(0, 500)}\n`);
    }
  } catch (error) {
    console.log(`❌ Health check failed: ${error.message}\n`);
  }

  // Test 2: API status
  console.log('2️⃣ Testing API status endpoint...');
  try {
    const response = await fetch(`${BASE_URL}/api/status`);
    const data = await response.json();
    console.log(`✅ API status: ${response.status}`);
    console.log(`   Message: ${data.message}\n`);
  } catch (error) {
    console.log(`❌ API status failed: ${error.message}\n`);
  }

  // Test 3: Nearby artworks (requires coordinates)
  console.log('3️⃣ Testing nearby artworks endpoint...');
  try {
    // Vancouver coordinates
    const lat = 49.2827;
    const lon = -123.1207;
    const response = await fetch(`${BASE_URL}/api/artworks/nearby?lat=${lat}&lon=${lon}&radius=1000`);
    const data = await response.json();
    console.log(`✅ Nearby artworks: ${response.status}`);
    console.log(`   Found: ${data.artworks ? data.artworks.length : 0} artworks`);
    if (data.artworks && data.artworks.length > 0) {
      console.log(`   First artwork: ${data.artworks[0].title || 'Untitled'}`);
    }
    console.log('');
  } catch (error) {
    console.log(`❌ Nearby artworks failed: ${error.message}\n`);
  }

  // Test 4: User submissions (should fail without proper auth)
  console.log('4️⃣ Testing user submissions endpoint...');
  try {
    const response = await fetch(`${BASE_URL}/api/me/submissions`);
    const data = await response.json();
    if (response.status === 401) {
      console.log(`✅ User submissions properly requires auth: ${response.status}`);
      console.log(`   Message: ${data.message}\n`);
    } else {
      console.log(`⚠️  Unexpected response: ${response.status}`);
      console.log(`   Data: ${JSON.stringify(data, null, 2)}\n`);
    }
  } catch (error) {
    console.log(`❌ User submissions failed: ${error.message}\n`);
  }

  // Test 5: 404 handling
  console.log('5️⃣ Testing 404 handling...');
  try {
    const response = await fetch(`${BASE_URL}/api/nonexistent`);
    const data = await response.json();
    console.log(`✅ 404 handling: ${response.status}`);
    console.log(`   Available endpoints: ${data.available_endpoints?.length || 0} listed`);
    console.log('');
  } catch (error) {
    console.log(`❌ 404 test failed: ${error.message}\n`);
  }

  // Test 6: Legacy redirect
  console.log('6️⃣ Testing legacy redirect...');
  try {
    const response = await fetch(`${BASE_URL}/api/artworks`, { redirect: 'manual' });
    console.log(`✅ Legacy redirect: ${response.status}`);
    if (response.status === 302) {
      console.log(`   Redirects to: ${response.headers.get('location')}`);
    }
    console.log('');
  } catch (error) {
    console.log(`❌ Legacy redirect failed: ${error.message}\n`);
  }

  console.log('🎉 API testing completed!');
}

// Run the tests
testAPI().catch(console.error);
