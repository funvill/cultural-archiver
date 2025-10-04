<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import {
  RectangleStackIcon,
  MapIcon,
  PhotoIcon,
  UserGroupIcon,
  MagnifyingGlassIcon,
  QuestionMarkCircleIcon,
  ShieldCheckIcon,
  ClipboardDocumentListIcon,
  BellIcon,
  UserIcon,
  ArrowRightOnRectangleIcon,
  ArrowLeftOnRectangleIcon,
} from '@heroicons/vue/24/outline';

// Auth prop interface
interface AuthProp {
  isAuthenticated?: boolean;
  userDisplayName?: string;
  userRole?: 'admin' | 'moderator' | 'user';
}

// Props
interface Props {
  isExpanded?: boolean;
  notificationCount?: number;
  showNotifications?: boolean;
  // Legacy props for backward compatibility
  isAuthenticated?: boolean;
  userDisplayName?: string;
  userRole?: 'admin' | 'moderator' | 'user';
  // New consolidated auth prop
  auth?: AuthProp;
}

const props = withDefaults(defineProps<Props>(), {
  isExpanded: true,
  notificationCount: 0,
  showNotifications: true,
  isAuthenticated: false,
  userDisplayName: '',
  userRole: 'user',
});

const route = useRoute();

// Computed auth helpers with fallbacks to legacy props
const authIsAuthenticated = computed(() => {
  if (props.auth && typeof props.auth.isAuthenticated === 'boolean') return props.auth.isAuthenticated;
  return props.isAuthenticated ?? false;
});

const authUserRole = computed(() => {
  if (props.auth && props.auth.userRole) return props.auth.userRole;
  return props.userRole ?? 'user';
});

// Navigation items matching NavigationDrawer
const navigationItems = computed(() => [
  {
    name: 'Map',
    path: '/',
    icon: MapIcon,
    description: 'Explore artwork on the map',
  },
  {
    name: 'Artworks',
    path: '/artworks',
    icon: PhotoIcon,
    description: 'Browse all artworks',
  },
  {
    name: 'Artists',
    path: '/artists',
    icon: UserGroupIcon,
    description: 'Discover artists',
  },

  {
    name: 'Search',
    path: '/search',
    icon: MagnifyingGlassIcon,
    description: 'Search artworks and artists',
  },
  {
    name: 'Help',
    path: '/help',
    icon: QuestionMarkCircleIcon,
    description: 'Help',
  }, 
  {
    name: 'Pages',
    path: '/pages',
    icon: RectangleStackIcon,
    description: 'Browse pages and guides',
  },
]);

// Role-based items matching NavigationDrawer
const roleBasedItems = computed(() => {
  const items = [];
  if (authUserRole.value === 'admin') {
    items.push({
      name: 'Admin',
      path: '/admin',
      icon: ShieldCheckIcon,
      description: 'Admin dashboard',
    });
  }
  if (authUserRole.value === 'admin' || authUserRole.value === 'moderator') {
    items.push({
      name: 'Moderate',
      path: '/review',
      icon: ClipboardDocumentListIcon,
      description: 'Review submissions',
    });
  }
  return items;
});

// All navigation items combined - removed as we handle them separately now

// Check if a route is active
const isRouteActive = (path: string): boolean => {
  if (path === '/' && route.path === '/') return true;
  if (path !== '/' && route.path.startsWith(path)) return true;
  return false;
};

// Events
const emit = defineEmits([
  'toggleExpanded',
  'notificationClick',
  'profileClick',
  'logoutClick',
  'loginClick',
]);

// We only need a few props and emits for the bottom navigation look
// (most navigation routing is handled elsewhere).

// Handlers
const handleToggleExpanded = () => {
  emit('toggleExpanded');
};

// Toggle when clicking on the rail background (white space). We need to
// ignore clicks on interactive elements such as buttons, links, inputs, and
// SVG icons so we don't interfere with normal behaviour.
const handleRailBackgroundClick = (evt: MouseEvent) => {
  const target = evt.target as HTMLElement | null;
  if (!target) return;

  // Walk up the DOM tree to see if the click happened inside an interactive
  // element that we should ignore.
  let el: HTMLElement | null = target;
  while (el && el !== (evt.currentTarget as HTMLElement)) {
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute && el.getAttribute('role');
    const isInteractive = (
      tag === 'button' ||
      tag === 'a' ||
      tag === 'input' ||
      tag === 'select' ||
      tag === 'textarea' ||
      el.closest && el.closest('[tabindex]') ||
      (role && ['button', 'link', 'menuitem'].includes(role))
    );
    if (isInteractive) return; // ignore
    el = el.parentElement;
  }

  // If we reached here, it means the click wasn't on an interactive child,
  // so toggle the rail.
  emit('toggleExpanded');
};

const handleNotificationClick = () => emit('notificationClick');
const handleProfileClick = () => emit('profileClick');
const handleLoginClick = () => emit('loginClick');
const handleLogoutClick = () => emit('logoutClick');
</script>

<template>
  <!-- Desktop: left-side Navigation Rail -->
  <aside
    class="hidden lg:flex flex-col theme-surface theme-nav-border shadow-lg h-screen fixed left-0 top-0 z-40 transition-all mr-4"
    :class="props.isExpanded ? 'w-80' : 'w-16'" role="navigation" aria-label="Navigation rail"
    @click="handleRailBackgroundClick">
    <!-- Top: Header with project title and expand/collapse controls -->
    <div v-if="props.isExpanded"
      class="flex-shrink-0 h-16 px-4 theme-primary theme-on-primary flex items-center justify-between">
      <div class="flex items-center space-x-3">
          <div class="flex-shrink-0" role="img" aria-label="Public Art Registry logo">
            <!-- External SVG asset used via <img> so the logo can be updated centrally -->
            <img src="/assets/logo-pin-brush.svg" alt="Public Art Registry" width="36" height="36" class="block" style="--pin-stroke:#000000; --inner:#000000; --handle:#000000; --ferrule:#000000; --bristle:#000000;" />
          </div>
        <h2 class="text-lg font-semibold truncate">Public Art Registry</h2>
      </div>
      <button @click="handleToggleExpanded"
        class="flex items-center justify-center w-10 h-10 rounded-full focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 transition-colors theme-nav-icon-hover"
        aria-label="Collapse navigation" title="Collapse navigation">
        <RectangleStackIcon class="w-6 h-6 transform rotate-180" aria-hidden="true" />
      </button>
    </div>

    <!-- Collapsed state: Just the expand button -->
    <div v-else class="flex items-center justify-center px-3 py-3 theme-nav-border">
      <button @click="handleToggleExpanded"
        class="flex items-center justify-center w-12 h-12 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors theme-nav-icon-hover"
        aria-label="Open navigation menu" title="Open navigation menu">
        <RectangleStackIcon class="w-6 h-6 theme-text-muted" aria-hidden="true" />
      </button>
    </div>
    <!-- Navigation items -->
    <div class="flex-1 overflow-y-auto">
      <!-- Main navigation -->
      <div class="py-2">
        <ul class="space-y-1 px-2">
          <li v-for="item in navigationItems" :key="item.path">
            <router-link :to="item.path"
              class="nav-item group flex items-center text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              :class="[
                props.isExpanded ? 'px-4 py-3' : 'px-2 py-2 justify-center',
                isRouteActive(item.path)
                  ? 'theme-nav-active-background theme-nav-active border-l-4 theme-nav-border'
                  : 'theme-text-muted theme-hover-background'
              ]" :title="item.description" :aria-current="isRouteActive(item.path) ? 'page' : undefined">
              <component :is="item.icon" class="flex-shrink-0 w-6 h-6 theme-nav-icon-hover" :class="[
                props.isExpanded ? 'mr-3' : '',
                isRouteActive(item.path)
                  ? 'theme-nav-active'
                  : 'theme-text-subtle'
              ]" aria-hidden="true" />
              <span v-if="props.isExpanded" class="truncate">{{ item.name }}</span>
            </router-link>
          </li>
        </ul>
      </div>

      <!-- Role-based Items -->
      <div v-if="roleBasedItems.length > 0" class="py-2 theme-nav-border">
        <div v-if="props.isExpanded" class="px-4 py-2">
          <h3 class="text-xs font-semibold theme-text-subtle uppercase tracking-wider">Administration</h3>
        </div>
        <ul class="space-y-1 px-2">
          <li v-for="item in roleBasedItems" :key="item.path">
            <router-link :to="item.path"
              class="nav-item group flex items-center text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              :class="[
                props.isExpanded ? 'px-4 py-3' : 'px-2 py-2 justify-center',
                isRouteActive(item.path)
                  ? 'theme-error theme-on-error border-l-4 theme-nav-border'
                  : 'theme-text-muted theme-hover-background'
              ]" :title="item.description" :aria-current="isRouteActive(item.path) ? 'page' : undefined">
              <component :is="item.icon" class="flex-shrink-0 w-6 h-6 theme-nav-icon-hover" :class="[
                props.isExpanded ? 'mr-3' : '',
                isRouteActive(item.path)
                  ? 'theme-on-error'
                  : 'theme-text-subtle'
              ]" aria-hidden="true" />
              <span v-if="props.isExpanded" class="truncate">{{ item.name }}</span>
            </router-link>
          </li>
        </ul>
      </div>
    </div>

    <!-- Footer Actions -->
    <div class="flex-shrink-0 theme-nav-border p-2">
      <div class="space-y-1">
        <!-- Notifications -->
        <button v-if="props.showNotifications" @click="handleNotificationClick"
          class="w-full flex items-center text-sm font-medium theme-text-muted rounded-lg theme-hover-background focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 group"
          :class="props.isExpanded ? 'px-4 py-3' : 'px-2 py-2 justify-center'" aria-label="View notifications">
          <div class="relative flex-shrink-0">
            <BellIcon class="w-6 h-6 theme-text-subtle theme-nav-icon-hover" :class="props.isExpanded ? 'mr-3' : ''" />
            <span v-if="props.notificationCount > 0"
              class="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none theme-on-error theme-error rounded-full min-w-[18px] h-[18px] shadow-sm"
              :aria-label="`${props.notificationCount} unread notifications`">
              {{ props.notificationCount > 99 ? '99+' : props.notificationCount }}
            </span>
          </div>
          <span v-if="props.isExpanded" class="truncate">Notifications</span>
        </button>

        <!-- Profile -->
        <button v-if="authIsAuthenticated" @click="handleProfileClick"
          class="w-full flex items-center text-sm font-medium theme-text-muted rounded-lg theme-hover-background focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 group"
          :class="props.isExpanded ? 'px-4 py-3' : 'px-2 py-2 justify-center'">
          <UserIcon class="flex-shrink-0 w-6 h-6 theme-text-subtle theme-nav-icon-hover"
            :class="props.isExpanded ? 'mr-3' : ''" aria-hidden="true" />
          <span v-if="props.isExpanded" class="truncate">Profile</span>
        </button>

        <!-- Login -->
        <button v-else @click="handleLoginClick"
          class="w-full flex items-center text-sm font-medium theme-text-muted rounded-lg theme-hover-background focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 group"
          :class="props.isExpanded ? 'px-4 py-3' : 'px-2 py-2 justify-center'" title="Login">
          <ArrowRightOnRectangleIcon class="flex-shrink-0 w-6 h-6 theme-text-subtle theme-nav-icon-hover"
            :class="props.isExpanded ? 'mr-3' : ''" aria-hidden="true" />
          <span v-if="props.isExpanded" class="truncate">Login</span>
        </button>

        <!-- Logout -->
        <button v-if="authIsAuthenticated" @click="handleLogoutClick"
          class="w-full flex items-center text-sm font-medium theme-text-muted rounded-lg hover:theme-error hover:theme-on-error focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200 group"
          :class="props.isExpanded ? 'px-4 py-3' : 'px-2 py-2 justify-center'">
          <ArrowLeftOnRectangleIcon class="flex-shrink-0 w-6 h-6 theme-text-subtle theme-nav-icon-hover"
            :class="props.isExpanded ? 'mr-3' : ''" aria-hidden="true" />
          <span v-if="props.isExpanded" class="truncate">Logout</span>
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.bottom-navigation {
  /* Ensure the bottom nav stays above other content but below modals */
  z-index: 30;
}

/* Active state styling matching NavigationDrawer */
.nav-item:focus-visible {
  outline: 2px solid rgb(59 130 246);
  outline-offset: 2px;
}

/* Remove old router-link-active styles */

/* Smooth transitions for expand/collapse */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 300ms;
}

/* Focus ring improvements for better accessibility */
.nav-item:focus-visible {
  outline: 2px solid rgb(59 130 246);
  outline-offset: 2px;
}

/* Custom scrollbar matching NavigationDrawer */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* Notification badge positioning */
.relative .absolute {
  transform: translate(50%, -50%);
}

/* Input search styling */
input[type="search"]::-webkit-search-decoration,
input[type="search"]::-webkit-search-cancel-button,
input[type="search"]::-webkit-search-results-button,
input[type="search"]::-webkit-search-results-decoration {
  -webkit-appearance: none;
}
</style>