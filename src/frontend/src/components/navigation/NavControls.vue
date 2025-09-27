<script setup lang="ts">
import { computed } from 'vue';
import { Bars3Icon, BellIcon, CameraIcon, UserIcon, ArrowRightOnRectangleIcon, MapIcon } from '@heroicons/vue/24/outline';

interface Props {
  orientation?: 'horizontal' | 'vertical';
  notificationCount?: number;
  showNotifications?: boolean;
  isAuthenticated?: boolean;
  userDisplayName?: string;
}

const props = withDefaults(defineProps<Props>(), {
  orientation: 'horizontal',
  notificationCount: 0,
  showNotifications: true,
  isAuthenticated: false,
  userDisplayName: '',
});

interface Emits {
  'menuToggle': [];
  'notificationClick': [];
  'fabClick': [];
  'profileClick': [];
  'loginClick': [];
  'mapClick': [];
}

const emit = defineEmits<Emits>();

const hasNotifications = computed(() => (props.notificationCount ?? 0) > 0);

const handleMenuToggle = () => emit('menuToggle');
const handleNotificationClick = () => emit('notificationClick');
const handleFabClick = () => emit('fabClick');
const handleProfileClick = () => emit('profileClick');
const handleLoginClick = () => emit('loginClick');
const handleMapClick = () => emit('mapClick');
</script>

<template>
  <div v-if="props.orientation === 'horizontal'" class="flex items-center justify-between h-16 px-4">
    <!-- Left: Menu Button (hidden on large screens) -->
    <button
      @click="handleMenuToggle"
      class="lg:hidden flex items-center justify-center w-12 h-12 rounded-full hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
      aria-label="Open navigation menu"
    >
      <Bars3Icon class="w-6 h-6 text-gray-700" aria-hidden="true" />
    </button>
    
    <!-- Left spacer for large screens to keep FAB centered -->
    <div class="hidden lg:block w-12 h-12"></div>

    <!-- Center: FAB -->
    <div class="relative">
      <button
        @click="handleFabClick"
        class="fab flex items-center justify-center w-14 h-14 theme-primary text-white rounded-full shadow-lg hover:theme-primary-hover hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        aria-label="Submit new artwork"
      >
        <CameraIcon class="w-7 h-7" aria-hidden="true" />
      </button>
    </div>

    <!-- Right: Notifications and Profile/Login -->
    <div class="flex items-center space-x-2">
      <!-- Notifications Button -->
      <button
        v-if="props.showNotifications"
        @click="handleNotificationClick"
        class="relative flex items-center justify-center w-12 h-12 rounded-full hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        aria-label="View notifications"
      >
        <BellIcon class="w-6 h-6 text-gray-700" aria-hidden="true" />
        <span
          v-if="hasNotifications"
          class="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full min-w-[18px] h-[18px] shadow-sm"
          :aria-label="`${props.notificationCount ?? 0} unread notifications`"
        >
          {{ (props.notificationCount ?? 0) > 99 ? '99+' : (props.notificationCount ?? 0) }}
        </span>
      </button>

      <!-- Map Button -->
      <button
        @click="handleMapClick"
        class="flex items-center justify-center w-12 h-12 rounded-full hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        aria-label="Open map"
        title="Map"
      >
        <MapIcon class="w-6 h-6 text-gray-700" aria-hidden="true" />
      </button>

      <!-- Profile / Login removed from bottom bar (kept in vertical navigation rail) -->
    </div>
  </div>

  <div v-else class="flex flex-col items-center px-3 py-4 space-y-3">
    <!-- Top: Menu / Toggle (vertical) -->
    <button
      @click="handleMenuToggle"
      class="flex items-center justify-center w-12 h-12 rounded-full hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
      aria-label="Open navigation menu"
    >
      <Bars3Icon class="w-6 h-6 text-gray-700" aria-hidden="true" />
    </button>

    <!-- Notifications -->
    <button
      v-if="props.showNotifications"
      @click="handleNotificationClick"
      class="relative flex items-center justify-center w-12 h-12 rounded-full hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
      aria-label="View notifications"
    >
      <BellIcon class="w-6 h-6 text-gray-700" aria-hidden="true" />
      <span
        v-if="hasNotifications"
        class="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full min-w-[18px] h-[18px] shadow-sm"
        :aria-label="`${props.notificationCount ?? 0} unread notifications`"
      >
        {{ (props.notificationCount ?? 0) > 99 ? '99+' : (props.notificationCount ?? 0) }}
      </span>
    </button>

    <!-- Profile / Login -->
    <button
      v-if="props.isAuthenticated"
      @click="handleProfileClick"
      class="flex items-center justify-center w-12 h-12 rounded-full hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
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

    <!-- FAB removed from vertical (navigation rail) mode - should only appear in bottom navigation -->
  </div>
</template>

<style scoped>
.fab {
  box-shadow:
    0px 6px 10px 0px rgba(0, 0, 0, 0.14),
    0px 1px 18px 0px rgba(0, 0, 0, 0.12),
    0px 3px 5px -1px rgba(0, 0, 0, 0.20);
  /* Explicitly control transitions - only colors and box-shadow, NO transform */
  transition: background-color 0.2s ease, box-shadow 0.16s ease;
}

.fab:hover {
  box-shadow:
    0px 8px 14px 0px rgba(0, 0, 0, 0.16),
    0px 2px 24px 0px rgba(0, 0, 0, 0.14),
    0px 4px 8px -1px rgba(0, 0, 0, 0.24);
  /* Ensure no transform is applied on hover */
  transform: none !important;
}
</style>
