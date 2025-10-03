<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { computed as vueComputed } from 'vue';
import { apiService, getErrorMessage } from '../services/api';
import { getApiBaseUrl } from '../utils/api-config';
import { useNotificationsStore } from '../stores/notifications';

const isLoading = ref(true);
const status = ref<string>('');
const stats = ref<any>(null);
const healthData = ref<any>(null);
const error = ref<string>('');

// Confetti state
const isConfettiActive = ref(false);
const confettiCanvas = ref<HTMLCanvasElement | null>(null);

// Expose API base URL and build date for debug
const apiBaseUrl = getApiBaseUrl();
// Use the build timestamp injected at build time, fallback to current date if not set
const buildDate = import.meta.env.VITE_BUILD_DATE || new Date().toISOString();
const environment = import.meta.env.MODE;

// Stores
const notificationsStore = useNotificationsStore();

// Check for reduced motion preference
const prefersReducedMotion = computed(() => {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
});

// Confetti configuration
interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  size: number;
  gravity: number;
}

const confettiParticles = ref<ConfettiParticle[]>([]);
const confettiColors = ['#FFD700', '#FFA500', '#FF6347', '#32CD32', '#4169E1', '#DA70D6'];

const checkSystemHealth = async (): Promise<void> => {
  try {
    // Check API status
    const statusResponse = await apiService.getStatus();
    status.value = statusResponse.message || 'API connected successfully';

    // Try to get stats for additional health info
    try {
      const statsResponse = await apiService.getReviewStats();
      stats.value = statsResponse.data;
    } catch (statsError) {
      console.warn('Failed to fetch stats:', statsError);
    }

    // Additional health checks could be added here
    healthData.value = {
      apiConnected: true,
      buildDate: buildDate,
      apiBaseUrl: apiBaseUrl,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    status.value = `API connection failed: ${getErrorMessage(err)}`;
    error.value = getErrorMessage(err);
    healthData.value = {
      apiConnected: false,
      buildDate: buildDate,
      apiBaseUrl: apiBaseUrl,
      timestamp: new Date().toISOString(),
    };
    console.warn('API status check failed:', err);
  } finally {
    isLoading.value = false;
  }
};

// Clear local settings (except user token) to allow first-time popup to show again
const clearLocalSettings = (): void => {
  const confirmMessage =
    'This will clear all local settings (map preferences, search history, etc.) except your user account. The welcome popup will show again on next page load. Are you sure?';

  if (!confirm(confirmMessage)) {
    return;
  }

  try {
    // Get all localStorage keys
    const keys = Object.keys(localStorage);

    // Keys to preserve (do not clear)
    const preserveKeys = ['user-token'];

    // Clear all keys except preserved ones
    keys.forEach(key => {
      if (!preserveKeys.includes(key)) {
        localStorage.removeItem(key);
      }
    });

    alert('Local settings cleared successfully! Refresh the page to see the welcome popup again.');
  } catch (err) {
    console.error('Failed to clear local settings:', err);
    alert('Failed to clear local settings. Please try again.');
  }
};

// Development tools
function triggerConfetti() {
  if (prefersReducedMotion.value) {
    alert('Confetti animation is disabled due to reduced motion preference.');
    return;
  }

  if (!isConfettiActive.value) {
    startConfetti();
  }
}

function triggerTestNotification() {
  // Create a mock badge notification for testing
  // Use a UUID for the id so it matches backend validation expectations.
  const makeUuid = () => {
    if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
      try {
        return (crypto as any).randomUUID();
      } catch (e) {
        // fallthrough to polyfill
      }
    }
    // Minimal UUID v4 polyfill (not cryptographically strong but good enough for dev/test IDs)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const mockBadgeNotification = {
    id: makeUuid(),
    user_token: 'test-user',
    type: 'badge' as const,
    type_key: 'test_badge',
    title: 'Test Badge',
    message: 'This is a test notification for development purposes.',
    metadata: {
      badge_id: 'test-badge-123',
      badge_key: 'test_badge',
      award_reason: 'Testing the notification system',
      badge_title: 'Test Badge',
      badge_icon_emoji: '🧪',
    },
    created_at: new Date().toISOString(),
    is_dismissed: false,
    related_id: 'test-badge-123',
  };

  // Add to notification store
  notificationsStore.addNotification(mockBadgeNotification);
  alert('Test notification added! Check the notification icon in the header.');
}

function startConfetti() {
  if (isConfettiActive.value) return;

  isConfettiActive.value = true;

  // Create canvas element if it doesn't exist
  if (!confettiCanvas.value) {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    document.body.appendChild(canvas);
    confettiCanvas.value = canvas;
  }

  const canvas = confettiCanvas.value;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Create confetti particles
  confettiParticles.value = [];
  for (let i = 0; i < 150; i++) {
    const idx = Math.floor(Math.random() * confettiColors.length);
    const color = (confettiColors[idx] || confettiColors[0]) as string;
    confettiParticles.value.push({
      x: Math.random() * canvas.width,
      y: -10,
      vx: (Math.random() - 0.5) * 6,
      vy: Math.random() * 3 + 2,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 15,
      color,
      size: Math.random() * 8 + 4,
      gravity: 0.15,
    });
  }

  // Animate confetti
  animateConfetti(ctx);

  // Stop confetti after 4 seconds
  setTimeout(() => {
    stopConfetti();
  }, 4000);
}

function animateConfetti(ctx: CanvasRenderingContext2D) {
  if (!isConfettiActive.value || !confettiCanvas.value) return;

  ctx.clearRect(0, 0, confettiCanvas.value.width, confettiCanvas.value.height);

  confettiParticles.value.forEach((particle: ConfettiParticle, index: number) => {
    // Update position
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += particle.gravity;
    particle.rotation += particle.rotationSpeed;

    // Remove particles that are off screen
    if (particle.y > confettiCanvas.value!.height + 10) {
      confettiParticles.value.splice(index, 1);
      return;
    }

    // Draw particle
    ctx.save();
    ctx.translate(particle.x, particle.y);
    ctx.rotate((particle.rotation * Math.PI) / 180);
    ctx.fillStyle = particle.color;
    ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
    ctx.restore();
  });

  if (confettiParticles.value.length > 0) {
    requestAnimationFrame(() => animateConfetti(ctx));
  }
}

function stopConfetti() {
  isConfettiActive.value = false;
  confettiParticles.value = [];

  if (confettiCanvas.value) {
    document.body.removeChild(confettiCanvas.value);
    confettiCanvas.value = null;
  }
}

function handleResize() {
  if (confettiCanvas.value) {
    confettiCanvas.value.width = window.innerWidth;
    confettiCanvas.value.height = window.innerHeight;
  }
}

// Geolocation state
const geoSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator;
const position = ref<GeolocationPosition | null>(null);
const geoError = ref<string | null>(null);
const geoLoading = ref(false);
let geoWatchId: number | null = null;

// Permissions API state for geolocation (if available)
const geoPermissionState = ref<string | null>(null);

function formatCoords(pos: GeolocationPosition | null) {
  if (!pos) return null;
  return {
    lat: pos.coords.latitude.toFixed(6),
    lon: pos.coords.longitude.toFixed(6),
    accuracy: `${pos.coords.accuracy} m`,
    timestamp: new Date(pos.timestamp).toLocaleString(),
  };
}

function clearGeoWatch() {
  if (!geoSupported) return;
  if (geoWatchId !== null) {
    navigator.geolocation.clearWatch(geoWatchId);
    geoWatchId = null;
  }
  geoLoading.value = false;
}

function startGeoWatch() {
  if (!geoSupported) {
    geoError.value = 'Geolocation is not supported by this browser.';
    return;
  }

  geoError.value = null;
  geoLoading.value = true;

  try {
    geoWatchId = navigator.geolocation.watchPosition(
      pos => {
        position.value = pos;
        geoLoading.value = false;
      },
      err => {
        geoError.value = `Geolocation error: ${err.message}`;
        geoLoading.value = false;
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );
  } catch (err: any) {
    geoError.value = `Failed to start geolocation: ${err?.message || err}`;
    geoLoading.value = false;
  }
}

function requestSinglePosition() {
  if (!geoSupported) {
    geoError.value = 'Geolocation is not supported by this browser.';
    return;
  }

  geoError.value = null;
  geoLoading.value = true;

  navigator.geolocation.getCurrentPosition(
    pos => {
      position.value = pos;
      geoLoading.value = false;
    },
    err => {
      geoError.value = `Geolocation error: ${err.message}`;
      geoLoading.value = false;
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// Try to read permission state for geolocation (optional)
async function updateGeoPermissionState() {
  try {
    if (typeof navigator !== 'undefined' && (navigator as any).permissions && (navigator as any).permissions.query) {
      const perm = await (navigator as any).permissions.query({ name: 'geolocation' });
      geoPermissionState.value = perm.state;
      // keep in sync if it changes
      perm.onchange = () => {
        geoPermissionState.value = perm.state;
      };
    } else {
      geoPermissionState.value = null;
    }
  } catch (err) {
    geoPermissionState.value = null;
  }
}

// Local storage diagnostics: list keys and try to infer timestamps from common fields
const localDataList = ref<Array<{ key: string; raw: string | null; inferredDate: string | null; size: number }>>([]);
const expandedKeys = ref<Record<string, boolean>>({});
const userToken = ref<string | null>(null);
const lastMapState = ref<{ center?: { latitude?: number; longitude?: number }; zoom?: number } | null>(null);
const showFullToken = ref(false);

const maskedToken = vueComputed(() => {
  if (!userToken.value) return null;
  if (showFullToken.value) return userToken.value;
  const t = userToken.value;
  if (t.length <= 8) return t;
  return `${t.slice(0, 6)}...${t.slice(-4)}`;
});

async function copyToClipboard(text: string | null) {
  if (!text) return;
  try {
    if (typeof navigator !== 'undefined' && (navigator as any).clipboard && (navigator as any).clipboard.writeText) {
      await (navigator as any).clipboard.writeText(text);
      alert('Copied to clipboard');
      return;
    }
  } catch (e) {
    // fallthrough to fallback
  }
  // Fallback
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    alert('Copied to clipboard');
  } catch (e) {
    alert('Copy failed');
  }
}

function refreshLocalDiagnostics() {
  loadLocalDataDiagnostics();
}

function bytesForString(s: string | null): number {
  if (!s) return 0;
  try {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(s).length;
    }
  } catch (e) {
    // fallback
  }
  return s.length;
}

function inferDateFromValue(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);

    // Common timestamp field names
    const candidates = ['timestamp', 'created_at', 'updated_at', 'cachedAt', 'cached_at', 'savedAt', 'saved_at'];
    for (const name of candidates) {
      if (parsed && typeof parsed === 'object' && parsed[name]) {
        const v = parsed[name];
        // epoch ms number
        if (typeof v === 'number' && v > 0) return new Date(v).toLocaleString();
        // ISO string
        if (typeof v === 'string') {
          const d = new Date(v);
          if (!isNaN(d.getTime())) return d.toLocaleString();
        }
      }
    }

    // If object has nested cachedAt or timestamp as number
    if (parsed && typeof parsed === 'object') {
      const flat = JSON.stringify(parsed);
      const epochMatch = flat.match(/\b(1[0-9]{12,}|[0-9]{12,})\b/); // crude epoch ms/seconds
      if (epochMatch) {
        const n = Number(epochMatch[0]);
        // heuristic: if looks like seconds (10 digits) convert
        if (epochMatch[0].length === 10) return new Date(n * 1000).toLocaleString();
        return new Date(n).toLocaleString();
      }
    }
  } catch (e) {
    // not JSON
    // try to detect ISO date
    const isoMatch = raw.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    if (isoMatch) {
      const d = new Date(isoMatch[0]);
      if (!isNaN(d.getTime())) return d.toLocaleString();
    }
  }
  return null;
}

function loadLocalDataDiagnostics() {
  try {
    const keys = Object.keys(localStorage).sort();
    localDataList.value = keys.map(k => {
      const raw = localStorage.getItem(k);
      const inferred = inferDateFromValue(raw);
      const size = bytesForString(raw);
      return { key: k, raw, inferredDate: inferred, size };
    });
    // reset expanded state
    expandedKeys.value = {};
    // load specific known keys for convenience
    loadSpecificKeys();
  } catch (err) {
    localDataList.value = [];
    expandedKeys.value = {};
  }
}

function loadSpecificKeys() {
  try {
    userToken.value = localStorage.getItem('user-token');
  } catch (e) {
    userToken.value = null;
  }

  try {
    const raw = localStorage.getItem('map:lastState');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        lastMapState.value = parsed;
      } catch (e) {
        lastMapState.value = null;
      }
    } else {
      lastMapState.value = null;
    }
  } catch (e) {
    lastMapState.value = null;
  }
}

function toggleExpanded(key: string) {
  expandedKeys.value[key] = !expandedKeys.value[key];
}

function totalLocalStorageBytes(): number {
  return localDataList.value.reduce((s: number, it: { size: number }) => s + (it.size || 0), 0);
}

onMounted(() => {
  checkSystemHealth();
  updateGeoPermissionState();
  loadLocalDataDiagnostics();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  stopConfetti();
  window.removeEventListener('resize', handleResize);
});
</script>

<template>
  <div class="status-view">
    <!-- Header -->
    <div class="bg-gray-50 border-b border-gray-200">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="text-center">
          <h1 class="text-3xl font-bold theme-on-background mb-2">System Status</h1>
          <p class="text-lg theme-on-surface-variant">
            Current status and health information for Public Art Registry
          </p>
        </div>
      </div>
    </div>

    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      <!-- Local Keys Card -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div class="p-6">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold mb-0">Local Keys</h2>
            <div class="flex items-center space-x-2">
              <button @click="refreshLocalDiagnostics" class="text-sm px-3 py-1 border rounded bg-gray-100">Refresh</button>
            </div>
          </div>

          <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div class="text-xs text-gray-600">User Token (user-token)</div>
              <div class="flex items-center space-x-2 mt-1">
                <div class="font-mono text-sm text-gray-900 truncate">{{ maskedToken ?? 'not set' }}</div>
                <button @click="showFullToken = !showFullToken" class="text-xs text-blue-600 underline">{{ showFullToken ? 'Hide' : 'Show' }}</button>
                <button @click="copyToClipboard(userToken)" class="text-xs px-2 py-1 border rounded">Copy</button>
              </div>
            </div>

            <div>
              <div class="text-xs text-gray-600">Map Last State (map:lastState)</div>
              <div class="mt-1 font-mono text-sm text-gray-900">{{ lastMapState ? (lastMapState.center ? `${lastMapState.center.latitude?.toFixed(6)}, ${lastMapState.center.longitude?.toFixed(6)} (z:${lastMapState.zoom})` : JSON.stringify(lastMapState)) : 'not set' }}</div>
              <div class="mt-2">
                <button @click="copyToClipboard(JSON.stringify(lastMapState))" class="text-xs px-2 py-1 border rounded">Copy JSON</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- API Status Card -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div class="p-6">
          <h2 class="text-lg font-semibold mb-4 flex items-center">
            <svg
              :class="['w-5 h-5 mr-2', error ? 'theme-error' : 'theme-success']"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                v-if="!error"
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd"
              />
              <path
                v-else
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clip-rule="evenodd"
              />
            </svg>
            API Status
          </h2>

          <div v-if="isLoading" class="theme-on-surface-variant flex items-center">
            <svg
              class="animate-spin -ml-1 mr-2 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Checking system health...
          </div>

          <div v-else>
            <p :class="['text-lg mb-4', error ? 'theme-error' : 'theme-success']">
              {{ status }}
            </p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div class="space-y-2">
                <div class="flex justify-between">
                  <span class="font-medium theme-on-surface-variant">API Connected:</span>
                  <span :class="[healthData?.apiConnected ? 'theme-success' : 'theme-error']">
                    {{ healthData?.apiConnected ? 'Yes' : 'No' }}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="font-medium text-gray-600">API Base URL:</span>
                  <span class="text-gray-900 font-mono text-xs">{{ apiBaseUrl }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="font-medium text-gray-600">Build Date:</span>
                  <span class="text-gray-900">{{ new Date(buildDate).toLocaleString() }}</span>
                </div>
              </div>

              <div class="space-y-2">
                <div class="flex justify-between">
                  <span class="font-medium text-gray-600">Last Check:</span>
                  <span class="text-gray-900">{{
                    healthData?.timestamp ? new Date(healthData.timestamp).toLocaleString() : 'N/A'
                  }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="font-medium text-gray-600">Environment:</span>
                  <span class="text-gray-900">{{ environment }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- System Statistics Card -->
      <div v-if="stats" class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div class="p-6">
          <h2 class="text-lg font-semibold mb-4 flex items-center">
            <svg class="w-5 h-5 mr-2" style="color: rgb(var(--md-primary))" fill="currentColor" viewBox="0 0 20 20">
              <path
                d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"
              />
            </svg>
            System Statistics
          </h2>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="text-center p-4 bg-blue-50 rounded-lg">
              <div class="text-2xl font-bold" style="color: rgb(var(--md-primary));">{{ stats.totalSubmissions || 0 }}</div>
              <div class="text-sm text-gray-600">Total Submissions</div>
            </div>
            <div class="text-center p-4 bg-green-50 rounded-lg">
              <div class="text-2xl font-bold" style="color: rgb(var(--md-success));">
                {{ stats.approvedSubmissions || 0 }}
              </div>
              <div class="text-sm text-gray-600">Approved Submissions</div>
            </div>
            <div class="text-center p-4 bg-yellow-50 rounded-lg">
              <div class="text-2xl font-bold theme-warning">
                {{ stats.pendingSubmissions || 0 }}
              </div>
              <div class="text-sm text-gray-600">Pending Review</div>
            </div>
          </div>

            <!-- Device GPS Permission & Local Data Card -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
              <div class="p-6">
                <h2 class="text-lg font-semibold mb-4 flex items-center">
                  <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 2a1 1 0 00-.894.553L7.382 6H4a1 1 0 00-.707 1.707l6 6a1 1 0 001.414 0l6-6A1 1 0 0016 6h-3.382l-1.724-3.447A1 1 0 0010 2z" />
                  </svg>
                  Device & Local Data
                </h2>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div class="space-y-2">
                    <div class="flex justify-between">
                      <span class="font-medium text-gray-600">Geolocation Supported:</span>
                      <span class="text-gray-900">{{ geoSupported ? 'Yes' : 'No' }}</span>
                    </div>

                    <div class="flex justify-between">
                      <span class="font-medium text-gray-600">Geolocation Permission:</span>
                      <span class="text-gray-900">{{ geoPermissionState ?? 'unknown' }}</span>
                    </div>

                    <div class="flex justify-between">
                      <span class="font-medium text-gray-600">Last Device Position:</span>
                      <span class="text-gray-900">{{ position ? formatCoords(position)?.lat + ', ' + formatCoords(position)?.lon : 'N/A' }}</span>
                    </div>

                    <div class="flex justify-between">
                      <span class="font-medium text-gray-600">Position Timestamp:</span>
                      <span class="text-gray-900">{{ position ? formatCoords(position)?.timestamp : 'N/A' }}</span>
                    </div>
                  </div>

                  <div class="space-y-2">
                    <div class="flex justify-between">
                      <span class="font-medium text-gray-600">Local Storage Keys:</span>
                      <span class="text-gray-900">{{ localDataList.length }}</span>
                    </div>

                    <div class="flex justify-between">
                      <span class="font-medium text-gray-600">User Token (user-token):</span>
                      <span class="text-gray-900 font-mono text-xs">{{ userToken ?? 'not set' }}</span>
                    </div>

                    <div class="flex justify-between">
                      <span class="font-medium text-gray-600">Map Last State (map:lastState):</span>
                      <span class="text-gray-900 font-mono text-xs">{{ lastMapState ? (lastMapState.center ? `${lastMapState.center.latitude?.toFixed(6)}, ${lastMapState.center.longitude?.toFixed(6)} (z:${lastMapState.zoom})` : JSON.stringify(lastMapState)) : 'not set' }}</span>
                    </div>

                    <div class="text-sm text-gray-600">
                      Below are localStorage keys and any inferred timestamps found inside their values (best-effort heuristic).
                    </div>

                    <div class="mt-2">
                      <div class="flex justify-between items-center mb-2">
                        <div class="text-sm text-gray-600">Total localStorage size:</div>
                        <div class="text-sm text-gray-900 font-mono">{{ totalLocalStorageBytes() }} bytes</div>
                      </div>

                      <div class="max-h-48 overflow-auto border rounded p-2 bg-gray-50">
                        <template v-if="localDataList.length">
                          <div v-for="item in localDataList" :key="item.key" class="py-1 border-b last:border-b-0">
                            <div class="flex justify-between items-center">
                              <div class="flex items-center space-x-3">
                                <button @click="toggleExpanded(item.key)" class="text-xs text-gray-500">{{ expandedKeys[item.key] ? '▾' : '▸' }}</button>
                                <div class="text-xs text-gray-700 font-mono truncate max-w-xs">{{ item.key }}</div>
                              </div>
                              <div class="flex items-center space-x-4">
                                <div class="text-xs text-gray-900">{{ item.inferredDate ?? '-' }}</div>
                                <div class="text-xs text-gray-600 font-mono">{{ item.size }} B</div>
                              </div>
                            </div>
                            <div v-if="expandedKeys[item.key]" class="mt-2 text-xs text-gray-800 font-mono bg-white p-2 rounded">
                              <pre class="whitespace-pre-wrap break-words">{{ item.raw }}</pre>
                            </div>
                          </div>
                        </template>
                        <div v-else class="text-sm text-gray-600">No localStorage data found.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
        </div>
      </div>

      <!-- Development Tools (only in dev/staging) -->
      <div
        v-if="environment === 'development' || environment === 'staging'"
        class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6"
      >
        <div class="p-6">
          <h2 class="text-lg font-semibold mb-4 flex items-center">
            <svg class="w-5 h-5 mr-2 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"
              />
            </svg>
            Development Tools
          </h2>
          <div class="space-y-4">
            <div class="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
              <div>
                <h3 class="font-medium text-gray-900">Confetti Animation Test</h3>
                <p class="text-sm text-gray-600">Test the badge celebration confetti animation</p>
              </div>
              <button
                @click="triggerConfetti"
                :disabled="isConfettiActive"
                class="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🎉 Test Confetti
              </button>
            </div>

            <div class="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
              <div>
                <h3 class="font-medium text-gray-900">Notification Test</h3>
                <p class="text-sm text-gray-600">Test notification display (requires login)</p>
              </div>
              <button
                @click="triggerTestNotification"
                class="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md theme-warning theme-on-warning"
              >
                🔔 Test Notification
              </button>
            </div>

            <!-- Device GPS Location Tool -->
            <div class="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
              <div class="flex items-start justify-between">
                <div>
                  <h3 class="font-medium text-gray-900">Device GPS Location</h3>
                  <p class="text-sm text-gray-600">
                    Show current device GPS coordinates and accuracy (for debugging).
                  </p>
                </div>
              </div>

              <div class="mt-3 space-y-2">
                <div v-if="!geoSupported" class="text-sm text-gray-600">
                  Geolocation is not supported by this browser.
                </div>

                <div v-else>
                  <div v-if="geoLoading" class="text-sm text-gray-600">Acquiring location…</div>
                  <div v-if="geoError" class="text-sm theme-error">{{ geoError }}</div>

                  <div v-if="position" class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div class="flex justify-between">
                      <span class="font-medium text-gray-600">Latitude:</span
                      ><span class="text-gray-900 font-mono">{{
                        formatCoords(position)?.lat
                      }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="font-medium text-gray-600">Longitude:</span
                      ><span class="text-gray-900 font-mono">{{
                        formatCoords(position)?.lon
                      }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="font-medium text-gray-600">Accuracy:</span
                      ><span class="text-gray-900">{{ formatCoords(position)?.accuracy }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="font-medium text-gray-600">Timestamp:</span
                      ><span class="text-gray-900">{{ formatCoords(position)?.timestamp }}</span>
                    </div>
                  </div>

                  <div class="flex items-center space-x-2 mt-3">
                    <button
                      @click="requestSinglePosition"
                      class="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      📍 Get Current Location
                    </button>

                    <button
                      @click="startGeoWatch"
                      class="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md theme-success theme-on-success focus:outline-none focus:ring-2 focus:ring-offset-2"
                      style="--tw-ring-color: var(--md-sys-color-success);"
                    >
                      👀 Start Watching
                    </button>

                    <button
                      @click="clearGeoWatch"
                      class="inline-flex items-center px-3 py-2 border theme-secondary theme-on-secondary text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2"
                      style="border-color: var(--md-sys-color-outline); --tw-ring-color: var(--md-sys-color-secondary);"
                    >
                      ✖️ Stop
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Refresh Button -->
      <div class="text-center space-y-4">
        <button
          @click="checkSystemHealth"
          :disabled="isLoading"
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm theme-primary theme-on-primary focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style="--tw-ring-color: var(--md-sys-color-primary);"
        >
          <svg
            :class="['w-4 h-4 mr-2', isLoading ? 'animate-spin' : '']"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {{ isLoading ? 'Checking...' : 'Refresh Status' }}
        </button>

        <!-- Clear Local Settings Button -->
        <button
          @click="clearLocalSettings"
          class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg
            class="w-4 h-4 mr-2"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H8a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          Clear Local Settings
        </button>
      </div>
    </div>

    <!-- Device GPS controls moved into Development Tools card (below) -->
  </div>
</template>

<style scoped>
.status-view {
  min-height: 100vh;
  background-color: var(--md-content-background, #f9fafb);
}
</style>
