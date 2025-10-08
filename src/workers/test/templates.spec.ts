import { describe, it, expect, beforeAll } from 'vitest';
import { buildTemplateContext, renderTemplate, generatePostText } from '../lib/social-media/templates';
import type { ArtworkApiResponse, ArtistApiResponse } from '../../shared/types';

// Sample data used across tests
const sampleArtwork: ArtworkApiResponse = {
  id: 'test-123',
  title: 'The Great Wave',
  description: "A stunning sculpture inspired by Hokusai's famous woodblock print, reimagined in stainless steel and glass.",
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

describe('social media templates', () => {
  it('buildTemplateContext includes tag:* keys', () => {
    const ctx = buildTemplateContext(sampleArtwork, sampleArtists, 'https://publicartregistry.com');
    expect(ctx['tag:artwork_type']).toBe('sculpture');
    expect(ctx['tag:city']).toBe('Vancouver');
    expect(ctx.title).toBe('The Great Wave');
    expect(ctx.artist).toBe('Jane Smith');
  });

  it('renderTemplate supports tag variables and conditionals', () => {
    const ctx = buildTemplateContext(sampleArtwork, sampleArtists, 'https://publicartregistry.com');
    const tmpl = 'Type: {{tag:artwork_type}}. {{#if tag:medium}}Medium: {{tag:medium}}{{/if}}';
    const out = renderTemplate(tmpl, ctx);
    expect(out).toContain('Type: sculpture');
    expect(out).toContain('Medium: stainless steel and glass');
  });

  it('generatePostText uses bundled bluesky template when present', async () => {
    const text = await generatePostText('bluesky', sampleArtwork, sampleArtists, 'https://publicartregistry.com');
    // Expect the generated text to include the tag-derived hashtag (sculpture)
    expect(text.toLowerCase()).toContain('sculpture');
    // Also expect the title and artist to be present
    expect(text).toContain('The Great Wave');
    expect(text).toContain('Jane Smith');
  });
});
