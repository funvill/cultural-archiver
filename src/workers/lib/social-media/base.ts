/**
 * Social Media Service Base Interface
 *
 * Defines the contract that all social media service implementations must follow.
 * Each platform (Bluesky, Instagram, etc.) should implement this interface.
 */

import type { SocialMediaType } from '../../../shared/types';

/**
 * Result of posting to a social media platform
 */
export interface SocialMediaPostResult {
  success: boolean;
  post_id?: string;
  post_url?: string;
  error?: string;
}

/**
 * Configuration for a social media post
 */
export interface SocialMediaPostConfig {
  body: string;
  photos: string[]; // URLs or file paths to photos (up to 4)
  alt_texts?: string[]; // Optional alt text for each photo
}

/**
 * Base interface that all social media services must implement
 */
export interface ISocialMediaService {
  /**
   * The type of social media platform this service handles
   */
  readonly type: SocialMediaType;

  /**
   * Maximum character length for post body
   */
  readonly maxBodyLength: number;

  /**
   * Maximum number of photos allowed per post
   */
  readonly maxPhotos: number;

  /**
   * Post content to the social media platform
   *
   * @param config Post configuration including body and photos
   * @returns Result of the posting operation
   */
  post(config: SocialMediaPostConfig): Promise<SocialMediaPostResult>;

  /**
   * Validate post configuration before attempting to post
   *
   * @param config Post configuration to validate
   * @returns Error message if invalid, null if valid
   */
  validate(config: SocialMediaPostConfig): string | null;
}

/**
 * Base class with common validation logic
 */
export abstract class BaseSocialMediaService implements ISocialMediaService {
  abstract readonly type: SocialMediaType;
  abstract readonly maxBodyLength: number;
  abstract readonly maxPhotos: number;

  abstract post(config: SocialMediaPostConfig): Promise<SocialMediaPostResult>;

  validate(config: SocialMediaPostConfig): string | null {
    // Check body length
    if (config.body.length > this.maxBodyLength) {
      return `Post body exceeds maximum length of ${this.maxBodyLength} characters`;
    }

    // Check photo count
    if (config.photos.length > this.maxPhotos) {
      return `Too many photos. Maximum ${this.maxPhotos} allowed`;
    }

    // Check alt text count matches photo count if provided
    if (config.alt_texts && config.alt_texts.length !== config.photos.length) {
      return `Alt text count (${config.alt_texts.length}) must match photo count (${config.photos.length})`;
    }

    return null;
  }
}
