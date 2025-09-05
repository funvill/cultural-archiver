<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted, computed } from 'vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';

interface Props {
  isOpen: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  showCloseButton?: boolean;
  variant?: 'primary' | 'danger' | 'warning';
  preventEscapeClose?: boolean;
  preventBackdropClose?: boolean;
  focusOnOpen?: 'confirm' | 'cancel' | 'close';
}

const props = withDefaults(defineProps<Props>(), {
  confirmText: 'OK',
  cancelText: 'Cancel',
  showCancel: true,
  showCloseButton: true,
  variant: 'primary',
  preventEscapeClose: false,
  preventBackdropClose: false,
  focusOnOpen: 'confirm',
});

interface Emits {
  (e: 'update:isOpen', value: boolean): void;
  (e: 'confirm'): void;
  (e: 'cancel'): void;
  (e: 'close'): void;
}

const emit = defineEmits<Emits>();

// Refs
const modalPanel = ref<HTMLElement>();
const confirmButton = ref<HTMLElement>();
const cancelButton = ref<HTMLElement>();
const closeButton = ref<HTMLElement>();

// State for focus management
const previouslyFocused = ref<HTMLElement | null>(null);

// Computed
const titleId = computed(() => `modal-title-${Math.random().toString(36).substr(2, 9)}`);
const descriptionId = computed(
  () => `modal-description-${Math.random().toString(36).substr(2, 9)}`
);

const confirmButtonClass = computed(() => {
  const baseClass = 'focus:ring-2 focus:ring-offset-2';
  switch (props.variant) {
    case 'danger':
      return `${baseClass} bg-red-600 hover:bg-red-700 focus:ring-red-500`;
    case 'warning':
      return `${baseClass} bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500`;
    default:
      return `${baseClass} bg-blue-600 hover:bg-blue-700 focus:ring-blue-500`;
  }
});

// Methods
function close() {
  emit('update:isOpen', false);
  emit('close');
  restoreFocus();
}

function confirm() {
  emit('confirm');
  close();
}

function cancel() {
  emit('cancel');
  close();
}

function handleEscape(event: KeyboardEvent) {
  if (!props.preventEscapeClose && event.key === 'Escape') {
    cancel();
  }
}

function handleBackdropClick() {
  if (!props.preventBackdropClose) {
    cancel();
  }
}

// Focus management
function setInitialFocus() {
  nextTick(() => {
    let elementToFocus: HTMLElement | null = null;

    switch (props.focusOnOpen) {
      case 'cancel':
        elementToFocus = cancelButton.value || null;
        break;
      case 'close':
        elementToFocus = closeButton.value || null;
        break;
      default:
        elementToFocus = confirmButton.value || null;
    }

    elementToFocus?.focus();
  });
}

function saveFocus() {
  previouslyFocused.value = document.activeElement as HTMLElement;
}

function restoreFocus() {
  nextTick(() => {
    previouslyFocused.value?.focus();
    previouslyFocused.value = null;
  });
}

// Tab trapping
function handleKeydown(event: KeyboardEvent) {
  if (!props.isOpen || event.key !== 'Tab') return;

  const panel = modalPanel.value;
  if (!panel) return;

  const focusableElements = panel.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

  if (event.shiftKey) {
    // Shift+Tab: moving backwards
    if (document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    }
  } else {
    // Tab: moving forwards
    if (document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }
}

// Body scroll management
function disableBodyScroll() {
  document.body.style.overflow = 'hidden';
}

function enableBodyScroll() {
  document.body.style.overflow = '';
}

// Watchers and lifecycle
import { watch } from 'vue';

watch(
  () => props.isOpen,
  newValue => {
    if (newValue) {
      saveFocus();
      disableBodyScroll();
      setInitialFocus();
    } else {
      enableBodyScroll();
    }
  }
);

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);

  // If modal opens on mount
  if (props.isOpen) {
    saveFocus();
    disableBodyScroll();
    setInitialFocus();
  }
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  enableBodyScroll();

  // Restore focus if modal was open when component unmounts
  if (props.isOpen) {
    restoreFocus();
  }
});
</script>

<template>
  <teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 overflow-y-auto"
      @keydown.escape="handleEscape"
      @click="handleBackdropClick"
      role="dialog"
      :aria-modal="true"
      :aria-labelledby="titleId"
      :aria-describedby="descriptionId"
    >
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity" />

      <!-- Modal Panel -->
      <div class="flex min-h-full items-center justify-center p-4">
        <div
          ref="modalPanel"
          class="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6 transform transition-all"
          @click.stop
        >
          <!-- Header -->
          <div v-if="title || $slots.header" class="mb-4">
            <div v-if="$slots.header">
              <slot name="header" />
            </div>
            <div v-else class="flex items-center justify-between">
              <h3 :id="titleId" class="text-lg font-semibold text-gray-900">
                {{ title }}
              </h3>
              <button
                v-if="showCloseButton"
                ref="closeButton"
                @click="close"
                class="text-gray-400 hover:text-gray-600 focus:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md p-1"
                aria-label="Close modal"
              >
                <XMarkIcon class="w-6 h-6" aria-hidden="true" />
              </button>
            </div>
          </div>

          <!-- Content -->
          <div :id="descriptionId" class="mb-6">
            <slot name="content">
              <p v-if="message" class="text-gray-600">{{ message }}</p>
            </slot>
          </div>

          <!-- Actions -->
          <div class="flex justify-end space-x-3">
            <slot name="actions">
              <button
                v-if="showCancel"
                ref="cancelButton"
                @click="cancel"
                type="button"
                class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                {{ cancelText }}
              </button>
              <button
                ref="confirmButton"
                @click="confirm"
                type="button"
                class="px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors"
                :class="confirmButtonClass"
              >
                {{ confirmText }}
              </button>
            </slot>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
/* Ensure modal is above everything */
.fixed.inset-0.z-50 {
  z-index: 9999;
}

/* Smooth animations */
.transition-opacity {
  transition: opacity 0.2s ease-in-out;
}

.transition-all {
  transition: all 0.2s ease-in-out;
}

/* Focus styles */
button:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
}

/* Animation for modal appearance */
@keyframes modal-fade-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.transform.transition-all {
  animation: modal-fade-in 0.2s ease-out;
}
</style>
