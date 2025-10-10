<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import { useGeolocation } from '../composables/useGeolocation';
import { extractExifData, createImagePreview } from '../utils/image';
import type { ExifData } from '../utils/image';
import type { Coordinates } from '../types';
import { useFastUploadSessionStore } from '../stores/fastUploadSession';
import { useAuthStore } from '../stores/auth';
import { useNotificationsStore } from '../stores/notifications';
import { useBreakpoint } from '../composables/useBreakpoint';
import { createLogger } from '../../../shared/logger';
import AuthModal from './AuthModal.vue';
import FeedbackDialog from './FeedbackDialog.vue';
import LiveRegion from './LiveRegion.vue';
import Toasts from './Toasts.vue';

// Import new navigation components
import BottomNavigation from './navigation/BottomNavigation.vue';
import NavigationRail from './navigation/NavigationRail.vue';
import NavigationDrawer from './navigation/NavigationDrawer.vue';
import AboutModal from './navigation/AboutModal.vue';



// Props
interface Props {
  title?: string;
}

defineProps<Props>();

// State
const showDrawer = ref(false);
const showAuthModal = ref(false);
const authMode = ref<'login' | 'signup'>('login');
const showAboutModal = ref(false);
const showFeedbackDialog = ref(false);
const feedbackDefaultNote = ref('');
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const notificationsStore = useNotificationsStore();
const { showNavigationRail } = useBreakpoint();
const log = createLogger({ module: 'frontend:AppShell' });

// Local state for navigation rail expanded/collapsed on desktop
const navExpanded = ref(true);

// Build auth object once for passing to navigation components
const auth = computed(() => ({
  isAuthenticated: authStore.isAuthenticated,
  userDisplayName: authStore.user?.email ?? '',
  userRole: (authStore.isAdmin ? 'admin' : (authStore.canReview ? 'moderator' : 'user')) as 'admin' | 'moderator' | 'user',
}));

function handleToggleRail(): void {
  navExpanded.value = !navExpanded.value;
  // Notify other components that the nav rail changed width so they can react (e.g., map resize)
  try {
    window.dispatchEvent(new CustomEvent('nav-rail-toggle', { detail: { expanded: navExpanded.value } }));
  } catch (e) {
    // ignore in non-browser/test environments
  }
}


// Fast Add Implementation - keeping existing functionality
interface FastPhotoFile {
  id: string;
  name: string;
  file: File;
  preview: string;
  exifData?: ExifData;
}

const fastFileInput = ref<HTMLInputElement | null>(null);
const fastSelected = ref<FastPhotoFile[]>([]);
const fastIsProcessing = ref(false);
const fastHasNavigated = ref(false);
const fastFinalLocation = ref<Coordinates | null>(null);
const fastLocationSources = ref({
  exif: { detected: false, error: false, coordinates: null as Coordinates | null },
  browser: { detected: false, error: false, coordinates: null as Coordinates | null },
});

const { getCurrentPosition } = useGeolocation();

function resetFastAddState(): void {
  // Clear in-memory selections
  fastSelected.value = [];
  fastFinalLocation.value = null;
  fastLocationSources.value = {
    exif: { detected: false, error: false, coordinates: null },
    browser: { detected: false, error: false, coordinates: null },
  } as any;
  // Clear shared Pinia store + sessionStorage
  try {
    const store = useFastUploadSessionStore();
    store.clear?.();
  } catch {}
  try {
    sessionStorage.removeItem('fast-upload-session');
  } catch {}
  fastHasNavigated.value = false; // allow navigation logic to treat next add as first
}

function triggerFastAdd(): void {
  if (fastIsProcessing.value) return;
  // If user is already in a fast-upload flow (navigated once) and clicks Add again,
  // they intend to start over with a new single selection. Overwrite previous session.
  if (fastHasNavigated.value) {
    resetFastAddState();
  }
  // Navigate to the add page immediately so the FAB click always takes the user to the add flow.
  // Keep the file input click to open file chooser for quick photo-first additions when available.
  try {
    router.push('/add');
  } catch (e) {
    // ignore routing failures (shouldn't happen)
  }
  fastFileInput.value?.click();
}

async function handleFastFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;
  await fastProcessFiles(Array.from(input.files));
  input.value = '';
}

async function fastProcessFiles(files: File[]) {
  fastIsProcessing.value = true;
  // If user re-triggers Add after having navigated once, treat this as overwrite
  if (fastHasNavigated.value) {
    fastSelected.value = [];
  }
  const imageFiles = files.filter(f => f.type.startsWith('image/'));
  for (const file of imageFiles) {
    try {
      const preview = await createImagePreview(file);
      const exif = await extractExifData(file);
      const entry: FastPhotoFile = {
        id: Math.random().toString(36).slice(2, 11),
        name: file.name,
        file,
        preview,
        exifData: exif,
      };
      fastSelected.value.push(entry);
      if (exif.latitude && exif.longitude && !fastLocationSources.value.exif.detected) {
        fastLocationSources.value.exif = {
          detected: true,
          error: false,
          coordinates: { latitude: exif.latitude, longitude: exif.longitude },
        };
        fastFinalLocation.value = fastLocationSources.value.exif.coordinates;
      }
    } catch (err) {
      log.warn('[FAST ADD] Failed to process file', { fileName: file.name, error: err });
    }
  }
  fastIsProcessing.value = false;
  if (!fastLocationSources.value.exif.detected) {
    try {
      const browserCoords = await getCurrentPosition();
      fastLocationSources.value.browser = {
        detected: true,
        error: false,
        coordinates: browserCoords,
      };
      if (!fastFinalLocation.value) fastFinalLocation.value = browserCoords;
    } catch (err) {
      fastLocationSources.value.browser = { detected: false, error: true, coordinates: null };
    }
  }
  maybeNavigateFast();
}

function maybeNavigateFast() {
  if (fastSelected.value.length === 0) return;

  // Helper to write session (shared for first navigation and subsequent updates)
  const writeSession = () => {
    const store = useFastUploadSessionStore();
    const metaWithPreview: Array<{
      id: string;
      name: string;
      preview: string;
      exifLat?: number | undefined;
      exifLon?: number | undefined;
      file: File;
    }> = fastSelected.value.map((p: FastPhotoFile) => ({
      id: p.id,
      name: p.name,
      preview: p.preview,
      exifLat: p.exifData?.latitude ?? undefined,
      exifLon: p.exifData?.longitude ?? undefined,
      file: p.file,
    }));
    const meta: Array<{
      id: string;
      name: string;
      exifLat?: number | undefined;
      exifLon?: number | undefined;
    }> = metaWithPreview.map(m => ({
      id: m.id,
      name: m.name,
      exifLat: m.exifLat,
      exifLon: m.exifLon,
    }));
    const payload = {
      photos: metaWithPreview,
      location: fastFinalLocation.value,
      detectedSources: fastLocationSources.value,
    } as any;
    store.setSession(payload);
    try {
      const json = JSON.stringify({ ...payload, photos: meta });
      if (json.length < 200_000) {
        sessionStorage.setItem('fast-upload-session', json);
      }
    } catch (e) {
      /* ignore quota */
    }
  };

  // Navigation (always treat as fresh if fastHasNavigated was reset by second Add)
  if (!fastHasNavigated.value) {
    if (!fastFinalLocation.value) {
      router.push('/add');
      fastHasNavigated.value = true;
      return;
    }
    writeSession();
    fastHasNavigated.value = true;
    const query = new URLSearchParams({ mode: 'photo', source: 'fast-upload' });
    if (fastFinalLocation.value) {
      query.set('lat', fastFinalLocation.value.latitude.toString());
      query.set('lng', fastFinalLocation.value.longitude.toString());
    }
    router.push(`/search?${query.toString()}`);
  }
}

// Authentication methods
function openAuthModal(mode: 'login' | 'signup' = 'login'): void {
  authMode.value = mode;
  showAuthModal.value = true;
}

function closeAuthModal(): void {
  showAuthModal.value = false;
}

function handleAuthSuccess(payload: { isNewAccount: boolean; email: string }): void {
  closeAuthModal();
  // Could show success toast here if needed
  log.info('Authentication successful', { payload });
}

async function handleLogout(): Promise<void> {
  // Show logout confirmation as per PRD requirements
  const confirmed = confirm('Are you sure you want to sign out?');
  if (!confirmed) {
    return;
  }

  try {
    await authStore.logout();
    // Could show logout success message here
  } catch (error) {
    log.error('Logout failed', { error });
  }
}

// New navigation handlers
function handleDrawerToggle(): void {
  showDrawer.value = !showDrawer.value;
}

function setShowDrawer(value: boolean): void {
  showDrawer.value = value;
}

// Feedback handlers
function handleFeedbackClick(): void {
  const currentUrl = window.location.href;
  const userToken = authStore.token || 'anonymous';
  feedbackDefaultNote.value = `Feedback url: ${currentUrl}\nUser token: ${userToken}\n\n`;
  showFeedbackDialog.value = true;
}

function closeFeedbackDialog(): void {
  showFeedbackDialog.value = false;
  feedbackDefaultNote.value = '';
}

function handleFeedbackSuccess(feedbackId: string): void {
  log.info('Feedback submitted successfully', { feedbackId });
  // Could show success toast here
}



function handleAboutClick(): void {
  showAboutModal.value = true;
}

function handleAboutModalClose(): void {
  showAboutModal.value = false;
}

function handleSearch(query: string): void {
  // Navigate to search results page
  if (query.trim()) {
    router.push(`/search/results?q=${encodeURIComponent(query.trim())}`);
  }
}

function handleNotificationClick(): void {
  // Navigate to profile notifications page
  router.push('/profile/notifications');
}

function handleMapClick(): void {
  router.push('/');
}

// Previously used to toggle a left navigation rail; no longer needed with a single bottom nav.





// Enhanced keyboard navigation
function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    if (showDrawer.value) {
      showDrawer.value = false;
      return;
    }
  }

  // Handle tab trapping in drawer when open
  if (showDrawer.value && event.key === 'Tab') {
    handleTabTrapping(event);
  }
}

// Tab trapping for modal accessibility
function handleTabTrapping(event: KeyboardEvent): void {
  const drawer = document.querySelector('[role="dialog"]') as HTMLElement;
  if (!drawer) return;

  const focusableElements = drawer.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

  if (event.shiftKey) {
    // Shift+Tab: moving backwards
    if (document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    }
  } else {
    // Tab: moving forwards
    if (document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }
}





// Lifecycle
onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
  
  // No desktop navigation rail state to initialize; using unified bottom navigation.
  
  // Initialize notifications if user is authenticated
  if (authStore.isAuthenticated) {
    notificationsStore.startPolling();
  }
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  notificationsStore.stopPolling();
});

// Watch route changes to close drawer
watch(() => route.path, () => {
  showDrawer.value = false;
});

// Watch authentication state changes to manage notification polling
watch(() => authStore.isAuthenticated, (isAuthenticated: boolean) => {
  if (isAuthenticated) {
    notificationsStore.startPolling();
  } else {
    notificationsStore.stopPolling();
    notificationsStore.resetState();
  }
});
</script>

<template>
  <div class="app-shell">
    <!-- Skip Navigation Link for Accessibility -->
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md"
    >
      Skip to main content
    </a>

      <!-- Development Warning Banner removed in production/staging builds -->

    <!-- Desktop Navigation Rail (md+ screens) -->
    <NavigationRail
      v-if="showNavigationRail"
      :is-expanded="navExpanded"
      :notification-count="notificationsStore.unreadCount"
      :show-notifications="authStore.isAuthenticated"
      :auth="auth"
      @toggleExpanded="handleToggleRail"
      @notificationClick="handleNotificationClick"
      @profileClick="() => router.push('/profile')"
      @loginClick="() => openAuthModal('login')"
      @logoutClick="handleLogout"
    />

    <!-- Bottom Navigation (always shown) -->
    <BottomNavigation
      :current-route="route.path"
      :notification-count="notificationsStore.unreadCount"
      :show-notifications="authStore.isAuthenticated"
      :auth="auth"
      @menuToggle="handleDrawerToggle"
      @fabClick="triggerFastAdd"
      @mapClick="handleMapClick"
      @notificationClick="handleNotificationClick"
      @profileClick="() => router.push('/profile')"
      @loginClick="() => openAuthModal('login')"
      @feedbackClick="handleFeedbackClick"
    />

    <!-- Mobile Navigation Drawer -->
    <NavigationDrawer
      :is-open="showDrawer"
      :current-route="route.path"
      :auth="auth"
      @update:is-open="setShowDrawer"
      @searchSubmit="handleSearch"
      @profileClick="() => router.push('/profile')"
      @aboutModalOpen="handleAboutClick"
      @loginClick="() => openAuthModal('login')"
      @logoutClick="handleLogout"
    />

    <!-- Main Content -->
    <main 
      id="main-content" 
      class="app-main" 
      role="main"
      :class="{
        'pb-16': true,
        'lg:ml-80': showNavigationRail && navExpanded,
        'lg:ml-16': showNavigationRail && !navExpanded
      }"
    >
      <RouterView />
    </main>

    <!-- Hidden file input for fast add -->
    <input
      ref="fastFileInput"
      type="file"
      accept="image/*"
      multiple
      class="hidden"
      @change="handleFastFileChange"
    />

    <!-- Global Live Region for Screen Reader Announcements -->
    <LiveRegion />

    <!-- Authentication Modal -->
    <AuthModal
      :is-open="showAuthModal"
      :mode="authMode"
      @close="closeAuthModal"
      @success="handleAuthSuccess"
    />

    <!-- About Modal -->
    <AboutModal
      :is-open="showAboutModal"
      @close="handleAboutModalClose"
    />

    <!-- Feedback Dialog -->
    <FeedbackDialog
      :open="showFeedbackDialog"
      subject-type="general"
      subject-id="general-feedback"
      mode="general"
      :default-note="feedbackDefaultNote"
      @close="closeFeedbackDialog"
      @success="handleFeedbackSuccess"
    />

    <!-- Global Toasts -->
    <Toasts />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.app-main {
  flex: 1;
  min-height: 0;
  overflow: auto;
  transition: margin-left 0.3s ease, padding-bottom 0.3s ease;
}

/* Desktop layout - main content with left margin for navigation rail */
@media (min-width: 1024px) {
  .app-main.lg\:ml-80 {
    margin-left: 20rem; /* 320px - expanded rail width */
  }
  
  .app-main.lg\:ml-16 {
    margin-left: 4rem; /* 64px - collapsed rail width */
  }
}

/* Mobile layout - main content with bottom padding for bottom navigation */
@media (max-width: 599px) {
  .app-main.pb-16 {
    padding-bottom: 4rem; /* 64px - bottom nav height */
  }
}

/* Responsive adjustments */
@media (max-width: 767px) {
  .app-shell {
    overflow-x: hidden;
  }
}
</style>
