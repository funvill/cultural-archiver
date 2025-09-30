<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick, defineEmits } from 'vue';
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
} from '../composables/useArtworkTypeFilters';
import { useUserLists } from '../composables/useUserLists';
import { useMapFilters } from '../composables/useMapFilters';
import { useRouter } from 'vue-router';
import MapOptionsModal from './MapOptionsModal.vue';

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
  // telemetry update event - parent can listen for live telemetry
  , 'telemetryUpdate'
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
// Pending marker update flag to avoid mutating layers during Leaflet zoom animations
const pendingMarkerUpdate = ref(false);
// Explicit animating flag driven by Leaflet zoom events (avoid reading Leaflet private props)
const animatingZoom = ref(false);
// Pending dismiss preview when zoom animates
const pendingDismissPreview = ref(false);
// Debounce for updating marker styles during continuous zoom
const zoomStyleTimeout = ref<ReturnType<typeof setTimeout> | null>(null);
// Track zoom animation state to prevent marker updates during animations
const isZoomAnimating = ref(false);
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
const showOptionsModal = ref(false);
// Use mapFilters clustering state instead of local ref
const clusterEnabled = computed(() => mapFilters.filtersState.clusterEnabled);
const debugRingsEnabled = ref(false);
// Artwork type filters - using shared composable
const { isArtworkTypeEnabled, getTypeColor } =
  useArtworkTypeFilters();

// User lists for marker classification
const { visitedArtworks, starredArtworks } = useUserLists();

// Map filters for advanced filtering
const mapFilters = useMapFilters();

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


// Leaflet guard helpers

type LeafletGlobal = typeof L & {
  Popup?: typeof L.Popup & { prototype: Record<string, any> };
  Marker?: typeof L.Marker & { prototype: Record<string, any> };
  DomUtil?: typeof L.DomUtil & Record<string, any>;
  Map?: typeof L.Map & { prototype: Record<string, any> };
};

const getLeafletGlobal = (): LeafletGlobal | null => {
  if (typeof window !== 'undefined' && (window as any).L) {
    return (window as any).L as LeafletGlobal;
  }
  return L as LeafletGlobal;
};

const installLeafletPopupGuards = () => {
  const Lglobal = getLeafletGlobal();
  const popupProto = Lglobal?.Popup?.prototype as Record<string, any> | undefined;
  if (!popupProto || popupProto._superNuclearGuardInstalled) return;

  popupProto._superNuclearGuardInstalled = true;

  const guardPopupMethod = (methodName: '_animateZoom' | '_updatePosition' | '_updateLayout' | '_movePopup') => {
    const original = popupProto[methodName];
    if (typeof original !== 'function') return;

    const originalKey = `_original${methodName.substring(1).charAt(0).toUpperCase()}${methodName.substring(2)}`;
    if (!popupProto[originalKey]) {
      popupProto[originalKey] = original;
    }

    popupProto[methodName] = function (...args: any[]) {
      const popupInstance = this as any;
      if (!popupInstance) return popupInstance;

      if (methodName === '_movePopup') {
        const popup = popupInstance._popup;
        if (!popup || typeof popup.setLatLng !== 'function') {
          return popupInstance;
        }
      }

      try {
        return original.apply(this, args);
      } catch (error) {
        console.warn(`[POPUP DEBUG] Suppressed popup ${methodName} failure:`, error);
        return popupInstance;
      }
    };
  };

  guardPopupMethod('_animateZoom');
  guardPopupMethod('_updatePosition');
  guardPopupMethod('_updateLayout');
  guardPopupMethod('_movePopup');
};

const installLeafletDomUtilGuards = () => {
  const Lglobal = getLeafletGlobal();
  const domUtilAny = Lglobal?.DomUtil as (typeof L.DomUtil & Record<string, any>) | undefined;
  if (!domUtilAny || domUtilAny._superNuclearGuardInstalled) return;

  domUtilAny._superNuclearGuardInstalled = true;
  const originalGetPosition = domUtilAny.getPosition;
  domUtilAny._originalGetPosition = originalGetPosition;

  domUtilAny.getPosition = ((el: HTMLElement) => {
    if (!el) {
      return L.point(0, 0);
    }

    try {
      return originalGetPosition.call(domUtilAny, el);
    } catch (error) {
      return L.point(0, 0);
    }
  }) as typeof L.DomUtil.getPosition;
};

const installLeafletMapZoomGuard = () => {
  const Lglobal = getLeafletGlobal();
  const mapProto = Lglobal?.Map?.prototype as Record<string, any> | undefined;
  if (!mapProto || mapProto._superNuclearGuardInstalled) return;

  mapProto._superNuclearGuardInstalled = true;
  const originalAnimateZoom = mapProto._animateZoom;
  if (typeof originalAnimateZoom === 'function') {
    mapProto._originalAnimateZoomGuard = originalAnimateZoom;
    mapProto._animateZoom = function (...args: any[]) {
      try {
        return originalAnimateZoom.apply(this, args);
      } catch (error) {
        console.warn('[ZOOM DEBUG] Suppressed map _animateZoom failure:', error);
        return this;
      }
    };
  }
};

const installLeafletMarkerGuards = () => {
  const Lglobal = getLeafletGlobal();
  const markerProto = Lglobal?.Marker?.prototype as Record<string, any> | undefined;
  if (!markerProto || markerProto._superNuclearMarkerGuardInstalled) return;

  markerProto._superNuclearMarkerGuardInstalled = true;
  const originalMovePopup = markerProto._movePopup as ((this: L.Marker, e: any) => any) | undefined;
  if (typeof originalMovePopup === 'function') {
    markerProto._originalMovePopupGuard = originalMovePopup;
    markerProto._movePopup = function (this: L.Marker, e: any) {
      const popup = (this as any)._popup;
      if (!popup || typeof popup.setLatLng !== 'function') {
        return this;
      }

      try {
        originalMovePopup.call(this, e);
      } catch (error) {
        console.warn('[POPUP DEBUG] Suppressed marker _movePopup failure:', error);
      }
      return this;
    };
  }
};

// Default coordinates (Vancouver - near sample data for testing)
const DEFAULT_CENTER = { latitude: 49.265, longitude: -123.25 };

// Marker type enum for filtering
enum MarkerType {
  NORMAL = 'normal',
  VISITED = 'visited',
  STARRED = 'starred',
  UNKNOWN = 'unknown'
}

// Create circle marker style for normal artworks (replaces emoji icons for better performance)
const createArtworkStyle = (type: string) => {
  const normalized = (type || 'other').toLowerCase();

// Helper: render an icon to an offscreen canvas and return data-URI
function renderIconToDataUri(kind: 'flag' | 'star' | 'question', size: number, fillColor?: string) {
  const key = `${kind}:${size}:${fillColor || ''}`;
  if (iconDataUriCache.has(key)) return iconDataUriCache.get(key)!;

  // Create offscreen canvas
  const canvas = document.createElement('canvas');
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return '';
  }
  ctx.scale(dpr, dpr);

  // Draw background circle
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.fillStyle = kind === 'question' ? (fillColor || '#888') : (kind === 'star' ? '#F59E0B' : '#9CA3AF');
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#fff';
  ctx.stroke();

  // Draw simple glyphs centered
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  if (kind === 'flag') {
    // Simple flag pole + triangle
    const poleX = size * 0.36;
    ctx.fillRect(poleX, size * 0.22, size * 0.06, size * 0.56);
    ctx.moveTo(poleX + size * 0.06, size * 0.22);
    ctx.lineTo(size * 0.76, size * 0.38);
    ctx.lineTo(poleX + size * 0.06, size * 0.54);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'star') {
    // Draw a simple star via path approximation
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.22;
    for (let i = 0; i < 5; i++) {
      const a = ((-18 + i * 72) * Math.PI) / 180;
      const x = cx + Math.cos(a) * r * (i % 2 === 0 ? 1 : 0.45);
      const y = cy + Math.sin(a) * r * (i % 2 === 0 ? 1 : 0.45);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    // question mark - draw a rounded path approximation
    ctx.font = `${Math.floor(size * 0.6)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', size / 2, size / 2 - size * 0.06);
  }

  // Apply the user's requested unconditional doubling of marker sizes across all zooms.
  // Clamp to a reasonable maximum to avoid excessively large markers.
  dynamicRadius = Math.min(dynamicRadius * 2, maxRadius * 2);

// Create priority-based div icon for artworks using cached data-URIs (faster)
const createArtworkIcon = (artwork: ArtworkPin, listMembership?: { beenHere: boolean, wantToSee: boolean }) => {
  const currentZoom = map.value?.getZoom() ?? 15;
  const baseSize = Math.max(20, Math.min(32, currentZoom * 1.5));

  // Determine kind
  const kind: 'flag' | 'star' | 'question' = listMembership?.beenHere
    ? 'flag'
    : listMembership?.wantToSee
    ? 'star'
    : 'question';

  const fillColor = kind === 'question' ? getTypeColor((artwork.type || 'other').toLowerCase()) : undefined;
  const dataUri = renderIconToDataUri(kind, Math.floor(baseSize), fillColor);

  const html = `
    <div class="artwork-marker-outer" style="width: ${baseSize}px; height: ${baseSize}px; display:flex; align-items:center; justify-content:center;">
      <div class="artwork-marker-inner" style="width: ${baseSize}px; height: ${baseSize}px; border-radius:50%; background-image: url('${dataUri}'); background-size: cover; box-shadow: 0 2px 8px rgba(0,0,0,0.15); transition: transform 120ms ease, box-shadow 120ms ease;">
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: '',
    iconSize: [baseSize, baseSize],
    iconAnchor: [baseSize / 2, baseSize / 2],
  });
};

// Enhanced marker factory functions for different marker types
const createNormalMarker = (type: string) => {
  const currentZoom = map.value?.getZoom() ?? 15;
  const size = calculateIconSize(currentZoom);
  const fillColor = getTypeColor((type || 'other').toLowerCase());
  
  return L.divIcon({
    html: `
      <div class="artwork-normal-marker flex items-center justify-center" style="width: ${size}px; height: ${size}px;">
        <div class="normal-circle" style="
          width: ${size}px; 
          height: ${size}px; 
          border-radius: 50%; 
          background: ${fillColor};
          border: 2px solid #1f2937;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
        "></div>
      </div>
    `,
    className: 'custom-normal-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
};

const createVisitedMarker = () => {
  const currentZoom = map.value?.getZoom() ?? 15;
  const size = calculateIconSize(currentZoom);
  const circleDiameter = size;

  return L.divIcon({
    html: `
      <div
        class="artwork-visited-marker flex items-center justify-center"
        style="
          width: ${circleDiameter}px;
          height: ${circleDiameter}px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        "
      >
        
        <svg
          width="${circleDiameter}px"
          height="${circleDiameter}"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          stroke-width="3"
          style="
            position: absolute;
            background: #1f2937;
            border-radius: 9999px;
            padding: ${size * 0.06}px;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
          "
        >
          <polyline points="20,6 9,17 4,12"></polyline>
        </svg>
      </div>
    `,
    className: 'custom-visited-icon visited-marker-layer',
    iconSize: [circleDiameter, circleDiameter],
    iconAnchor: [circleDiameter / 2, circleDiameter / 2]
  });
};



const createStarredMarker = () => {
  const currentZoom = map.value?.getZoom() ?? 15;
  const size = calculateIconSize(currentZoom);
  
  return L.divIcon({
    html: `
      <div class="artwork-starred-marker flex items-center justify-center" style="width: ${size}px; height: ${size}px;">
        <div class="starred-circle" style="
          width: ${size}px; 
          height: ${size}px; 
          border-radius: 50%; 
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          border: 2px solid #d97706;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        ">
          <svg width="${size * 0.6}" height="${size * 0.6}" viewBox="0 0 24 24" fill="#fff" stroke="none">
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
          </svg>
        </div>
      </div>
    `,
    className: 'custom-starred-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const createUnknownMarker = (type: string) => {
  const currentZoom = map.value?.getZoom() ?? 15;
  const size = calculateIconSize(currentZoom);
  const fillColor = getTypeColor((type || 'other').toLowerCase());
  
  return L.divIcon({
    html: `
      <div class="artwork-unknown-marker flex items-center justify-center" style="width: ${size}px; height: ${size}px;">
        <div class="unknown-circle" style="
          width: ${size}px; 
          height: ${size}px; 
          border-radius: 50%; 
          background: ${fillColor};
          border: 2px dashed #6b7280;
          opacity: 0.6;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
        "></div>
      </div>
    `,
    className: 'custom-unknown-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
};

// Helper functions for marker sizing
const calculateIconSize = (currentZoom: number) => {
  const minSize = 16;
  const maxSize = 32;
  const minZoom = 12;
  const maxZoom = 18;
  
  if (currentZoom <= minZoom) {
    return minSize;
  } else if (currentZoom >= maxZoom) {
    return maxSize;
  } else {
    const t = (currentZoom - minZoom) / (maxZoom - minZoom);
    return Math.round(minSize + t * (maxSize - minSize));
  }
};

// Function to determine marker type based on artwork and user lists
const getMarkerType = (artwork: ArtworkPin): MarkerType => {
  // For test/mock data, check title keywords first
  if (artwork.title) {
    const titleLower = artwork.title.toLowerCase();
    if (titleLower.includes('unknown')) {
      return MarkerType.UNKNOWN;
    }
    if (titleLower.includes('starred')) {
      return MarkerType.STARRED;
    }
    if (titleLower.includes('visited')) {
      return MarkerType.VISITED;
    }
  }
  
  // Check user lists using the composable (for production data)
  if (starredArtworks.value.has(artwork.id)) {
    return MarkerType.STARRED;
  }
  
  if (visitedArtworks.value.has(artwork.id)) {
    return MarkerType.VISITED;
  }
  
  return MarkerType.NORMAL;
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

    // Install persistent Leaflet guards to prevent popup zoom crashes
    installLeafletPopupGuards();
    installLeafletDomUtilGuards();
    installLeafletMapZoomGuard();
    installLeafletMarkerGuards();
    installLeafletPopupGuards();
    installLeafletDomUtilGuards();
    installLeafletMapZoomGuard();
    installLeafletMarkerGuards();

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
      if (saved !== null) {
        mapFilters.filtersState.clusterEnabled = saved === 'true';
      }
    } catch {
      /* ignore */
    }

    await configureMarkerGroup();

    // 🚀 PROACTIVE ZOOM INTERCEPTION - Override zoom controls to execute nuclear cleanup BEFORE animation starts
    const interceptZoomControls = () => {
      if (!map.value) return;

      // Wait for Leaflet to fully initialize the zoom controls
      nextTick(() => {
        const zoomInButton = map.value!.getContainer().querySelector('.leaflet-control-zoom-in');
        const zoomOutButton = map.value!.getContainer().querySelector('.leaflet-control-zoom-out');

        if (zoomInButton) {
          console.log('[ZOOM DEBUG] Intercepting zoom in button');
          // Remove existing event listeners and add our own
          const newZoomInButton = zoomInButton.cloneNode(true) as HTMLElement;
          zoomInButton.parentNode?.replaceChild(newZoomInButton, zoomInButton);
          
          newZoomInButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            executeNuclearZoom(() => map.value!.zoomIn());
          });
        }

        if (zoomOutButton) {
          console.log('[ZOOM DEBUG] Intercepting zoom out button');
          // Remove existing event listeners and add our own
          const newZoomOutButton = zoomOutButton.cloneNode(true) as HTMLElement;
          zoomOutButton.parentNode?.replaceChild(newZoomOutButton, zoomOutButton);
          
          newZoomOutButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            executeNuclearZoom(() => map.value!.zoomOut());
          });
        }
      });
    };

    // 🚀 NUCLEAR ZOOM EXECUTION - Synchronous popup cleanup BEFORE zoom animation can start
    const executeNuclearZoom = (zoomAction: () => void) => {
      console.log('[ZOOM DEBUG] Executing nuclear zoom with synchronous popup cleanup');
      
      if (!map.value) return;

      // 🔥 IMMEDIATE SYNCHRONOUS POPUP DESTRUCTION - Execute BEFORE any Leaflet animation starts
      console.log('[POPUP DEBUG] SYNCHRONOUS: Destroying all popups before zoom animation can start');
      
      // Force preview dismissal immediately
      emit('dismissPreview');

      // Close all popups immediately and synchronously
      const mapAny = map.value as any;
      
      // Remove main popup completely
      if (mapAny._popup) {
        map.value.closePopup();
        mapAny._popup = null;
      }
      
      // Remove all popup layers from map's internal layer management
      if (mapAny._layers) {
        Object.keys(mapAny._layers).forEach(layerKey => {
          const layer = mapAny._layers[layerKey];
          if (layer && layer._popup) {
            if (map.value!.hasLayer(layer._popup)) {
              map.value!.removeLayer(layer._popup);
            }
            layer._popup = null;
          }
        });
      }

      // Clear and rebuild cluster group to ensure clean state
      if (markerClusterGroup.value) {
        markerClusterGroup.value.clearLayers();
        artworkMarkers.value.forEach((marker: any) => {
          if (marker) {
            // Remove any popup from marker
            if (marker.getPopup && marker.getPopup()) {
              marker.unbindPopup();
            }
            markerClusterGroup.value!.addLayer(marker);
          }
        });
      }

      console.log('[ZOOM DEBUG] Starting zoom action with completely clean popup state');
      
      // Execute the actual zoom - now safe because all popups are destroyed
      zoomAction();
    };

    // Initialize zoom control interception
    interceptZoomControls();

    // Setup event listeners
    map.value.on('moveend', handleMapMove);
    map.value.on('zoomend', handleMapMove);
    
    // Track zoom animation state to prevent marker updates during animations
    map.value.on('zoomstart', () => {
      try {
        isZoomAnimating.value = true;
        console.log('[ZOOM DEBUG] SUPER NUCLEAR: Instantaneous popup destruction started');

        // Ensure Leaflet guard patches are active before zoom
        // Defensive overrides: ensure persistent guard patches stay active
        try {
          installLeafletPopupGuards();
          installLeafletDomUtilGuards();
          installLeafletMapZoomGuard();
          installLeafletMarkerGuards();
        } catch (overrideErr) {
          console.warn('[ZOOM DEBUG] Error applying defensive overrides:', overrideErr);
        }

        // Synchronous popup/DOM cleanup
        const mapAny = map.value as any;

        // Remove the main popup if present
        try {
          if (mapAny && mapAny._popup) {
            try {
              if (map.value && typeof map.value.closePopup === 'function') map.value.closePopup();
            } catch {};
            try {
              if (mapAny._popup && mapAny._popup._container && mapAny._popup._container.parentNode) {
                mapAny._popup._container.parentNode.removeChild(mapAny._popup._container);
              }
            } catch {};
            mapAny._popup = null;
          }
        } catch (mainPopupErr) {
          console.warn('[ZOOM DEBUG] Error removing main popup:', mainPopupErr);
        }

        // Remove popups attached to layers
        try {
          if (mapAny && mapAny._layers) {
            Object.keys(mapAny._layers).forEach(layerKey => {
              try {
                const layer = mapAny._layers[layerKey];
                if (layer && layer._popup) {
                  try {
                    if (layer._popup._container && layer._popup._container.parentNode) {
                      layer._popup._container.parentNode.removeChild(layer._popup._container);
                    }
                  } catch {}
                  try { layer._popup = null; } catch {}
                }
              } catch (e) {
                /* ignore individual layer errors */
              }
            });
          }
        } catch (layersErr) {
          console.warn('[ZOOM DEBUG] Error cleaning layer popups:', layersErr);
        }

        // Force-close popups on markers
        let popupsClosed = 0;
        try {
          artworkMarkers.value.forEach((marker: any) => {
            try {
              const hasPopup = !!marker?._popup;
              const isOpen = !!(marker && marker.isPopupOpen && marker.isPopupOpen());
              if (hasPopup || isOpen) {
                try {
                  if (marker._popup && marker._popup._container && marker._popup._container.parentNode) {
                    marker._popup._container.parentNode.removeChild(marker._popup._container);
                  }
                } catch {}
                try { if (marker.closePopup) marker.closePopup(); } catch {}
                try { marker._popup = null; } catch {}
                popupsClosed++;
              }
            } catch (markerErr) {
              /* ignore marker-level errors */
            }
          });
        } catch (markerLoopErr) {
          console.warn('[ZOOM DEBUG] Error iterating markers to close popups:', markerLoopErr);
        }

        // Emergency DOM cleanup: remove any orphaned popup elements
        try {
          const selectors = ['.leaflet-popup', '.leaflet-popup-pane', '.leaflet-popup-content-wrapper', '.leaflet-popup-content', '.leaflet-popup-tip-container', '.leaflet-popup-tip', '.artwork-popup-container'];
          selectors.forEach(sel => {
            const nodes = Array.from(document.querySelectorAll(sel));
            nodes.forEach(n => { try { n.remove(); } catch {} });
          });
        } catch (domErr) {
          console.warn('[ZOOM DEBUG] Emergency DOM cleanup error:', domErr);
        }

        // Clear cluster group state if available (best-effort)
        try {
          if (markerClusterGroup.value) {
            try { markerClusterGroup.value.clearLayers(); } catch {};
            try { artworkMarkers.value.forEach((m: any) => markerClusterGroup.value.addLayer(m)); } catch {}
          }
        } catch (clusterErr) {
          console.warn('[ZOOM DEBUG] Error resetting cluster group:', clusterErr);
        }

        // Ensure preview dismissed
        try { emit('dismissPreview'); } catch (_) {}

        console.log('[ZOOM DEBUG] All popup closure attempts completed. Closed', popupsClosed, 'popups.');
      } catch (overallError) {
        console.error('[ZOOM DEBUG] Critical error in zoomstart handler:', overallError);
        // Ensure zoom state is set so other logic knows animation may be happening
        isZoomAnimating.value = true;
      }
    });
    
    map.value.on('zoomend', () => {
      try {
        isZoomAnimating.value = false;
        
        // Debug: Log final zoom state
        const mapAny = map.value as any;
      console.log('[ZOOM DEBUG] Zoom animation ended:', {
        currentZoom: map.value?.getZoom(),
        hasPopup: !!mapAny?._popup,
        mapExists: !!map.value,
        mapContainerExists: !!map.value?.getContainer(),
        markerCount: artworkMarkers.value.length,
        timestamp: new Date().toISOString()
      });

      // RESTORE: Re-enable ALL popup methods after zoom completes
      try {
        const Lglobal = getLeafletGlobal();
        if (Lglobal) {
          const popupProto = Lglobal.Popup?.prototype as any;
          if (popupProto && popupProto._superNuclearGuardInstalled) {
            console.log('[POPUP DEBUG] Persistent popup guards active; skipping popup restoration');
          } else if (popupProto) {
            if (popupProto._originalAnimateZoom) {
              console.log('[POPUP DEBUG] Restoring popup _animateZoom method');
              popupProto._animateZoom = popupProto._originalAnimateZoom;
            }

            if (popupProto._originalUpdatePosition) {
              console.log('[POPUP DEBUG] Restoring popup _updatePosition method');
              popupProto._updatePosition = popupProto._originalUpdatePosition;
            }

            if (popupProto._originalUpdateLayout) {
              console.log('[POPUP DEBUG] Restoring popup _updateLayout method');
              popupProto._updateLayout = popupProto._originalUpdateLayout;
            }
          }

          if (Lglobal.Marker && Lglobal.Marker.prototype && Lglobal.Marker.prototype._originalOpenPopup) {
            console.log('[POPUP DEBUG] Restoring marker openPopup method');
            Lglobal.Marker.prototype.openPopup = Lglobal.Marker.prototype._originalOpenPopup;
          }

          if (Lglobal.DomUtil) {
            const domUtilAny = Lglobal.DomUtil as any;
            if (domUtilAny._superNuclearGuardInstalled) {
              console.log('[POPUP DEBUG] Persistent DomUtil guards active; skipping restoration');
            } else if (domUtilAny._originalGetPosition) {
              console.log('[POPUP DEBUG] Restoring DomUtil.getPosition method');
              Lglobal.DomUtil.getPosition = domUtilAny._originalGetPosition;
            }
          }

          if (map.value) {
            const mapInstance = map.value as any;
            if (mapInstance._originalGetMapPanePos) {
              console.log('[POPUP DEBUG] Restoring map _getMapPanePos method');
              mapInstance._getMapPanePos = mapInstance._originalGetMapPanePos;
            }
          }
        }

        // RESTORE: Re-enable CSS transitions and restore transforms
        console.log('[POPUP DEBUG] Restoring CSS transitions and transforms');
        
        // Restore transitions on preview elements
        const previewElements = document.querySelectorAll('.preview-card, .shake-animation, [class*="transition"]');
        previewElements.forEach((el) => {
          const element = el as HTMLElement;
          if (element.style) {
            element.style.transition = '';
            element.style.animation = '';
          }
        });

        // Restore original transforms on map panes
        const mapPanes = document.querySelectorAll('.leaflet-map-pane, .leaflet-popup-pane');
        mapPanes.forEach((pane) => {
          const paneEl = pane as HTMLElement;
          const originalTransform = paneEl.getAttribute('data-original-transform');
          if (originalTransform) {
            paneEl.style.transform = originalTransform;
            paneEl.removeAttribute('data-original-transform');
          }
        });
        
      } catch (restoreError) {
        console.warn('[POPUP DEBUG] Error restoring popup animation method:', restoreError);
      }
      
      // Update markers after zoom animation completes
      updateArtworkMarkersDebounced(50);
      
      } catch (zoomEndError) {
        console.error('[ZOOM DEBUG] Critical error in zoomend handler:', zoomEndError);
        // Ensure zoom state is cleared even if restoration fails
        isZoomAnimating.value = false;
      }
    });
    
    // Update marker styles during continuous zoom events (throttled)
    map.value.on('zoom', () => {
      console.log('[ZOOM DEBUG] Zoom event fired:', {
        currentZoom: map.value?.getZoom(),
        isAnimating: isZoomAnimating.value,
        timestamp: new Date().toISOString()
      });
      
      if (zoomStyleTimeout.value) clearTimeout(zoomStyleTimeout.value);
      zoomStyleTimeout.value = setTimeout(() => {
        try {
          // Guard against calling updateMarkerStyles after map destruction or during animation
          if (map.value && !isZoomAnimating.value) {
            console.log('[ZOOM DEBUG] Updating marker styles after zoom');
            updateMarkerStyles();
          } else {
            console.log('[ZOOM DEBUG] Skipping marker style update - map missing or still animating');
          }
        } catch (e) {
          console.warn('[ZOOM DEBUG] Error updating marker styles:', e);
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
      updateArtworkMarkers().catch(console.error);
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
    updateArtworkMarkers().catch(console.error);
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
          updateArtworkMarkers().catch(console.error);
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
    // Guard against running after component unmount or during zoom animations
    if (map.value && !isZoomAnimating.value) {
      updateArtworkMarkers();
    } else if (isZoomAnimating.value) {
      // Retry after animation completes
      updateArtworkMarkersDebounced(100);
    }
  }, delay);
}

// Update artwork markers with efficient viewport-based rendering
async function updateArtworkMarkers() {
    // If we're currently performing an animated zoom, avoid mutating layers.
  if (map.value && animatingZoom.value) {
    if (!pendingMarkerUpdate.value) {
      pendingMarkerUpdate.value = true;
      // Schedule a one-time update after zoomend
      map.value.once('zoomend', () => {
        pendingMarkerUpdate.value = false;
        // ensure animating flag cleared before updating
        animatingZoom.value = false;
        updateArtworkMarkers().catch(console.error);
      });
    }
    return;
  }
  console.log('[MARKER DEBUG] updateArtworkMarkers() called:', {
    mapExists: !!map.value,
    clusterGroupExists: !!markerClusterGroup.value,
    propsArtworksLength: props.artworks?.length || 0,
    currentMarkersCount: artworkMarkers.value.length,
    mapContainerInDOM: !!mapContainer.value?.isConnected,
    mapSize: map.value ? { width: map.value.getSize().x, height: map.value.getSize().y } : null,
    isZoomAnimating: isZoomAnimating.value,
    timestamp: new Date().toISOString(),
  });

  if (!map.value || !markerClusterGroup.value) {
    console.log('[MARKER DEBUG] Early return - missing map or cluster group');
    return;
  }

  // Prevent marker updates during zoom animations to avoid _latLngToNewLayerPoint errors
  if (isZoomAnimating.value) {
    console.log('[MARKER DEBUG] Skipping marker update during zoom animation');
    // Retry after animation completes
    updateArtworkMarkersDebounced(100);
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
        updateArtworkMarkers().catch(console.error);
      }, 100);
      return;
    }

    // Additional stability check - ensure map is actually rendered and interactive
    if (map.value && !map.value.getContainer()) {
      console.log('[MARKER DEBUG] Map container not yet attached - delaying marker update');
      setTimeout(() => updateArtworkMarkers().catch(console.error), 100);
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

  // Get artworks that should be visible in current viewport and pass all filters
  const artworksInViewport = (props.artworks || []).filter((artwork: ArtworkPin) => {
    const inBounds = viewportBounds.contains(L.latLng(artwork.latitude, artwork.longitude));
    
    // Use the new comprehensive filtering system
    if (!mapFilters.shouldShowArtwork(artwork)) {
      return false;
    }

    return inBounds;
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
      try {
        // Close any open popup first to prevent animation issues
        if (marker.isPopupOpen && marker.isPopupOpen()) {
          marker.closePopup();
        }
        // Remove from cluster group first
        if (markerClusterGroup.value && markerClusterGroup.value.hasLayer(marker)) {
          markerClusterGroup.value.removeLayer(marker as any);
        }
        // Remove any lingering event listeners
        if (marker.off) {
          marker.off();
        }
      } catch (e) {
        console.warn('[MARKER DEBUG] Error removing marker from cluster:', e);
      }
      return false; // Remove from artworkMarkers array
    }
  } else {
    artworkMarkers.value = artworkMarkers.value.filter((marker: any) => {
      const artworkId = marker._artworkId;
      const artworkType = marker._artworkType;

    // Remove if artwork type is now disabled
    if (artworkType && !isArtworkTypeEnabled(artworkType)) {
      try {
        // Close any open popup first to prevent animation issues
        if (marker.isPopupOpen && marker.isPopupOpen()) {
          marker.closePopup();
        }
        // Remove from cluster group first
        if (markerClusterGroup.value && markerClusterGroup.value.hasLayer(marker)) {
          markerClusterGroup.value.removeLayer(marker as any);
        }
        // Remove any lingering event listeners
        if (marker.off) {
          marker.off();
        }
      } catch (e) {
        console.warn('[MARKER DEBUG] Error removing marker from cluster:', e);
      }
      return true; // Keep in artworkMarkers array
    });
  }

  // Sort artworks by marker type to ensure visited markers are added first (appear behind)
  const sortedArtworks = artworksInViewport.sort((a: ArtworkPin, b: ArtworkPin) => {
    const typeA = getMarkerType(a);
    const typeB = getMarkerType(b);
    
    // Visited markers first (behind), then unknown, then normal, then starred (on top)
    const order = { [MarkerType.VISITED]: 0, [MarkerType.UNKNOWN]: 1, [MarkerType.NORMAL]: 2, [MarkerType.STARRED]: 3 };
    return (order[typeA] || 2) - (order[typeB] || 2);
  });

  // Add new markers for artworks that entered the viewport
  sortedArtworks.forEach((artwork: ArtworkPin) => {
    // Skip if marker already exists
    if (currentArtworkIds.has(artwork.id)) {
      return;
    }

    // Create new marker using appropriate factory based on artwork type
    const markerType = getMarkerType(artwork);
    let marker: L.Marker;

    switch (markerType) {
      case MarkerType.VISITED:
        marker = L.marker([artwork.latitude, artwork.longitude], { icon: createVisitedMarker() });
        break;
      case MarkerType.STARRED:
        marker = L.marker([artwork.latitude, artwork.longitude], { icon: createStarredMarker() });
        break;
      case MarkerType.UNKNOWN:
        marker = L.marker([artwork.latitude, artwork.longitude], { icon: createUnknownMarker(artwork.type || 'other') });
        break;
      case MarkerType.NORMAL:
      default:
        marker = L.marker([artwork.latitude, artwork.longitude], { icon: createNormalMarker(artwork.type || 'other') });
        break;
    }

    // Store artwork ID and type on marker for efficient tracking and type on marker for efficient tracking
    (marker as any)._artworkId = artwork.id;
    (marker as any)._artworkType = artwork.type || 'other';
    (marker as any)._markerType = markerType;

    // Add event handlers BEFORE adding to cluster group to ensure proper binding
    marker.on('click', (e: L.LeafletMouseEvent) => {
      console.log('[MARKER DEBUG] Leaflet marker click event fired for artwork:', artwork.id);
      
      // Debug: Log marker and popup state at click time
      const markerAny = marker as any;
      const mapAny = map.value as any;
      
      // Check if there are existing preview elements that might cause conflicts
      const existingPreviews = document.querySelectorAll('.preview-card, [data-preview-id]');
      const previewAnimations = document.querySelectorAll('.shake-animation, [class*="animate"]');
      
      console.log('[POPUP DEBUG] Marker clicked - state:', {
        markerId: artwork.id,
        markerHasPopup: !!markerAny._popup,
        mapHasPopup: !!mapAny?._popup,
        markerIsOnMap: map.value?.hasLayer(marker) || false,
        zoomAnimating: isZoomAnimating.value,
        existingPreviewElements: existingPreviews.length,
        activeAnimations: previewAnimations.length,
        timestamp: new Date().toISOString()
      });

      // If there are existing preview elements, this is a transition scenario
      if (existingPreviews.length > 0) {
        console.log('[POPUP DEBUG] Preview transition detected - existing preview elements will conflict with zoom');
      }
      
      // Prevent event propagation to avoid map click conflicts
      if (e.originalEvent) {
        e.originalEvent.stopPropagation();
        e.originalEvent.preventDefault();
      }
      
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
      
      // SPECIAL HANDLING: If zoom is starting, defer the preview event
      if (isZoomAnimating.value) {
        console.log('[POPUP DEBUG] Deferring preview event due to active zoom animation');
        // Wait for zoom to complete before showing preview
        setTimeout(() => {
          if (!isZoomAnimating.value) {
            emit('previewArtwork', previewData);
          }
        }, 100);
        return;
      }

      // Only emit preview event - let MapPreviewCard handle navigation
      emit('previewArtwork', previewData);
    });

    // Create popup content - but disable during zoom animations to prevent null reference errors
    const popupContent = `
      <div class="artwork-popup">
        <h3 class="font-semibold text-sm mb-1">${artwork.title || 'Untitled'}</h3>
        <button onclick="window.viewArtworkDetails('${artwork.id}')" 
                class="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">
          View Details
        </button>
      </div>
    `;

    console.log('[POPUP DEBUG] Binding popup to marker:', {
      markerId: artwork.id,
      markerPosition: [artwork.latitude, artwork.longitude],
      mapExists: !!map.value,
      isZoomAnimating: isZoomAnimating.value
    });

    marker.bindPopup(popupContent, {
      closeOnClick: true,
      autoClose: true,
      closeButton: true,
      // Set a custom className to identify our popups
      className: 'artwork-popup-container'
    });

    // Add popup event listeners for debugging
    marker.on('popupopen', (e: any) => {
      console.log('[POPUP DEBUG] Popup opened for marker:', {
        markerId: artwork.id,
        popupElement: !!e.popup._container,
        mapExists: !!map.value,
        isZoomAnimating: isZoomAnimating.value,
        timestamp: new Date().toISOString()
      });
    });

    marker.on('popupclose', (e: any) => {
      console.log('[POPUP DEBUG] Popup closed for marker:', {
        markerId: artwork.id,
        reason: 'popup-close-event',
        popupExists: !!e.popup,
        mapExists: !!map.value,
        isZoomAnimating: isZoomAnimating.value,
        timestamp: new Date().toISOString()
      });
    });

    // Add to cluster group after event handlers are set up
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

    // Add hover effects (only for CircleMarkers)
    if (marker instanceof L.CircleMarker) {
      const circleMarker = marker as L.CircleMarker;
      marker.on('mouseover', () => {
        circleMarker.setStyle({ fillOpacity: 1.0, weight: 2 });
      });

      marker.on('mouseout', () => {
        circleMarker.setStyle({ fillOpacity: 0.9, weight: 1 });
      });
    }

    artworkMarkers.value.push(marker);
  });
}

// Update styles (radius/color/etc) for all existing markers to react to zoom changes
function updateMarkerStyles() {
  if (!map.value) {
    return;
  }

  try {
    artworkMarkers.value.forEach((marker: any) => {
      try {
        const artworkType = marker._artworkType || 'other';
        const markerType = marker._markerType as MarkerType | undefined;
        const newStyle = createArtworkStyle(artworkType as string);

        if (typeof marker.setIcon === 'function' && markerType) {
          let newIcon: L.DivIcon | null = null;
          switch (markerType) {
            case MarkerType.VISITED:
              newIcon = createVisitedMarker();
              break;
            case MarkerType.STARRED:
              newIcon = createStarredMarker();
              break;
            case MarkerType.UNKNOWN:
              newIcon = createUnknownMarker(artworkType as string);
              break;
            case MarkerType.NORMAL:
            default:
              newIcon = createNormalMarker(artworkType as string);
              break;
          }

          if (newIcon) {
            marker.setIcon(newIcon);
          }
        }

        if (typeof marker.setStyle === 'function') {
          marker.setStyle(newStyle);
        }

        if (typeof marker.setRadius === 'function' && typeof newStyle.radius === 'number') {
          try {
            marker.setRadius(newStyle.radius);
          } catch {
            /* ignore */
          }

<<<<<<< HEAD
          // If this is a group/cluster wrapper, try to update inner layers as well
          if ((marker as any).getLayers && typeof (marker as any).getLayers === 'function') {
            const layers = (marker as any).getLayers();
            layers.forEach((inner: any) => {
              if (!inner) return;
              // For inner layers in cluster groups, also try to update the icon
              if (typeof inner.setIcon === 'function') {
                try {
                  inner.setIcon(newIcon);
                } catch {
                  /* ignore */
                }
=======
        if (marker.getLayers && typeof marker.getLayers === 'function') {
          const layers = marker.getLayers();
          layers.forEach((inner: any) => {
            if (!inner) return;
            if (typeof inner.setStyle === 'function') {
              try {
                inner.setStyle(newStyle);
              } catch {
                /* ignore */
>>>>>>> ad07d42 (Filter artworks without photos)
              }
            });
          }
        } catch (err) {
          // ignore per-marker failures
          // console.debug('Failed to update marker style for marker', marker, err);
        }
<<<<<<< HEAD
=======
      } catch (err) {
        /* ignore individual marker errors */
>>>>>>> ad07d42 (Filter artworks without photos)
      }
    } catch (err) {
      console.warn('updateMarkerStyles failed:', err);
    }
  })();
}

// Configure marker layer group according to clusterEnabled
async function configureMarkerGroup() {
  if (!map.value) return;

  // If a zoom animation is in progress, defer reconfiguration to avoid removing/adding layers mid-animation
  if (animatingZoom.value && map.value && !pendingMarkerUpdate.value) {
    pendingMarkerUpdate.value = true;
    map.value.once('zoomend', () => {
      pendingMarkerUpdate.value = false;
      animatingZoom.value = false;
      // Retry configuration after animation
      configureMarkerGroup().catch?.(console.error);
    });
    return;
  }

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

  updateArtworkMarkers().catch(console.error);

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
  // If a zoom animation is in progress, defer dismissing the preview until after animation ends
  if (animatingZoom.value && map.value) {
    if (!pendingDismissPreview.value) {
      pendingDismissPreview.value = true;
      map.value.once('zoomend', () => {
        pendingDismissPreview.value = false;
        try {
          emit('dismissPreview');
        } catch (e) {
          /* ignore */
        }
      });
    }
  } else {
    emit('dismissPreview');
  }

  // Persist map state
  try {
    localStorage.setItem('map:lastState', JSON.stringify({ center: coordinates, zoom }));
  } catch {
    /* ignore */
  }

  // Debounced artwork loading to prevent infinite loops
  debounceLoadArtworks();
  // Also update marker styles immediately for zoom changes (better responsiveness)
  updateArtworkMarkers().catch(console.error);
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



// Handle applying settings from the modal
function handleApplySettings(): void {
  // Trigger a re-rendering of markers with new filter settings
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
      map.value.off('zoomstart');
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

// Rebuild markers when visited/starred sets change
watch(
  () => Array.from(visitedArtworks.value).join(','),
  () => updateArtworkMarkersDebounced(25)
);
watch(
  () => Array.from(starredArtworks.value).join(','),
  () => updateArtworkMarkersDebounced(25)
);

// Watch clustering toggle
watch(
  () => clusterEnabled.value,
  async () => {
    await configureMarkerGroup();
  }
);

// Rebuild markers when visited/starred sets change (ensures icons update after lists load)
watch(
  () => Array.from(visitedArtworks.value).join(','),
  () => {
    updateArtworkMarkersDebounced(25);
  }
);

watch(
  () => Array.from(starredArtworks.value).join(','),
  () => {
    updateArtworkMarkersDebounced(25);
  }
);

// Watch map filters for changes
watch(
  () => [
    mapFilters.filtersState.artworkTypes,
    mapFilters.filtersState.statusFilters,
    mapFilters.filtersState.userListFilters,
    mapFilters.filtersState.showOnlyMySubmissions,
    mapFilters.filtersState.clusterEnabled,
    mapFilters.filtersState.hideVisited,
    mapFilters.filtersState.showRemoved,
    mapFilters.filtersState.showArtworksWithoutPhotos,
  ],
  () => {
    console.log('[FILTER DEBUG] Map filters changed, updating markers');
    updateArtworkMarkersDebounced(25);
  },
  { deep: true }
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

    <!-- Active Filters Banner -->
    <div
      v-if="mapFilters.hasActiveFilters.value"
      class="absolute top-4 left-4 right-24 bg-blue-50 border border-blue-200 rounded-lg p-3 shadow-md z-10 pointer-events-auto"
      role="status"
      aria-live="polite"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span class="text-sm text-blue-800 font-medium">
            {{ mapFilters.activeFilterCount.value }} filter{{ mapFilters.activeFilterCount.value === 1 ? '' : 's' }} active
          </span>
        </div>
        <button
          @click="mapFilters.resetFilters"
          class="text-xs text-blue-600 hover:text-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 px-2 py-1 rounded transition-colors"
          title="Clear all filters"
        >
          Clear
        </button>
      </div>
      <p class="text-xs text-blue-700 mt-1">{{ mapFilters.activeFilterDescription.value }}</p>
    </div>

  <!-- Map Controls -->
  <div class="absolute top-4 right-4 flex flex-col space-y-2 z-20">
      <!-- Map Options (Layers) Button -->
      <div class="relative">
        <button
          @click="showOptionsModal = true"
          class="theme-surface shadow-md rounded-full p-3 hover:theme-surface-hover focus:theme-surface-hover focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          title="Map settings"
          aria-label="Open map settings"
        >
          <Squares2X2Icon class="w-5 h-5 text-gray-700" />
        </button>


      </div>
      <!-- Current Location Button -->
      <button
        v-if="hasGeolocation"
        @click="centerOnUserLocation"
        :disabled="isLocating"
        class="theme-surface shadow-md rounded-full p-3 hover:theme-surface-hover focus:theme-surface-hover focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
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
      <div class="theme-surface shadow-md rounded-lg overflow-hidden">
        <button
          @click="zoomIn"
          class="block w-full px-3 py-2 text-gray-700 hover:theme-surface-hover focus:theme-surface-hover focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset transition-colors border-b border-gray-200"
          title="Zoom in"
          aria-label="Zoom in on map"
        >
          <PlusIcon class="w-4 h-4 mx-auto" aria-hidden="true" />
        </button>
        <button
          @click="zoomOut"
          class="block w-full px-3 py-2 text-gray-700 hover:theme-surface-hover focus:theme-surface-hover focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset transition-colors"
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

  <!-- Map Options Modal -->
  <MapOptionsModal
    :isOpen="showOptionsModal"
    @update:isOpen="showOptionsModal = $event"
    @applySettings="handleApplySettings"
  />
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

.artwork-marker-container {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.artwork-marker-inner {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
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

/* Fix custom marker click events by allowing pointer events to pass through child elements */
.custom-visited-icon .artwork-visited-marker,
.custom-visited-icon .artwork-visited-marker *,
.custom-starred-icon .artwork-starred-marker,
.custom-starred-icon .artwork-starred-marker *,
.custom-normal-icon .artwork-normal-marker,
.custom-normal-icon .artwork-normal-marker *,
.custom-unknown-icon .artwork-unknown-marker,
.custom-unknown-icon .artwork-unknown-marker *,
.custom-artwork-icon,
.custom-artwork-icon * {
  pointer-events: none !important;
}

/* Keep the root marker icon clickable */
.custom-visited-icon,
.custom-starred-icon,
.custom-normal-icon,
.custom-unknown-icon,
.leaflet-marker-icon {
  pointer-events: auto !important;
  cursor: pointer !important;
}

/* Ensure marker layers don't block each other */
.leaflet-marker-icon.custom-visited-icon,
.leaflet-marker-icon.custom-starred-icon,
.leaflet-marker-icon.custom-normal-icon,
.leaflet-marker-icon.custom-unknown-icon {
  z-index: 1000 !important;
}
</style>
