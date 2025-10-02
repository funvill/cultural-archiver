<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useNotificationsStore } from '../stores/notifications';
import NotificationPanel from './NotificationPanel.vue';

// Props
interface Props {
  autoStartPolling?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  autoStartPolling: true,
});

// Emits
const emit = defineEmits<{
  notificationClick: [notificationId: string];
  panelToggle: [isOpen: boolean];
}>();

// Store
const notificationsStore = useNotificationsStore();

// Local state
const showPanel = ref(false);

// Computed
const unreadCount = computed(() => notificationsStore.unreadCount);

// Cap display at 99+ for UI
const displayCount = computed(() => {
  return unreadCount.value > 99 ? '99+' : unreadCount.value.toString();
});

// Methods
function togglePanel() {
  showPanel.value = !showPanel.value;
  emit('panelToggle', showPanel.value);

  if (showPanel.value && notificationsStore.notifications.length === 0) {
    // Fetch notifications when panel is opened for the first time
    notificationsStore.fetchNotifications({ limit: 10 }).catch(() => {
      // Silent failure - error will be shown in panel
    });
  }
}

function handleNotificationAction(action: { type: string; notificationId: string }) {
  if (action.type === 'click') {
    emit('notificationClick', action.notificationId);
    showPanel.value = false;
  }
}

// Keyboard navigation
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && showPanel.value) {
    showPanel.value = false;
    emit('panelToggle', false);
  }
}

// Lifecycle
onMounted(() => {
  if (props.autoStartPolling) {
    notificationsStore.startPolling();
  }

  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  if (props.autoStartPolling) {
    notificationsStore.stopPolling();
  }

  document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div class="relative">
    <!-- Notification Bell Icon -->
    <button
      @click="togglePanel"
      class="relative p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg"
      :aria-label="unreadCount > 0 ? `Notifications (${displayCount} unread)` : 'Notifications'"
      :aria-expanded="showPanel"
      aria-haspopup="true"
    >
      <!-- Bell Icon -->
      <svg
        class="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>

      <!-- Unread Count Badge -->
      <span
        v-if="unreadCount > 0"
        class="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center min-w-[1.25rem] px-1"
        :aria-label="`${unreadCount} unread notifications`"
      >
        {{ displayCount }}
      </span>
    </button>

    <!-- Notification Panel -->
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <NotificationPanel
        v-if="showPanel"
        @close="showPanel = false"
        @notification-action="handleNotificationAction"
        class="absolute right-0 top-full mt-2 z-50"
      />
    </Transition>
  </div>

  <!-- Click outside to close -->
  <div
    v-if="showPanel"
    class="fixed inset-0 z-40"
    @click="showPanel = false"
    aria-hidden="true"
  ></div>
</template>

<<<<<<< HEAD
<!-- script moved above template to satisfy component-tags-order rule -->

=======
>>>>>>> 79cbe81 (data-collectors, linting)
<style scoped>
/* Additional styles if needed */
.notification-badge-pulse {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
