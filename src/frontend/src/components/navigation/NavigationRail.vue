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

// Props
interface Props {
  isExpanded?: boolean;
  notificationCount?: number;
  isAuthenticated?: boolean;
  showNotifications?: boolean;
  userDisplayName?: string;
  userRole?: 'admin' | 'moderator' | 'user';
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
]);

// Role-based items matching NavigationDrawer
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

// All navigation items combined - removed as we handle them separately now

// Check if a route is active
const isRouteActive = (path: string): boolean => {
  if (path === '/' && route.path === '/') return true;
  if (path !== '/' && route.path.startsWith(path)) return true;
  return false;
};

// Events
interface Emits {
  'toggleExpanded': [];
  'notificationClick': [];
  'profileClick': [];
  'logoutClick': [];
  'loginClick': [];
}

const emit = defineEmits<Emits>();

// We only need a few props and emits for the bottom navigation look
// (most navigation routing is handled elsewhere).

// Handlers
const handleToggleExpanded = () => {
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
    class="hidden lg:flex flex-col bg-white border-r border-gray-200 shadow-lg h-screen fixed left-0 top-0 z-40 transition-all mr-4"
    :class="props.isExpanded ? 'w-80' : 'w-16'"
    role="navigation"
    aria-label="Navigation rail"
  >
    <!-- Top: Header with project title and expand/collapse controls -->
    <div v-if="props.isExpanded" class="flex-shrink-0 h-16 px-4 bg-blue-600 text-white flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="text-2xl flex-shrink-0" role="img" aria-label="Public Art Registry logo">🎨</div>
        <h2 class="text-lg font-semibold truncate">Public Art Registry</h2>
      </div>
      <button
        @click="handleToggleExpanded"
        class="flex items-center justify-center w-10 h-10 rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 transition-colors"
        aria-label="Collapse navigation"
        title="Collapse navigation"
      >
        <RectangleStackIcon class="w-6 h-6 transform rotate-180" aria-hidden="true" />
      </button>
    </div>
    
    <!-- Collapsed state: Just the expand button -->
    <div v-else class="flex items-center justify-center px-3 py-3 border-b">
      <button
        @click="handleToggleExpanded"
        class="flex items-center justify-center w-12 h-12 rounded-full hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        aria-label="Open navigation menu"
        title="Open navigation menu"
      >
        <RectangleStackIcon class="w-6 h-6 text-gray-700" aria-hidden="true" />
      </button>
    </div>

    <!-- Project description (only when expanded) -->
    <div v-if="props.isExpanded" class="p-4 border-b border-gray-200">
      <p class="text-sm text-gray-600 leading-relaxed">
        make culture accessible to everyone while preserving it for future generations
      </p>
      <router-link
        to="/help"
        class="mt-1 inline-block text-sm text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-colors"
      >
        Read More
      </router-link>
    </div>

    <!-- Navigation items -->
    <div class="flex-1 overflow-y-auto">
      <!-- Main navigation -->
      <div class="py-2">
        <ul class="space-y-1 px-2">
          <li v-for="item in navigationItems" :key="item.path">
            <router-link 
              :to="item.path"
              class="nav-item group flex items-center text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              :class="[
                props.isExpanded ? 'px-4 py-3' : 'px-2 py-2 justify-center',
                isRouteActive(item.path) 
                  ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700' 
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              ]"
              :title="item.description"
              :aria-current="isRouteActive(item.path) ? 'page' : undefined"
            >
              <component 
                :is="item.icon" 
                class="flex-shrink-0 w-6 h-6"
                :class="[
                  props.isExpanded ? 'mr-3' : '',
                  isRouteActive(item.path) 
                    ? 'text-blue-600' 
                    : 'text-gray-400 group-hover:text-gray-500'
                ]"
                aria-hidden="true" 
              />
              <span v-if="props.isExpanded" class="truncate">{{ item.name }}</span>
            </router-link>
          </li>
        </ul>
      </div>
      
      <!-- Role-based Items -->
      <div v-if="roleBasedItems.length > 0" class="py-2 border-t border-gray-200">
        <div v-if="props.isExpanded" class="px-4 py-2">
          <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Administration</h3>
        </div>
        <ul class="space-y-1 px-2">
          <li v-for="item in roleBasedItems" :key="item.path">
            <router-link
              :to="item.path"
              class="nav-item group flex items-center text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              :class="[
                props.isExpanded ? 'px-4 py-3' : 'px-2 py-2 justify-center',
                isRouteActive(item.path) 
                  ? 'bg-red-50 text-red-700 border-l-4 border-red-700' 
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              ]"
              :title="item.description"
              :aria-current="isRouteActive(item.path) ? 'page' : undefined"
            >
              <component
                :is="item.icon"
                class="flex-shrink-0 w-6 h-6"
                :class="[
                  props.isExpanded ? 'mr-3' : '',
                  isRouteActive(item.path) 
                    ? 'text-red-600' 
                    : 'text-gray-400 group-hover:text-gray-500'
                ]"
                aria-hidden="true"
              />
              <span v-if="props.isExpanded" class="truncate">{{ item.name }}</span>
            </router-link>
          </li>
        </ul>
      </div>
    </div>

    <!-- Footer Actions -->
    <div class="flex-shrink-0 border-t border-gray-200 p-2">
      <div class="space-y-1">
        <!-- Notifications -->
        <button
          v-if="props.showNotifications"
          @click="handleNotificationClick"
          class="w-full flex items-center text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
          :class="props.isExpanded ? 'px-4 py-3' : 'px-2 py-2 justify-center'"
          aria-label="View notifications"
        >
          <div class="relative flex-shrink-0">
            <BellIcon class="w-6 h-6 text-gray-400" :class="props.isExpanded ? 'mr-3' : ''" />
            <span
              v-if="props.notificationCount > 0"
              class="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full min-w-[18px] h-[18px] shadow-sm"
              :aria-label="`${props.notificationCount} unread notifications`"
            >
              {{ props.notificationCount > 99 ? '99+' : props.notificationCount }}
            </span>
          </div>
          <span v-if="props.isExpanded" class="truncate">Notifications</span>
        </button>

        <!-- Profile -->
        <button
          v-if="props.isAuthenticated"
          @click="handleProfileClick"
          class="w-full flex items-center text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
          :class="props.isExpanded ? 'px-4 py-3' : 'px-2 py-2 justify-center'"
        >
          <UserIcon class="flex-shrink-0 w-6 h-6 text-gray-400" :class="props.isExpanded ? 'mr-3' : ''" aria-hidden="true" />
          <span v-if="props.isExpanded" class="truncate">Profile</span>
        </button>

        <!-- Login -->
        <button
          v-else
          @click="handleLoginClick"
          class="w-full flex items-center text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
          :class="props.isExpanded ? 'px-4 py-3' : 'px-2 py-2 justify-center'"
          title="Login"
        >
          <ArrowRightOnRectangleIcon class="flex-shrink-0 w-6 h-6 text-gray-400" :class="props.isExpanded ? 'mr-3' : ''" aria-hidden="true" />
          <span v-if="props.isExpanded" class="truncate">Login</span>
        </button>

        <!-- Logout -->
        <button
          v-if="props.isAuthenticated"
          @click="handleLogoutClick"
          class="w-full flex items-center text-sm font-medium text-gray-700 rounded-lg hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200"
          :class="props.isExpanded ? 'px-4 py-3' : 'px-2 py-2 justify-center'"
        >
          <ArrowLeftOnRectangleIcon class="flex-shrink-0 w-6 h-6 text-gray-400" :class="props.isExpanded ? 'mr-3' : ''" aria-hidden="true" />
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