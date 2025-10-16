import { describe, it, expect } from 'vitest';
import { getImageSizedURL, getImageVariantURLs, preloadImageVariants } from '../utils/image';

describe('Image Utils', () => {
  describe('getImageSizedURL', () => {
    it('should construct thumbnail URL for R2 photo', () => {
      const url = getImageSizedURL('photos/abc123.jpg', 'thumbnail');
      expect(url).toBe('/api/images/thumbnail/photos/abc123.jpg');
    });

    it('should construct medium URL', () => {
      const url = getImageSizedURL('photos/test.png', 'medium');
      expect(url).toBe('/api/images/medium/photos/test.png');
    });

    it('should construct large URL', () => {
      const url = getImageSizedURL('photos/xyz.jpg', 'large');
      expect(url).toBe('/api/images/large/photos/xyz.jpg');
    });

    it('should return original URL for "original" variant', () => {
      const url = getImageSizedURL('photos/original.jpg', 'original');
      expect(url).toBe('photos/original.jpg');
    });

    it('should handle full HTTP URLs by extracting R2 key', () => {
      const url = getImageSizedURL('https://photos.publicartregistry.com/originals/test.jpg', 'thumbnail');
      expect(url).toBe('/api/images/thumbnail/originals/test.jpg');
    });

    it('should handle paths with slashes', () => {
      const url = getImageSizedURL('photos/2024/03/image.jpg', 'medium');
      expect(url).toBe('/api/images/medium/photos/2024/03/image.jpg');
    });

    it('should handle URLs without protocol by extracting R2 key', () => {
      const url = getImageSizedURL('//photos.publicartregistry.com/photos/photo.jpg', 'thumbnail');
      expect(url).toBe('/api/images/thumbnail/photos/photo.jpg');
    });

    it('should return external URLs unchanged for non-original variants', () => {
      const externalUrl = 'https://collections.burnabyartgallery.ca/media/image.jpg?width=280';
      expect(getImageSizedURL(externalUrl, 'thumbnail')).toBe(externalUrl);
      expect(getImageSizedURL(externalUrl, 'medium')).toBe(externalUrl);
      expect(getImageSizedURL(externalUrl, 'large')).toBe(externalUrl);
    });

    it('should return external URLs unchanged for original variant', () => {
      const externalUrl = 'https://example.com/photos/external-photo.jpg';
      expect(getImageSizedURL(externalUrl, 'original')).toBe(externalUrl);
    });
  });

  describe('getImageVariantURLs', () => {
    it('should return all variant URLs', () => {
      const variants = getImageVariantURLs('photos/test.jpg');
      expect(variants).toEqual({
        thumbnail: '/api/images/thumbnail/photos/test.jpg',
        medium: '/api/images/medium/photos/test.jpg',
        large: '/api/images/large/photos/test.jpg',
        original: 'photos/test.jpg',
      });
    });

    it('should work with full photo URLs', () => {
      const variants = getImageVariantURLs('https://photos.publicartregistry.com/originals/test.jpg');
      expect(variants.thumbnail).toBe('/api/images/thumbnail/originals/test.jpg');
      expect(variants.medium).toBe('/api/images/medium/originals/test.jpg');
      expect(variants.large).toBe('/api/images/large/originals/test.jpg');
      expect(variants.original).toBe('https://photos.publicartregistry.com/originals/test.jpg');
    });

    it('should handle nested paths', () => {
      const variants = getImageVariantURLs('photos/2024/03/image.png');
      expect(variants.thumbnail).toBe('/api/images/thumbnail/photos/2024/03/image.png');
      expect(variants.medium).toBe('/api/images/medium/photos/2024/03/image.png');
      expect(variants.large).toBe('/api/images/large/photos/2024/03/image.png');
      expect(variants.original).toBe('photos/2024/03/image.png');
    });
  });

  describe('preloadImageVariants', () => {
    it('should create link elements for preloading', () => {
      // Mock DOM
      const links: HTMLLinkElement[] = [];
      const createElement = document.createElement.bind(document);
      document.createElement = (tagName: string) => {
        const element = createElement(tagName);
        if (tagName === 'link') {
          links.push(element as HTMLLinkElement);
        }
        return element;
      };

      // Mock appendChild
      const originalAppendChild = document.head.appendChild.bind(document.head);
      const appendedLinks: HTMLLinkElement[] = [];
      document.head.appendChild = ((child: Node) => {
        if (child instanceof HTMLLinkElement) {
          appendedLinks.push(child);
        }
        return originalAppendChild(child);
      }) as typeof document.head.appendChild;

      preloadImageVariants('photos/test.jpg', ['thumbnail', 'medium']);

      // Verify link elements were created
      expect(appendedLinks.length).toBeGreaterThanOrEqual(2);

      // Verify link attributes
      const thumbnailLink = appendedLinks.find((link) =>
        link.href.includes('/api/images/thumbnail/')
      );
      const mediumLink = appendedLinks.find((link) => link.href.includes('/api/images/medium/'));

      expect(thumbnailLink?.rel).toBe('prefetch');
      expect(thumbnailLink?.as).toBe('image');
      expect(mediumLink?.rel).toBe('prefetch');
      expect(mediumLink?.as).toBe('image');
    });

    it('should default to thumbnail and medium variants', () => {
      const links: HTMLLinkElement[] = [];
      const createElement = document.createElement.bind(document);
      document.createElement = (tagName: string) => {
        const element = createElement(tagName);
        if (tagName === 'link') {
          links.push(element as HTMLLinkElement);
        }
        return element;
      };

      const appendedLinks: HTMLLinkElement[] = [];
      const originalAppendChild = document.head.appendChild.bind(document.head);
      document.head.appendChild = ((child: Node) => {
        if (child instanceof HTMLLinkElement) {
          appendedLinks.push(child);
        }
        return originalAppendChild(child);
      }) as typeof document.head.appendChild;

      preloadImageVariants('photos/test.jpg');

      expect(appendedLinks.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle single variant', () => {
      const appendedLinks: HTMLLinkElement[] = [];
      const originalAppendChild = document.head.appendChild.bind(document.head);
      document.head.appendChild = ((child: Node) => {
        if (child instanceof HTMLLinkElement) {
          appendedLinks.push(child);
        }
        return originalAppendChild(child);
      }) as typeof document.head.appendChild;

      preloadImageVariants('photos/test.jpg', ['large']);

      const largeLink = appendedLinks.find((link) => link.href.includes('/api/images/large/'));
      expect(largeLink).toBeDefined();
    });
  });
});
