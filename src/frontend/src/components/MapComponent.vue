<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick, defineEmits } from 'vue';
import {
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  XMarkIcon,
  PlusIcon,
  MinusIcon,
  Squares2X2Icon,
} from '@heroicons/vue/24/outline';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// MarkerCluster (DOM-based) removed: we render markers with WebGL (deck.gl)
import type { Coordinates, ArtworkPin, MapComponentProps } from '../types/index';
import { useArtworksStore } from '../stores/artworks';
import { useArtworkTypeFilters } from '../composables/useArtworkTypeFilters';
import { useUserLists } from '../composables/useUserLists';
import { useMapFilters } from '../composables/useMapFilters';
import { useRouter } from 'vue-router';
import MapOptionsModal from './MapOptionsModal.vue';
import { useMapPreviewStore } from '../stores/mapPreview';
import { useMapSettings } from '../stores/mapSettings';
import MapWebGLLayer from './MapWebGLLayer.vue';
import { useGridCluster } from '../composables/useGridCluster';
import type { ClusterFeature } from '../composables/useGridCluster';
import { useAnnouncer } from '../composables/useAnnouncer';
import { createIconAtlas, DEFAULT_ICONS, type IconAtlas } from '../utils/iconAtlas';
// Props
const props = withDefaults(defineProps<MapComponentProps & { suppressFilterBanner?: boolean }>(), {
  zoom: 15,
  showUserLocation: true,
  suppressFilterBanner: false,
});

// Emits - using runtime declaration to avoid TypeScript compilation issues
const emit = defineEmits([
  'artworkClick',
  'previewArtwork', 
  'dismissPreview',
  'mapMove',
  'locationFound',
  // Telemetry events emitted by the map for external listeners (e.g., analytics)
  'telemetryUpdate'
]);

// State
const mapContainer = ref<HTMLDivElement>();
const map = ref<L.Map>();
const isLoading = ref(true);
const isLocating = ref(false);
const error = ref<string | null>(null);
const showLocationNotice = ref(false);
// Transient error toast state (used when GPS/watchPosition errors occur)
const showErrorToast = ref(false);
const errorToastMessage = ref('');

// Announcer for screen-reader announcements
const { announceError } = useAnnouncer();
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
// Timeout used for delayed artwork loading during various interactions
const loadArtworksTimeout = ref<ReturnType<typeof setTimeout> | null>(null);
// Track zoom animation state to prevent marker updates during animations
const isZoomAnimating = ref(false);
// Progressive loading state

// Default coordinates (Vancouver - used as a fallback)
const DEFAULT_CENTER = { latitude: 49.265, longitude: -123.25 };

// MarkerType enum intentionally removed - visuals are WebGL-driven

// Minimal guard/install helpers (existing implementation exists elsewhere; provide no-op fallbacks)
const getLeafletGlobal = () => (typeof window !== 'undefined' && (window as any).L) ? (window as any).L : L;
const installLeafletPopupGuards = () => {};
const installLeafletDomUtilGuards = () => {};
const installLeafletMapZoomGuard = () => {};
const installLeafletMarkerGuards = () => {};

const hadSavedMapState = ref(false);
const isProgressiveLoading = ref(false);

// Small helper placeholders and shared refs
const hasGeolocation = ref(typeof navigator !== 'undefined' && !!navigator.geolocation);
const userLocationMarker = ref<L.Marker | null>(null);
const userWatchId = ref<number | null>(null);
const userHeading = ref<number>(0);

const debugRingsEnabled = ref(false);

// Progressive loading stats placeholder
// include optional fields referenced by the template (batchSize, avgTime)
const progressiveLoadingStats = ref<{
  loaded: number;
  total: number;
  percentage: number;
  batchSize?: number;
  avgTime?: number;
} | null>(null);
const useProgressiveLoading = ref(false);

// Tracking state (are we actively following the user's location?)
const isTracking = computed(() => userWatchId.value !== null);

// Effective clustering: user preference AND zoom threshold
const effectiveClusterEnabled = computed(() => {
  const z = map.value?.getZoom() ?? props.zoom ?? 15;
  // Only cluster if user preference is enabled AND zoom is appropriate
  return mapSettings.clusteringEnabled && z > 14;
});

// Router and other listeners used in component
const router = useRouter();
let debugImmediateRing: L.Circle | null = null;

// LocalStorage keys and basic state persistence helpers
const MAP_STATE_KEY = 'map:lastState';
function saveMapState() {
  if (!map.value) return;
  const center = map.value.getCenter();
  const zoom = map.value.getZoom();
  try {
    localStorage.setItem(MAP_STATE_KEY, JSON.stringify({ center: { latitude: center.lat, longitude: center.lng }, zoom }));
  } catch (e) {
    // ignore
  }
}

function readSavedMapState(): { center: Coordinates; zoom: number } | null {
  try {
    const raw = localStorage.getItem(MAP_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return null;
  }
}
// Composables used by the map component
const artworksStore = useArtworksStore();
const mapFilters = useMapFilters();
const mapPreviewStore = useMapPreviewStore();
const mapSettings = useMapSettings();
// Artwork type helpers
useArtworkTypeFilters();
const { visitedArtworks, starredArtworks } = useUserLists();

// WebGL cluster state
const webglClusters = ref<ClusterFeature[]>([]);
const webglClustering = useGridCluster({ gridSize: 100, maxZoom: 15 });
let webglMoveHandler: (() => void) | null = null;
let webglZoomHandler: (() => void) | null = null;
// Icon atlas for WebGL marker icons
const iconAtlas = ref<IconAtlas | null>(null);
// Map options state
const showOptionsModal = ref(false);

// unknown marker DOM factory intentionally removed; visuals are WebGL-rendered

// Marker sizing handled by WebGL layer; DOM sizing helpers removed.

// Marker type logic and DOM marker factory functions are intentionally unused
// because all artwork visuals are rendered via WebGL in the current integration.

// Custom icon for user location - use a person icon so it's clearly the user, not an artwork
// Legacy user location icon generator
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

// Expose a no-op clearListCaches so parent components can call it safely
function clearListCaches(): void {
  // This was previously used to clear internal caches on the map component.
  // Currently a no-op; keep as a stable API for callers.
}

// Expose methods for parent components (include legacy helpers)
try {
  // defineExpose is available in <script setup>
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  defineExpose({ clearListCaches, createUserLocationIcon });
} catch (e) {
  // ignore in non-setup contexts
}

/**
 * Build ClusterFeature-like plain objects from the current artworks for the WebGL layer.
 * This intentionally does NOT perform any clustering - we rely on Leaflet marker clustering
 * when that feature is enabled. The WebGL layer will only be shown when clustering is disabled.
 */
function buildWebGLClusters() {
  try {
    if (!map.value || !props.artworks) {
      webglClusters.value = [];
      return;
    }

    // Compute a slightly padded viewport bounds so markers just outside the edge are still visible
    const b = map.value.getBounds();
    const latPad = (b.getNorth() - b.getSouth()) * 0.05;
    const lngPad = (b.getEast() - b.getWest()) * 0.05;
    const viewportBounds = L.latLngBounds(
      L.latLng(b.getSouth() - latPad, b.getWest() - lngPad),
      L.latLng(b.getNorth() + latPad, b.getEast() + lngPad)
    );

  // Determine effective clustering: user preference AND only when zoom > 14
  const currentZoom = map.value?.getZoom() ?? props.zoom ?? 15;

  // If clustering is enabled for this zoom level, let the grid clusterer compute clusters to render via WebGL
  if (effectiveClusterEnabled.value) {
      try {
        // Ensure clusterer has points loaded
        // Map artworks to clusterer expected format
        const artworkPoints = (props.artworks || []).map((a: any) => ({
          id: a.id,
          lat: a.latitude,
          lon: a.longitude,
          title: a.title || 'Untitled',
          type: a.type || 'default'
        }));

        webglClustering.loadPoints(artworkPoints);

        const bbox: [number, number, number, number] = [
          viewportBounds.getWest(),
          viewportBounds.getSouth(),
          viewportBounds.getEast(),
          viewportBounds.getNorth()
        ];

  const zoom = currentZoom;

        const clusters = webglClustering.getClusters(bbox, zoom);
        webglClusters.value = clusters;
        return;
      } catch (err) {
        console.warn('webglClustering error:', err);
      }
    }

  // Default: no clustering — render all visible artworks as individual WebGL points
    const pts: ClusterFeature[] = (props.artworks || [])
  .filter((a: any) => mapFilters.shouldShowArtwork(a) && viewportBounds.contains(L.latLng(a.latitude, a.longitude)))
      .map((a: any) => {
        const visited = visitedArtworks.value instanceof Set ? visitedArtworks.value.has(a.id) : false;
        const starred = starredArtworks.value instanceof Set ? starredArtworks.value.has(a.id) : false;
        
        return {
          type: 'Feature',
          id: a.id,
          properties: {
            cluster: false,
            id: a.id,
            type: a.type || 'default',
            title: a.title || 'Untitled',
            // Include user list flags so WebGL rendering can show visited/starred icons
            visited,
            starred
          },
          geometry: { type: 'Point', coordinates: [a.longitude, a.latitude] }
        };
      }) as ClusterFeature[];

    webglClusters.value = pts;
  } catch (err) {
    console.warn('buildWebGLClusters error:', err);
    webglClusters.value = [];
  }
}

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
    // NOTE: legacy localStorage persistence for 'map:clusterEnabled' has been removed.
    // Map clustering is controlled by the global `mapFilters` state and WebGL behavior.
    await configureMarkerGroup();

    // Reconfigure marker group on zoom changes so clustering can toggle when crossing zoom thresholds
    try {
      map.value.on('zoomend', async () => {
        try {
          await configureMarkerGroup();
          buildWebGLClusters();
        } catch (e) {
          /* ignore */
        }
      });
    } catch (e) {
      /* ignore */
    }

    // 🚀 PROACTIVE ZOOM INTERCEPTION - Override zoom controls to execute nuclear cleanup BEFORE animation starts
    const interceptZoomControls = () => {
  if (!map.value) return;

      // Wait for Leaflet to fully initialize the zoom controls
      nextTick(() => {
        // Some test environments mock map.value and may not provide getContainer().
        // Fall back to the component's mapContainer DOM node when necessary.
        const containerEl: HTMLElement | null =
          (map.value && typeof (map.value as any).getContainer === 'function')
            ? (map.value as any).getContainer()
            : mapContainer.value || null;

        if (!containerEl) return;

        const zoomInButton = containerEl.querySelector('.leaflet-control-zoom-in');
        const zoomOutButton = containerEl.querySelector('.leaflet-control-zoom-out');

        if (zoomInButton) {
          // intercepting zoom in button (debug suppressed)
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
          // intercepting zoom out button (debug suppressed)
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
      // executing nuclear zoom with synchronous popup cleanup
      
      if (!map.value) return;

      // 🔥 IMMEDIATE SYNCHRONOUS POPUP DESTRUCTION - Execute BEFORE any Leaflet animation starts
  // synchronous: destroy all popups before zoom animation can start
      
      // Force preview dismissal immediately
      emit('dismissPreview');

  // Close all popups immediately and synchronously
  const mapAny = map.value as any;
  // final zoom state (debug suppressed)
      
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

      // Legacy DOM cluster/marker cleanup removed - WebGL layer manages visuals now

  // Zoom action starting after defensive popup cleanup
      
      // Execute the actual zoom - now safe because all popups are destroyed
      zoomAction();
    };

    // Initialize zoom control interception
    interceptZoomControls();

    // Setup event listeners
    map.value.on('moveend', handleMapMove);
    map.value.on('zoomend', handleMapMove);
    // Dismiss preview immediately when the user starts panning/dragging the map
    try {
      map.value.on('movestart', () => { try { emit('dismissPreview'); } catch (_) {} });
      map.value.on('dragstart', () => { try { emit('dismissPreview'); } catch (_) {} });
    } catch (e) {
      // some environments may not support these events; ignore
    }
    
    // Track zoom animation state to prevent marker updates during animations
    map.value.on('zoomstart', () => {
      try {
        isZoomAnimating.value = true;
  // SUPER NUCLEAR instantaneous popup destruction started (debug suppressed)

        // Ensure Leaflet guard patches are active before zoom
        // Defensive overrides: ensure persistent guard patches stay active
        try {
          installLeafletPopupGuards();
          installLeafletDomUtilGuards();
          installLeafletMapZoomGuard();
          installLeafletMarkerGuards();
        } catch (overrideErr) {
    // Error applying defensive overrides (suppressed in production)
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
          // Error removing main popup (suppressed)
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
          // Error cleaning layer popups (suppressed)
        }

        // No DOM markers to force-close; WebGL layer handles interactions

        // Emergency DOM cleanup: remove any orphaned popup elements
        try {
          const selectors = ['.leaflet-popup', '.leaflet-popup-pane', '.leaflet-popup-content-wrapper', '.leaflet-popup-content', '.leaflet-popup-tip-container', '.leaflet-popup-tip', '.artwork-popup-container'];
          selectors.forEach(sel => {
            const nodes = Array.from(document.querySelectorAll(sel));
            nodes.forEach(n => { try { n.remove(); } catch {} });
          });
        } catch (domErr) {
          // Emergency DOM cleanup error (suppressed)
        }

        // No legacy cluster group to reset

        // Ensure preview dismissed
        try { emit('dismissPreview'); } catch (_) {}

  // popup closure attempts completed (debug suppressed)
      } catch (overallError) {
  console.error('Critical error in zoomstart handler:', overallError);
        // Ensure zoom state is set so other logic knows animation may be happening
        isZoomAnimating.value = true;
      }
    });
    
    map.value.on('zoomend', () => {
      try {
        isZoomAnimating.value = false;
        
  // Final zoom state (debug suppressed)

      // RESTORE: Re-enable ALL popup methods after zoom completes
      try {
        const Lglobal = getLeafletGlobal();
        if (Lglobal) {
          const popupProto = Lglobal.Popup?.prototype as any;
          if (popupProto && popupProto._superNuclearGuardInstalled) {
            // persistent popup guards active; skipping popup restoration
          } else if (popupProto) {
            if (popupProto._originalAnimateZoom) {
              // restoring popup _animateZoom method
              popupProto._animateZoom = popupProto._originalAnimateZoom;
            }

            if (popupProto._originalUpdatePosition) {
              // restoring popup _updatePosition method
              popupProto._updatePosition = popupProto._originalUpdatePosition;
            }

            if (popupProto._originalUpdateLayout) {
              // restoring popup _updateLayout method
              popupProto._updateLayout = popupProto._originalUpdateLayout;
            }
          }

          if (Lglobal.Marker && Lglobal.Marker.prototype && Lglobal.Marker.prototype._originalOpenPopup) {
            // restoring marker openPopup method
            Lglobal.Marker.prototype.openPopup = Lglobal.Marker.prototype._originalOpenPopup;
          }

          if (Lglobal.DomUtil) {
            const domUtilAny = Lglobal.DomUtil as any;
            if (domUtilAny._superNuclearGuardInstalled) {
              // persistent DomUtil guards active; skipping restoration
            } else if (domUtilAny._originalGetPosition) {
              // restoring DomUtil.getPosition method
              Lglobal.DomUtil.getPosition = domUtilAny._originalGetPosition;
            }
          }

          if (map.value) {
            const mapInstance = map.value as any;
            if (mapInstance._originalGetMapPanePos) {
              // restoring map _getMapPanePos method
              mapInstance._getMapPanePos = mapInstance._originalGetMapPanePos;
            }
          }
        }

        // RESTORE: Re-enable CSS transitions and restore transforms
  // Restoring CSS transitions and transforms
        
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
  // Error restoring popup animation method (suppressed)
      }
      
      // Update markers after zoom animation completes
      updateArtworkMarkersDebounced(50);
      
      } catch (zoomEndError) {
  console.error('Critical error in zoomend handler:', zoomEndError);
        // Ensure zoom state is cleared even if restoration fails
        isZoomAnimating.value = false;
      }
    });
    
    // Update marker styles during continuous zoom events (throttled)
    map.value.on('zoom', () => {
      // Zoom event fired (suppressed detailed debug)
      
      if (zoomStyleTimeout.value) clearTimeout(zoomStyleTimeout.value);
      zoomStyleTimeout.value = setTimeout(() => {
        try {
          // Guard against calling updateMarkerStyles after map destruction or during animation
          if (map.value && !isZoomAnimating.value) {
            // Updating marker styles after zoom
            updateMarkerStyles();
          } else {
            // Skipping marker style update - map missing or still animating
          }
        } catch (e) {
          // Error updating marker styles (suppressed)
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
        // Always center to zoom level 15 when user requests their location
        try {
          map.value.setView([userLocation.latitude, userLocation.longitude], 15);
        } catch (e) {
          // fallback
          map.value.setView([userLocation.latitude, userLocation.longitude], props.zoom);
        }
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
    icon: createUserLocationIconWithCone(userHeading.value),
    zIndexOffset: 10000,
  })
    .addTo(map.value!)
    .bindPopup('Your current location');

  // Ensure user marker is on top visually
  try {
    userLocationMarker.value.getElement()?.style.setProperty('z-index', '10050');
    if ((userLocationMarker.value as any).bringToFront) {
      (userLocationMarker.value as any).bringToFront();
    }
  } catch (e) {
    /* ignore */
  }
}

// Create a divIcon that includes a view cone rotated to heading (deg)
const createUserLocationIconWithCone = (headingDeg: number) => {
  const size = 56; // px
  const half = size / 2;
  // Google-maps-like marker: small central circle, subtle ring, cone (faint), and a small arrow/chevron
  const coneSvg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.25" />
        </filter>
      </defs>
      <g transform="translate(${half}, ${half}) rotate(${headingDeg})">
        <!-- Outer faint ring -->
        <circle cx="0" cy="0" r="18" fill="none" stroke="#2563eb" stroke-opacity="0.12" stroke-width="8" />

        <!-- Inner solid center -->
        <circle cx="0" cy="0" r="8" fill="#2563eb" stroke="#fff" stroke-width="2" filter="url(#shadow)" />

        <!-- Forward cone (semi-transparent) -->
        <path d="M0 -10 L22 -38 L-22 -38 Z" fill="#2563eb" fill-opacity="0.12" stroke="none" />

        <!-- Inner thin cone edge -->
        <path d="M0 -10 L18 -34 L-18 -34 Z" fill="none" stroke="#2563eb" stroke-opacity="0.22" stroke-width="1" />

        <!-- Small arrow/chevron tip at the cone point -->
        <path d="M0 -40 L6 -30 L-6 -30 Z" fill="#2563eb" />
      </g>
    </svg>
  `;

  return L.divIcon({
    html: `
      <div class="user-location-marker-wrapper" style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">
        ${coneSvg}
      </div>
    `,
    className: 'custom-user-location-icon-wrapper',
    iconSize: [size, size],
    iconAnchor: [half, half],
  });
};

// Note: keep legacy createUserLocationIcon available for other code paths

// Load artworks on map with intelligent viewport-based loading
async function loadArtworks() {
  // loadArtworks called

  if (!map.value) {
  // loadArtworks early return - no map
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
  // About to fetch artworks from store
      await artworksStore.fetchArtworksInBounds(expandedBounds);
  // Finished fetching artworks
    }

    // Cache the bounds we just loaded
    lastLoadedBounds.value = expandedBounds;

    // Waiting for nextTick before updating markers

    // Wait for Vue reactivity to update props before updating markers
    await nextTick();

  // After nextTick, updating markers
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
function updateArtworkMarkers() {
  // updateArtworkMarkers called

  if (!map.value) {
    // Early return - no map available
    return;
  }

  // Prevent marker updates during zoom animations to avoid _latLngToNewLayerPoint errors
  if (isZoomAnimating.value) {
  // Skipping marker update during zoom animation
    // Retry after animation completes
    updateArtworkMarkersDebounced(100);
    return;
  }

  // Force map to be visible and properly sized
  if (mapContainer.value && map.value) {
    const containerRect = mapContainer.value.getBoundingClientRect();
    // Map container dimensions checked

    if (containerRect.width === 0 || containerRect.height === 0) {
  // Map container has zero dimensions - triggering resize
      setTimeout(() => {
        map.value?.invalidateSize();
        updateArtworkMarkers();
      }, 100);
      return;
    }

    // Additional stability check - ensure map is actually rendered and interactive
    if (map.value && !map.value.getContainer()) {
  // Map container not yet attached - delaying marker update
      setTimeout(() => updateArtworkMarkers(), 100);
      return;
    }
  }

  // Determine current bounds with padding for smooth experience (used inside buildWebGLClusters)

  // All markers are rendered via WebGL; update webglClusters and skip DOM marker creation entirely.
  buildWebGLClusters();
}

// Update styles (radius/color/etc) for all existing markers to react to zoom changes
function updateMarkerStyles() {
  // No-op: marker styles are handled by the WebGL layer. Keep this function as a stable API
  // for callers that expect it, but avoid DOM marker manipulation in WebGL-only mode.
  return;
}

// Configure marker layer group according to effective clustering state (preference + zoom)
async function configureMarkerGroup() {
  if (!map.value) return;

  // In WebGL-first mode we do not create or attach a DOM marker/cluster group.
  // This function is responsible for honoring the user's clustering preference
  // and triggering a rebuild of the WebGL features.

  // Rebuild the WebGL cluster/point data. The grid clusterer will be used
  // by buildWebGLClusters when effectiveClusterEnabled is true.
  buildWebGLClusters();

  // Ensure the WebGL layer receives any required style updates (noop for DOM markers)
  updateMarkerStyles();

  // Persistence of cluster preference to localStorage has been removed - WebGL is the source of truth.
}

// Handle map movement
function handleMapMove() {
  if (!map.value) return;

  const center = map.value.getCenter();

  const coordinates: Coordinates = {
    latitude: center.lat,
    longitude: center.lng,
  };

  // Update store
  artworksStore.setMapCenter(coordinates);
  // In WebGL-first mode we no longer attach a DOM marker/cluster group.
  // This function exists to persist clustering preferences and trigger WebGL rebuilds.

  // Trigger WebGL clusters update instead of DOM marker creation
  buildWebGLClusters();

  // Ensure WebGL layer styles are up-to-date (no-op for DOM markers)
  updateMarkerStyles();

  // No-op: cluster preference is managed by the global mapFilters state and not persisted locally.

  // Load artworks for the new viewport with debouncing
  // Clear any pending load and schedule a new one after the user stops moving
  if (loadArtworksTimeout.value) {
    clearTimeout(loadArtworksTimeout.value);
  }
  
  loadArtworksTimeout.value = setTimeout(() => {
    loadArtworks();
  }, 500); // Wait 500ms after map stops moving

  // Show loading state after a brief delay to avoid flicker
  loadingTimeout.value = setTimeout(() => {
    if (!isLoadingViewport.value && map.value) {
      isLoadingViewport.value = true;
    }
  }, 100);
}

// Handler for marker clicks emitted from MapWebGLLayer
function onWebGLMarkerClick(f: any) {
  try {
    const markerId = (f && f.properties && f.properties.id) ? f.properties.id : null;
    if (!markerId) return;
    // Try to enrich the preview with full artwork details from the store first.
    (async () => {
      try {
        // Attempt to fetch details (returns cached if available)
        const details = await (artworksStore.fetchArtwork as any)(markerId);

        // Choose thumbnail defensively from details first, then fallback to pin
        let thumb: string | undefined = undefined;
        if (details) {
          const dphotos = (details as any).photos;
          if (Array.isArray(dphotos) && dphotos.length) {
            const p0 = dphotos[0];
            if (typeof p0 === 'string') thumb = p0;
            else if (p0 && typeof p0 === 'object') thumb = p0.url || p0.thumbnail_url || undefined;
          } else if ((details as any).recent_photo && typeof (details as any).recent_photo === 'string') {
            thumb = (details as any).recent_photo;
          }
        }

        // Fallback to artwork pin in props if details not available
        const artworkPin = (props.artworks || []).find((a: any) => a.id === markerId) as any;
        if (!artworkPin && !details) return;

        const previewData = {
          id: markerId,
          title: (details && (details as any).title) || (artworkPin && artworkPin.title) || 'Untitled Artwork',
          description: (details && (details as any).description) || (artworkPin && artworkPin.type) || 'Public artwork',
          type_name: (details && ((details as any).type_name || (details as any).type)) || (artworkPin && (artworkPin.type || (artworkPin as any).type_name)) || 'artwork',
          thumbnailUrl: thumb || (artworkPin && Array.isArray(artworkPin.photos) && artworkPin.photos[0]) || undefined,
          artistName: (details && ((details as any).artist_name || (details as any).artist || (details as any).created_by)) || (artworkPin && (artworkPin.artist_name || artworkPin.created_by)) || undefined,
          lat: (artworkPin && artworkPin.latitude) || (details && ((details as any).latitude || (details as any).lat)),
          lon: (artworkPin && artworkPin.longitude) || (details && ((details as any).longitude || (details as any).lon)),
        };

        emit('previewArtwork', previewData);
      } catch (err) {
        // Fallback: emit minimal preview using pin data
        const artwork = (props.artworks || []).find((a: any) => a.id === markerId);
        if (!artwork) return;
        const thumb = Array.isArray((artwork as any).photos) ? (artwork as any).photos[0] : (artwork as any).recent_photo;
        const previewData = {
          id: artwork.id,
          title: artwork.title || 'Untitled Artwork',
          description: artwork.type || 'Public artwork',
          type_name: (artwork as any).type || (artwork as any).type_name || 'artwork',
          thumbnailUrl: thumb,
          artistName: (artwork as any).artist_name || (artwork as any).created_by || undefined,
          lat: artwork.latitude,
          lon: artwork.longitude,
        };
        emit('previewArtwork', previewData);
      }
    })();
  } catch (err) {
    // ignore
  }
}

// Expose test helper to simulate marker click from page context for E2E tests
try {
  if (typeof window !== 'undefined') {
    (window as any).__ca_test_trigger_marker_click = (id: string) => {
      try {
        const artwork = (props.artworks || []).find((a: any) => a.id === id);
        if (!artwork) return;
        onWebGLMarkerClick({ properties: { id } });
      } catch (e) {
        // ignore
      }
    };
  }
} catch (e) {
  // ignore
}

// Handler for cluster clicks emitted from MapWebGLLayer
function onWebGLClusterClick(feature: any) {
  try {
    if (!map.value || !feature || !feature.geometry) return;

    // Extract cluster center coords (deck/gl feature coords are [lon, lat])
    const lon = feature.geometry.coordinates[0];
    const lat = feature.geometry.coordinates[1];

    // Zoom in a couple of levels (clamp at max 19)
    const currentZoom = map.value.getZoom() || props.zoom || 15;
    const newZoom = Math.min(currentZoom + 2, 19);

    // Move/zoom the map to the cluster center
    try {
      map.value.setView([lat, lon], newZoom, { animate: true });
    } catch (e) {
      // fallback: setView may fail in some test environments
      try { map.value.setView([lat, lon], newZoom); } catch (_) {}
    }

    // Inform parent listeners that the map moved (useful for telemetry/tests)
    try {
      emit('mapMove', { center: { latitude: lat, longitude: lon }, zoom: newZoom });
    } catch (e) {
      // ignore
    }
  } catch (err) {
    // ignore
  }
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
  // One-time center action - does NOT continuously track user position
  // User can pan/zoom away freely after centering
  if (!hasGeolocation.value) {
    requestUserLocation();
    return;
  }

  isLocating.value = true;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const coords: Coordinates = { 
        latitude: pos.coords.latitude, 
        longitude: pos.coords.longitude 
      };
      
      // Update store and marker
      artworksStore.setCurrentLocation(coords);
      addUserLocationMarker(coords);
      
      // Center map once at zoom level 15
      if (map.value) {
        map.value.setView([coords.latitude, coords.longitude], 15, { 
          animate: true, 
          duration: 0.5 
        });
      }
      
      emit('locationFound', coords);
      isLocating.value = false;
    },
    (err) => {
      console.warn('getCurrentPosition error:', err);
      try {
        const msg = err && err.message ? `Location error: ${err.message}` : 'Unable to access your location.';
        errorToastMessage.value = msg;
        showErrorToast.value = true;
        try { announceError(msg); } catch (e) { /* ignore */ }
      } catch (e) {
        /* ignore */
      }
      isLocating.value = false;
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000,
    }
  );
}

function requestLocation() {
  requestUserLocation();
}

// Note: Continuous user tracking functions removed in favor of one-time centering.
// The location button now centers the map once per click without continuous tracking.

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

// Handle clear filters button in the UI banner
function handleClearFilters(): void {
  mapFilters.resetFilters();
  // Rebuild webgl clusters and update markers
  buildWebGLClusters();
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
  (_newArtworks: ArtworkPin[] | undefined) => {
    // Props artworks watcher triggered (details suppressed)
    // Use debounced update to prevent excessive calls during initialization
    updateArtworkMarkersDebounced(25);
    // Rebuild WebGL cluster points for WebGL layer when artworks change
    buildWebGLClusters();
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
  // Window resized, invalidating map size
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
  // Map container changed, invalidating size
      nextTick(() => {
        map.value?.invalidateSize();
      });
    }
  }
);

// Lifecycle
onMounted(async () => {
  await nextTick();
  
  // Initialize icon atlas for WebGL markers
  try {
    console.log('[ICON ATLAS] Starting icon atlas creation...');
    const iconConfigs = [
      { name: 'default', svg: DEFAULT_ICONS.default || '', size: 64 },
      { name: 'sculpture', svg: DEFAULT_ICONS.sculpture || '', size: 64 },
      { name: 'mural', svg: DEFAULT_ICONS.mural || '', size: 64 },
      { name: 'installation', svg: DEFAULT_ICONS.installation || '', size: 64 },
      { name: 'cluster', svg: DEFAULT_ICONS.cluster || '', size: 64 },
      { name: 'visited', svg: DEFAULT_ICONS.visited || '', size: 64 },
      { name: 'starred', svg: DEFAULT_ICONS.starred || '', size: 64 }
    ];
    iconAtlas.value = await createIconAtlas(iconConfigs);
    console.log('[ICON ATLAS] Icon atlas created successfully:', {
      atlasExists: !!iconAtlas.value,
      icons: iconAtlas.value ? Object.keys(iconAtlas.value.icons) : []
    });
  } catch (err) {
    console.error('[ICON ATLAS] Failed to create icon atlas:', err);
  }
  
  await initializeMap();

  // Add window resize listener (guarded for non-browser envs)
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize);
    // Listen for navigation rail toggle events so the map can reflow to the new width
    window.addEventListener('nav-rail-toggle', handleNavRailToggle as EventListener);
  }
  // Attach map listeners for WebGL cluster updates when clustering is disabled
  try {
    if (map.value) {
      webglMoveHandler = () => buildWebGLClusters();
      webglZoomHandler = () => buildWebGLClusters();
      map.value.on('moveend', webglMoveHandler);
      map.value.on('zoomend', webglZoomHandler);
    }
  } catch (e) {
    // ignore
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
  if (loadArtworksTimeout.value) {
    clearTimeout(loadArtworksTimeout.value as any);
    loadArtworksTimeout.value = null;
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

    // Remove webgl listeners if present
    try {
      if (webglMoveHandler) map.value.off('moveend', webglMoveHandler);
      if (webglZoomHandler) map.value.off('zoomend', webglZoomHandler);
    } catch {}
    
    // Legacy DOM cluster group cleanup removed - WebGL layer manages visuals now
    
    // Remove the map instance
    try {
      map.value.remove();
    } catch (e) {
      console.warn('Error removing map:', e);
    }
    
    map.value = undefined;
  }
  // Note: User tracking no longer used with one-time location button
  // try { stopUserTracking(); } catch {}
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
  () => effectiveClusterEnabled.value,
  async () => {
    await configureMarkerGroup();
    // When effective clustering changes (preference or zoom), rebuild WebGL list and update listeners
    buildWebGLClusters();
  }
);

// Rebuild webgl clusters when filters change
watch(
  () => [
    mapFilters.filtersState.artworkTypes,
    mapFilters.filtersState.statusFilters,
    mapFilters.filtersState.userListFilters,
    mapFilters.filtersState.showOnlyMySubmissions,
    mapFilters.filtersState.hideVisited,
    mapFilters.filtersState.showRemoved,
    mapFilters.filtersState.showArtworksWithoutPhotos,
  ],
  () => {
    buildWebGLClusters();
  },
  { deep: true }
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
  // clusterEnabled removed from direct persistence/watch. Keep other filter dependencies below.
    mapFilters.filtersState.hideVisited,
    mapFilters.filtersState.showRemoved,
    mapFilters.filtersState.showArtworksWithoutPhotos,
  ],
  () => {
  // Map filters changed, updating markers
    updateArtworkMarkersDebounced(25);
  },
  { deep: true }
);

// Rebuild WebGL clusters when user lists change (visited/starred artworks)
watch(
  [() => visitedArtworks.value, () => starredArtworks.value],
  () => {
    buildWebGLClusters();
  },
  { deep: true }
);

// Watch clustering preference changes
watch(
  () => mapSettings.clusteringEnabled,
  () => {
    buildWebGLClusters();
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
  <div :class="['map-component h-full w-full relative', { 'webgl-active': true }]">
    <!-- Map Container -->
    <div
      ref="mapContainer"
      class="h-full w-full relative z-0"
      :class="{ 'opacity-50': isLoading }"
      role="application"
      aria-label="Interactive map showing public artwork locations"
      :aria-busy="isLoading"
    />

    <!-- WebGL overlay (always mounted). We pass webglClusters (flat points) and keep Leaflet clustering active.
         The UI CSS hides DOM markers when desired but cluster icons remain visible. -->
    <MapWebGLLayer
      v-if="map && props.artworks && props.artworks.length > 0 && iconAtlas"
      :map="map"
      :clusters="webglClusters"
      :icon-atlas="iconAtlas"
      @cluster-click="onWebGLClusterClick"
      @marker-click="onWebGLMarkerClick"
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

    <!-- Transient Error Toast (GPS / watchPosition failures) -->
    <div
      v-if="showErrorToast"
      class="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50"
      role="alert"
      aria-live="assertive"
    >
      <div class="theme-error px-4 py-2 rounded-lg shadow-lg flex items-center space-x-3">
        <ExclamationCircleIcon class="w-5 h-5" />
        <span>{{ errorToastMessage }}</span>
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
    <!-- Updated: use a solid/semi-opaque background + shadow for better readability over the map -->
    <div
      v-if="showLocationNotice"
      class="absolute top-4 left-4 bg-yellow-50/95 border border-yellow-300 rounded-lg z-30 shadow-md backdrop-blur-sm max-w-xs"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div class="flex items-center gap-3 px-3 py-2">
        <ExclamationTriangleIcon class="w-5 h-5 text-yellow-600 flex-shrink-0" />
        <div class="flex-1 min-w-0">
          <p class="text-sm text-yellow-900 font-semibold truncate">Location Access Needed</p>
          <p class="text-xs text-yellow-800 truncate">
            Enable location access to see nearby artworks and improve your experience.
          </p>
        </div>
        <div class="flex-shrink-0 ml-2 flex items-center space-x-2">
          <button
            @click="requestLocation"
            class="text-xs bg-yellow-700 text-white px-2 py-1 rounded hover:bg-yellow-800 focus:bg-yellow-800 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:ring-offset-2 transition-colors"
          >
            Enable
          </button>
        </div>
      </div>
      <div class="px-3 pb-2">
        <a
          href="/help#location-access-faq"
          class="text-xs text-yellow-700 underline hover:text-yellow-800 focus:text-yellow-800 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 rounded px-1"
        >
          Why is this needed?
        </a>
      </div>
    </div>

    <!-- Active Filters Banner -->
    <div
      v-if="mapFilters.hasActiveFilters.value && !props.suppressFilterBanner"
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
          @click="handleClearFilters"
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
          @click="() => { showOptionsModal = true; mapPreviewStore.hidePreview(); }"
          class="theme-surface shadow-md rounded-full p-3 hover:theme-surface-hover focus:theme-surface-hover focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          title="Map settings"
          aria-label="Open map settings"
        >
          <Squares2X2Icon class="w-5 h-5 text-gray-700" />
        </button>


      </div>
      <!-- Current Location Button (Person icon, toggles tracking) -->
      <button
        v-if="hasGeolocation"
        @click="centerOnUserLocation"
        :disabled="isLocating"
        :class="['theme-surface shadow-md rounded-full p-3 hover:theme-surface-hover focus:theme-surface-hover focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 relative', isTracking ? 'ring-4 ring-blue-300' : '']"
        :title="isLocating ? 'Getting location...' : (isTracking ? 'Stop tracking location' : 'Center on current location')"
        :aria-label="isLocating ? 'Getting current location...' : (isTracking ? 'Stop tracking location' : 'Center map on current location')"
      >
        <!-- Person glyph (keeps styling consistent and distinct from artwork markers) -->
        <template v-if="!isLocating">
          <svg v-if="!isLocating" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 20v-1a4 4 0 014-4h4a4 4 0 014 4v1" />
          </svg>
          <div v-if="isTracking && !isLocating" class="w-3 h-3 rounded-full bg-blue-600 absolute" style="transform: translate(10px, -10px);"></div>
        </template>
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
    @update:isOpen="(val) => { showOptionsModal = val; if (val) mapPreviewStore.hidePreview(); }"
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

/* When WebGL overlay is active we typically want to hide the DOM markers to avoid
   duplicate visuals. Keep marker cluster icons visible (they use .marker-cluster).
   The .webgl-active class is applied to the map root when WebGL is mounted. */
.webgl-active .leaflet-marker-icon:not(.marker-cluster-icon),
.webgl-active .leaflet-marker-pane .artwork-marker,
.webgl-active .leaflet-marker-pane .artwork-circle-marker,
.webgl-active .leaflet-marker-pane .custom-normal-icon,
.webgl-active .leaflet-marker-pane .custom-visited-icon,
.webgl-active .leaflet-marker-pane .custom-starred-icon,
.webgl-active .leaflet-marker-pane .custom-unknown-icon {
  opacity: 0 !important;
  pointer-events: none !important;
  transform: scale(0.9) !important;
}

/* Ensure cluster icons remain visible and interactive */
.webgl-active .marker-cluster-icon {
  /* hide DOM cluster icons when using WebGL-only visuals */
  display: none !important;
  opacity: 0 !important;
  pointer-events: none !important;
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

.custom-user-location-icon-wrapper {
  pointer-events: auto !important;
}

.user-location-marker-wrapper svg {
  transform-origin: center center;
  transition: transform 150ms linear;
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

/* Ensure user marker sits above artwork markers and tiles */
.leaflet-marker-icon.custom-user-location-icon-wrapper,
.custom-user-location-icon-wrapper {
  z-index: 11000 !important;
}
</style>
