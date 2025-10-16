/**
 * Transform scraper GeoJSON format to OSM-compatible format
 * 
 * This script transforms GeoJSON files from the scraper format to a format
 * compatible with the osm-artwork importer by adding required OSM properties.
 */

const fs = require('fs');
const path = require('path');

function transformScraperToOSM(inputPath, outputPath) {
  console.log(`📖 Reading ${inputPath}...`);
  const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

  if (!data.features || !Array.isArray(data.features)) {
    throw new Error('Invalid GeoJSON: missing features array');
  }

  console.log(`🔄 Transforming ${data.features.length} features...`);

  // Transform each feature to add OSM-compatible properties
  data.features = data.features.map((feature, index) => {
    const props = feature.properties || {};
    
    // Map scraper properties to OSM properties
    const osmProperties = {
      ...props,
      // Required OSM properties
      tourism: 'artwork', // Mark as artwork for OSM importer
      name: props.title || props.name, // OSM uses 'name' instead of 'title'
      
      // Map artist information
      artist_name: Array.isArray(props.artists) 
        ? props.artists.join('; ') 
        : props.artist || props.artists,
      
      // Preserve artwork_type or set default
      artwork_type: props.artwork_type || 'sculpture',
      
      // Map other common fields
      description: props.description,
      start_date: props.start_date,
      end_date: props.end_date,
      material: props.medium || props.material,
      subject: props.keywords ? (Array.isArray(props.keywords) ? props.keywords.join('; ') : props.keywords) : undefined,
      
      // Preserve source information
      source: props.source,
      source_url: props.source_url,
      
      // Keep original properties for reference
      _scraper_title: props.title,
      _scraper_artists: props.artists,
    };

    // Remove undefined values
    Object.keys(osmProperties).forEach(key => {
      if (osmProperties[key] === undefined) {
        delete osmProperties[key];
      }
    });

    return {
      ...feature,
      properties: osmProperties
    };
  });

  console.log(`💾 Writing ${outputPath}...`);
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  
  console.log(`✅ Transformation complete!`);
  console.log(`   Input: ${data.metadata?.totalItems || data.features.length} features`);
  console.log(`   Output: ${data.features.length} features`);
}

// CLI Usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('Usage: node transform-scraper-to-osm.cjs <input.geojson> [output.geojson]');
    console.error('');
    console.error('Example:');
    console.error('  node scripts/transform-scraper-to-osm.cjs src/mass-import/scraper/output/richmond-ca-artworks.geojson');
    console.error('  node scripts/transform-scraper-to-osm.cjs input.geojson output-osm.geojson');
    process.exit(1);
  }

  const inputPath = args[0];
  const outputPath = args[1] || inputPath.replace(/\.geojson$/, '-osm.geojson');

  try {
    transformScraperToOSM(inputPath, outputPath);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

module.exports = { transformScraperToOSM };
