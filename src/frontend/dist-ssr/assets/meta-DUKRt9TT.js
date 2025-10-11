import { useHead } from '@vueuse/head';

const routeMetadata = {
  home: {
    title: "Public Art Registry - Discover Street Art & Murals",
    description: "Explore a crowdsourced archive of public art, street murals, and sculptures. Interactive map with photos, artist credits, and location data.",
    canonical: "https://publicartregistry.com/",
    ogType: "website"
  },
  map: {
    title: "Interactive Public Art Map",
    description: "Browse public art on an interactive map. Filter by artist, location, medium, and tags to discover nearby murals and sculptures.",
    canonical: "https://publicartregistry.com/map",
    ogType: "website"
  }
  // artwork and artist will be generated dynamically
};
function getMetaForRoute(routeName) {
  return routeMetadata[routeName] || {
    title: "Public Art Registry",
    description: "Discover and document public art around the world.",
    canonical: "https://publicartregistry.com/"
  };
}

function useRouteMeta(metadata, structuredData) {
  useHead({
    title: metadata.title,
    meta: [
      { name: "description", content: metadata.description },
      { property: "og:title", content: metadata.title },
      { property: "og:description", content: metadata.description },
      { property: "og:url", content: metadata.canonical },
      { property: "og:type", content: metadata.ogType || "website" },
      { property: "og:site_name", content: "Public Art Registry" },
      { property: "og:locale", content: "en_US" },
      ...metadata.ogImage ? [{ property: "og:image", content: metadata.ogImage }] : [],
      { name: "twitter:card", content: metadata.ogImage ? "summary_large_image" : "summary" }
    ],
    link: [{ rel: "canonical", href: metadata.canonical }],
    script: structuredData ? [
      {
        type: "application/ld+json",
        children: JSON.stringify(structuredData)
      }
    ] : []
  });
}
function createOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://publicartregistry.com/#org",
    name: "Public Art Registry",
    url: "https://publicartregistry.com/",
    logo: "https://publicartregistry.com/logo-pin-plinth.svg",
    sameAs: ["https://twitter.com/yourhandle", "https://www.facebook.com/yourpage"]
  };
}
function createWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": "https://publicartregistry.com/#website",
    url: "https://publicartregistry.com/",
    name: "Public Art Registry",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://publicartregistry.com/map?search={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };
}
function createArtworkSchema(artwork) {
  return {
    "@context": "https://schema.org",
    "@type": "VisualArtwork",
    name: artwork.title,
    url: `https://publicartregistry.com/artwork/${artwork.id}`,
    image: artwork.images,
    description: artwork.description || artwork.title,
    keywords: artwork.tags,
    creator: artwork.artistName ? {
      "@type": "Person",
      name: artwork.artistName,
      url: artwork.artistUrl
    } : void 0,
    locationCreated: {
      "@type": "Place",
      name: artwork.city || "Unknown",
      geo: {
        "@type": "GeoCoordinates",
        latitude: artwork.lat,
        longitude: artwork.lon
      }
    }
  };
}
function createArtistSchema(artist) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `https://publicartregistry.com/artist/${artist.id}`,
    name: artist.name,
    url: `https://publicartregistry.com/artist/${artist.id}`,
    description: artist.bio
  };
  if (artist.sameAs && Array.isArray(artist.sameAs) && artist.sameAs.length > 0) {
    const s = schema;
    s.sameAs = artist.sameAs;
  }
  return schema;
}

export { createWebSiteSchema as a, createArtworkSchema as b, createOrganizationSchema as c, createArtistSchema as d, getMetaForRoute as g, useRouteMeta as u };
//# sourceMappingURL=meta-DUKRt9TT.js.map
