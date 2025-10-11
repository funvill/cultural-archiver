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
        description: 'Browse public art on an interactive map. Filter by artist, location, medium, and tags.',
        canonical: 'https://publicartregistry.com/map',
        ogType: 'website',
    },
    // minimal placeholder for artwork and artist pages; components will override per-item fields
    artwork: {
        title: 'Artwork - Public Art Registry',
        description: 'View public artwork details including photos, artist credit, and location data.',
        canonical: 'https://publicartregistry.com/artwork/',
        ogType: 'article',
    },
    artist: {
        title: 'Artist - Public Art Registry',
        description: 'Explore artist profiles and their public artworks documented in the registry.',
        canonical: 'https://publicartregistry.com/artist/',
        ogType: 'profile',
    }
};

export function getMetaForRoute(routeName: string) : RouteMetadata {
    return routeMetadata[routeName] || {
        title: 'Public Art Registry',
        description: 'Discover and document public art around the world.',
        canonical: 'https://publicartregistry.com/',
    };
}
