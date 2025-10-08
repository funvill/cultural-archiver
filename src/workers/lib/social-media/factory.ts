/**
 * Social Media Service Factory
 *
 * Creates the appropriate social media service instance based on platform type.
 */

import type { ISocialMediaService } from './base';
import type { SocialMediaType } from '../../../shared/types';
import { BlueskyService } from './services/bluesky';
import { InstagramService } from './services/instagram';

/**
 * Environment variables required for social media services
 */
export interface SocialMediaEnv {
  // Bluesky credentials
  BSKY_IDENTIFIER?: string;
  BSKY_APP_PASSWORD?: string;

  // Instagram credentials (Facebook Graph API)
  INSTAGRAM_ACCESS_TOKEN?: string;
  INSTAGRAM_ACCOUNT_ID?: string;

  // Twitter credentials (if implementing Twitter/X)
  TWITTER_API_KEY?: string;
  TWITTER_API_SECRET?: string;
  TWITTER_ACCESS_TOKEN?: string;
  TWITTER_ACCESS_SECRET?: string;

  // Facebook credentials (if implementing Facebook)
  FACEBOOK_ACCESS_TOKEN?: string;
  FACEBOOK_PAGE_ID?: string;
}

/**
 * Create a social media service instance for the specified platform
 *
 * @param type Social media platform type
 * @param env Environment variables containing API credentials
 * @returns Social media service instance or null if credentials missing
 */
export function createSocialMediaService(
  type: SocialMediaType,
  env: SocialMediaEnv
): ISocialMediaService | null {
  switch (type) {
    case 'bluesky':
      if (!env.BSKY_IDENTIFIER || !env.BSKY_APP_PASSWORD) {
        console.error('Bluesky credentials not found in environment');
        return null;
      }
      return new BlueskyService(env.BSKY_IDENTIFIER, env.BSKY_APP_PASSWORD);

    case 'instagram':
      if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_ACCOUNT_ID) {
        console.error('Instagram credentials not found in environment');
        return null;
      }
      return new InstagramService(env.INSTAGRAM_ACCESS_TOKEN, env.INSTAGRAM_ACCOUNT_ID);

    case 'twitter':
      // TODO: Implement Twitter service
      console.warn('Twitter service not yet implemented');
      return null;

    case 'facebook':
      // TODO: Implement Facebook service
      console.warn('Facebook service not yet implemented');
      return null;

    case 'other':
      console.warn('Custom social media service not implemented');
      return null;

    default:
      console.error(`Unknown social media type: ${type}`);
      return null;
  }
}

/**
 * Check if credentials are configured for a given social media type
 *
 * @param type Social media platform type
 * @param env Environment variables
 * @returns True if credentials are present
 */
export function hasCredentialsForType(type: SocialMediaType, env: SocialMediaEnv): boolean {
  switch (type) {
    case 'bluesky':
      return Boolean(env.BSKY_IDENTIFIER && env.BSKY_APP_PASSWORD);
    case 'instagram':
      return Boolean(env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_ACCOUNT_ID);
    case 'twitter':
      return Boolean(
        env.TWITTER_API_KEY &&
          env.TWITTER_API_SECRET &&
          env.TWITTER_ACCESS_TOKEN &&
          env.TWITTER_ACCESS_SECRET
      );
    case 'facebook':
      return Boolean(env.FACEBOOK_ACCESS_TOKEN && env.FACEBOOK_PAGE_ID);
    default:
      return false;
  }
}
