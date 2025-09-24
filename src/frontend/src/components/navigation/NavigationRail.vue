<script setup lang="ts">
import {
  RectangleStackIcon,
  BellIcon,
  UserIcon,
  ArrowRightOnRectangleIcon,
  PlusIcon,
} from '@heroicons/vue/24/outline';

// Props
interface Props {
  isExpanded?: boolean;
  notificationCount?: number;
  isAuthenticated?: boolean;
  userDisplayName?: string;
}

const props = withDefaults(defineProps<Props>(), {
  isExpanded: true,
  notificationCount: 0,
  isAuthenticated: false,
  userDisplayName: '',
});

// Events
interface Emits {
  'toggleExpanded': [];
  'notificationClick': [];
  'profileClick': [];
  'logoutClick': [];
  'loginClick': [];
  'fabClick': [];
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

const handleFabClick = () => {
  emit('fabClick');
};
</script>

<template>
  <!-- Render a bottom-style navigation bar on desktop to match mobile look -->
  <nav
    class="bottom-navigation fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-30"
    role="navigation"
    aria-label="Bottom navigation"
  >
    <div class="flex items-center justify-between h-16 px-4">
      <!-- Left: Menu / Toggle Button -->
      <button
        @click="handleToggleExpanded"
        class="flex items-center justify-center w-12 h-12 rounded-full hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
  :aria-label="props.isExpanded ? 'Collapse navigation' : 'Open navigation menu'"
  :title="props.isExpanded ? 'Collapse navigation' : 'Open navigation menu'"
      >
        <RectangleStackIcon class="w-6 h-6 text-gray-700" aria-hidden="true" />
      </button>

      <!-- Center: FAB -->
      <div class="relative">
        <button
          @click="handleFabClick"
          class="fab flex items-center justify-center w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transform hover:scale-105 active:scale-95 transition-all duration-200"
          aria-label="Add new artwork"
          title="Add new artwork"
        >
          <PlusIcon class="w-7 h-7" aria-hidden="true" />
        </button>
      </div>

      <!-- Right: Notifications / Profile -->
      <div class="flex items-center space-x-2">
        <button
          @click="handleNotificationClick"
          class="relative flex items-center justify-center w-12 h-12 rounded-full hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          aria-label="View notifications"
        >
          <BellIcon class="w-6 h-6 text-gray-700" aria-hidden="true" />
          <span
            v-if="(props.notificationCount ?? 0) > 0"
            class="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full min-w-[18px] h-[18px] shadow-sm"
            :aria-label="`${props.notificationCount ?? 0} unread notifications`"
          >
            {{ (notificationCount ?? 0) > 99 ? '99+' : (notificationCount ?? 0) }}
          </span>
        </button>

        <!-- Profile / Login -->
        <button
          v-if="props.isAuthenticated"
          @click="handleProfileClick"
          class="flex items-center justify-center w-12 h-12 rounded-full hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors px-3"
          :title="props.userDisplayName || 'Profile'"
        >
          <UserIcon class="w-6 h-6 text-gray-700" aria-hidden="true" />
        </button>

        <button
          v-else
          @click="handleLoginClick"
          class="flex items-center justify-center w-12 h-12 rounded-full hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          title="Login"
        >
          <ArrowRightOnRectangleIcon class="w-6 h-6 text-gray-700" aria-hidden="true" />
        </button>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.bottom-navigation {
  /* Ensure the bottom nav stays above other content but below modals */
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