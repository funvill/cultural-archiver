<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import {
  XMarkIcon,
  MapIcon,
  PhotoIcon,
  UserGroupIcon,
  MagnifyingGlassIcon,
  UserIcon,
  ArrowLeftOnRectangleIcon,
  ShieldCheckIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/vue/24/outline';

// Props
interface Props {
  isOpen: boolean;
  currentRoute: string;
  userRole?: 'admin' | 'moderator' | 'user';
}

const props = withDefaults(defineProps<Props>(), {
  userRole: 'user',
});

// Events
interface Emits {
  'update:isOpen': [value: boolean];
  'searchSubmit': [query: string];
  'profileClick': [];
  'logoutClick': [];
  'aboutModalOpen': [];
}

const emit = defineEmits<Emits>();

// Local state
const searchQuery = ref('');
const route = useRoute();
const drawerRef = ref<HTMLElement>();
const closeButtonRef = ref<HTMLElement>();

// Navigation items (excluding Add since it's in the FAB)
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
const handleClose = (): void => {
  emit('update:isOpen', false);
};

const handleOverlayClick = (): void => {
  handleClose();
};

const handleSearch = (): void => {
  if (searchQuery.value.trim()) {
    emit('searchSubmit', searchQuery.value.trim());
    searchQuery.value = '';
    handleClose();
  }
};

const handleNavItemClick = (): void => {
  // Close drawer when navigation item is clicked
  handleClose();
};

const handleProfileClick = (): void => {
  emit('profileClick');
  handleClose();
};

const handleLogoutClick = (): void => {
  emit('logoutClick');
  handleClose();
};

const handleAboutModalOpen = (): void => {
  emit('aboutModalOpen');
  handleClose();
};

// Keyboard navigation
const handleKeyDown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    handleClose();
  }
};

// Focus management
const handleFocusManagement = (): void => {
  if (props.isOpen) {
    // Focus the close button when drawer opens
    nextTick(() => {
      closeButtonRef.value?.focus();
    });
  }
};

// Watch for open/close changes
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    handleFocusManagement();
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
  } else {
    // Restore body scroll
    document.body.style.overflow = '';
    document.removeEventListener('keydown', handleKeyDown);
  }
});

// Cleanup on unmount
onUnmounted(() => {
  document.body.style.overflow = '';
  document.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <!-- Overlay -->
  <Transition name="overlay">
    <div
      v-if="isOpen"
      class="fixed inset-0 bg-black bg-opacity-50 z-40"
      @click="handleOverlayClick"
      aria-hidden="true"
    />
  </Transition>

  <!-- Drawer -->
  <Transition name="drawer">
    <nav
      v-if="isOpen"
      ref="drawerRef"
      class="navigation-drawer fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-white shadow-xl z-50 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      <!-- Header -->
      <div class="flex-shrink-0 flex items-center justify-between h-16 px-4 bg-blue-600 text-white">
        <div class="flex items-center space-x-3">
          <div class="text-2xl flex-shrink-0" role="img" aria-label="Public Art Registry logo">🎨</div>
          <h2 id="drawer-title" class="text-lg font-semibold truncate">Public Art Registry</h2>
        </div>
        <button
          ref="closeButtonRef"
          @click="handleClose"
          class="flex items-center justify-center w-10 h-10 rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 transition-colors"
          aria-label="Close navigation menu"
        >
          <XMarkIcon class="w-6 h-6" aria-hidden="true" />
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto">
        <!-- Introduction -->
        <div class="p-4 border-b border-gray-200">
          <p class="text-sm text-gray-600 leading-relaxed">
            Welcome to the Public Art Registry!
          </p>
          <button
            @click="handleAboutModalOpen"
            class="mt-1 text-sm text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-colors"
          >
            Read More
          </button>
        </div>

        <!-- Search Section -->
        <div class="p-4 border-b border-gray-200">
          <label for="drawer-search" class="sr-only">Search</label>
          <div class="relative">
            <MagnifyingGlassIcon
              class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              aria-hidden="true"
            />
            <input
              id="drawer-search"
              v-model="searchQuery"
              type="search"
              placeholder="Search artworks, artists..."
              class="w-full pl-10 pr-16 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              @keydown.enter="handleSearch"
            />
            <button
              v-if="searchQuery.trim()"
              @click="handleSearch"
              class="absolute right-2 top-1/2 transform -translate-y-1/2 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
            >
              Go
            </button>
          </div>
        </div>

        <!-- Navigation Items -->
        <div class="py-2">
          <ul class="space-y-1 px-2">
            <li v-for="item in navigationItems" :key="item.path">
              <RouterLink
                :to="item.path"
                class="nav-item group flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                :class="{
                  'bg-blue-50 text-blue-700 border-l-4 border-blue-700': isActiveRoute(item.path),
                  'text-gray-700 hover:bg-gray-50 hover:text-gray-900': !isActiveRoute(item.path),
                }"
                :aria-current="isActiveRoute(item.path) ? 'page' : undefined"
                @click="handleNavItemClick"
              >
                <component
                  :is="item.icon"
                  class="flex-shrink-0 w-6 h-6 mr-3"
                  :class="{
                    'text-blue-600': isActiveRoute(item.path),
                    'text-gray-400 group-hover:text-gray-500': !isActiveRoute(item.path),
                  }"
                  aria-hidden="true"
                />
                <span class="truncate">{{ item.name }}</span>
              </RouterLink>
            </li>
          </ul>
        </div>

        <!-- Role-based Items -->
        <div v-if="roleBasedItems.length > 0" class="py-2 border-t border-gray-200">
          <div class="px-4 py-2">
            <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Administration</h3>
          </div>
          <ul class="space-y-1 px-2">
            <li v-for="item in roleBasedItems" :key="item.path">
              <RouterLink
                :to="item.path"
                class="nav-item group flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                :class="{
                  'bg-red-50 text-red-700 border-l-4 border-red-700': isActiveRoute(item.path),
                  'text-gray-700 hover:bg-gray-50 hover:text-gray-900': !isActiveRoute(item.path),
                }"
                :aria-current="isActiveRoute(item.path) ? 'page' : undefined"
                @click="handleNavItemClick"
              >
                <component
                  :is="item.icon"
                  class="flex-shrink-0 w-6 h-6 mr-3"
                  :class="{
                    'text-red-600': isActiveRoute(item.path),
                    'text-gray-400 group-hover:text-gray-500': !isActiveRoute(item.path),
                  }"
                  aria-hidden="true"
                />
                <span class="truncate">{{ item.name }}</span>
              </RouterLink>
            </li>
          </ul>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="flex-shrink-0 border-t border-gray-200 p-2">
        <div class="space-y-1">
          <!-- Profile -->
          <button
            @click="handleProfileClick"
            class="w-full flex items-center px-4 py-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
          >
            <UserIcon class="flex-shrink-0 w-6 h-6 mr-3 text-gray-400" aria-hidden="true" />
            <span class="truncate">Profile</span>
          </button>

          <!-- Logout -->
          <button
            @click="handleLogoutClick"
            class="w-full flex items-center px-4 py-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200"
          >
            <ArrowLeftOnRectangleIcon class="flex-shrink-0 w-6 h-6 mr-3 text-gray-400" aria-hidden="true" />
            <span class="truncate">Logout</span>
          </button>
        </div>
      </div>
    </nav>
  </Transition>
</template>

<style scoped>
/* Overlay transitions */
.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

.overlay-enter-to,
.overlay-leave-from {
  opacity: 1;
}

/* Drawer transitions */
.drawer-enter-active,
.drawer-leave-active {
  transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(-100%);
}

.drawer-enter-to,
.drawer-leave-from {
  transform: translateX(0);
}

/* Navigation item styling */
.nav-item {
  transition: all 0.2s ease-in-out;
}

.nav-item:focus-visible {
  outline: 2px solid rgb(59 130 246);
  outline-offset: 2px;
}

/* Smooth transitions */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 200ms;
}

/* Custom scrollbar */
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

/* Input search styling */
input[type="search"]::-webkit-search-decoration,
input[type="search"]::-webkit-search-cancel-button,
input[type="search"]::-webkit-search-results-button,
input[type="search"]::-webkit-search-results-decoration {
  -webkit-appearance: none;
}

/* Z-index management */
.navigation-drawer {
  z-index: 50;
}
</style>