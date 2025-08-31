#!/usr/bin/env node
/**
 * Deployment diagnosis script for Cultural Archiver API
 * Run with: node debug-deployment.js [base-url]
 * 
 * This script helps diagnose common deployment issues, especially the
 * "hello world" problem where the wrong worker is deployed.
 */

const BASE_URL = process.argv[2] || 'https://art-api.abluestar.com';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testEndpoint(url, description) {
  console.log(`\n🔍 Testing ${description}...`);
  console.log(`   URL: ${url}`);
  
  try {
    const response = await fetch(url);
    const responseText = await response.text();
    
    console.log(`   Status: ${response.status}`);
    console.log(`   Content-Type: ${response.headers.get('content-type')}`);
    
    // Check for "hello world" response (indicates wrong worker deployed)
    const isHelloWorldResponse = responseText.toLowerCase().trim() === 'hello world' || 
                                 (responseText.toLowerCase().includes('hello world') && 
                                  !responseText.includes('{') && 
                                  !responseText.includes('json'));
    
    if (isHelloWorldResponse) {
      console.log(`   This indicates the wrong worker is deployed.`);
      console.log(`   Expected: JSON response with proper API data`);
      console.log(`   Got: "${responseText.substring(0, 100)}..."`);
      return { status: 'wrong_worker', data: responseText };
    }
    
    // Try to parse as JSON
    try {
      const data = JSON.parse(responseText);
      console.log(`✅ JSON Response: ${Object.keys(data).join(', ')}`);
      return { status: 'success', data };
    } catch (parseError) {
      console.log(`⚠️  Non-JSON Response: ${responseText.substring(0, 200)}...`);
      return { status: 'non_json', data: responseText };
    }
    
  } catch (error) {
    console.log(`❌ Request Failed: ${error.message}`);
    return { status: 'error', error: error.message };
  }
}

async function diagnosisAPI() {
  console.log('🚀 Cultural Archiver API Deployment Diagnosis');
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log('='.repeat(60));

  const issues = [];
  
  // Test 1: Basic test endpoint
  const testResult = await testEndpoint(`${BASE_URL}/test`, 'Basic Test Endpoint');
  if (testResult.status === 'wrong_worker') {
    issues.push({
      type: 'CRITICAL',
      issue: 'Wrong worker deployed',
      endpoint: '/test',
      description: 'The API is returning "hello world" instead of proper JSON responses',
      solution: 'Check worker deployment configuration and redeploy correct worker'
    });
  } else if (testResult.status === 'success') {
    console.log(`   Environment: ${testResult.data.environment || 'unknown'}`);
    console.log(`   Version: ${testResult.data.version || 'unknown'}`);
    if (testResult.data.debug_note) {
      console.log(`   Debug: ${testResult.data.debug_note}`);
    }
  }
  
  await delay(1000);
  
  // Test 2: Health endpoint
  const healthResult = await testEndpoint(`${BASE_URL}/health`, 'Health Check Endpoint');
  if (healthResult.status === 'wrong_worker') {
    issues.push({
      type: 'CRITICAL',
      issue: 'Wrong worker deployed',
      endpoint: '/health',
      description: 'Health endpoint returning "hello world" instead of health data'
    });
  } else if (healthResult.status === 'success') {
    const health = healthResult.data;
    console.log(`   Overall Status: ${health.status || 'unknown'}`);
    if (health.summary) {
      console.log(`   Health Summary: ${health.summary.overall_health}`);
      console.log(`   Test Duration: ${health.summary.test_duration_ms}ms`);
    }
    
    // Check for common health issues
    if (health.checks) {
      const failedChecks = Object.entries(health.checks)
        .filter(([_, check]) => check.status === 'unhealthy')
        .map(([name, check]) => ({ name, error: check.error }));
      
      if (failedChecks.length > 0) {
        issues.push({
          type: 'WARNING',
          issue: 'Health check failures',
          description: `${failedChecks.length} health checks failed`,
          details: failedChecks
        });
      }
    }
  }
  
  await delay(1000);
  
  // Test 3: API Status endpoint
  const statusResult = await testEndpoint(`${BASE_URL}/api/status`, 'API Status Endpoint');
  if (statusResult.status === 'wrong_worker') {
    issues.push({
      type: 'CRITICAL',
      issue: 'Wrong worker deployed',
      endpoint: '/api/status',
      description: 'API status endpoint returning "hello world"'
    });
  }
  
  await delay(1000);
  
  // Test 4: Sample API endpoint
  const nearbyResult = await testEndpoint(
    `${BASE_URL}/api/artworks/nearby?lat=49.2827&lon=-123.1207`, 
    'Sample API Endpoint'
  );
  if (nearbyResult.status === 'wrong_worker') {
    issues.push({
      type: 'CRITICAL',
      issue: 'Wrong worker deployed',
      endpoint: '/api/artworks/nearby',
      description: 'API endpoints returning "hello world"'
    });
  }
  
  await delay(1000);
  
  // Test 5: 404 handling
  const notFoundResult = await testEndpoint(`${BASE_URL}/nonexistent`, '404 Error Handling');
  if (notFoundResult.status === 'wrong_worker') {
    issues.push({
      type: 'CRITICAL',
      issue: 'Wrong worker deployed',
      endpoint: '/nonexistent',
      description: '404 handler returning "hello world"'
    });
  }
  
  // Report findings
  console.log('\n' + '='.repeat(60));
  console.log('📊 DIAGNOSIS RESULTS');
  console.log('='.repeat(60));
  
  if (issues.length === 0) {
    console.log('✅ No major deployment issues detected!');
    console.log('   The API appears to be deployed correctly.');
  } else {
    console.log(`❌ Found ${issues.length} deployment issue(s):`);
    
    issues.forEach((issue, index) => {
      console.log(`\n${index + 1}. ${issue.type}: ${issue.issue}`);
      if (issue.endpoint) console.log(`   Endpoint: ${issue.endpoint}`);
      console.log(`   Description: ${issue.description}`);
      if (issue.solution) console.log(`   Solution: ${issue.solution}`);
      if (issue.details) {
        console.log(`   Details: ${JSON.stringify(issue.details, null, 2)}`);
      }
    });
  }
  
  // Provide specific guidance
  console.log('\n' + '='.repeat(60));
  console.log('🔧 TROUBLESHOOTING GUIDANCE');
  console.log('='.repeat(60));
  
  const hasCriticalIssues = issues.some(issue => issue.type === 'CRITICAL');
  
  if (hasCriticalIssues) {
    console.log('\n🚨 CRITICAL ISSUE: Wrong Worker Deployed');
    console.log('The API is returning "hello world" instead of proper responses.');
    console.log('This typically means:');
    console.log('1. A basic "hello world" worker is deployed instead of the Cultural Archiver API');
    console.log('2. The custom domain is pointing to the wrong worker');
    console.log('3. The deployment configuration is incorrect');
    
    console.log('\n💡 IMMEDIATE ACTIONS:');
    console.log('1. Check Cloudflare Dashboard > Workers & Pages');
    console.log('2. Verify the custom domain art-api.abluestar.com points to the correct worker');
    console.log('3. Redeploy the Cultural Archiver API worker:');
    console.log('   cd src/workers');
    console.log('   wrangler deploy --env production');
    console.log('4. Run this script again to verify the fix');
  } else {
    console.log('\n✅ No critical deployment issues detected.');
    console.log('The Cultural Archiver API appears to be properly deployed.');
    
    if (issues.length > 0) {
      console.log('\n⚠️  Minor issues detected:');
      console.log('- Check the health endpoint for detailed service status');
      console.log('- Review logs with: wrangler tail --name cultural-archiver-workers-prod');
    }
  }
  
  console.log('\n📚 For more help, see: docs/deployment.md#troubleshooting');
  console.log('🔗 Test again with: node debug-deployment.js [url]');
}

// Run the diagnosis
diagnosisAPI().catch(console.error);