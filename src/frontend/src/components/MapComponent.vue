<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, defineEmits } from 'vue';
import {
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  XMarkIcon,
  MapPinIcon,
  PlusIcon,
  MinusIcon,
  Squares2X2Icon,
} from '@heroicons/vue/24/outline';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import type { Coordinates, ArtworkPin, MapComponentProps } from '../types/index';
import { useArtworksStore } from '../stores/artworks';
import {
  useArtworkTypeFilters,
  type ArtworkTypeToggle,
} from '../composables/useArtworkTypeFilters';
import { useRouter } from 'vue-router';

// Props
const props = withDefaults(defineProps<MapComponentProps>(), {
  zoom: 15,
  showUserLocation: true,
});

// Emits - using runtime declaration to avoid TypeScript compilation issues
const emit = defineEmits([
  'artworkClick',
  'previewArtwork', 
  'dismissPreview',
  'mapMove',
  'locationFound'
]);

// State
const mapContainer = ref<HTMLDivElement>();
const map = ref<L.Map>();
const isLoading = ref(true);
const isLocating = ref(false);
const error = ref<string | null>(null);
const showLocationNotice = ref(false);
// Viewport loading state
const isLoadingViewport = ref(false);
const lastLoadedBounds = ref<{ north: number; south: number; east: number; west: number } | null>(
  null
);
const loadingTimeout = ref<ReturnType<typeof setTimeout> | null>(null);
// Marker update debouncing
const markerUpdateTimeout = ref<ReturnType<typeof setTimeout> | null>(null);
// Debounce for updating marker styles during continuous zoom
const zoomStyleTimeout = ref<ReturnType<typeof setTimeout> | null>(null);
// Progressive loading state
const isProgressiveLoading = ref(false);
const progressiveLoadingStats = ref<{
  loaded: number;
  total: number;
  percentage: number;
  batchSize?: number;
  avgTime?: number;
} | null>(null);
const useProgressiveLoading = ref(false); // Toggle for progressive loading mode
// Guard navigator for SSR / non-browser test environments
const hasGeolocation = ref(typeof navigator !== 'undefined' && !!navigator.geolocation);
const userLocationMarker = ref<L.Marker | null>(null);
const artworkMarkers = ref<(L.Marker | L.CircleMarker)[]>([]);
// Use any for cluster type to avoid type issues if markercluster types not available
const markerClusterGroup = ref<any | null>(null);
// Map options state
const showOptionsPanel = ref(false);
const clusterEnabled = ref(true);
const debugRingsEnabled = ref(false);
const clearingCache = ref(false);
// Artwork type filters - using shared composable
const { artworkTypes, isArtworkTypeEnabled, getTypeColor, enableAllTypes, disableAllTypes } =
  useArtworkTypeFilters();

// Debug ring layer (only immediate 100m ring)
let debugImmediateRing: L.Circle | null = null;
// Saved map state presence
const hadSavedMapState = ref(false);

// LocalStorage keys
const MAP_STATE_KEY = 'map:lastState';

// Save map state (center/zoom) to localStorage
function saveMapState() {
  if (!map.value) return;
  const center = map.value.getCenter();
  const zoom = map.value.getZoom();
  try {
    localStorage.setItem(
      MAP_STATE_KEY,
      JSON.stringify({
        center: { latitude: center.lat, longitude: center.lng },
        zoom,
      })
    );
  } catch (e) {
    // ignore
  }
}

// Read map state from localStorage
function readSavedMapState(): { center: Coordinates; zoom: number } | null {
  try {
    const raw = localStorage.getItem(MAP_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      parsed.center &&
      typeof parsed.center.latitude === 'number' &&
      typeof parsed.center.longitude === 'number' &&
      typeof parsed.zoom === 'number'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

// Store
const artworksStore = useArtworksStore();

// Router for navigation
const router = useRouter();

// Default coordinates (Vancouver - near sample data for testing)
const DEFAULT_CENTER = { latitude: 49.265, longitude: -123.25 };

// Create circle marker style for artworks (replaces emoji icons for better performance)
const createArtworkStyle = (type: string) => {
  const normalized = (type || 'other').toLowerCase();

  // Calculate dynamic radius based on zoom level
  // Note: Leaflet zoom increases when you zoom in (higher = closer). We want radius to grow as zoom increases.
  const currentZoom = map.value?.getZoom() ?? 15;
  // Set base min/max for the raw radius (before applying the 2x multiplier)
  const minRadius = 3; // smallest marker at lower zoom levels
  const maxRadius = 10; // largest marker at higher zoom levels

  // Effective zoom range for interpolation (adjustable)
  // 10 = metropolitan area, 16 = Street, 18 = buildings/trees
  const minZoom = 12;
  const maxZoom = 18;
  let dynamicRadius: number;

  if (currentZoom <= minZoom) {
    dynamicRadius = minRadius;
  } else if (currentZoom >= maxZoom) {
    dynamicRadius = maxRadius;
  } else {
    // t = 0 at minZoom (smallest), t = 1 at maxZoom (largest)
    const t = (currentZoom - minZoom) / (maxZoom - minZoom);
    dynamicRadius = minRadius + t * (maxRadius - minRadius);
  }

  // Apply the user's requested unconditional doubling of marker sizes across all zooms.
  // Clamp to a reasonable maximum to avoid excessively large markers.
  dynamicRadius = Math.min(dynamicRadius * 2, maxRadius * 2);
  console.log('Zoom:', currentZoom, 'Dynamic radius:', dynamicRadius);

  // Use shared color logic from composable
  const fillColor = getTypeColor(normalized);

  const baseStyle = {
    radius: dynamicRadius, // Use zoom-scaled radius
    fillColor: fillColor,
    color: '#ffffff', // white border
    weight: 1,
    fillOpacity: 0.9,
    opacity: 1,
    // Ensure proper interaction settings
    interactive: true,
    bubblingMouseEvents: false,
    className: 'artwork-circle-marker', // Add CSS class for styling
  };

  // Don't add renderer - let Leaflet handle canvas rendering automatically
  return baseStyle;
};

// Custom icon for user location - use a person icon so it's clearly the user, not an artwork
const createUserLocationIcon = () => {
  // Inline SVG for a simple person/user glyph (keeps dependency-free)
  const personSvg = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="8" r="3" fill="white"/>
      <path d="M4 20c0-3.314 2.686-6 6-6h4c3.314 0 6 2.686 6 6v0H4z" fill="white"/>
    </svg>
  `;

  return L.divIcon({
    html: `
      <div class="user-location-marker flex items-center justify-center bg-blue-600 rounded-full w-8 h-8 border-2 border-white shadow-lg">
        ${personSvg}
      </div>
    `,
    className: 'custom-user-location-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

// Initialize map
async function initializeMap() {
  // Skip initialization in non-browser environments (e.g., unit tests / SSR) to avoid window usage errors
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    console.warn('Map initialization skipped: non-browser environment');
    isLoading.value = false;
    return;
  }
  if (!mapContainer.value) {
    console.error('Map container not found');
    return;
  }

  console.log('Initializing map with container:', mapContainer.value);
  console.log('Container dimensions:', {
    offsetWidth: mapContainer.value.offsetWidth,
    offsetHeight: mapContainer.value.offsetHeight,
    clientWidth: mapContainer.value.clientWidth,
    clientHeight: mapContainer.value.clientHeight,
  });

  try {
    isLoading.value = true;
    error.value = null;

    console.log('Creating Leaflet map...');

    // Check for saved map state first
    const saved = readSavedMapState();
    hadSavedMapState.value = !!saved;

    // Create map
    let initialCenter: [number, number];
    let initialZoom: number;
    if (saved) {
      initialCenter = [saved.center.latitude, saved.center.longitude];
      initialZoom = saved.zoom;
    } else if (props.center) {
      initialCenter = [props.center.latitude, props.center.longitude];
      initialZoom = props.zoom;
    } else {
      initialCenter = [DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude];
      initialZoom = props.zoom;
    }
    map.value = L.map(mapContainer.value, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: false, // We'll use custom controls
      attributionControl: true,
    });

    console.log('Map created successfully:', map.value);

    // Ensure the container has the proper Leaflet classes
    if (mapContainer.value) {
      mapContainer.value.classList.add('leaflet-container');
      mapContainer.value.style.position = 'relative';
      console.log('Added leaflet-container class to map container');
    }

    // Add tile layer with error handling
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      errorTileUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', // Transparent 1x1 pixel
    }).addTo(map.value);

    // Add error handling for tile loading
    tileLayer.on('tileerror', e => {
      console.error('Tile loading error:', e);
      console.error('Tile error details:', {
        coords: e.coords,
        error: e.error,
        tile: e.tile,
      });
    });

    tileLayer.on('tileload', () => {
      // Apply fixes whenever a tile loads (no console log)
      nextTick(() => {
        forceMapDimensions();
      });
    });

    console.log('Tile layer added to map');

    // Force Leaflet containers to have proper classes and dimensions
    const forceMapDimensions = () => {
      if (mapContainer.value) {
        // Ensure container has leaflet-container class
        mapContainer.value.classList.add('leaflet-container');

        // Force dimensions on all Leaflet elements
        const mapPanes = mapContainer.value.querySelectorAll('.leaflet-pane');
        mapPanes.forEach((pane: any) => {
          if (pane.classList.contains('leaflet-map-pane')) {
            (pane as HTMLElement).style.width = '100%';
            (pane as HTMLElement).style.height = '100%';
            (pane as HTMLElement).style.position = 'absolute';
            (pane as HTMLElement).style.left = '0px';
            (pane as HTMLElement).style.top = '0px';
          }
          if (pane.classList.contains('leaflet-tile-pane')) {
            (pane as HTMLElement).style.width = '100%';
            (pane as HTMLElement).style.height = '100%';
            (pane as HTMLElement).style.position = 'absolute';
            (pane as HTMLElement).style.left = '0px';
            (pane as HTMLElement).style.top = '0px';
            (pane as HTMLElement).style.zIndex = '200';

            // Force tile images to display
            const tileImages = pane.querySelectorAll('img');
            tileImages.forEach((img: any) => {
              (img as HTMLImageElement).style.width = '256px';
              (img as HTMLImageElement).style.height = '256px';
              (img as HTMLImageElement).style.display = 'block';
              (img as HTMLImageElement).style.visibility = 'visible';
              (img as HTMLImageElement).style.opacity = '1';
            });
          }
        });
        console.log('Applied dimension fixes to Leaflet containers');
      }
    };

    // Apply fixes immediately and after a delay
    forceMapDimensions();
    setTimeout(forceMapDimensions, 100);
    setTimeout(forceMapDimensions, 500);
    setTimeout(forceMapDimensions, 1000);

    // Debug: Check if Leaflet styles are applied
    setTimeout(() => {
      if (mapContainer.value) {
        const leafletContainer = mapContainer.value.querySelector('.leaflet-container');
        console.log('Leaflet container found:', leafletContainer);
        if (leafletContainer) {
          const styles = (leafletContainer as HTMLElement).style;
          console.log('Leaflet container styles:', {
            position: styles.position,
            width: styles.width,
            height: styles.height,
            zIndex: styles.zIndex,
          });
        }

        // Check for tile layers
        const tileLayers = mapContainer.value.querySelectorAll('.leaflet-tile-pane img');
        console.log('Tile images found:', tileLayers.length);
        if (tileLayers.length > 0) {
          const firstTile = tileLayers[0] as HTMLImageElement;
          console.log('First tile image:', {
            src: firstTile.src,
            width: firstTile.width,
            height: firstTile.height,
            naturalWidth: firstTile.naturalWidth,
            naturalHeight: firstTile.naturalHeight,
          });
        }
      }
    }, 500);

    // Force map to resize after initialization
    setTimeout(() => {
      if (map.value) {
        console.log('Forcing map resize...');
        map.value.invalidateSize();

        // Safe debug logging with error handling
        try {
          if (typeof map.value.getBounds === 'function') {
            console.log('Map bounds after resize:', map.value.getBounds());
          }
          if (typeof map.value.getCenter === 'function') {
            console.log('Map center after resize:', map.value.getCenter());
          }
          if (typeof map.value.getZoom === 'function') {
            console.log('Map zoom after resize:', map.value.getZoom());
          }
        } catch (error) {
          console.warn('Debug logging failed:', error);
        }
      }
    }, 100);

    // Initialize marker group based on clustering preference
    // Load saved preference
    try {
      const saved = localStorage.getItem('map:clusterEnabled');
      if (saved !== null) clusterEnabled.value = saved === 'true';
    } catch {
      /* ignore */
    }

    await configureMarkerGroup();

    // Setup event listeners
    map.value.on('moveend', handleMapMove);
    map.value.on('zoomend', handleMapMove);
    // Update marker styles during continuous zoom events (throttled)
    map.value.on('zoom', () => {
      if (zoomStyleTimeout.value) clearTimeout(zoomStyleTimeout.value);
      zoomStyleTimeout.value = setTimeout(() => {
        try {
          // Guard against calling updateMarkerStyles after map destruction
          if (map.value) {
            updateMarkerStyles();
          }
        } catch (e) {
          /* ignore */
        }
        zoomStyleTimeout.value = null;
      }, 50);
    });
    // Save map state on move/zoom
    map.value.on('moveend', saveMapState);
    map.value.on('zoomend', saveMapState);

    // Initialize debug rings (respect saved preference)
    try {
      const savedRings = localStorage.getItem('map:debugRingsEnabled');
      if (savedRings !== null) debugRingsEnabled.value = savedRings === 'true';
    } catch {
      /* ignore */
    }
    updateDebugRings();

    // Request user location only when there's no saved state
    if (!hadSavedMapState.value) {
      if (props.showUserLocation && hasGeolocation.value) {
        // If Permissions API is available, check current permission state first.
        try {
          if (navigator.permissions && typeof navigator.permissions.query === 'function') {
            const perm = await navigator.permissions.query({
              name: 'geolocation' as PermissionName,
            });
            // If already granted, request location but do not show the notice
            if (perm.state === 'granted') {
              showLocationNotice.value = false;
              await requestUserLocation();
            } else if (perm.state === 'prompt') {
              // Prompting: attempt to get location which will trigger browser prompt
              await requestUserLocation();
            } else {
              // denied - attempt request which will trigger immediate rejection and let the error handler show the notice
              await requestUserLocation();
            }
            // Listen for permission changes to update the notice dynamically
            try {
              perm.onchange = () => {
                if (perm.state === 'granted') {
                  showLocationNotice.value = false;
                  // Try to get location once permission flips to granted
                  requestUserLocation().catch(() => {
                    /* ignore */
                  });
                }
              };
            } catch (e) {
              // noop
            }
          } else {
            // Permissions API not available - fall back to requesting location which will trigger prompt
            await requestUserLocation();
          }
        } catch (err) {
          // In case of any errors querying permissions, fall back to requesting location
          console.warn('Permissions API check failed:', err);
          await requestUserLocation();
        }
      } else {
        // No geolocation available and no saved state: use default
        showLocationNotice.value = true;
        artworksStore.setCurrentLocation(DEFAULT_CENTER);
        if (map.value) {
          map.value.setView([DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude], props.zoom);
        }
        setTimeout(() => {
          showLocationNotice.value = false;
        }, 10000);
      }
    } else {
      // We had a saved state; don't override it. Do not show the location notice unless a location request fails.
    }

    // Load initial artworks with a small delay to ensure DOM stability
    setTimeout(async () => {
      await loadArtworks();
      // Add additional delay for marker rendering after data load
      updateArtworkMarkersDebounced(100);
    }, 50);
  } catch (err) {
    console.error('Map initialization error:', err);
    error.value = 'Failed to initialize map. Please check your internet connection and try again.';
    // Dismiss location notice on error to show map
    showLocationNotice.value = false;
  } finally {
    isLoading.value = false;
  }
}

// Request user location
async function requestUserLocation() {
  if (!hasGeolocation.value) {
    // No geolocation: set default location, show notice, allow map to work
    artworksStore.setCurrentLocation(DEFAULT_CENTER);
    if (map.value) {
      map.value.setView([DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude], props.zoom);
    }
    addUserLocationMarker(DEFAULT_CENTER);
    emit('locationFound', DEFAULT_CENTER);
    showLocationNotice.value = true;
    return;
  }

  isLocating.value = true;

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      });
    });

    const userLocation: Coordinates = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };

    // Update store
    artworksStore.setCurrentLocation(userLocation);

    // Center map on user location
    if (map.value) {
      map.value.setView([userLocation.latitude, userLocation.longitude], props.zoom);
    }

    // Add user location marker
    addUserLocationMarker(userLocation);

    // Emit location found event
    emit('locationFound', userLocation);

    // Hide location notice
    showLocationNotice.value = false;
  } catch (err) {
    // On error (denied, unavailable, etc): set default location, show notice, allow map to work
    console.warn('Geolocation error:', err);
    artworksStore.setCurrentLocation(DEFAULT_CENTER);
    if (map.value) {
      map.value.setView([DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude], props.zoom);
    }
    addUserLocationMarker(DEFAULT_CENTER);
    emit('locationFound', DEFAULT_CENTER);
    showLocationNotice.value = true;
  } finally {
    isLocating.value = false;
  }
}

// Add user location marker
function addUserLocationMarker(location: Coordinates) {
  if (!map.value) return;

  // Remove existing marker
  if (userLocationMarker.value) {
    map.value.removeLayer(userLocationMarker.value as any);
  }

  // Add new marker
  userLocationMarker.value = L.marker([location.latitude, location.longitude], {
    icon: createUserLocationIcon(),
  })
    .addTo(map.value!)
    .bindPopup('Your current location');
}

// Load artworks on map with intelligent viewport-based loading
async function loadArtworks() {
  console.log('[MARKER DEBUG] loadArtworks() called:', {
    mapExists: !!map.value,
    currentPropsLength: props.artworks?.length || 0,
    timestamp: new Date().toISOString(),
  });

  if (!map.value) {
    console.log('[MARKER DEBUG] loadArtworks() early return - no map');
    return;
  }

  try {
    // Get current map bounds with generous padding for smooth experience
    const bounds = map.value.getBounds();
    const padding = 0.15; // 15% padding around viewport
    const latPad = (bounds.getNorth() - bounds.getSouth()) * padding;
    const lngPad = (bounds.getEast() - bounds.getWest()) * padding;

    const expandedBounds = {
      north: bounds.getNorth() + latPad,
      south: bounds.getSouth() - latPad,
      east: bounds.getEast() + lngPad,
      west: bounds.getWest() - lngPad,
    };

    // Check if we already have data for this area (smart caching)
    if (lastLoadedBounds.value && boundsContain(lastLoadedBounds.value, expandedBounds)) {
      // We already have data for this viewport, just update markers
      updateArtworkMarkers();
      return;
    }

    // Show loading indicator for viewport changes
    isLoadingViewport.value = true;

    // Use progressive loading for potentially large datasets
    if (useProgressiveLoading.value) {
      await loadArtworksProgressively(expandedBounds);
    } else {
      // Standard loading
      console.log('[MARKER DEBUG] About to fetch artworks from store');
      await artworksStore.fetchArtworksInBounds(expandedBounds);
      console.log('[MARKER DEBUG] Finished fetching artworks, props should update next');
    }

    // Cache the bounds we just loaded
    lastLoadedBounds.value = expandedBounds;

    console.log('[MARKER DEBUG] About to wait for nextTick, then update markers:', {
      propsLength: props.artworks?.length || 0,
    });

    // Wait for Vue reactivity to update props before updating markers
    await nextTick();

    console.log('[MARKER DEBUG] After nextTick, props length now:', props.artworks?.length || 0);
    updateArtworkMarkers();
  } catch (err) {
    console.error('Error loading artworks:', err);
  } finally {
    isLoadingViewport.value = false;
  }
}

// Progressive loading for large datasets
async function loadArtworksProgressively(bounds: {
  north: number;
  south: number;
  east: number;
  west: number;
}) {
  if (!map.value) return;

  isProgressiveLoading.value = true;
  progressiveLoadingStats.value = { loaded: 0, total: 0, percentage: 0 };

  try {
    await artworksStore.fetchArtworksInBoundsBatched(
      bounds,
      500, // initial batch size
      (progress: {
        loaded: number;
        total: number;
        batch: ArtworkPin[];
        batchSize: number;
        avgTime: number;
      }) => {
        // Update progress stats
        progressiveLoadingStats.value = {
          loaded: progress.loaded,
          total: Math.max(progress.total, progress.loaded),
          percentage: Math.round(
            (progress.loaded / Math.max(progress.total, progress.loaded)) * 100
          ),
          batchSize: progress.batchSize,
          avgTime: progress.avgTime,
        };

        // Update markers incrementally for each batch
        nextTick(() => {
          updateArtworkMarkers();
        });
      }
    );
  } finally {
    isProgressiveLoading.value = false;
    progressiveLoadingStats.value = null;
  }
}

// Helper function to check if bounds A contains bounds B
function boundsContain(
  boundsA: { north: number; south: number; east: number; west: number },
  boundsB: { north: number; south: number; east: number; west: number }
): boolean {
  return (
    boundsA.north >= boundsB.north &&
    boundsA.south <= boundsB.south &&
    boundsA.east >= boundsB.east &&
    boundsA.west <= boundsB.west
  );
}

// Debounced marker update to prevent excessive calls during initialization
function updateArtworkMarkersDebounced(delay: number = 0) {
  if (markerUpdateTimeout.value) {
    clearTimeout(markerUpdateTimeout.value);
  }

  markerUpdateTimeout.value = setTimeout(() => {
    // Guard against running after component unmount
    if (map.value) {
      updateArtworkMarkers();
    }
  }, delay);
}

// Update artwork markers with efficient viewport-based rendering
function updateArtworkMarkers() {
  console.log('[MARKER DEBUG] updateArtworkMarkers() called:', {
    mapExists: !!map.value,
    clusterGroupExists: !!markerClusterGroup.value,
    propsArtworksLength: props.artworks?.length || 0,
    currentMarkersCount: artworkMarkers.value.length,
    mapContainerInDOM: !!mapContainer.value?.isConnected,
    mapSize: map.value ? { width: map.value.getSize().x, height: map.value.getSize().y } : null,
    timestamp: new Date().toISOString(),
  });

  if (!map.value || !markerClusterGroup.value) {
    console.log('[MARKER DEBUG] Early return - missing map or cluster group');
    return;
  }

  // Force map to be visible and properly sized
  if (mapContainer.value && map.value) {
    const containerRect = mapContainer.value.getBoundingClientRect();
    console.log('[MARKER DEBUG] Map container dimensions:', {
      width: containerRect.width,
      height: containerRect.height,
      isVisible: containerRect.width > 0 && containerRect.height > 0,
    });

    if (containerRect.width === 0 || containerRect.height === 0) {
      console.log('[MARKER DEBUG] Map container has zero dimensions - triggering resize');
      setTimeout(() => {
        map.value?.invalidateSize();
        updateArtworkMarkers();
      }, 100);
      return;
    }

    // Additional stability check - ensure map is actually rendered and interactive
    if (map.value && !map.value.getContainer()) {
      console.log('[MARKER DEBUG] Map container not yet attached - delaying marker update');
      setTimeout(() => updateArtworkMarkers(), 100);
      return;
    }
  }

  // Determine current bounds with padding for smooth experience
  const bounds = map.value.getBounds();
  const latPad = (bounds.getNorth() - bounds.getSouth()) * 0.05; // Reduced padding for viewport
  const lngPad = (bounds.getEast() - bounds.getWest()) * 0.05;
  const viewportBounds = L.latLngBounds(
    L.latLng(bounds.getSouth() - latPad, bounds.getWest() - lngPad),
    L.latLng(bounds.getNorth() + latPad, bounds.getEast() + lngPad)
  );

  // Get artworks that should be visible in current viewport and are of enabled types
  const artworksInViewport = (props.artworks || []).filter((artwork: ArtworkPin) => {
    const inBounds = viewportBounds.contains(L.latLng(artwork.latitude, artwork.longitude));
    const typeEnabled = isArtworkTypeEnabled(artwork.type || 'other');

    return inBounds && typeEnabled;
  });

  console.log('[MARKER DEBUG] Filtered artworks in viewport:', {
    totalPropsArtworks: props.artworks?.length || 0,
    artworksInViewport: artworksInViewport.length,
    viewportBounds: {
      north: viewportBounds.getNorth(),
      south: viewportBounds.getSouth(),
      east: viewportBounds.getEast(),
      west: viewportBounds.getWest(),
    },
    firstFewInViewport: artworksInViewport
      .slice(0, 3)
      .map((a: ArtworkPin) => ({ id: a.id, lat: a.latitude, lng: a.longitude })),
  });

  // Create a set of artwork IDs currently in viewport for efficient comparison
  const viewportArtworkIds = new Set(artworksInViewport.map((a: ArtworkPin) => a.id));

  // Create a set of currently displayed artwork IDs
  const currentArtworkIds = new Set(
    artworkMarkers.value
      .map((marker: any) => {
        // Get artwork ID from marker (stored when marker was created)
        return marker._artworkId;
      })
      .filter(Boolean)
  );

  // Remove markers that are no longer in viewport or are of disabled types
  artworkMarkers.value = artworkMarkers.value.filter((marker: any) => {
    const artworkId = marker._artworkId;
    const artworkType = marker._artworkType;

    // Remove if no longer in viewport
    if (artworkId && !viewportArtworkIds.has(artworkId)) {
      if (markerClusterGroup.value) {
        markerClusterGroup.value.removeLayer(marker as any);
      }
      return false; // Remove from artworkMarkers array
    }

    // Remove if artwork type is now disabled
    if (artworkType && !isArtworkTypeEnabled(artworkType)) {
      if (markerClusterGroup.value) {
        markerClusterGroup.value.removeLayer(marker as any);
      }
      return false; // Remove from artworkMarkers array
    }
    return true; // Keep in artworkMarkers array
  });

  // Add new markers for artworks that entered the viewport
  artworksInViewport.forEach((artwork: ArtworkPin) => {
    // Skip if marker already exists
    if (currentArtworkIds.has(artwork.id)) {
      return;
    }

    // Create new marker with optimized options
    const markerOptions = {
      ...createArtworkStyle(artwork.type || 'other'),
      interactive: true,
      bubblingMouseEvents: false,
      pane: 'markerPane',
    };

    const marker = L.circleMarker([artwork.latitude, artwork.longitude], markerOptions);

    // Store artwork ID and type on marker for efficient tracking
    (marker as any)._artworkId = artwork.id;
    (marker as any)._artworkType = artwork.type || 'other';

    // Create popup content
    const popupContent = `
      <div class="artwork-popup">
        <h3 class="font-semibold text-sm mb-1">${artwork.title || 'Untitled'}</h3>
        <button onclick="window.viewArtworkDetails('${artwork.id}')" 
                class="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">
          View Details
        </button>
      </div>
    `;

    marker.bindPopup(popupContent);

    // Add to cluster group first
    if (markerClusterGroup.value) {
      console.log('[MARKER DEBUG] Adding marker to cluster group:', {
        markerId: artwork.id,
        clusterGroupType: markerClusterGroup.value.constructor.name,
        isClusterGroupOnMap: map.value?.hasLayer(markerClusterGroup.value),
        mapContainerInDOM: !!mapContainer.value?.isConnected,
      });
      markerClusterGroup.value.addLayer(marker as any);
    } else {
      console.log('[MARKER DEBUG] No cluster group available for marker:', artwork.id);
    }

    // Add event handlers AFTER adding to cluster group to avoid conflicts
    marker.on('click', (e: L.LeafletMouseEvent) => {
      console.log('[MARKER DEBUG] Leaflet marker click event fired for artwork:', artwork.id);
      e.originalEvent?.stopPropagation();
      
      // Create preview data from artwork
      const previewData = {
        id: artwork.id,
        title: artwork.title || 'Untitled Artwork',
        description: artwork.type || 'Public artwork',
        thumbnailUrl: artwork.photos && artwork.photos.length > 0 ? artwork.photos[0] : undefined,
        lat: artwork.latitude,
        lon: artwork.longitude,
      };
      
      console.log('[MARKER DEBUG] Emitting previewArtwork event:', previewData);
      
      // Only emit preview event - let MapPreviewCard handle navigation
      emit('previewArtwork', previewData);
    });

    // Add hover effects
    marker.on('mouseover', () => {
      marker.setStyle({ fillOpacity: 1.0, weight: 2 });
    });

    marker.on('mouseout', () => {
      marker.setStyle({ fillOpacity: 0.9, weight: 1 });
    });

    artworkMarkers.value.push(marker);
  });
}

// Update styles (radius/color/etc) for all existing markers to react to zoom changes
function updateMarkerStyles() {
  // Guard against accessing map during destruction
  if (!map.value) {
    return;
  }

  try {
    // Recompute style for each marker and apply via setStyle
    artworkMarkers.value.forEach((marker: any) => {
      try {
        const artworkType = marker._artworkType || 'other';
        const newStyle = createArtworkStyle(artworkType as string);
        // circleMarker supports setStyle; markerCluster may wrap markers but setStyle should still work
        if (typeof marker.setStyle === 'function') {
          marker.setStyle(newStyle);
        }
        // Also attempt to setRadius on circle markers which sometimes don't update via setStyle
        if (typeof marker.setRadius === 'function' && typeof newStyle.radius === 'number') {
          try {
            marker.setRadius(newStyle.radius);
          } catch {
            /* ignore */
          }
        }

        // If this is a group/cluster wrapper, try to update inner layers as well
        if (marker.getLayers && typeof marker.getLayers === 'function') {
          const layers = marker.getLayers();
          layers.forEach((inner: any) => {
            if (!inner) return;
            if (typeof inner.setStyle === 'function') {
              try {
                inner.setStyle(newStyle);
              } catch {
                /* ignore */
              }
            }
            if (typeof inner.setRadius === 'function' && typeof newStyle.radius === 'number') {
              try {
                inner.setRadius(newStyle.radius);
              } catch {
                /* ignore */
              }
            }
          });
        }
      } catch (err) {
        // ignore per-marker failures
        // console.debug('Failed to update marker style for marker', marker, err);
      }
    });
  } catch (err) {
    console.warn('updateMarkerStyles failed:', err);
  }
}

// Configure marker layer group according to clusterEnabled
async function configureMarkerGroup() {
  if (!map.value) return;

  // Remove existing group from map
  if (markerClusterGroup.value) {
    try {
      map.value.removeLayer(markerClusterGroup.value);
    } catch {
      /* ignore */
    }
  }

  // Create new group
  if (clusterEnabled.value) {
    if ((L as any).markerClusterGroup) {
      markerClusterGroup.value = (L as any).markerClusterGroup({
        showCoverageOnHover: false,
        disableClusteringAtZoom: 18,
        spiderfyOnMaxZoom: true,
      });
    } else {
      markerClusterGroup.value = L.layerGroup();
    }
  } else {
    markerClusterGroup.value = L.layerGroup();
  }

  // Add to map and rebuild markers
  markerClusterGroup.value!.addTo(map.value);

  // Clear existing marker references since they belong to the old cluster group
  artworkMarkers.value = [];

  updateArtworkMarkers();

  // Ensure styles applied to any markers added during updateArtworkMarkers
  updateMarkerStyles();

  // Persist preference
  try {
    localStorage.setItem('map:clusterEnabled', String(clusterEnabled.value));
  } catch {
    /* ignore */
  }
}

// Handle map movement
function handleMapMove() {
  if (!map.value) return;

  const center = map.value.getCenter();
  const zoom = map.value.getZoom();

  const coordinates: Coordinates = {
    latitude: center.lat,
    longitude: center.lng,
  };

  // Update store
  artworksStore.setMapCenter(coordinates);
  artworksStore.setMapZoom(zoom);

  // Emit map move event
  emit('mapMove', { center: coordinates, zoom });
  
  // Dismiss preview on pan according to PRD
  emit('dismissPreview');

  // Persist map state
  try {
    localStorage.setItem('map:lastState', JSON.stringify({ center: coordinates, zoom }));
  } catch {
    /* ignore */
  }

  // Debounced artwork loading to prevent infinite loops
  debounceLoadArtworks();
  // Also update marker styles immediately for zoom changes (better responsiveness)
  updateArtworkMarkers();
  // Ensure existing markers update their style (radius/color) when zoom changes
  updateMarkerStyles();
  // Move debug rings to new center
  updateDebugRings();
}

// Debounced artwork loading with intelligent timing
let loadArtworksTimeout: ReturnType<typeof setTimeout> | null = null;
function debounceLoadArtworks() {
  // Clear existing timeout
  if (loadArtworksTimeout) {
    clearTimeout(loadArtworksTimeout);
  }

  // Clear any pending loading timeout state
  if (loadingTimeout.value) {
    clearTimeout(loadingTimeout.value);
  }

  // Set a shorter delay for more responsive loading
  loadArtworksTimeout = setTimeout(() => {
    // Guard against running after component unmount
    if (map.value) {
      loadArtworks();
    }
  }, 250); // Reduced from 500ms to 250ms for better responsiveness

  // Show loading state after a brief delay to avoid flicker
  loadingTimeout.value = setTimeout(() => {
    if (!isLoadingViewport.value && map.value) {
      isLoadingViewport.value = true;
    }
  }, 100);
}

// Map control methods
function zoomIn() {
  if (map.value) {
    map.value.zoomIn();
  }
}

function zoomOut() {
  if (map.value) {
    map.value.zoomOut();
  }
}

function centerOnUserLocation() {
  requestUserLocation();
}

function requestLocation() {
  requestUserLocation();
}

function clearError() {
  error.value = null;
}

function retryMapLoad() {
  error.value = null;
  initializeMap();
}

// Clear persistent map cache via store and reload markers
async function clearMapCacheAndReload() {
  if (clearingCache.value) return;
  const confirmed =
    typeof window !== 'undefined'
      ? window.confirm(
          'Clear cached map pins? This will remove locally stored pins and reload from the network.'
        )
      : true;
  if (!confirmed) return;
  try {
    clearingCache.value = true;
    artworksStore.clearMapCache();
    // Clear current in-memory pins; they will refill on next fetch
    artworksStore.setArtworks([]);
    await nextTick();
    updateArtworkMarkers();
    await loadArtworks();
  } finally {
    clearingCache.value = false;
  }
}

// Handle artwork type filter toggles
function handleArtworkTypeToggle(_artworkType: ArtworkTypeToggle) {
  // Immediately update markers to show/hide based on the new filter state
  updateArtworkMarkers();
}

// Enable all artwork type filters
function enableAllArtworkTypes() {
  enableAllTypes();
  updateArtworkMarkers();
}

// Disable all artwork type filters
function disableAllArtworkTypes() {
  disableAllTypes();
  updateArtworkMarkers();
}

// =====================
// Debug Rings (Overlays)
// =====================
function removeDebugRings() {
  if (!map.value) return;
  if (debugImmediateRing) {
    try {
      map.value.removeLayer(debugImmediateRing);
    } catch {
      /* ignore */
    }
    debugImmediateRing = null;
  }
}

function updateDebugRings() {
  if (!map.value) return;

  // Clear when disabled
  if (!debugRingsEnabled.value) {
    removeDebugRings();
    return;
  }

  const center = map.value.getCenter();

  // 100m immediate area (red dashed ring)
  if (!debugImmediateRing) {
    debugImmediateRing = L.circle([center.lat, center.lng], {
      radius: 100,
      color: '#dc2626', // red-600
      weight: 2,
      fill: false,
      dashArray: '6,6',
      interactive: false,
    }).addTo(map.value);
  } else {
    debugImmediateRing.setLatLng([center.lat, center.lng]);
    debugImmediateRing.setRadius(100);
  }
}

// Global function for popup buttons
// Only attach helper to window in browser environments
if (typeof window !== 'undefined') {
  (window as any).viewArtworkDetails = (artworkId: string) => {
    router.push(`/artwork/${artworkId}`);
  };
}

// Watch for props changes
watch(
  () => props.artworks,
  (newArtworks: ArtworkPin[] | undefined) => {
    console.log('[MARKER DEBUG] Props artworks watcher triggered:', {
      newArtworksLength: newArtworks?.length || 0,
      newArtworks: newArtworks?.slice(0, 3) || [], // First 3 for debugging
      timestamp: new Date().toISOString(),
    });
    // Use debounced update to prevent excessive calls during initialization
    updateArtworkMarkersDebounced(25);
  },
  { deep: true }
);

watch(
  () => props.center,
  (newCenter: Coordinates | undefined) => {
    if (newCenter && map.value) {
      const current = map.value.getCenter();
      // Only update if the new center is different (avoid recursive updates)
      if (
        Math.abs(current.lat - newCenter.latitude) > 1e-6 ||
        Math.abs(current.lng - newCenter.longitude) > 1e-6
      ) {
        map.value.setView([newCenter.latitude, newCenter.longitude], map.value.getZoom());
      }
    }
  }
);

// Apply external zoom changes (e.g., restored from localStorage)
watch(
  () => props.zoom,
  (newZoom: number | undefined) => {
    if (map.value && typeof newZoom === 'number' && newZoom !== map.value.getZoom()) {
      map.value.setZoom(newZoom);
    }
  }
);

// Handle window resize
const handleResize = () => {
  if (map.value) {
    console.log('Window resized, invalidating map size');
    map.value.invalidateSize();
  }
};

// When the nav rail toggles, Leaflet sometimes needs a few invalidateSize attempts
// to properly reflow. Try a few times spaced out to handle CSS transitions.
function handleNavRailToggle(_evt?: Event) {
  if (!map.value) return;
  const attempts = [0, 50, 150, 350];
  for (const t of attempts) {
    setTimeout(() => {
      try {
        map.value?.invalidateSize();
      } catch (e) {
        // ignore
      }
    }, t);
  }
}

// Watch for container size changes
watch(
  () => mapContainer.value,
  (newContainer: HTMLDivElement | undefined) => {
    if (newContainer && map.value) {
      console.log('Map container changed, invalidating size');
      nextTick(() => {
        map.value?.invalidateSize();
      });
    }
  }
);

// Lifecycle
onMounted(async () => {
  await nextTick();
  await initializeMap();

  // Add window resize listener (guarded for non-browser envs)
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize);
    // Listen for navigation rail toggle events so the map can reflow to the new width
    window.addEventListener('nav-rail-toggle', handleNavRailToggle as EventListener);
  }
});

onUnmounted(() => {
  // Clear any pending timeouts to prevent callbacks on destroyed map
  if (loadingTimeout.value) {
    clearTimeout(loadingTimeout.value);
    loadingTimeout.value = null;
  }
  if (markerUpdateTimeout.value) {
    clearTimeout(markerUpdateTimeout.value);
    markerUpdateTimeout.value = null;
  }
  if (zoomStyleTimeout.value) {
    clearTimeout(zoomStyleTimeout.value);
    zoomStyleTimeout.value = null;
  }
  if (loadArtworksTimeout) {
    clearTimeout(loadArtworksTimeout);
    loadArtworksTimeout = null;
  }

  // Remove window resize listener (guarded)
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('nav-rail-toggle', handleNavRailToggle as EventListener);
  }

  if (map.value) {
    // Remove all event listeners before destroying the map
    try {
      map.value.off('moveend');
      map.value.off('zoomend');
      map.value.off('zoom');
      map.value.off('locationfound');
      map.value.off('locationerror');
    } catch (e) {
      console.warn('Error removing map event listeners:', e);
    }
    
    // Clean up marker cluster group
    if (markerClusterGroup.value) {
      try {
        markerClusterGroup.value.clearLayers();
      } catch (e) {
        console.warn('Error clearing cluster group:', e);
      }
    }
    
    // Remove the map instance
    try {
      map.value.remove();
    } catch (e) {
      console.warn('Error removing map:', e);
    }
    
    map.value = undefined;
  }
});

// Watch clustering toggle
watch(
  () => clusterEnabled.value,
  async () => {
    await configureMarkerGroup();
  }
);

// Persist and react to debug rings toggle
watch(
  () => debugRingsEnabled.value,
  () => {
    try {
      localStorage.setItem('map:debugRingsEnabled', String(debugRingsEnabled.value));
    } catch {
      /* ignore */
    }
    updateDebugRings();
  }
);

// Update search ring when the effective fetch radius changes
// Note: Blue search ring removed; no need to watch fetchRadius for ring updates
</script>

<template>
  <div class="map-component h-full w-full relative">
    <!-- Map Container -->
    <div
      ref="mapContainer"
      class="h-full w-full relative z-0"
      :class="{ 'opacity-50': isLoading }"
      role="application"
      aria-label="Interactive map showing public artwork locations"
      :aria-busy="isLoading"
    />

    <!-- Loading Overlay -->
    <div
      v-if="isLoading"
      class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10"
      role="status"
      aria-live="polite"
    >
      <div class="flex flex-col items-center space-y-2">
        <div
          class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
          aria-hidden="true"
        ></div>
        <p class="text-sm text-gray-600">Loading map...</p>
      </div>
    </div>

    <!-- Viewport Loading Indicator -->
    <div
      v-if="isLoadingViewport && !isLoading"
      class="absolute top-4 right-4 bg-white bg-opacity-90 backdrop-blur-sm rounded-lg p-2 shadow-md z-15"
      role="status"
      aria-live="polite"
    >
      <div class="flex items-center space-x-2">
        <div
          class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"
          aria-hidden="true"
        ></div>
        <p class="text-xs text-gray-600">Loading artworks...</p>
      </div>
    </div>

    <!-- Progressive Loading Indicator -->
    <div
      v-if="isProgressiveLoading && progressiveLoadingStats"
      class="absolute top-4 right-4 bg-white bg-opacity-95 backdrop-blur-sm rounded-lg p-3 shadow-lg z-15"
      role="status"
      aria-live="polite"
    >
      <div class="flex items-center space-x-2 mb-2">
        <div
          class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"
          aria-hidden="true"
        ></div>
        <p class="text-xs text-gray-700 font-medium">Progressive Loading</p>
      </div>
      <div class="space-y-1">
        <div class="flex justify-between text-xs text-gray-600">
          <span>{{ progressiveLoadingStats.loaded }} loaded</span>
          <span>{{ progressiveLoadingStats.percentage }}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-1.5">
          <div
            class="bg-blue-600 h-1.5 rounded-full transition-all duration-300 ease-out"
            :style="{ width: `${progressiveLoadingStats.percentage}%` }"
          ></div>
        </div>
        <div
          v-if="progressiveLoadingStats.batchSize || progressiveLoadingStats.avgTime"
          class="flex justify-between text-xs text-gray-500 pt-1"
        >
          <span v-if="progressiveLoadingStats.batchSize"
            >Batch: {{ progressiveLoadingStats.batchSize }}</span
          >
          <span v-if="progressiveLoadingStats.avgTime"
            >{{ Math.round(progressiveLoadingStats.avgTime) }}ms avg</span
          >
        </div>
      </div>
    </div>

    <!-- Location Permission Notice -->
    <div
      v-if="showLocationNotice"
      class="absolute top-4 left-4 right-4 bg-yellow-100 border border-yellow-300 rounded-lg p-3 z-30"
      role="alert"
      aria-live="assertive"
    >
      <div class="flex items-start space-x-2">
        <ExclamationTriangleIcon class="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
        <div class="flex-1">
          <p class="text-sm text-yellow-800 font-medium">Location Access Needed</p>
          <p class="text-xs text-yellow-700 mb-2">
            Enable location access to see nearby artworks and improve your experience.
          </p>
          <div class="flex flex-col sm:flex-row gap-2">
            <button
              @click="requestLocation"
              class="text-xs bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 focus:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 transition-colors"
            >
              Enable Location
            </button>
            <a
              href="/help#location-access-faq"
              class="text-xs text-yellow-700 underline hover:text-yellow-800 focus:text-yellow-800 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 rounded px-1"
            >
              Why is this needed?
            </a>
          </div>
        </div>
      </div>
    </div>

  <!-- Map Controls -->
  <div class="absolute top-4 right-4 flex flex-col space-y-2 z-20">
      <!-- Map Options (Layers) Button -->
      <div class="relative">
        <button
          @click="showOptionsPanel = !showOptionsPanel"
          class="bg-white shadow-md rounded-full p-3 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          title="Map options"
          aria-label="Open map options"
          :aria-expanded="showOptionsPanel"
        >
          <Squares2X2Icon class="w-5 h-5 text-gray-700" />
        </button>

        <!-- Options Panel -->
        <div
          v-show="showOptionsPanel"
          class="absolute top-14 right-0 w-80 sm:w-96 lg:w-[32rem] bg-white shadow-xl rounded-lg p-4 border border-gray-200 max-h-[calc(100vh-8rem)] overflow-y-auto"
          role="dialog"
          aria-label="Map options"
        >
          <div class="flex items-start">
            <input
              id="toggle-cluster"
              type="checkbox"
              class="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              v-model="clusterEnabled"
            />
            <label for="toggle-cluster" class="ml-2 text-sm text-gray-700 select-none">
              Cluster markers
            </label>
          </div>
          <div class="mt-2 pt-2 border-t border-gray-100 flex items-start">
            <input
              id="toggle-rings"
              type="checkbox"
              class="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              v-model="debugRingsEnabled"
            />
            <label for="toggle-rings" class="ml-2 text-sm text-gray-700 select-none">
              Enable map rings (debug)
            </label>
          </div>
          <div class="mt-2 pt-2 border-t border-gray-100 flex items-start">
            <input
              id="toggle-progressive"
              type="checkbox"
              class="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              v-model="useProgressiveLoading"
            />
            <label for="toggle-progressive" class="ml-2 text-sm text-gray-700 select-none">
              Progressive loading
              <div class="text-xs text-gray-500 mt-0.5">Load large datasets in batches</div>
            </label>
          </div>
          <div class="mt-3 pt-3 border-t border-gray-100">
            <h3 class="text-sm font-medium text-gray-900 mb-1">Artwork Types Filtering</h3>
            <p class="text-xs text-gray-600 mb-3">
              Select which types of artworks to display on the map. Each colored circle shows the
              marker color used on the map.
            </p>

            <!-- Control buttons -->
            <div class="flex gap-2 mb-3">
              <button
                @click="enableAllArtworkTypes"
                class="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 focus:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
              >
                Enable All
              </button>
              <button
                @click="disableAllArtworkTypes"
                class="text-xs bg-gray-600 text-white px-3 py-1.5 rounded hover:bg-gray-700 focus:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1 transition-colors"
              >
                Disable All
              </button>
            </div>

            <!-- Artwork types grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              <div
                v-for="artworkType in artworkTypes"
                :key="artworkType.key"
                class="flex items-center"
              >
                <input
                  :id="`toggle-${artworkType.key}`"
                  type="checkbox"
                  class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
                  v-model="artworkType.enabled"
                  @change="handleArtworkTypeToggle(artworkType)"
                />
                <label
                  :for="`toggle-${artworkType.key}`"
                  class="ml-2 flex items-center text-xs text-gray-700 select-none min-w-0"
                >
                  <span
                    class="inline-block w-3 h-3 rounded-full mr-1.5 border border-white shadow-sm flex-shrink-0"
                    :style="{ backgroundColor: artworkType.color }"
                  ></span>
                  <span class="truncate">{{ artworkType.label }}</span>
                </label>
              </div>
            </div>
          </div>
          <div class="mt-4 pt-3 border-t border-gray-100">
            <button
              @click="clearMapCacheAndReload"
              :disabled="clearingCache"
              class="w-full text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
              title="Clear cached map pins"
            >
              {{ clearingCache ? 'Clearing…' : 'Clear map Cache' }}
            </button>
          </div>
        </div>
      </div>
      <!-- Current Location Button -->
      <button
        v-if="hasGeolocation"
        @click="centerOnUserLocation"
        :disabled="isLocating"
        class="bg-white shadow-md rounded-full p-3 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
        :title="isLocating ? 'Getting location...' : 'Center on current location'"
        :aria-label="isLocating ? 'Getting current location...' : 'Center map on current location'"
      >
        <MapPinIcon v-if="!isLocating" class="w-5 h-5 text-gray-700" />
        <div
          v-else
          class="w-5 h-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"
        ></div>
      </button>

      <!-- Zoom Controls -->
      <div class="bg-white shadow-md rounded-lg overflow-hidden">
        <button
          @click="zoomIn"
          class="block w-full px-3 py-2 text-gray-700 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset transition-colors border-b border-gray-200"
          title="Zoom in"
          aria-label="Zoom in on map"
        >
          <PlusIcon class="w-4 h-4 mx-auto" aria-hidden="true" />
        </button>
        <button
          @click="zoomOut"
          class="block w-full px-3 py-2 text-gray-700 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset transition-colors"
          title="Zoom out"
          aria-label="Zoom out on map"
        >
          <MinusIcon class="w-4 h-4 mx-auto" aria-hidden="true" />
        </button>
      </div>
    </div>

    <!-- Error Message -->
    <div
      v-if="error"
      class="absolute top-4 left-4 right-4 bg-red-100 border border-red-300 rounded-lg p-3 z-20"
      role="alert"
      aria-live="assertive"
    >
      <div class="flex items-start space-x-2">
        <ExclamationCircleIcon class="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
        <div class="flex-1">
          <p class="text-sm text-red-800 font-medium">Map Error</p>
          <p class="text-xs text-red-700">{{ error }}</p>
          <button
            @click="retryMapLoad"
            class="mt-2 text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
        <button
          @click="clearError"
          class="text-red-600 hover:text-red-800"
          aria-label="Dismiss error"
        >
          <XMarkIcon class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>

<style>
/* Custom marker styles */
.custom-artwork-icon,
.custom-user-location-icon {
  background: transparent !important;
  border: none !important;
}

/* Circle marker styles for better interaction */
.artwork-circle-marker {
  cursor: pointer !important;
}

.artwork-marker {
  cursor: pointer;
  transition: transform 0.2s ease;
}

.artwork-marker:hover {
  transform: scale(1.1);
}

.user-location-marker {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Popup styles */
.leaflet-popup-content {
  margin: 8px !important;
}

.artwork-popup img {
  margin-bottom: 8px;
}

/* Fix Leaflet icon paths */
.leaflet-default-icon-path {
  background-image: url('https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png');
}

/* Ensure Leaflet containers have proper dimensions */
.leaflet-container {
  height: 100% !important;
  width: 100% !important;
  position: relative !important;
}

.leaflet-map-pane {
  height: 100% !important;
  width: 100% !important;
  position: absolute !important;
  left: 0 !important;
  top: 0 !important;
}

.leaflet-tile-pane {
  height: 100% !important;
  width: 100% !important;
  position: absolute !important;
  left: 0 !important;
  top: 0 !important;
  z-index: 200 !important;
}

.leaflet-pane {
  width: 100% !important;
  height: 100% !important;
}

/* Force Leaflet tiles to display properly */
.leaflet-tile {
  width: 256px !important;
  height: 256px !important;
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  position: absolute !important;
}

.leaflet-tile-container {
  width: 100% !important;
  height: 100% !important;
}

/* Map container specific overrides */
.map-component .leaflet-container {
  height: 100% !important;
  width: 100% !important;
}

.map-component [role='application'] {
  height: 100% !important;
  width: 100% !important;
  position: relative !important;
}

/* Ensure tiles are always visible */
.map-component .leaflet-tile-pane img {
  width: 256px !important;
  height: 256px !important;
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
}

/* Fix marker clicking by disabling pointer events on interfering Leaflet panes */
.map-component .leaflet-popup-pane,
.map-component .leaflet-tooltip-pane {
  pointer-events: none !important;
}
</style>
