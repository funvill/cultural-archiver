/**
 * Social Media Template Rendering Utility
 *
 * Provides simple Handlebars-style template rendering for social media post text.
 * Supports variable substitution and conditional blocks.
 */

import type { ArtworkApiResponse, ArtistApiResponse, SocialMediaType } from '../../../shared/types';

/**
 * Template context with all available variables
 */
export interface TemplateContext {
  title: string;
  artist: string | undefined;
  artists: string | undefined;
  description: string | undefined;
  url: string;
  location: string | undefined;
  year: string | undefined;
  medium: string | undefined;
}

/**
 * Read template file for a given social media type
 *
 * @param type Social media platform type
 * @returns Template string or null if not found
 */
export async function readTemplate(type: SocialMediaType): Promise<string | null> {
  try {
    // In a Cloudflare Worker, we'll need to bundle templates as strings
    // For now, return default templates
    return getDefaultTemplate(type);
  } catch (error) {
    console.error(`Error reading template for ${type}:`, error);
    return null;
  }
}

/**
 * Get default template for a social media type
 */
function getDefaultTemplate(type: SocialMediaType): string {
  switch (type) {
    case 'bluesky':
      return `🎨 {{title}}{{#if artist}} by {{artist}}{{/if}}

Discover more public art at {{url}}

#PublicArt #UrbanArt #CulturalHeritage #ArtInPublicSpaces`;

    case 'instagram':
      return `🎨 {{title}}{{#if artist}} by {{artist}}{{/if}}
{{#if description}}

{{description}}
{{/if}}{{#if location}}

📍 {{location}}{{/if}}{{#if year}}
📅 {{year}}{{/if}}{{#if medium}}
🖌️ {{medium}}{{/if}}

Discover more public art at {{url}}

#PublicArt #UrbanArt #CulturalHeritage #ArtInPublicSpaces #StreetArt #OutdoorArt #CommunityArt`;

    case 'twitter':
      return `🎨 {{title}}{{#if artist}} by {{artist}}{{/if}}

{{url}}

#PublicArt #UrbanArt`;

    case 'facebook':
      return `🎨 {{title}}{{#if artist}} by {{artist}}{{/if}}
{{#if description}}

{{description}}
{{/if}}

Discover more at {{url}}`;

    default:
      return `{{title}}{{#if artist}} by {{artist}}{{/if}}\n\n{{url}}`;
  }
}

/**
 * Render a template with the given context
 *
 * @param template Template string with {{variables}} and {{#if condition}}...{{/if}}
 * @param context Template context with variable values
 * @returns Rendered string
 */
export function renderTemplate(template: string, context: TemplateContext): string {
  let result = template;

  // Handle conditional blocks first: {{#if variable}}...{{/if}}
  result = result.replace(/\{\{#if\s+(\w+)\}\}(.*?)\{\{\/if\}\}/gs, (_match, varName, content) => {
    const value = context[varName as keyof TemplateContext];
    return value ? content : '';
  });

  // Replace variables: {{variable}}
  result = result.replace(/\{\{(\w+)\}\}/g, (_match, varName) => {
    const value = context[varName as keyof TemplateContext];
    return value !== undefined ? String(value) : '';
  });

  // Clean up extra blank lines (more than 2 consecutive newlines)
  result = result.replace(/\n{3,}/g, '\n\n');

  // Trim leading/trailing whitespace
  result = result.trim();

  return result;
}

/**
 * Build template context from artwork and artists
 *
 * @param artwork Artwork data
 * @param artists Array of artist data
 * @param baseUrl Base URL for the site (e.g., 'https://publicartregistry.com')
 * @returns Template context
 */
export function buildTemplateContext(
  artwork: ArtworkApiResponse,
  artists: ArtistApiResponse[],
  baseUrl: string
): TemplateContext {
  // Parse tags if needed
  let tags: Record<string, unknown> = {};
  if (artwork.tags) {
    try {
      tags = typeof artwork.tags === 'string' ? JSON.parse(artwork.tags) : artwork.tags;
    } catch (e) {
      console.error('Error parsing artwork tags:', e);
    }
  }

  // Build artist names
  const artistNames = artists.map((a) => a.name).filter(Boolean);
  const primaryArtist = artistNames[0];
  const allArtists = artistNames.join(', ');

  // Truncate description if too long (max 200 chars for social media)
  let description = artwork.description || '';
  if (description.length > 200) {
    description = description.substring(0, 197) + '...';
  }

  // Build URL
  const url = `${baseUrl}/artwork/${artwork.id}`;

  return {
    title: artwork.title || 'Untitled',
    artist: primaryArtist || undefined,
    artists: allArtists || undefined,
    description: description || undefined,
    url,
    location: tags.city ? String(tags.city) : undefined,
    year: tags.year_created ? String(tags.year_created) : undefined,
    medium: tags.medium ? String(tags.medium) : undefined,
  };
}

/**
 * Generate post text for a given social media type
 *
 * @param type Social media platform type
 * @param artwork Artwork data
 * @param artists Array of artist data
 * @param baseUrl Base URL for the site
 * @returns Rendered post text
 */
export async function generatePostText(
  type: SocialMediaType,
  artwork: ArtworkApiResponse,
  artists: ArtistApiResponse[],
  baseUrl: string
): Promise<string> {
  const template = await readTemplate(type);
  if (!template) {
    // Fallback to simple format
    const firstArtist = artists.length > 0 ? artists[0] : null;
    const artistText = firstArtist ? ` by ${firstArtist.name}` : '';
    return `${artwork.title || 'Untitled'}${artistText}\n\n${baseUrl}/artwork/${artwork.id}`;
  }

  const context = buildTemplateContext(artwork, artists, baseUrl);
  return renderTemplate(template, context);
}
