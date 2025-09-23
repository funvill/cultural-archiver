<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import {
  Bars3Icon,
  XMarkIcon,
  UserIcon,
  QuestionMarkCircleIcon,
  ClipboardDocumentListIcon,
  MapIcon,
  ArrowLeftOnRectangleIcon,
  ShieldCheckIcon,
  MagnifyingGlassIcon,
  CameraIcon,
  PhotoIcon,
  UserGroupIcon,
} from '@heroicons/vue/24/outline';
import { useGeolocation } from '../composables/useGeolocation';
import { extractExifData, createImagePreview } from '../utils/image';
import type { ExifData } from '../utils/image';
import type { Coordinates } from '../types';
import { useFastUploadSessionStore } from '../stores/fastUploadSession';
import { useAuthStore } from '../stores/auth';
import AuthModal from './AuthModal.vue';
import DevelopmentBanner from './DevelopmentBanner.vue';
import LiveRegion from './LiveRegion.vue';
import NotificationIcon from './NotificationIcon.vue';
import type { NavigationItem } from '../types';

// Props
interface Props {
  title?: string;
}

defineProps<Props>();

// State
const showDrawer = ref(false);
const showAuthModal = ref(false);
const authMode = ref<'login' | 'signup'>('login');
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

// Refs for focus management
const drawerCloseButton = ref<HTMLElement>();
// Note: firstNavLink ref is defined but not used - keeping for future drawer focus enhancement

// (removed mainNavigationItems - header uses FAB instead)

// Menu navigation items (shown in hamburger menu)
const menuNavigationItems: NavigationItem[] = [
  {
    name: 'Add',
    path: '/add',
    icon: CameraIcon,
    primaryAction: true,
  },
  {
    name: 'Map',
    path: '/',
    icon: MapIcon,
  },
  {
    name: 'Artworks',
    path: '/artworks',
    icon: PhotoIcon,
  },
  {
    name: 'Artists',
    path: '/artists',
    icon: UserGroupIcon,
  },
  {
    name: 'Search',
    path: '/search',
    icon: MagnifyingGlassIcon,
  },
  {
    name: 'Moderate',
    path: '/review',
    icon: ClipboardDocumentListIcon,
    requiresModerator: true,
  },
  {
    name: 'Admin',
    path: '/admin',
    icon: ShieldCheckIcon,
    requiresAdmin: true,
  },
  {
    name: 'Help',
    path: '/help',
    icon: QuestionMarkCircleIcon,
  },
];

// Note: `drawerNavItems` uses `menuNavigationItems` directly for filtering.

// Computed

// Separate computed property for drawer navigation (excludes "Add" since it's in main nav)
const drawerNavItems = computed(() => {
  const items = menuNavigationItems.filter(item => {
    // Hide auth-required items if not authenticated
    if (item.requiresAuth && !authStore.isAuthenticated) {
      return false;
    }

  // Hide moderator-only items if user cannot review
  if ((item as any).requiresModerator && !authStore.canReview) {
      return false;
    }

    // Hide admin-only items if not an admin
    if (item.requiresAdmin && !authStore.isAdmin) {
      return false;
    }

    return true;
  });
  
  console.log('*** DRAWER DEBUG START ***');
  console.log('menuNavigationItems:', menuNavigationItems);
  console.log('authStore.isAuthenticated:', authStore.isAuthenticated);
  console.log('authStore.canReview:', authStore.canReview);
  console.log('authStore.isAdmin:', authStore.isAdmin);
  console.log('filtered items:', items);
  console.log('*** DRAWER DEBUG END ***');
  
  return items;
});

// Fast Add Implementation ---------------------------------------
/*
 Fast Add UX (Overwrite Model)
 ---------------------------------
 1. User clicks Add -> immediate file picker (no intermediate landing page).
 2. Selected photo(s) are processed (preview + EXIF). If EXIF provides coordinates, we store them.
 3. If no EXIF coordinates, we attempt browser geolocation once per selection batch.
 4. On success (have at least one photo):
   - If we obtained a location (from EXIF or browser) we navigate directly to /search?source=fast-upload&lat=..&lng=..
   - If no location at all we fallback to legacy /add page so user can manually set location.
 5. Overwrite Semantics: After the first navigation (fastHasNavigated=true), a second Add click
   indicates the user wants to discard the previous in-progress fast upload and start over.
   We fully reset in-memory state, Pinia fast-upload session store, and sessionStorage before
   re-opening the picker. This replaced the earlier "append & re-search" multi-add design.

 Rationale:
   - Simplifies mental model (each Add = new flow) and avoids complex incremental refresh logic.
   - Eliminates need for global 'fast-upload-session-updated' events and length watchers in SearchView.
   - Reduces risk of stale preview/location data persisting across separate capture attempts.

 If future requirements reintroduce multi-session accumulation, revert to history where
 SearchView listened for 'fast-upload-session-updated' and re-ran location searches.
*/
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
  try { sessionStorage.removeItem('fast-upload-session'); } catch {}
  fastHasNavigated.value = false; // allow navigation logic to treat next add as first
}

function triggerFastAdd(): void {
  if (fastIsProcessing.value) return;
  // If user is already in a fast-upload flow (navigated once) and clicks Add again,
  // they intend to start over with a new single selection. Overwrite previous session.
  if (fastHasNavigated.value) {
    resetFastAddState();
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
      console.warn('[FAST ADD] Failed to process file', file.name, err);
    }
  }
  fastIsProcessing.value = false;
  if (!fastLocationSources.value.exif.detected) {
    try {
      const browserCoords = await getCurrentPosition();
      fastLocationSources.value.browser = { detected: true, error: false, coordinates: browserCoords };
      if (!fastFinalLocation.value) fastFinalLocation.value = browserCoords;
    } catch (err) {
      fastLocationSources.value.browser = { detected: false, error: true, coordinates: null };
    }
  }
  // If both EXIF and browser geolocation failed, surface a single consolidated message
  if (
    !fastLocationSources.value.exif.detected &&
    fastLocationSources.value.browser.error &&
    !fastLocationSources.value.browser.coordinates &&
    !fastFinalLocation.value
  ) {
    // Avoid alert spam if multiple files; only show once per processing batch
    try {
      console.warn('[FAST ADD] No location detected from EXIF or browser geolocation');
      // Non-blocking lightweight UX (could be replaced by a toast component if available)
      // Using alert as a fallback since component-level toast system not referenced here
  // TODO: Replace window.alert with centralized toast/notification system once available
  alert('Could not detect photo location automatically (EXIF & browser GPS unavailable). You can still continue and set location later.');
    } catch {}
  }
  maybeNavigateFast();
}

function maybeNavigateFast() {
  if (fastSelected.value.length === 0) return;

  // Helper to write session (shared for first navigation and subsequent updates)
  const writeSession = () => {
    const store = useFastUploadSessionStore();
    const metaWithPreview: Array<{ id: string; name: string; preview: string; exifLat?: number | undefined; exifLon?: number | undefined; file: File }> = fastSelected.value.map((p: FastPhotoFile) => ({
      id: p.id,
      name: p.name,
      preview: p.preview,
      exifLat: p.exifData?.latitude ?? undefined,
      exifLon: p.exifData?.longitude ?? undefined,
      file: p.file,
    }));
    const meta: Array<{ id: string; name: string; exifLat?: number | undefined; exifLon?: number | undefined }> = metaWithPreview.map((m) => ({ id: m.id, name: m.name, exifLat: m.exifLat, exifLon: m.exifLon }));
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


const userDisplayName = computed(() => {
  if (!authStore.user) return 'Anonymous';
  if (authStore.user.emailVerified && authStore.user.email) {
    return authStore.user.email;
  }
  return `Anonymous (${authStore.user.id.slice(0, 8)}...)`;
});

// Methods
function toggleDrawer(): void {
  showDrawer.value = !showDrawer.value;

  // Focus management when opening/closing drawer
  if (showDrawer.value) {
    focusFirstDrawerElement();
  }
}

function closeDrawer(): void {
  const wasOpen = showDrawer.value;
  showDrawer.value = false;

  // Return focus to navigation drawer button when closing drawer
  if (wasOpen) {
    nextTick(() => {
      const menuButton = document.querySelector(
        '[aria-label="Open navigation menu"]'
      ) as HTMLElement;
      menuButton?.focus();
    });
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
  console.log('Authentication successful:', payload);
}

// Notification handlers
function handleNotificationClick(notificationId: string): void {
  // For now, just log - could navigate to notification details or related content
  console.log('Notification clicked:', notificationId);
}

function handleNotificationPanelToggle(isOpen: boolean): void {
  // Close drawer if notification panel is opened to avoid UI conflicts
  if (isOpen && showDrawer.value) {
    showDrawer.value = false;
  }
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
    console.error('Logout failed:', error);
  }
}

// Handle navigation to home with dirty form check
function handleHomeNavigation(): void {
  // Check if we're already on the map page
  if (route.path === '/') {
    return;
  }

  // Check for dirty forms
  const isDirty = checkForDirtyForms();

  if (isDirty) {
    const confirmed = confirm(
      'You have unsaved changes. Are you sure you want to leave this page?'
    );
    if (!confirmed) {
      return;
    }
  }

  // Navigate to map
  router.push('/');
}

// Check for dirty forms in the current view
function checkForDirtyForms(): boolean {
  // Look for forms with data-dirty attribute or common form indicators
  const forms = document.querySelectorAll('form');

  for (const form of forms) {
    // Check if form has been marked as dirty
    if (form.hasAttribute('data-dirty') && form.getAttribute('data-dirty') === 'true') {
      return true;
    }

    // Check for input values that might indicate unsaved changes
    const inputs = form.querySelectorAll('input, textarea, select');
    for (const input of inputs) {
      if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
        // Skip empty inputs and default values
        if (input.value && input.value !== input.defaultValue) {
          return true;
        }
      } else if (input instanceof HTMLSelectElement) {
        if (input.selectedIndex !== 0) {
          return true;
        }
      }
    }
  }

  return false;
}

// Enhanced keyboard navigation
function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    if (showDrawer.value) {
      closeDrawer();
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

// Focus management for drawer
function focusFirstDrawerElement(): void {
  nextTick(() => {
    const firstNavLink = document.querySelector('.drawer-link') as HTMLElement;
    firstNavLink?.focus();
  });
}

// Close drawer on route change
function handleRouteChange(): void {
  closeDrawer();
}

// Lifecycle
onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});

// Watch route changes (defensive: tests may mount without a real router)
try {
  if (route && typeof route === 'object') {
    watch(() => (route as any)?.path, handleRouteChange);
  }
} catch (e) {
  // In unit tests without a router instance, accessing route may fail; ignore.
}
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

    <!-- Top App Bar -->
    <header class="app-header bg-blue-600 text-white shadow-md" role="banner">
      <div class="grid grid-cols-3 items-center h-16 px-4">
        <!-- Left side: Logo and Title -->
        <div class="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <button
            @click="handleHomeNavigation"
            class="flex items-center space-x-2 sm:space-x-3 text-left hover:opacity-80 focus:opacity-80 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 rounded-md transition-opacity"
            aria-label="Return to map"
          >
            <div class="text-xl sm:text-2xl" role="img" aria-label="Cultural Archiver logo">🎨</div>
            <h1 class="text-lg sm:text-xl font-semibold truncate">Cultural Archiver</h1>
          </button>
        </div>

        <!-- Center: Floating Add FAB (Material-style) -->
        <div class="flex justify-center">
          <!-- Hidden textual Add button to preserve legacy selectors/tests -->
          <button
            type="button"
            @click="triggerFastAdd"
            class="sr-only"
            aria-label="Add"
          >
            Add
          </button>

          <!-- FAB button positioned absolutely via scoped styles to overlap header -->
          <button
            type="button"
            @click="triggerFastAdd"
            class="fab pointer-events-auto flex items-center justify-center shadow-lg bg-primary-500 text-white rounded-full focus:outline-none focus:ring-4 focus:ring-primary-200 transition-transform"
            aria-label="Add photo"
          >
            <CameraIcon class="w-7 h-7" aria-hidden="true" />
          </button>
          <input
            ref="fastFileInput"
            type="file"
            accept="image/*"
            multiple
            class="hidden"
            @change="handleFastFileChange"
          />
        </div>

        <!-- Right side: Search, Notifications, Profile and Navigation -->
        <div class="flex items-center justify-end space-x-2">
          <!-- Search Icon -->
          <button
            class="p-2 rounded-md hover:bg-blue-700 focus:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 transition-colors"
            @click="() => { router.push('/search'); }"
            aria-label="Search"
          >
            <MagnifyingGlassIcon class="w-6 h-6" aria-hidden="true" />
          </button>

          <!-- Notification Icon (only for authenticated users) -->
          <NotificationIcon 
            v-if="authStore.isAuthenticated"
            @notification-click="handleNotificationClick"
            @panel-toggle="handleNotificationPanelToggle"
          />

          <!-- Profile Icon (navigates to profile) -->
          <button
            v-if="authStore.isAuthenticated"
            class="p-2 rounded-md hover:bg-blue-700 focus:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 transition-colors"
            @click="() => { router.push('/profile'); }"
            aria-label="Profile"
          >
            <UserIcon class="w-6 h-6" aria-hidden="true" />
          </button>

          <!-- Navigation Drawer Button -->
          <button
            class="p-2 rounded-md hover:bg-blue-700 focus:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 transition-colors"
            @click="toggleDrawer"
            @keydown.escape="closeDrawer"
            :aria-expanded="showDrawer"
            aria-label="Open navigation menu"
            aria-controls="navigation-drawer"
          >
            <Bars3Icon v-if="!showDrawer" class="w-6 h-6" aria-hidden="true" />
            <XMarkIcon v-else class="w-6 h-6" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>

    <!-- Development Warning Banner -->
    <DevelopmentBanner />

    <!-- Navigation Drawer Overlay -->
    <div
      v-if="showDrawer"
      class="fixed inset-0 z-40"
      @click="closeDrawer"
      aria-hidden="true"
    >
      <div class="fixed inset-0 bg-black bg-opacity-50" />
    </div>

    <!-- Navigation Drawer -->
    <div
      id="navigation-drawer"
      class="fixed top-0 right-0 z-50 h-full w-80 bg-white shadow-xl transform transition-transform duration-300"
      :class="showDrawer ? 'translate-x-0' : 'translate-x-full'"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      @keydown.escape="closeDrawer"
    >
      <!-- Drawer Header -->
      <div class="flex items-center justify-between h-16 px-4 bg-blue-600 text-white">
        <div class="flex items-center space-x-3">
          <div class="text-2xl" role="img" aria-label="Cultural Archiver logo">🎨</div>
          <h2 id="drawer-title" class="text-lg font-semibold">Navigation Menu</h2>
        </div>
        <button
          ref="drawerCloseButton"
          @click="closeDrawer"
          class="p-2 rounded-md hover:bg-blue-700 focus:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 transition-colors"
          aria-label="Close navigation menu"
        >
          <XMarkIcon class="w-6 h-6" aria-hidden="true" />
        </button>
      </div>

      <!-- Drawer Navigation -->
      <nav class="py-4" role="navigation" aria-label="Navigation menu">
        <!-- All Navigation Items -->
        <RouterLink
          v-for="(item, index) in drawerNavItems"
          :key="item.path"
          v-bind="index === 0 ? { ref: 'firstNavLink' } : {}"
          :to="item.path"
          class="drawer-link flex items-center px-6 py-4 text-gray-700 hover:bg-blue-50 hover:text-blue-600 focus:bg-blue-50 focus:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset transition-colors"
          :class="[
            $route.path === item.path ? 'bg-blue-100 text-blue-600 border-r-4 border-blue-600' : '',
            item.primaryAction ? 'relative z-0' : ''
          ]"
          :aria-current="$route.path === item.path ? 'page' : undefined"
          @click="closeDrawer"
        >
          <span v-if="item.primaryAction" class="absolute -inset-1 rounded bg-blue-50 border border-blue-200 pointer-events-none -z-10" />
          <component
            v-if="item.icon"
            :is="item.icon"
            :class="item.primaryAction ? 'relative z-10 w-6 h-6 mr-4' : 'w-5 h-5 mr-4'"
            aria-hidden="true"
          />
          <span :class="item.primaryAction ? 'relative z-10 font-semibold text-base' : 'font-medium text-base'">{{ item.name }}</span>
        </RouterLink>

        <!-- Authentication Section -->
        <div class="border-t border-gray-200 mt-6 pt-6">
          <!-- User Status -->
          <div class="px-6 py-2">
            <button
              v-if="authStore.isAuthenticated"
              @click="
                $router.push('/profile');
                closeDrawer();
              "
              class="w-full flex items-center space-x-3 px-3 py-3 text-left text-base font-medium text-gray-900 hover:bg-gray-50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
              :title="`View profile for ${userDisplayName}`"
            >
              <UserIcon class="w-5 h-5 text-gray-600" aria-hidden="true" />
              <span>{{ userDisplayName }}</span>
            </button>
            <div v-else class="text-base font-medium text-gray-900 px-3 py-3">{{ userDisplayName }}</div>
          </div>

          <!-- Auth Actions -->
          <div v-if="!authStore.isAuthenticated" class="px-6 py-2">
            <button
              @click="
                openAuthModal('login');
                closeDrawer();
              "
              class="w-full flex items-center justify-center px-4 py-3 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Sign In
            </button>
          </div>
          <div v-else class="px-6 py-2">
            <button
              @click="
                handleLogout();
                closeDrawer();
              "
              class="w-full flex items-center justify-center px-4 py-3 text-base font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-inset"
            >
              <ArrowLeftOnRectangleIcon class="w-5 h-5 mr-2" aria-hidden="true" />
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <!-- Drawer Footer -->
      <div class="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-200">
        <div class="text-sm text-gray-600 text-center">Cultural Archiver v1.0</div>
      </div>
    </div>

    <!-- Main Content -->
    <main id="main-content" class="app-main" role="main">
      <RouterView />
    </main>

    <!-- Global Live Region for Screen Reader Announcements -->
    <LiveRegion />

    <!-- Authentication Modal -->
    <AuthModal
      :is-open="showAuthModal"
      :mode="authMode"
      @close="closeAuthModal"
      @success="handleAuthSuccess"
    />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.app-header {
  flex-shrink: 0;
  position: relative; /* allow absolutely positioned FAB inside header */
}

.app-main {
  flex: 1;
  min-height: calc(100vh - 4rem);
}

/* Navigation link styles */
.nav-link {
  transition: all 0.2s ease-in-out;
}

.drawer-link {
  transition: all 0.2s ease-in-out;
}

/* Focus styles for better accessibility */
.nav-link:focus,
.drawer-link:focus {
  box-shadow: 0 0 0 2px currentColor;
}

/* Mobile drawer animation */
.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.3s ease-in-out;
}

.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(-100%);
}

/* Mobile responsive adjustments */
@media (max-width: 767px) {
  .app-shell {
    overflow-x: hidden;
  }
}

/* Scoped FAB positioning: make the FAB overlap the app bar so 30% extends into content */
/* Make the FAB fixed so its top touches the viewport top and it visually clips into the header
   We keep the bottom hanging 30% into the content by offsetting the header's inner padding. */
.fab {
  position: fixed;
  top: 0; /* FAB top aligns with window top */
  left: 50%;
  transform: translateX(-50%);
  z-index: 40; /* above header but below modals */
  /* visually center the icon inside the circular FAB — existing width/height apply */
}

@media (max-width: 640px) {
  /* Slightly smaller FAB on small screens and adjust overlap */
  .fab {
    width: 64px;
    height: 64px;
    /* top is fixed at 0 with fixed positioning; no top calc needed */
  }
}

/* Ensure header content isn't covered by the clipped top of the FAB by adding top padding
   equal to approximately 30% of the FAB so the visible lower portion overlaps the header. */
/* Prevent body scroll when drawer is open */
body.drawer-open {
  overflow: hidden;
}
</style>
