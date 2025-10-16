/**
 * Mass Import v3 Validation Schemas
 * 
 * Zod schemas for validating artwork (GeoJSON Feature) and artist (JSON) imports.
 */

import { z } from 'zod';

/**
 * Coordinate validation schema
 * - Latitude: -90 to 90
 * - Longitude: -180 to 180
 * - Reject (0, 0) as likely error
 * - Allow up to 8 decimal places
 */
export const CoordinatesSchema = z
  .tuple([z.number(), z.number()])
  .refine(
    ([lon, lat]) => {
      // Check latitude range
      if (lat < -90 || lat > 90) return false;
      // Check longitude range
      if (lon < -180 || lon > 180) return false;
      // Reject (0, 0) as likely error
      if (lon === 0 && lat === 0) return false;
      return true;
    },
    {
      message: 'Invalid coordinates: latitude must be -90 to 90, longitude must be -180 to 180, and (0,0) is not allowed',
    }
  );

/**
 * URL validation schema
 * Basic URL validation - must start with http:// or https://
 */
export const UrlSchema = z
  .string()
  .url()
  .refine(
    (url) => url.startsWith('http://') || url.startsWith('https://'),
    {
      message: 'URL must start with http:// or https://',
    }
  );

/**
 * Photo URL schema
 * Validates photo URLs - must be valid http/https URLs
 */
export const PhotoUrlSchema = z.object({
  url: UrlSchema,
  caption: z.string().optional(),
  credit: z.string().optional(),
});

/**
 * Artwork properties schema
 * Required: source, source_url, title
 * Optional: description, artwork_type, material, start_date, artist, photos, etc.
 */
export const ArtworkPropertiesSchema = z.object({
  source: z.string().min(1, 'Source is required'),
  source_url: UrlSchema,
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  artwork_type: z.string().optional(),
  material: z.string().optional(),
  start_date: z.string().optional(),
  // artist (string) is supported for backwards compatibility but prefer `artists` array
  artist: z.string().optional(),
  artists: z.array(z.string()).optional(),
  photos: z.array(z.union([UrlSchema, PhotoUrlSchema])).max(10, 'Maximum 10 photos allowed').optional(),
  // Allow additional properties
}).passthrough();

/**
 * GeoJSON Point geometry schema
 */
export const PointGeometrySchema = z.object({
  type: z.literal('Point'),
  coordinates: CoordinatesSchema,
});

/**
 * Artwork GeoJSON Feature schema
 */
export const ArtworkFeatureSchema = z.object({
  type: z.literal('Feature'),
  id: z.string().min(1, 'ID is required'),
  geometry: PointGeometrySchema,
  properties: ArtworkPropertiesSchema,
});

/**
 * Artist properties schema
 * Required: source, source_url
 * Optional: birth_date, death_date, website, etc.
 */
export const ArtistPropertiesSchema = z.object({
  source: z.string().min(1, 'Source is required'),
  source_url: UrlSchema,
  birth_date: z.string().optional(),
  death_date: z.string().optional(),
  website: z.string().url().optional(),
  // Allow additional properties
}).passthrough();

/**
 * Artist import schema
 */
export const ArtistSchema = z.object({
  type: z.literal('Artist'),
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  properties: ArtistPropertiesSchema,
});

/**
 * Type definitions derived from schemas
 */
export type ArtworkFeature = z.infer<typeof ArtworkFeatureSchema>;
export type ArtistImport = z.infer<typeof ArtistSchema>;
export type Coordinates = z.infer<typeof CoordinatesSchema>;
export type ArtworkProperties = z.infer<typeof ArtworkPropertiesSchema>;
export type ArtistProperties = z.infer<typeof ArtistPropertiesSchema>;
