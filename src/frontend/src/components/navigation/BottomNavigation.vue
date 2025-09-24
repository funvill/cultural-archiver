<script setup lang="ts">
import { computed } from 'vue';
import {
  Bars3Icon,
  BellIcon,
  PlusIcon,
} from '@heroicons/vue/24/outline';

// Props
interface Props {
  currentRoute: string;
  notificationCount?: number;
  showNotifications?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  notificationCount: 0,
  showNotifications: true,
});

// Events
interface Emits {
  'menuToggle': [];
  'notificationClick': [];
  'fabClick': [];
}

const emit = defineEmits<Emits>();

// Handlers
const handleMenuToggle = (): void => {
  emit('menuToggle');
};

const handleNotificationClick = (): void => {
  emit('notificationClick');
};

const handleFabClick = (): void => {
  emit('fabClick');
};

// Computed
const hasNotifications = computed(() => props.notificationCount > 0);
</script>

<template>
  <nav
    class="bottom-navigation fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-30"
    role="navigation"
    aria-label="Bottom navigation"
  >
    <div class="flex items-center justify-between h-16 px-4">
      <!-- Left: Menu Button -->
      <button
        @click="handleMenuToggle"
        class="flex items-center justify-center w-12 h-12 rounded-full hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        aria-label="Open navigation menu"
        aria-expanded="false"
      >
        <Bars3Icon class="w-6 h-6 text-gray-700" aria-hidden="true" />
      </button>

      <!-- Center: FAB (Floating Action Button) -->
      <div class="relative">
        <button
          @click="handleFabClick"
          class="fab flex items-center justify-center w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transform hover:scale-105 active:scale-95 transition-all duration-200"
          aria-label="Submit new artwork"
        >
          <PlusIcon class="w-7 h-7" aria-hidden="true" />
        </button>
      </div>

      <!-- Right: Notifications Button -->
      <button
        v-if="showNotifications"
        @click="handleNotificationClick"
        class="relative flex items-center justify-center w-12 h-12 rounded-full hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        aria-label="View notifications"
      >
        <BellIcon class="w-6 h-6 text-gray-700" aria-hidden="true" />
        <!-- Notification Badge -->
        <span
          v-if="hasNotifications"
          class="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full min-w-[18px] h-[18px] shadow-sm"
          :aria-label="`${notificationCount ?? 0} unread notifications`"
        >
          {{ (notificationCount ?? 0) > 99 ? '99+' : (notificationCount ?? 0) }}
        </span>
      </button>

      <!-- Spacer if notifications are hidden -->
      <div v-else class="w-12 h-12"></div>
    </div>
  </nav>
</template>

<style scoped>
.bottom-navigation {
  /* Ensure the bottom nav stays above other content but below modals */
  z-index: 30;
}

/* FAB elevation and animation */
.fab {
  box-shadow: 
    0px 6px 10px 0px rgba(0, 0, 0, 0.14),
    0px 1px 18px 0px rgba(0, 0, 0, 0.12),
    0px 3px 5px -1px rgba(0, 0, 0, 0.20);
}

.fab:hover {
  box-shadow: 
    0px 8px 14px 0px rgba(0, 0, 0, 0.16),
    0px 2px 24px 0px rgba(0, 0, 0, 0.14),
    0px 4px 8px -1px rgba(0, 0, 0, 0.24);
}

/* Smooth transitions */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 200ms;
}

/* Focus improvements for accessibility */
button:focus-visible {
  outline: 2px solid rgb(59 130 246);
  outline-offset: 2px;
}

/* Notification badge positioning */
.relative .absolute {
  transform: translate(50%, -50%);
}

/* Safe area handling for devices with notches */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .bottom-navigation {
    padding-bottom: env(safe-area-inset-bottom);
  }
}

/* Prevent body scroll when navigation is active on mobile */
body.mobile-nav-open {
  overflow: hidden;
}
</style>