#!/usr/bin/env node
/**
 * Test script to validate the GitHub Actions workflow changes locally
 * 
 * This script simulates the key parts of the deployment workflow to ensure
 * our changes will work correctly in the CI environment.
 */

import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

async function testWorkflowChanges() {
  console.log('🧪 Testing GitHub Actions Workflow Changes');
  console.log('==========================================');
  console.log('');

  const wranglerTomlPath = join(projectRoot, 'src', 'workers', 'wrangler.toml');
  const testDatabaseId = 'test-db-id-12345';

  try {
    // Step 1: Read original wrangler.toml
    console.log('📝 Step 1: Reading original wrangler.toml');
    const originalContent = await readFile(wranglerTomlPath, 'utf8');
    
    if (!originalContent.includes('CHANGE_ME_PRODUCTION_DATABASE_ID')) {
      console.error('❌ Error: wrangler.toml does not contain expected placeholder');
      return false;
    }
    console.log('✅ Original configuration contains placeholder');

    // Step 2: Simulate the sed replacement that happens in GitHub Actions
    console.log('🔄 Step 2: Simulating database ID replacement');
    const updatedContent = originalContent.replace(
      /CHANGE_ME_PRODUCTION_DATABASE_ID/g, 
      testDatabaseId
    );
    
    await writeFile(wranglerTomlPath, updatedContent);
    console.log(`✅ Replaced placeholder with: ${testDatabaseId}`);

    // Step 3: Verify the replacement worked
    console.log('🔍 Step 3: Verifying replacement');
    const verifyContent = await readFile(wranglerTomlPath, 'utf8');
    
    if (verifyContent.includes('CHANGE_ME_PRODUCTION_DATABASE_ID')) {
      console.error('❌ Error: Placeholder was not replaced');
      return false;
    }
    
    if (!verifyContent.includes(testDatabaseId)) {
      console.error('❌ Error: Test database ID not found');
      return false;
    }
    console.log('✅ Replacement verification successful');

    // Step 4: Test migration sync command
    console.log('🔄 Step 4: Testing migration sync');
    await execAsync('npm run migrate:sync', { cwd: projectRoot });
    console.log('✅ Migration sync successful');

    // Step 5: Test migration validation
    console.log('🔍 Step 5: Testing migration validation');
    const { stdout, stderr } = await execAsync('npm run migrate:validate', { cwd: projectRoot });
    
    if (stderr && stderr.includes('error')) {
      console.error('❌ Migration validation failed');
      console.error(stderr);
      return false;
    }
    console.log('✅ Migration validation passed');

    // Step 6: Test migration command structure (dry run)
    console.log('🧪 Step 6: Testing production migration command structure');
    try {
      await execAsync('npm run migrate:prod -- --help', { cwd: projectRoot });
      console.log('✅ Production migration command is accessible');
    } catch (error) {
      // This is expected to fail without proper authentication, but the command should exist
      if (error.message.includes('Production Migration Safety Guard')) {
        console.log('✅ Production migration command structure is correct');
      } else {
        console.error('❌ Production migration command has issues');
        console.error(error.message);
        return false;
      }
    }

    console.log('');
    console.log('🎉 All Workflow Tests Passed!');
    console.log('');
    console.log('📋 Summary:');
    console.log('   ✅ Database ID placeholder replacement works');
    console.log('   ✅ Migration sync works');
    console.log('   ✅ Migration validation passes');
    console.log('   ✅ Production migration command structure is correct');
    console.log('');
    console.log('🚀 The GitHub Actions workflow should now work correctly!');
    console.log('');
    console.log('⚠️  Next steps:');
    console.log('   1. Ensure GitHub repository secrets are configured');
    console.log('   2. Push to main branch to test the actual workflow');
    console.log('   3. Monitor the Actions tab for successful deployment');

    return true;

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return false;
  } finally {
    // Step 7: Restore original wrangler.toml
    console.log('🔄 Restoring original wrangler.toml');
    try {
      const originalContent = await readFile(wranglerTomlPath, 'utf8');
      const restoredContent = originalContent.replace(
        new RegExp(testDatabaseId, 'g'),
        'CHANGE_ME_PRODUCTION_DATABASE_ID'
      );
      await writeFile(wranglerTomlPath, restoredContent);
      console.log('✅ Original configuration restored');
    } catch (restoreError) {
      console.error('⚠️  Warning: Could not restore original wrangler.toml');
      console.error('   Please manually check src/workers/wrangler.toml');
    }
  }
}

// Run the test
testWorkflowChanges()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });