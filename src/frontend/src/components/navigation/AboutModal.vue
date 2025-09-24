<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from 'vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';

// Props
interface Props {
  isOpen: boolean;
}

const props = defineProps<Props>();

// Events
interface Emits {
  'update:isOpen': [value: boolean];
  'close': [];
}

const emit = defineEmits<Emits>();

// Local state
const modalRef = ref<HTMLElement>();
const closeButtonRef = ref<HTMLElement>();

// Handlers
const handleClose = (): void => {
  emit('update:isOpen', false);
  emit('close');
};

const handleOverlayClick = (event: Event): void => {
  if (event.target === modalRef.value) {
    handleClose();
  }
};

const handleKeyDown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    handleClose();
  }
};

// Focus management
const handleFocusManagement = (): void => {
  if (props.isOpen) {
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
  <!-- Modal Overlay -->
  <Transition name="modal">
    <div
      v-if="isOpen"
      ref="modalRef"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      @click="handleOverlayClick"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <!-- Modal Content -->
      <div
        class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        @click.stop
      >
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b border-gray-200">
          <div class="flex items-center space-x-3">
            <div class="text-2xl" role="img" aria-label="Public Art Registry logo">🎨</div>
            <h2 id="modal-title" class="text-xl font-semibold text-gray-900">About Public Art Registry</h2>
          </div>
          <button
            ref="closeButtonRef"
            @click="handleClose"
            class="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            aria-label="Close modal"
          >
            <XMarkIcon class="w-5 h-5 text-gray-500" aria-hidden="true" />
          </button>
        </div>

        <!-- Content -->
        <div class="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
          <div class="prose prose-blue max-w-none">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Our Mission</h3>
            <p class="text-gray-700 mb-4">
              The Public Art Registry is a community-driven platform dedicated to documenting and celebrating public art in all its forms. We believe that public art enriches our communities, tells important stories, and deserves to be preserved for future generations.
            </p>

            <h3 class="text-lg font-semibold text-gray-900 mb-4">What We Do</h3>
            <ul class="text-gray-700 mb-4 space-y-2">
              <li class="flex items-start">
                <span class="inline-block w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span><strong>Document:</strong> Catalog public artworks with detailed information, photos, and location data</span>
              </li>
              <li class="flex items-start">
                <span class="inline-block w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span><strong>Discover:</strong> Help people find and explore public art in their communities</span>
              </li>
              <li class="flex items-start">
                <span class="inline-block w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span><strong>Connect:</strong> Build a community of art enthusiasts, historians, and cultural advocates</span>
              </li>
              <li class="flex items-start">
                <span class="inline-block w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span><strong>Preserve:</strong> Create a lasting digital archive of public art for research and education</span>
              </li>
            </ul>

            <h3 class="text-lg font-semibold text-gray-900 mb-4">Get Involved</h3>
            <p class="text-gray-700 mb-4">
              Whether you're an artist, art lover, historian, or simply curious about the art in your neighborhood, there are many ways to contribute:
            </p>
            <ul class="text-gray-700 mb-6 space-y-2">
              <li class="flex items-start">
                <span class="inline-block w-1.5 h-1.5 bg-green-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span>Submit photos and information about public artworks you encounter</span>
              </li>
              <li class="flex items-start">
                <span class="inline-block w-1.5 h-1.5 bg-green-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span>Help verify and improve existing artwork entries</span>
              </li>
              <li class="flex items-start">
                <span class="inline-block w-1.5 h-1.5 bg-green-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span>Share stories and insights about the art and artists in your community</span>
              </li>
              <li class="flex items-start">
                <span class="inline-block w-1.5 h-1.5 bg-green-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span>Spread the word about this valuable cultural resource</span>
              </li>
            </ul>

            <div class="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-400">
              <p class="text-sm text-blue-800">
                <strong>Open Source & Community Driven:</strong> This platform is built by and for the community. 
                Our goal is to make public art more accessible and to ensure that these important cultural artifacts are documented and preserved for everyone to enjoy.
              </p>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-end p-6 border-t border-gray-200 bg-gray-50">
          <button
            @click="handleClose"
            class="px-4 py-2 text-sm font-medium text-blue-600 bg-white border border-blue-300 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Modal transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-to,
.modal-leave-from {
  opacity: 1;
}

.modal-enter-active .bg-white,
.modal-leave-active .bg-white {
  transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-enter-from .bg-white,
.modal-leave-to .bg-white {
  transform: scale(0.95);
}

.modal-enter-to .bg-white,
.modal-leave-from .bg-white {
  transform: scale(1);
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

/* Focus improvements */
button:focus-visible {
  outline: 2px solid rgb(59 130 246);
  outline-offset: 2px;
}

/* Prose styling for content */
.prose {
  line-height: 1.7;
}

.prose h3 {
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
}

.prose p, .prose ul {
  margin-bottom: 1rem;
}

.prose ul {
  list-style: none;
  padding-left: 0;
}

.prose li {
  margin-bottom: 0.5rem;
}
</style>