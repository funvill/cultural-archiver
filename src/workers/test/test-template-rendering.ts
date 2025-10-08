/**
 * Test script to verify template rendering with bundled templates
 * Run with: npx tsx src/workers/test/test-template-rendering.ts
 */

import { generatePostText, buildTemplateContext, renderTemplate } from '../lib/social-media/templates';
import type { ArtworkApiResponse, ArtistApiResponse } from '../../shared/types';

// Sample artwork data for testing
const sampleArtwork: ArtworkApiResponse = {
  id: 'test-123',
  title: 'The Great Wave',
  description: 'A stunning sculpture inspired by Hokusai\'s famous woodblock print, reimagined in stainless steel and glass.',
  lat: 49.2827,
  lon: -123.1207,
  status: 'approved',
  photos: ['https://example.com/photo1.jpg'] as any,
  tags: JSON.stringify({
    artwork_type: 'sculpture',
    medium: 'stainless steel and glass',
    year_created: '2023',
    city: 'Vancouver',
    dimensions: '15ft x 20ft',
    condition: 'excellent',
  }),
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const sampleArtists: ArtistApiResponse[] = [
  {
    id: 'artist-1',
    name: 'Jane Smith',
    description: null,
    aliases: null,
    tags: null,
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

async function testTemplateRendering() {
  console.log('🧪 Testing Template Rendering\n');
  console.log('=' .repeat(60));

  // Test 1: Build context
  console.log('\n📋 Test 1: Building template context...');
  const context = buildTemplateContext(sampleArtwork, sampleArtists, 'https://publicartregistry.com');
  console.log('Context:', JSON.stringify(context, null, 2));

  // Test 2: Generate Bluesky post
  console.log('\n🦋 Test 2: Generating Bluesky post...');
  const blueskyText = await generatePostText('bluesky', sampleArtwork, sampleArtists, 'https://publicartregistry.com');
  console.log('Bluesky Post:');
  console.log('-'.repeat(60));
  console.log(blueskyText);
  console.log('-'.repeat(60));
  console.log(`Character count: ${blueskyText.length}/300`);

  // Test 3: Generate Instagram post
  console.log('\n📷 Test 3: Generating Instagram post...');
  const instagramText = await generatePostText('instagram', sampleArtwork, sampleArtists, 'https://publicartregistry.com');
  console.log('Instagram Post:');
  console.log('-'.repeat(60));
  console.log(instagramText);
  console.log('-'.repeat(60));
  console.log(`Character count: ${instagramText.length}/2200`);

  // Test 4: Check if tag variables are working
  console.log('\n🏷️  Test 4: Checking tag variable rendering...');
  const testTemplate = 'Type: {{tag:artwork_type}}, Medium: {{tag:medium}}, Year: {{tag:year_created}}';
  const rendered = renderTemplate(testTemplate, context);
  console.log('Template:', testTemplate);
  console.log('Rendered:', rendered);

  // Test 5: Check conditional tag variables
  console.log('\n🔀 Test 5: Checking conditional tag variables...');
  const conditionalTemplate = '{{#if tag:artwork_type}}This is a {{tag:artwork_type}}.{{/if}}';
  const renderedConditional = renderTemplate(conditionalTemplate, context);
  console.log('Template:', conditionalTemplate);
  console.log('Rendered:', renderedConditional);

  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests completed!\n');

  // Check if the Bluesky template includes the tag:artwork_type variable
  if (blueskyText.includes('sculpture')) {
    console.log('✅ SUCCESS: Template includes tag:artwork_type value (sculpture)');
  } else {
    console.log('❌ WARNING: Template does not include tag:artwork_type value');
    console.log('   Expected to see "sculpture" in the Bluesky post');
  }
}

// Run the tests
testTemplateRendering().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
