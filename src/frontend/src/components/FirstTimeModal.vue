<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
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

const goToHelp = () => {
  closeModal();
  router.push('/help');
};

const goToMap = () => {
  closeModal();
  router.push('/');
};

const goToSubmit = () => {
  closeModal();
  router.push('/add');
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
        class="relative bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
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
            <div class="text-3xl" role="img" aria-label="Cultural Archiver logo">🎨</div>
            <h2 id="welcome-title" class="text-2xl font-bold text-gray-900">
              Welcome to Cultural Archiver!
            </h2>
          </div>
        </div>

        <!-- Modal Body -->
        <div id="welcome-description" class="px-6 pb-6">
          <div class="space-y-4 text-gray-700">
            <p class="text-lg leading-relaxed">
              Discover, document, and celebrate public art in your community! 
              We're building the world's most comprehensive map of cultural works through community collaboration.
            </p>

            <div class="bg-blue-50 rounded-lg p-4">
              <h3 class="font-semibold text-blue-900 mb-2">How You Can Help:</h3>
              <ul class="space-y-2 text-blue-800">
                <li class="flex items-start">
                  <span class="text-blue-500 mr-2 mt-1">📸</span>
                  <span><strong>Photograph artworks</strong> you discover in your neighborhood</span>
                </li>
                <li class="flex items-start">
                  <span class="text-blue-500 mr-2 mt-1">📍</span>
                  <span><strong>Share locations</strong> to help others find these cultural treasures</span>
                </li>
                <li class="flex items-start">
                  <span class="text-blue-500 mr-2 mt-1">📝</span>
                  <span><strong>Add descriptions</strong> and details about the art and artists</span>
                </li>
                <li class="flex items-start">
                  <span class="text-blue-500 mr-2 mt-1">🌍</span>
                  <span><strong>Explore the map</strong> to discover art near you</span>
                </li>
              </ul>
            </div>

            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p class="text-yellow-800 text-sm">
                <strong>Note:</strong> This project is open source and community-driven. 
                All content is shared under Creative Commons licensing to preserve cultural heritage for everyone.
              </p>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="mt-6 space-y-3">
            <div class="flex flex-col sm:flex-row gap-3">
              <button
                @click="goToSubmit"
                class="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                🚀 Add Your First Artwork
              </button>
              <button
                @click="goToMap"
                class="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
              >
                🗺️ Explore the Map
              </button>
            </div>
            
            <button
              @click="goToHelp"
              class="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              📚 Learn More in Help Section
            </button>
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