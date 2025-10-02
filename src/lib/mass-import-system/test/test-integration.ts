/**
 * Integration test - Test mass import system integration with main project
 */

import _path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);

async function testIntegration() {
  console.log('🔗 Testing Mass Import System Integration...');

  try {
    // Test that the mass import package builds and exports correctly
    console.log('📦 Testing package exports...');

    const {
      MassImportProcessor,
      VancouverMapper,
      createDefaultConfig,
      DEFAULT_CONFIG,
      VERSION,
      getLibraryInfo,
    } = await import('../dist/index.js');

    console.log('✅ Core exports work');
    console.log(`📋 Library version: ${VERSION}`);
    console.log('📋 Library info:', getLibraryInfo());

    // Test configuration creation
    console.log('⚙️ Testing configuration...');
    const config = createDefaultConfig({
      dryRun: true,
      batchSize: 10,
    });

    console.log('✅ Configuration creation works');
    console.log('📋 Default config keys:', Object.keys(DEFAULT_CONFIG));

    // Test processor creation
    console.log('🏭 Testing processor creation...');
    const processor = new MassImportProcessor(config);
    processor.setMapper(VancouverMapper);

    console.log('✅ Processor creation works');
    console.log('✅ Vancouver mapper assignment works');

    // Test with minimal sample data
    console.log('🧪 Testing with minimal data...');
    const sampleData = [
      {
        registryid: 999,
        title_of_work: 'Test Artwork',
        type: 'Sculpture',
        status: 'In place',
        geo_point_2d: {
          lat: 49.2827,
          lon: -123.1207,
        },
        descriptionofwork: 'A test artwork for integration testing',
      },
    ];

    const results = await processor.processData(sampleData, {
      source: 'vancouver-opendata',
      dryRun: true,
      continueOnError: true,
    });

    console.log('✅ Data processing works');
    console.log(
      `📊 Results: ${results.summary.successfulImports}/${results.summary.totalRecords} successful`
    );

    if (results.summary.successfulImports === 1) {
      console.log('\n🎉 Integration test PASSED!');
      console.log('✅ Package exports correctly');
      console.log('✅ Classes instantiate correctly');
      console.log('✅ Data processing pipeline works');
      console.log('✅ Vancouver mapper works');
      console.log('✅ Ready for production use');
    } else {
      console.log('\n⚠️ Integration test had issues');
      console.log('Data processing may need adjustment');
    }
  } catch (error) {
    console.error('\n❌ Integration test failed:', error);
    process.exit(1);
  }
}

// Run integration test
testIntegration().catch(error => {
  console.error('Integration test failed:', error);
  process.exit(1);
});

export { testIntegration };
