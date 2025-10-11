export interface RouteMetadata {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  ogType?: string;
}

export const routeMetadata: Record<string, RouteMetadata> = {
  home: {
    title: 'Public Art Registry - Discover Street Art & Murals',
    description: 'Explore a crowdsourced archive of public art, street murals, and sculptures. Interactive map with photos, artist credits, and location data.',
    canonical: 'https://publicartregistry.com/',
    ogType: 'website',
  },
  map: {
    title: 'Interactive Public Art Map',
    description: 'Browse public art on an interactive map. Filter by artist, location, medium, and tags to discover nearby murals and sculptures.',
    canonical: 'https://publicartregistry.com/map',
    ogType: 'website',
  },
  // artwork and artist will be generated dynamically
};

export function getMetaForRoute(routeName: string): RouteMetadata {
  return (
    routeMetadata[routeName] || {
      title: 'Public Art Registry',
      description: 'Discover and document public art around the world.',
      canonical: 'https://publicartregistry.com/',
    }
  );
}
