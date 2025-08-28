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
      <div class="flex items-center justify-between h-16 px-4">
        <!-- Left side: Logo and Title -->
        <div class="flex items-center space-x-3">
          <div class="text-2xl" role="img" aria-label="Cultural Archiver logo">🎨</div>
          <h1 class="text-xl font-semibold truncate">Cultural Archiver</h1>
        </div>

        <!-- Right side: Navigation (Desktop) -->
        <nav class="hidden md:flex items-center space-x-4" role="navigation" aria-label="Main navigation">
          <RouterLink
            v-for="item in visibleNavItems"
            :key="item.path"
            :to="item.path"
            class="nav-link px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 transition-colors"
            :class="{ 'bg-blue-800': $route.path === item.path }"
            :aria-current="$route.path === item.path ? 'page' : undefined"
          >
            <component
              v-if="item.icon"
              :is="item.icon"
              class="w-5 h-5 inline-block mr-1"
              aria-hidden="true"
            />
            {{ item.name }}
          </RouterLink>
        </nav>

        <!-- Mobile menu button -->
        <button
          class="md:hidden p-2 rounded-md hover:bg-blue-700 focus:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 transition-colors"
          @click="toggleDrawer"
          @keydown.escape="closeDrawer"
          :aria-expanded="showDrawer"
          aria-label="Open navigation menu"
          aria-controls="mobile-menu"
        >
          <Bars3Icon v-if="!showDrawer" class="w-6 h-6" aria-hidden="true" />
          <XMarkIcon v-else class="w-6 h-6" aria-hidden="true" />
        </button>
      </div>
    </header>

    <!-- Mobile Drawer Overlay -->
    <div
      v-if="showDrawer"
      class="fixed inset-0 z-40 md:hidden"
      @click="closeDrawer"
      aria-hidden="true"
    >
      <div class="fixed inset-0 bg-black bg-opacity-50" />
    </div>

    <!-- Mobile Drawer -->
    <div
      id="mobile-menu"
      class="fixed top-0 left-0 z-50 h-full w-64 bg-white shadow-xl transform transition-transform duration-300 md:hidden"
      :class="showDrawer ? 'translate-x-0' : '-translate-x-full'"
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
      <nav class="py-4" role="navigation" aria-label="Mobile navigation">
        <RouterLink
          v-for="(item, index) in visibleNavItems"
          :key="item.path"
          :ref="index === 0 ? 'firstNavLink' : undefined"
          :to="item.path"
          class="drawer-link flex items-center px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 focus:bg-blue-50 focus:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset transition-colors"
          :class="{ 'bg-blue-100 text-blue-600 border-r-4 border-blue-600': $route.path === item.path }"
          :aria-current="$route.path === item.path ? 'page' : undefined"
          @click="closeDrawer"
        >
          <component
            v-if="item.icon"
            :is="item.icon"
            class="w-5 h-5 mr-3"
            aria-hidden="true"
          />
          <span class="font-medium">{{ item.name }}</span>
        </RouterLink>
      </nav>

      <!-- Drawer Footer -->
      <div class="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
        <div class="text-sm text-gray-500 text-center">
          Cultural Archiver v1.0
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <main id="main-content" class="app-main" role="main">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { Bars3Icon, XMarkIcon, PlusIcon, UserIcon, InformationCircleIcon, QuestionMarkCircleIcon, ClipboardDocumentListIcon, MapIcon } from '@heroicons/vue/24/outline'
import { useAuthStore } from '../stores/auth'
import type { NavigationItem } from '../types'

// Props
interface Props {
  title?: string
}

defineProps<Props>()

// State
const showDrawer = ref(false)
const route = useRoute()
const authStore = useAuthStore()

// Navigation items
const navigationItems: NavigationItem[] = [
  {
    name: 'Map',
    path: '/',
    icon: MapIcon
  },
  {
    name: 'Add',
    path: '/submit',
    icon: PlusIcon
  },
  {
    name: 'Profile',
    path: '/profile',
    icon: UserIcon,
    requiresAuth: true
  },
  {
    name: 'Review',
    path: '/review',
    icon: ClipboardDocumentListIcon,
    requiresReviewer: true
  },
  {
    name: 'About',
    path: '/home',
    icon: InformationCircleIcon
  },
  {
    name: 'Help',
    path: '/help',
    icon: QuestionMarkCircleIcon
  }
]

// Computed
const visibleNavItems = computed(() => {
  return navigationItems.filter(item => {
    // Hide auth-required items if not authenticated
    if (item.requiresAuth && !authStore.isAuthenticated) {
      return false
    }
    
    // Hide reviewer-only items if not a reviewer
    if (item.requiresReviewer && !authStore.isReviewer) {
      return false
    }
    
    return true
  })
})

// Methods
function toggleDrawer() {
  showDrawer.value = !showDrawer.value
}

function closeDrawer() {
  showDrawer.value = false
}

// Close drawer on escape key
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && showDrawer.value) {
    closeDrawer()
  }
}

// Close drawer on route change
function handleRouteChange() {
  closeDrawer()
}

// Lifecycle
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

// Watch route changes
import { watch } from 'vue'
watch(() => route.path, handleRouteChange)
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 30;
}

.app-main {
  flex: 1;
  margin-top: 4rem; /* Account for fixed header */
  min-height: calc(100vh - 4rem);
}

.nav-link {
  display: flex;
  align-items: center;
  text-decoration: none;
}

.nav-link:hover {
  text-decoration: none;
}

.drawer-link {
  display: flex;
  align-items: center;
  text-decoration: none;
}

.drawer-link:hover {
  text-decoration: none;
}

/* Ensure drawer is above everything */
.drawer-overlay {
  z-index: 40;
}

.drawer-panel {
  z-index: 50;
}

/* Focus styles for accessibility */
.nav-link:focus,
.drawer-link:focus,
button:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* Smooth transitions */
.drawer-panel {
  transition: transform 0.3s ease-in-out;
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