<script setup lang="ts">
import { onMounted, watch, ref, provide } from 'vue';
import { useRoute } from 'vue-router';

import AppShell from './components/AppShell.vue';
import ErrorBoundary from './components/ErrorBoundary.vue';
import FirstTimeModal from './components/FirstTimeModal.vue';
import Modal from './components/Modal.vue';
import PromptModal from './components/PromptModal.vue';
import { useAuth } from './composables/useAuth';
import { globalModal } from './composables/useModal';



const { initAuth } = useAuth();
const route = useRoute();

// First time modal reference
const firstTimeModalRef = ref<InstanceType<typeof FirstTimeModal> | null>(null);

// Provide the method to open the welcome modal to child components
provide('openWelcomeModal', () => {
  if (firstTimeModalRef.value) {
    firstTimeModalRef.value.open();
  }
});

// Initialize authentication on app startup
onMounted(async () => {
  try {
    await initAuth();
  } catch (error) {
    console.error('Failed to initialize authentication:', error);
  }
});

// Watch for query parameters that might trigger authentication
watch(
  () => route.query,
  newQuery => {
    // Handle login requirement from router guard
    if (newQuery.login === 'required') {
      console.log('Authentication required for this route');
      // Could trigger auth modal here if needed
    }

    // Handle errors from router guard
    if (newQuery.error === 'reviewer_required') {
      console.log('Moderator access required for this route');
      // Could show error message here if needed
    }

    if (newQuery.error === 'admin_required') {
      console.log('Admin access required for this route');
      // Could show error message here if needed
    }
  },
  { immediate: true }
);
</script>

<template>
  <div id="app">
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>

    <!-- Global Modal -->
    <Modal
      :is-open="globalModal.modalState.isOpen"
      :title="globalModal.modalState.config.title || ''"
      :message="globalModal.modalState.config.message || ''"
      :confirm-text="globalModal.modalState.config.confirmText || 'OK'"
      :cancel-text="globalModal.modalState.config.cancelText || 'Cancel'"
      :show-cancel="globalModal.modalState.config.showCancel ?? true"
      :variant="globalModal.modalState.config.variant || 'primary'"
      :prevent-escape-close="globalModal.modalState.config.preventEscapeClose || false"
      :prevent-backdrop-close="globalModal.modalState.config.preventBackdropClose || false"
      :focus-on-open="globalModal.modalState.config.focusOnOpen || 'confirm'"
      @update:is-open="globalModal.updateModalOpen"
      @confirm="globalModal.handleConfirm"
      @cancel="globalModal.handleCancel"
      @close="globalModal.handleCancel"
    />

    <!-- Global Prompt Modal -->
    <PromptModal
      :is-open="globalModal.promptState.isOpen"
      :title="globalModal.promptState.config.title || ''"
      :message="globalModal.promptState.config.message || ''"
      :input-label="globalModal.promptState.config.inputLabel || ''"
      :placeholder="globalModal.promptState.config.placeholder || ''"
      :default-value="globalModal.promptState.config.defaultValue || ''"
      :confirm-text="globalModal.promptState.config.confirmText || 'OK'"
      :cancel-text="globalModal.promptState.config.cancelText || 'Cancel'"
      :variant="globalModal.promptState.config.variant || 'primary'"
      :required="globalModal.promptState.config.required || false"
      :multiline="globalModal.promptState.config.multiline || false"
      v-bind="{
        ...(globalModal.promptState.config.maxLength !== undefined
          ? { maxLength: globalModal.promptState.config.maxLength }
          : {}),
        ...(globalModal.promptState.config.validator !== undefined
          ? { validator: globalModal.promptState.config.validator }
          : {}),
      }"
      @update:is-open="globalModal.updatePromptOpen"
      @confirm="globalModal.handlePromptConfirm"
      @cancel="globalModal.handlePromptCancel"
      @close="globalModal.handlePromptCancel"
    />

    <!-- First Time User Modal -->
    <FirstTimeModal ref="firstTimeModalRef" />
  </div>
</template>

<style>
#app {
  font-family:
    'Inter',
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    Roboto,
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Ensure full height */
html,
body {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden; /* Prevent double scrollbars - AppShell handles all scrolling */
}

/* Override any default margins */
* {
  box-sizing: border-box;
}
</style>
