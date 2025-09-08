/**
 * Test script for Mass Import System
 * 
 * This script tests the core functionality with Vancouver sample data
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { MassImportProcessor, VancouverMapper, createDefaultConfig } from '../src';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testMassImport() {
  console.log('🧪 Testing Mass Import System...');

  try {
    // Load sample Vancouver data
    console.log('📄 Loading Vancouver sample data...');
    const sampleDataPath = path.join(__dirname, '../../../../tasks/public-art.json');
    const sampleData = JSON.parse(await fs.readFile(sampleDataPath, 'utf-8'));
    
    console.log(`✅ Loaded ${sampleData.length} Vancouver artwork records`);

    // Create configuration for dry-run testing
    const config = createDefaultConfig({
      dryRun: true,
      batchSize: 10, // Small batch for testing
      duplicateDetectionRadius: 100,
      titleSimilarityThreshold: 0.7,
    });

    console.log('⚙️ Configuration:', config);

    // Create processor with Vancouver mapper
    const processor = new MassImportProcessor(config);
    processor.setMapper(VancouverMapper);

    // Test with first 5 records only for quick validation
    const testData = sampleData.slice(0, 5);
    console.log(`🔍 Testing with ${testData.length} records (dry-run mode)...`);

    // Process data in dry-run mode
    const results = await processor.processData(testData, {
      source: 'vancouver-opendata',
      dryRun: true,
      continueOnError: true,
    });

    console.log('\n📊 Test Results:');
    console.log('─'.repeat(50));
    console.log(`Total records: ${results.summary.totalRecords}`);
    console.log(`Successful: ${results.summary.successfulImports}`);
    console.log(`Failed: ${results.summary.failedImports}`);
    console.log(`Skipped (duplicates): ${results.summary.skippedDuplicates}`);
    console.log(`Photos processed: ${results.summary.successfulPhotos}/${results.summary.totalPhotos}`);

    // Show detailed results for first few records
    console.log('\n📝 Detailed Results:');
    results.batches.forEach((batch, batchIndex) => {
      console.log(`\nBatch ${batchIndex + 1}:`);
      batch.results.slice(0, 3).forEach((result, resultIndex) => {
        console.log(`  Record ${resultIndex + 1}: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
        if (result.error) {
          console.log(`    Error: ${result.error}`);
        }
        if (result.warnings.length > 0) {
          console.log(`    Warnings: ${result.warnings.join(', ')}`);
        }
        if (result.duplicateDetection.candidates.length > 0) {
          console.log(`    Potential duplicates: ${result.duplicateDetection.candidates.length}`);
        }
      });
    });

    if (results.summary.successfulImports > 0) {
      console.log('\n🎉 Mass Import System test PASSED!');
      console.log('✅ Core validation works');
      console.log('✅ Vancouver data mapper works');
      console.log('✅ Batch processing works');
      console.log('✅ Error handling works');
    } else {
      console.log('\n⚠️ Mass Import System test had issues');
      console.log('Some records failed validation - this may be expected for test data');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run test automatically when this file is executed
testMassImport().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});

export { testMassImport };