/**
 * Instagram Social Media Service
 *
 * Handles posting artwork to Instagram.
 * Note: Instagram posting requires Facebook Graph API or third-party services.
 * This is a stub implementation that should be completed based on your Instagram integration method.
 */

import {
  BaseSocialMediaService,
  type SocialMediaPostConfig,
  type SocialMediaPostResult,
} from '../base';
import type { SocialMediaType } from '../../../../shared/types';

export class InstagramService extends BaseSocialMediaService {
  readonly type: SocialMediaType = 'instagram';
  readonly maxBodyLength = 2200;
  readonly maxPhotos = 10; // Instagram supports up to 10 images in carousel

  // Prefixed with _ to indicate intentionally unused (stub implementation)
  constructor(
    private readonly _accessToken: string,
    private readonly _accountId: string
  ) {
    super();
    // Store credentials for future implementation
    void this._accessToken;
    void this._accountId;
  }

  async post(config: SocialMediaPostConfig): Promise<SocialMediaPostResult> {
    // Validate first
    const validationError = this.validate(config);
    if (validationError) {
      return {
        success: false,
        error: validationError,
      };
    }

    try {
      // TODO: Implement Instagram posting via Facebook Graph API
      // For now, return a stub response
      console.warn('Instagram posting not yet implemented');
      
      return {
        success: false,
        error: 'Instagram posting not yet implemented. Please configure Facebook Graph API.',
      };

      // Example implementation outline:
      // 1. Upload media using POST /{ig-user-id}/media
      // 2. Publish the container using POST /{ig-user-id}/media_publish
      // 3. Return post URL and ID
    } catch (error) {
      console.error('Instagram posting error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error posting to Instagram',
      };
    }
  }
}
