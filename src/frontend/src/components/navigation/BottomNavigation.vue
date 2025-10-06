<script setup lang="ts">
import { toRefs } from 'vue';
import NavControls from './NavControls.vue';

// Props
interface Props {
  currentRoute: string;
  notificationCount?: number;
  showNotifications?: boolean;
  isAuthenticated?: boolean;
  userDisplayName?: string;
}

const props = withDefaults(defineProps<Props>(), {
  notificationCount: 0,
  showNotifications: true,
  isAuthenticated: false,
  userDisplayName: '',
});

// expose individual refs for template convenience
const { notificationCount, showNotifications } = toRefs(props);

// Events
interface Emits {
  'menuToggle': [];
  'notificationClick': [];
  'fabClick': [];
  'profileClick': [];
  'loginClick': [];
  'mapClick': [];
  'feedbackClick': [];
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

const handleProfileClick = (): void => {
  emit('profileClick');
};

const handleLoginClick = (): void => {
  emit('loginClick');
};

const handleFeedbackClick = (): void => {
  emit('feedbackClick');
};

// (removed unused hasNotifications)
</script>

<template>
  <nav
    class="bottom-navigation fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-30"
    role="navigation"
    aria-label="Bottom navigation"
  >
    <NavControls
      orientation="horizontal"
      :notification-count="notificationCount"
      :show-notifications="showNotifications"
      :auth="{ isAuthenticated: props.isAuthenticated, userDisplayName: props.userDisplayName }"
      @menuToggle="handleMenuToggle"
      @fabClick="handleFabClick"
      @notificationClick="handleNotificationClick"
      @mapClick="$emit('mapClick')"
      @profileClick="handleProfileClick"
      @loginClick="handleLoginClick"
      @feedbackClick="handleFeedbackClick"
    />
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