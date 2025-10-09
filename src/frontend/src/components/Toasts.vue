<script setup lang="ts">
import { computed } from 'vue';
import { useToastsStore } from '../stores/toasts';
import BadgeToast from './BadgeToast.vue';

const toasts = useToastsStore();
const items = computed(() => toasts.toasts);

function dismiss(id: string): void {
  toasts.removeToast(id);
}
</script>

<template>
  <div class="fixed top-4 right-4 z-50 flex flex-col items-end space-y-2">
    <transition-group name="toast" tag="div">
      <div v-for="t in items" :key="t.id">
        <BadgeToast v-if="t.payload && t.payload.badge" :badge="t.payload.badge" :notification-id="t.id" />
        <div
          v-else
          role="alert"
          aria-live="polite"
          :class="[
            'max-w-sm w-full shadow-lg rounded-md p-3 text-sm',
            t.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : '',
            t.type === 'error' ? 'bg-red-50 border border-red-200 text-red-800' : '',
            t.type === 'info' ? 'bg-blue-50 border border-blue-200 text-blue-800' : '',
            t.type === 'warning' ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' : '',
          ]"
        >
          <div class="flex items-start justify-between">
            <div class="pr-3 flex-1 break-words">{{ t.message }}</div>
            <button @click="dismiss(t.id)" class="ml-3 text-xs opacity-70 hover:opacity-100">Dismiss</button>
          </div>
        </div>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active {
  transition: all 0.2s ease;
}
.toast-enter-from {
  transform: translateY(-8px);
  opacity: 0;
}
.toast-leave-to {
  transform: translateY(-8px);
  opacity: 0;
}
</style>
