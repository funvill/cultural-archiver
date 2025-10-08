/**
 * Bluesky Social Media Service
 *
 * Handles posting artwork to Bluesky using the AT Protocol.
 * Requires BSKY_IDENTIFIER and BSKY_APP_PASSWORD environment variables.
 */

import {
  BaseSocialMediaService,
  type SocialMediaPostConfig,
  type SocialMediaPostResult,
} from '../base';
import type { SocialMediaType } from '../../../../shared/types';

export class BlueskyService extends BaseSocialMediaService {
  readonly type: SocialMediaType = 'bluesky';
  readonly maxBodyLength = 300;
  readonly maxPhotos = 4;

  private identifier: string;
  private appPassword: string;

  constructor(identifier: string, appPassword: string) {
    super();
    this.identifier = identifier;
    this.appPassword = appPassword;
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
      // Step 1: Authenticate and get session
      const session = await this.authenticate();
      if (!session) {
        return {
          success: false,
          error: 'Failed to authenticate with Bluesky',
        };
      }

      // Step 2: Upload photos if any
      const uploadedImages = await this.uploadPhotos(config.photos, config.alt_texts, session);

      // Step 3: Create post
      const postResult = await this.createPost(
        config.body,
        uploadedImages,
        session
      );

      return postResult;
    } catch (error) {
      console.error('Bluesky posting error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error posting to Bluesky',
      };
    }
  }

  /**
   * Authenticate with Bluesky and get session token
   */
  private async authenticate(): Promise<{ accessJwt: string; did: string } | null> {
    try {
      const response = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: this.identifier,
          password: this.appPassword,
        }),
      });

      if (!response.ok) {
        console.error('Bluesky auth failed:', await response.text());
        return null;
      }

      const data = (await response.json()) as {
        accessJwt: string;
        did: string;
      };
      return {
        accessJwt: data.accessJwt,
        did: data.did,
      };
    } catch (error) {
      console.error('Bluesky authentication error:', error);
      return null;
    }
  }

  /**
   * Upload photos to Bluesky and return blob references
   */
  private async uploadPhotos(
    photoUrls: string[],
    altTexts: string[] | undefined,
    session: { accessJwt: string; did: string }
  ): Promise<Array<{ alt: string; image: unknown }>> {
    const uploadedImages: Array<{ alt: string; image: unknown }> = [];

    for (let i = 0; i < photoUrls.length; i++) {
      const photoUrl = photoUrls[i];
      if (!photoUrl) continue;
      
      const altText = altTexts?.[i] || '';

      try {
        // Fetch the photo
        const photoResponse = await fetch(photoUrl);
        if (!photoResponse.ok) {
          console.error(`Failed to fetch photo: ${photoUrl}`);
          continue;
        }

        const photoBlob = await photoResponse.blob();
        const photoBuffer = await photoBlob.arrayBuffer();

        // Upload to Bluesky
        const uploadResponse = await fetch('https://bsky.social/xrpc/com.atproto.repo.uploadBlob', {
          method: 'POST',
          headers: {
            'Content-Type': photoBlob.type,
            Authorization: `Bearer ${session.accessJwt}`,
          },
          body: photoBuffer,
        });

        if (!uploadResponse.ok) {
          console.error(`Failed to upload photo to Bluesky: ${photoUrl}`);
          continue;
        }

        const uploadData = (await uploadResponse.json()) as {
          blob: unknown;
        };
        uploadedImages.push({
          alt: altText,
          image: uploadData.blob,
        });
      } catch (error) {
        console.error(`Error uploading photo ${photoUrl}:`, error);
      }
    }

    return uploadedImages;
  }

  /**
   * Create the actual post on Bluesky
   */
  private async createPost(
    text: string,
    images: Array<{ alt: string; image: unknown }>,
    session: { accessJwt: string; did: string }
  ): Promise<SocialMediaPostResult> {
    try {
      const record: {
        text: string;
        createdAt: string;
        embed?: {
          $type: string;
          images: Array<{ alt: string; image: unknown }>;
        };
      } = {
        text,
        createdAt: new Date().toISOString(),
      };

      // Add images if any
      if (images.length > 0) {
        record.embed = {
          $type: 'app.bsky.embed.images',
          images,
        };
      }

      const response = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessJwt}`,
        },
        body: JSON.stringify({
          repo: session.did,
          collection: 'app.bsky.feed.post',
          record,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Bluesky post creation failed:', errorText);
        return {
          success: false,
          error: `Failed to create post: ${errorText}`,
        };
      }

      const data = (await response.json()) as {
        uri: string;
      };

      // Construct post URL
      const postUrl = `https://bsky.app/profile/${session.did}/post/${data.uri.split('/').pop()}`;

      return {
        success: true,
        post_id: data.uri,
        post_url: postUrl,
      };
    } catch (error) {
      console.error('Error creating Bluesky post:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
