<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import {
  RectangleStackIcon,
  MapIcon,
  PhotoIcon,
  UserGroupIcon,
  MagnifyingGlassIcon,
  BellIcon,
  UserIcon,
  ArrowLeftOnRectangleIcon,
  ArrowRightOnRectangleIcon,
  ShieldCheckIcon,
  ClipboardDocumentListIcon,
  QuestionMarkCircleIcon,
  PlusIcon,
} from '@heroicons/vue/24/outline';

// Props
interface Props {
  isExpanded?: boolean;
  currentRoute: string;
  userRole?: 'admin' | 'moderator' | 'user';
  notificationCount?: number;
  isAuthenticated?: boolean;
  userDisplayName?: string;
}

const props = withDefaults(defineProps<Props>(), {
  isExpanded: true,
  userRole: 'user',
  notificationCount: 0,
  isAuthenticated: false,
  userDisplayName: '',
});

// Events
interface Emits {
  'toggleExpanded': [];
  'searchSubmit': [query: string];
  'notificationClick': [];
  'profileClick': [];
  'logoutClick': [];
  'loginClick': [];
  'aboutModalOpen': [];
  'fabClick': [];
}

const emit = defineEmits<Emits>();

// Local state
const route = useRoute();

// Computed
const railClasses = computed(() => ({
  'w-80': props.isExpanded,
  'w-16': !props.isExpanded,
  'transition-all duration-300 ease-in-out': true,
}));

// Navigation items - moved search to top and restructured
const navigationItems = computed(() => [
  {
    name: 'Search',
    path: '/search',
    icon: MagnifyingGlassIcon,
    description: 'Search artworks and artists',
  },
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
    name: 'Help',
    path: '/help',
    icon: QuestionMarkCircleIcon,
    description: 'Get help and support',
  },
]);

// Role-based items
const roleBasedItems = computed(() => {
  const items = [];
  if (props.userRole === 'admin') {
    items.push({
      name: 'Admin',
      path: '/admin',
      icon: ShieldCheckIcon,
      description: 'Admin dashboard',
    });
  }
  if (props.userRole === 'admin' || props.userRole === 'moderator') {
    items.push({
      name: 'Moderate',
      path: '/review',
      icon: ClipboardDocumentListIcon,
      description: 'Review submissions',
    });
  }
  return items;
});

// Check if a route is active
const isActiveRoute = (path: string) => {
  if (path === '/') {
    return route.path === '/';
  }
  return route.path.startsWith(path);
};

// Handlers
const handleToggleExpanded = () => {
  emit('toggleExpanded');
};

const handleNotificationClick = () => {
  emit('notificationClick');
};

const handleProfileClick = () => {
  emit('profileClick');
};

const handleLogoutClick = () => {
  emit('logoutClick');
};

const handleLoginClick = () => {
  emit('loginClick');
};

const handleAboutModalOpen = () => {
  emit('aboutModalOpen');
};

const handleFabClick = () => {
  emit('fabClick');
};
</script>

<template>
  <nav
    class="navigation-rail fixed left-0 top-0 h-full bg-white shadow-lg border-r border-gray-200 flex flex-col z-30"
    :class="railClasses"
    role="navigation"
    aria-label="Main navigation"
  >
    <!-- Header Section with Blue Background and Close Button -->
    <div class="flex-shrink-0 bg-blue-600 text-white p-4 relative">
      <!-- Close/Collapse Button in Top Right -->
      <button
        v-if="isExpanded"
        @click="handleToggleExpanded"
        class="absolute top-2 right-2 p-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 transition-colors"
        :title="'Collapse navigation'"
      >
        <RectangleStackIcon class="w-5 h-5" aria-hidden="true" />
        <span class="sr-only">Collapse navigation</span>
      </button>

      <div class="flex items-center space-x-3" :class="{ 'justify-center': !isExpanded }">
        <!-- Logo -->
        <div class="text-2xl flex-shrink-0" role="img" aria-label="Public Art Registry logo">🎨</div>
        
        <!-- App Name (only when expanded) -->
        <div v-if="isExpanded" class="min-w-0 pr-8">
          <h1 class="text-lg font-semibold truncate">Public Art Registry</h1>
        </div>
      </div>
      
      <!-- Mission Statement (only when expanded) -->
      <div v-if="isExpanded" class="mt-3">
        <p class="text-sm text-blue-100 leading-relaxed">
          Public art is fragile. Murals fade, sculptures crumble, stories vanish. If no one honors them, they are lost — forever.
        </p>
        <p class="text-sm text-blue-100 leading-relaxed mt-2">
          By preserving artworks and committing them to this archive, you safeguard our shared cultural story — a legacy of memory and meaning for generations yet to come.
        </p>
        <p class="text-sm text-blue-100 leading-relaxed mt-2">
          This is your chance to protect what matters. To give the future the legacy of memory.
        </p>
        <button
          @click="handleAboutModalOpen"
          class="mt-2 text-sm text-blue-200 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-1 focus:ring-offset-blue-600 rounded transition-colors"
        >
          Read More
        </button>
      </div>

      <!-- Expand Button (only when collapsed) -->
      <button
        v-if="!isExpanded"
        @click="handleToggleExpanded"
        class="absolute top-2 right-2 p-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 transition-colors"
        :title="'Expand navigation'"
      >
        <RectangleStackIcon class="w-5 h-5" aria-hidden="true" />
        <span class="sr-only">Expand navigation</span>
      </button>
    </div>

    <!-- Navigation Links -->
    <div class="flex-1 py-4 overflow-y-auto">
      <ul class="space-y-1 px-2">
        <li v-for="item in navigationItems" :key="item.path">
          <RouterLink
            :to="item.path"
            class="nav-item group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            :class="{
              'bg-blue-50 text-blue-700 border-l-4 border-blue-700': isActiveRoute(item.path),
              'text-gray-700 hover:bg-gray-50 hover:text-gray-900': !isActiveRoute(item.path),
              'justify-center': !isExpanded,
            }"
            :aria-current="isActiveRoute(item.path) ? 'page' : undefined"
            :title="!isExpanded ? item.name : undefined"
          >
            <component
              :is="item.icon"
              class="flex-shrink-0 w-6 h-6"
              :class="{
                'text-blue-600': isActiveRoute(item.path),
                'text-gray-400 group-hover:text-gray-500': !isActiveRoute(item.path),
              }"
              aria-hidden="true"
            />
            <span v-if="isExpanded" class="ml-3 truncate">{{ item.name }}</span>
            <span v-if="!isExpanded" class="sr-only">{{ item.name }}</span>
          </RouterLink>
        </li>
      </ul>

      <!-- Role-based Items -->
      <div v-if="roleBasedItems.length > 0" class="mt-6 px-2">
        <div v-if="isExpanded" class="px-3 py-2">
          <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Administration</h3>
        </div>
        <ul class="space-y-1" :class="{ 'mt-2': !isExpanded }">
          <li v-for="item in roleBasedItems" :key="item.path">
            <RouterLink
              :to="item.path"
              class="nav-item group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              :class="{
                'bg-red-50 text-red-700 border-l-4 border-red-700': isActiveRoute(item.path),
                'text-gray-700 hover:bg-gray-50 hover:text-gray-900': !isActiveRoute(item.path),
                'justify-center': !isExpanded,
              }"
              :aria-current="isActiveRoute(item.path) ? 'page' : undefined"
              :title="!isExpanded ? item.name : undefined"
            >
              <component
                :is="item.icon"
                class="flex-shrink-0 w-6 h-6"
                :class="{
                  'text-red-600': isActiveRoute(item.path),
                  'text-gray-400 group-hover:text-gray-500': !isActiveRoute(item.path),
                }"
                aria-hidden="true"
              />
              <span v-if="isExpanded" class="ml-3 truncate">{{ item.name }}</span>
              <span v-if="!isExpanded" class="sr-only">{{ item.name }}</span>
            </RouterLink>
          </li>
        </ul>
      </div>
    </div>

    <!-- Bottom Actions -->
    <div class="flex-shrink-0 border-t border-gray-200 p-2">
      <div class="space-y-1">
        <!-- Notifications -->
        <button
          @click="handleNotificationClick"
          class="nav-item group w-full flex items-center px-3 py-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
          :class="{ 'justify-center': !isExpanded }"
        >
          <div class="relative flex-shrink-0">
            <BellIcon class="w-6 h-6 text-gray-400 group-hover:text-gray-500" aria-hidden="true" />
            <span
              v-if="(notificationCount ?? 0) > 0"
              class="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full min-w-[18px] h-[18px]"
            >
              {{ (notificationCount ?? 0) > 99 ? '99+' : (notificationCount ?? 0) }}
            </span>
          </div>
          <span v-if="isExpanded" class="ml-3 truncate">Notifications</span>
          <span v-if="!isExpanded" class="sr-only">Notifications</span>
        </button>

        <!-- Profile or Login -->
        <button
          v-if="isAuthenticated"
          @click="handleProfileClick"
          class="nav-item group w-full flex items-center px-3 py-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
          :class="{ 'justify-center': !isExpanded }"
        >
          <UserIcon class="flex-shrink-0 w-6 h-6 text-gray-400 group-hover:text-gray-500" aria-hidden="true" />
          <span v-if="isExpanded" class="ml-3 truncate">
            {{ userDisplayName || 'Profile' }}
          </span>
          <span v-if="!isExpanded" class="sr-only">{{ userDisplayName || 'Profile' }}</span>
        </button>

        <button
          v-else
          @click="handleLoginClick"
          class="nav-item group w-full flex items-center px-3 py-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
          :class="{ 'justify-center': !isExpanded }"
        >
          <ArrowRightOnRectangleIcon class="flex-shrink-0 w-6 h-6 text-gray-400 group-hover:text-blue-500" aria-hidden="true" />
          <span v-if="isExpanded" class="ml-3 truncate">Login</span>
          <span v-if="!isExpanded" class="sr-only">Login</span>
        </button>

        <!-- Logout (only when authenticated) -->
        <button
          v-if="isAuthenticated"
          @click="handleLogoutClick"
          class="nav-item group w-full flex items-center px-3 py-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200"
          :class="{ 'justify-center': !isExpanded }"
        >
          <ArrowLeftOnRectangleIcon class="flex-shrink-0 w-6 h-6 text-gray-400 group-hover:text-red-500" aria-hidden="true" />
          <span v-if="isExpanded" class="ml-3 truncate">Logout</span>
          <span v-if="!isExpanded" class="sr-only">Logout</span>
        </button>
      </div>
    </div>

    <!-- Floating Action Button (FAB) - Desktop -->
    <div class="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
      <button
        @click="handleFabClick"
        class="bg-blue-600 hover:bg-blue-700 focus:bg-blue-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
        aria-label="Add new artwork"
        title="Add new artwork"
      >
        <PlusIcon class="w-6 h-6" aria-hidden="true" />
      </button>
    </div>
  </nav>
</template>

<style scoped>
.navigation-rail {
  /* Ensure the rail stays above other content but below modals */
  z-index: 30;
}

/* Active state styling with Material Design 3 principles */
.nav-item.router-link-active {
  background-color: rgb(239 246 255);
  color: rgb(29 78 216);
}

.nav-item.router-link-active .heroicon {
  color: rgb(37 99 235);
}

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

/* Custom scrollbar for the navigation area */
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