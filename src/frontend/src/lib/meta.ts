import { useHead } from '@vueuse/head';
import type { RouteMetadata } from './seo-config';

export interface StructuredData {
  '@context': string;
  '@type': string;
  [key: string]: unknown;
}

export function useRouteMeta(metadata: RouteMetadata, structuredData?: StructuredData): void {
  useHead({
    title: metadata.title,
    meta: [
      { name: 'description', content: metadata.description },
      { property: 'og:title', content: metadata.title },
      { property: 'og:description', content: metadata.description },
      { property: 'og:url', content: metadata.canonical },
      { property: 'og:type', content: metadata.ogType || 'website' },
      { property: 'og:site_name', content: 'Public Art Registry' },
      { property: 'og:locale', content: 'en_US' },
      ...(metadata.ogImage ? [{ property: 'og:image', content: metadata.ogImage }] : []),
      { name: 'twitter:card', content: metadata.ogImage ? 'summary_large_image' : 'summary' },
    ],
    link: [{ rel: 'canonical', href: metadata.canonical }],
    script: structuredData
      ? [
          {
            type: 'application/ld+json',
            children: JSON.stringify(structuredData),
          },
        ]
      : [],
  });
}

export function createOrganizationSchema(): StructuredData {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': 'https://publicartregistry.com/#org',
    name: 'Public Art Registry',
    url: 'https://publicartregistry.com/',
    logo: 'https://publicartregistry.com/logo-pin-plinth.svg',
    sameAs: ['https://twitter.com/yourhandle', 'https://www.facebook.com/yourpage'],
  } as StructuredData;
}

export function createWebSiteSchema(): StructuredData {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://publicartregistry.com/#website',
    url: 'https://publicartregistry.com/',
    name: 'Public Art Registry',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://publicartregistry.com/map?search={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  } as StructuredData;
}

export function createArtworkSchema(artwork: {
  id: string;
  title: string;
  artistName?: string;
  artistUrl?: string;
  images: string[];
  lat: number;
  lon: number;
  city?: string;
  tags: string[];
  description?: string;
}): StructuredData {
  return {
    '@context': 'https://schema.org',
    '@type': 'VisualArtwork',
    name: artwork.title,
    url: `https://publicartregistry.com/artwork/${artwork.id}`,
    image: artwork.images,
    description: artwork.description || artwork.title,
    keywords: artwork.tags,
    creator: artwork.artistName
      ? {
          '@type': 'Person',
          name: artwork.artistName,
          url: artwork.artistUrl,
        }
      : undefined,
    locationCreated: {
      '@type': 'Place',
      name: artwork.city || 'Unknown',
      geo: {
        '@type': 'GeoCoordinates',
        latitude: artwork.lat,
        longitude: artwork.lon,
      },
    },
  } as StructuredData;
}

export function createArtistSchema(artist: { id: string; name: string; bio?: string; sameAs?: string[] }): StructuredData {
  const schema: StructuredData = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `https://publicartregistry.com/artist/${artist.id}`,
    name: artist.name,
    url: `https://publicartregistry.com/artist/${artist.id}`,
    description: artist.bio,
  } as StructuredData;

  if (artist.sameAs && Array.isArray(artist.sameAs) && artist.sameAs.length > 0) {
    const s = schema as Record<string, unknown>;
    s.sameAs = artist.sameAs;
  }

  return schema;
}

