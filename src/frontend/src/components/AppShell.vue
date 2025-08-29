<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { Bars3Icon, XMarkIcon, PlusIcon, UserIcon, InformationCircleIcon, QuestionMarkCircleIcon, ClipboardDocumentListIcon, MapIcon } from '@heroicons/vue/24/outline'
import { useAuthStore } from '../stores/auth'
import LiveRegion from './LiveRegion.vue'
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

// Refs for focus management
const drawerCloseButton = ref<HTMLElement>()
// Note: firstNavLink ref is defined but not used - keeping for future drawer focus enhancement

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
function toggleDrawer(): void {
  showDrawer.value = !showDrawer.value
  
  // Focus management when opening/closing drawer
  if (showDrawer.value) {
    focusFirstDrawerElement()
  }
}

function closeDrawer(): void {
  const wasOpen = showDrawer.value
  showDrawer.value = false
  
  // Return focus to mobile menu button when closing drawer
  if (wasOpen) {
    nextTick(() => {
      const menuButton = document.querySelector('[aria-label="Open navigation menu"]') as HTMLElement
      menuButton?.focus()
    })
  }
}

// Enhanced keyboard navigation
function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && showDrawer.value) {
    closeDrawer()
    return
  }
  
  // Handle tab trapping in drawer when open
  if (showDrawer.value && event.key === 'Tab') {
    handleTabTrapping(event)
  }
}

// Tab trapping for modal accessibility
function handleTabTrapping(event: KeyboardEvent): void {
  const drawer = document.querySelector('[role="dialog"]') as HTMLElement
  if (!drawer) return
  
  const focusableElements = drawer.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  const firstElement = focusableElements[0] as HTMLElement
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement
  
  if (event.shiftKey) {
    // Shift+Tab: moving backwards
    if (document.activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
    }
  } else {
    // Tab: moving forwards
    if (document.activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
    }
  }
}

// Focus management for drawer
function focusFirstDrawerElement(): void {
  nextTick(() => {
    const firstNavLink = document.querySelector('.drawer-link') as HTMLElement
    firstNavLink?.focus()
  })
}

// Close drawer on route change
function handleRouteChange(): void {
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
watch(() => route.path, handleRouteChange)
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
      <div class="flex items-center justify-between h-16 px-4">
        <!-- Left side: Logo and Title -->
        <div class="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <div class="text-xl sm:text-2xl" role="img" aria-label="Cultural Archiver logo">🎨</div>
          <h1 class="text-lg sm:text-xl font-semibold truncate">Cultural Archiver</h1>
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
          class="md:hidden p-3 rounded-md hover:bg-blue-700 focus:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 transition-colors"
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
          v-bind="index === 0 ? { ref: 'firstNavLink' } : {}"
          :to="item.path"
          class="drawer-link flex items-center px-4 py-4 text-gray-700 hover:bg-blue-50 hover:text-blue-600 focus:bg-blue-50 focus:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset transition-colors"
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
        <div class="text-sm text-gray-600 text-center">
          Cultural Archiver v1.0
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <main id="main-content" class="app-main" role="main">
      <RouterView />
    </main>

    <!-- Global Live Region for Screen Reader Announcements -->
    <LiveRegion />
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