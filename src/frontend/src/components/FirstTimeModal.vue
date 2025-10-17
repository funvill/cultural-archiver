<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  XMarkIcon,
  CameraIcon,
  PencilSquareIcon,
  MapIcon,
  StarIcon,
} from '@heroicons/vue/24/outline';
import { useRouter } from 'vue-router';

// Reactive state
const isVisible = ref(false);
const router = useRouter();

// Check if this is the user's first visit
const checkFirstVisit = () => {
  const hasVisited = localStorage.getItem('cultural-archiver-visited');
  if (!hasVisited) {
    // Mark as visited first, then show modal after a short delay
    localStorage.setItem('cultural-archiver-visited', 'true');
    setTimeout(() => {
      isVisible.value = true;
    }, 500); // Small delay to let the page load properly
  }
};

// Close modal handlers
const closeModal = () => {
  isVisible.value = false;
};

const goToMap = (path = '/') => {
  closeModal();
  // Use relative route paths for tutorials and map
  router.push(path);
};

const goToSubmit = (path = '/add') => {
  closeModal();
  router.push(path);
};

// Handle escape key and backdrop clicks
const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeModal();
  }
};

const handleBackdropClick = (event: MouseEvent) => {
  if (event.target === event.currentTarget) {
    closeModal();
  }
};

onMounted(() => {
  checkFirstVisit();
});

// Expose method to open modal from parent components
defineExpose({
  open: () => {
    isVisible.value = true;
  },
});
</script>

<template>
  <!-- Modal Backdrop -->
  <Teleport to="body">
    <div
      v-if="isVisible"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
      @click="handleBackdropClick"
      @keydown="handleEscape"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      aria-describedby="welcome-description"
    >
      <!-- Modal Content -->
      <div
        class="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        @click.stop
      >
        <!-- Close Button -->
        <button
          @click="closeModal"
          class="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md z-10"
          aria-label="Close welcome dialog"
        >
          <XMarkIcon class="h-5 w-5" />
        </button>

        <!-- Modal Header -->
        <div class="px-6 pt-6 pb-4">
          <div class="flex items-center space-x-3 mb-4">
            <div class="text-3xl" role="img" aria-label="Public Art Registry logo">🎨</div>
            <h2 id="welcome-title" class="text-2xl font-bold text-gray-900">
              Welcome to Public Art Registry
            </h2>
          </div>
        </div>

        <!-- Modal Body -->
        <div id="welcome-description" class="px-6 pb-6">
          <div class="space-y-4 text-gray-700">
            <p class="text-lg leading-relaxed">
              <strong>Public art</strong> is fragile. Murals fade, sculptures crumble, stories vanish. If no one
              <strong>honors</strong> them, they are <strong>lost - forever</strong>.
            </p>

            <p class="text-lg leading-relaxed">
              By preserving artworks and committing them to this archive, you safeguard our shared
              cultural story - a legacy of memory and meaning for <strong>generations yet to come.</strong>
            </p>

            <p class="text-lg leading-relaxed">
              This is your chance to <strong>protect what matters</strong>. To give the future the legacy of memory.
            </p>
          </div>

          <!-- How to Help Section -->
          <div class="mt-8">
            <h3 class="text-xl font-bold text-gray-900 mb-4">Be the Hero</h3>
            <p class="text-gray-700 mb-6">
              Every action you take makes you a <strong>guardian of culture</strong>. Each step is a way to honor
              artists, preserve their work, and inspire those who follow.
            </p>

            <!-- 2x2 Grid of Help Cards -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Card 1: Take photos -->
              <div class="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 flex flex-col">
                <div class="flex items-start mb-2">
                  <CameraIcon class="h-6 w-6 text-blue-600 mr-2 flex-shrink-0" />
                  <h4 class="font-bold text-gray-900">Take photos of artworks</h4>
                </div>
                <p class="text-sm text-gray-700 mb-4 flex-grow">
                  Your photo could be the last record of a mural before it vanishes. By capturing
                  it now, you become the guardian of its memory. <button
                    @click="closeModal(); goToMap('/pages/tutorial-take-photos')"
                    class="text-blue-600 hover:text-blue-800 underline text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                  >
                    More info
                  </button>
                </p>
                <div class="flex flex-col gap-2">
                  <button
                    @click="closeModal(); goToSubmit('/add')"
                    class="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors text-sm"
                  >
                    Safeguard Creativity
                  </button>
                  
                </div>
              </div>

              <!-- Card 2: Update information -->
              <div class="bg-green-100 border-2 border-green-300 rounded-lg p-4 flex flex-col">
                <div class="flex items-start mb-2">
                  <PencilSquareIcon class="h-6 w-6 text-green-800 mr-2 flex-shrink-0" />
                  <h4 class="font-bold text-gray-900">Update artworks and artists</h4>
                </div>
                <p class="text-sm text-gray-700 mb-4 flex-grow">
                  Every detail you add protects the truth of our shared culture. You ensure future
                  generations know the stories behind the art. <button
                    @click="closeModal(); goToMap('/pages/tutorial-update-information')"
                    class="text-green-700 hover:text-green-900 underline text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 rounded"
                  >
                    More info
                  </button>
                </p>
                <div class="flex flex-col gap-2">
                  <button
                    @click="closeModal(); goToMap('/')"
                    class="bg-green-700 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors text-sm"
                  >
                    Protect History
                  </button>
                  
                </div>
              </div>

              <!-- Card 3: Explore Art Nearby -->
              <div class="bg-purple-50 border-2 border-purple-200 rounded-lg p-4 flex flex-col">
                <div class="flex items-start mb-2">
                  <MapIcon class="h-6 w-6 text-purple-600 mr-2 flex-shrink-0" />
                  <h4 class="font-bold text-gray-900">Explore Art Nearby</h4>
                </div>
                <p class="text-sm text-gray-700 mb-4 flex-grow">
                  Artists create for others to witness. Your journey completes their work and
                  preserves it for the future - every visit keeps the art alive. <button
                    @click="closeModal(); goToMap('/pages/tutorial-explore-nearby-artworks')"
                    class="text-purple-600 hover:text-purple-800 underline text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded"
                  >
                    More info
                  </button>
                </p>
                <div class="flex flex-col gap-2">
                  <button
                    @click="closeModal(); goToMap('/')"
                    class="bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors text-sm"
                  >
                    Discover Nearby Art
                  </button>
                  
                </div>
              </div>

              <!-- Card 4: Highlight Great Works -->
              <div class="bg-orange-50 border-2 border-orange-200 rounded-lg p-4 flex flex-col">
                <div class="flex items-start mb-2">
                  <StarIcon class="h-6 w-6 text-orange-600 mr-2 flex-shrink-0" />
                  <h4 class="font-bold text-gray-900">Highlight Great Works</h4>
                </div>
                <p class="text-sm text-gray-700 mb-4 flex-grow">
                  Art lives through connection. By choosing what inspires you, you pass that spark
                  to those who follow - guiding them toward what matters most. <button
                    @click="closeModal(); goToMap('/pages/tutorial-rate-artworks')"
                    class="text-orange-600 hover:text-orange-800 underline text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 rounded"
                  >
                    More info
                  </button>
                </p>
                <div class="flex flex-col gap-2">
                  <button
                    @click="closeModal(); goToMap('/')"
                    class="bg-orange-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors text-sm"
                  >
                    Share What Moves You
                  </button>
                  
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Ensure modal appears above everything else */
.fixed {
  z-index: 9999;
}

/* Smooth entrance animation */
.fixed {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Modal content animation */
.bg-white {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
