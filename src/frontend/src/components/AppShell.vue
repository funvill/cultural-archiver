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
} from '@heroicons/vue/24/outline';
import { useAuthStore } from '../stores/auth';
import AuthModal from './AuthModal.vue';
import LiveRegion from './LiveRegion.vue';
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

// Main navigation items (shown in desktop header)
const mainNavigationItems: NavigationItem[] = [
  {
    name: 'Add',
    path: '/add',
    icon: CameraIcon,
    primaryAction: true,
  },
];

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
    name: 'Search',
    path: '/search',
    icon: MagnifyingGlassIcon,
  },
  {
    name: 'Moderate',
    path: '/review',
    icon: ClipboardDocumentListIcon,
    // New canonical flag
    requiresModerator: true,
    // Backward compatibility legacy flag (to remove later)
    requiresReviewer: true,
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

  // Hide moderator-only items if user cannot review (support both legacy & new flags)
  if ((item as any).requiresModerator && !authStore.canReview) {
      return false;
    }
  if (item.requiresReviewer && !authStore.canReview) {
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

// Watch route changes
watch(() => route.path, handleRouteChange);
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

        <!-- Center: Add Button -->
        <div class="flex justify-center">
          <nav role="navigation" aria-label="Main navigation">
            <RouterLink
              v-for="item in mainNavigationItems"
              :key="item.path"
              :to="item.path"
              class="nav-link rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 transition-colors"
              :class="[
                $route.path === item.path ? 'bg-blue-800' : 'hover:bg-blue-700',
                item.primaryAction
                  ? 'px-4 py-2 text-sm relative'
                  : 'px-3 py-2 text-sm'
              ]"
              :aria-current="$route.path === item.path ? 'page' : undefined"
            >
              <span v-if="item.primaryAction" class="absolute -inset-1 rounded-lg bg-white/10 pointer-events-none" />
              <component
                v-if="item.icon"
                :is="item.icon"
                :class="item.primaryAction ? 'w-6 h-6 inline-block mr-1' : 'w-5 h-5 inline-block mr-1'"
                aria-hidden="true"
              />
              <span :class="item.primaryAction ? 'text-base font-semibold' : ''">{{ item.name }}</span>
            </RouterLink>
          </nav>
        </div>

        <!-- Right side: Navigation Drawer Button -->
        <div class="flex justify-end">
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

/* Prevent body scroll when drawer is open */
body.drawer-open {
  overflow: hidden;
}
</style>
