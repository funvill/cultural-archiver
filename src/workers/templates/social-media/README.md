# Social Media Post Templates

This directory contains editable templates for generating social media post text.

## Template Structure

Each social media platform has its own template file named `{platform}.txt`.

Currently supported platforms:
- `bluesky.txt` - Bluesky posts (max 300 characters)
- `instagram.txt` - Instagram posts (max 2200 characters)
- `twitter.txt` - Twitter/X posts (max 280 characters)
- `facebook.txt` - Facebook posts (no strict limit, aim for ~500 characters)

## Available Variables

The following variables are available for use in templates:

- `{{title}}` - Artwork title
- `{{artist}}` - Primary artist name
- `{{artists}}` - Comma-separated list of all artists
- `{{description}}` - Artwork description (truncated if too long)
- `{{url}}` - Full URL to artwork detail page
- `{{location}}` - City/location of the artwork (if available in tags)
- `{{year}}` - Year created (if available in tags)
- `{{medium}}` - Medium/material (if available in tags)

## Conditional Blocks

Use Handlebars-style conditionals:
- `{{#if artist}}...{{/if}}` - Show only if artist exists
- `{{#if description}}...{{/if}}` - Show only if description exists

## Editing Templates

You can edit these templates at any time. Changes will be reflected in the admin UI immediately for new suggestions. Existing scheduled posts retain their text.

## Character Limits

- **Bluesky**: 300 characters
- **Instagram**: 2200 characters (first caption only, not per-carousel)
- **Twitter/X**: 280 characters
- **Facebook**: No strict limit (aim for ~500 for best engagement)

## Photo Handling

The system automatically selects up to 4 photos from the artwork for each post, regardless of platform. The template system handles the text portion only.

## Adding New Platforms

To add a new platform:
1. Create a new template file: `{platform}.txt`
2. Add the platform to the `SOCIAL_MEDIA_TYPES` constant in `src/shared/types.ts`
3. Create a service module in `src/workers/lib/social-media/services/`
4. Update the database CHECK constraint if needed

## Notes

- Hashtags are included in character count
- Emoji are counted as 1-2 characters depending on complexity
- URLs are counted as ~23 characters (after shortening on most platforms)
