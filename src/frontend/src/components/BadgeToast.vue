<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';

// Local badge prop type (subset of server-side award result)
interface BadgeInfo {
  badge_id: string;
  badge_key?: string;
  title?: string;
  description?: string;
  icon_emoji?: string;
  award_reason?: string;
}

// Props
interface Props {
  badge: BadgeInfo;
  autoHide?: boolean;
  autoHideDelay?: number;
  notificationId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  autoHide: true,
  autoHideDelay: 8000, // 8 seconds
});

// Emits
const emit = defineEmits<{
  dismiss: [notificationId?: string];
  celebrate: [badgeId: string];
}>();

// Router
const router = useRouter();

// Local state
const isVisible = ref(true);
const isConfettiActive = ref(false);
const confettiCanvas = ref<HTMLCanvasElement | null>(null);
const hideTimer = ref<number | null>(null);

// Check for reduced motion preference
const prefersReducedMotion = computed(() => {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
});

// Confetti configuration
interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  size: number;
  gravity: number;
}

const confettiParticles = ref<ConfettiParticle[]>([]);
const confettiColors = ['#FFD700', '#FFA500', '#FF6347', '#32CD32', '#4169E1', '#DA70D6'];

// Methods
function dismiss() {
  isVisible.value = false;
  emit('dismiss', props.notificationId);

  if (hideTimer.value) {
    clearTimeout(hideTimer.value);
    hideTimer.value = null;
  }
}

function viewBadges() {
  dismiss();
  router.push('/profile/badges');
}

function celebrate() {
  emit('celebrate', props.badge.badge_id);

  if (!prefersReducedMotion.value) {
    startConfetti();
  }
}

function startConfetti() {
  if (isConfettiActive.value || !confettiCanvas.value) return;

  isConfettiActive.value = true;

  // Set canvas size
  const canvas = confettiCanvas.value;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Create confetti particles
  confettiParticles.value = [];
  for (let i = 0; i < 100; i++) {
    confettiParticles.value.push({
      x: Math.random() * canvas.width,
      y: -10,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 2 + 2,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)] || '#FFD700',
      size: Math.random() * 5 + 5,
      gravity: 0.1,
    });
  }

  // Animate confetti
  animateConfetti(ctx);

  // Stop confetti after 3 seconds
  setTimeout(() => {
    isConfettiActive.value = false;
    confettiParticles.value = [];
  }, 3000);
}

function animateConfetti(ctx: CanvasRenderingContext2D) {
  if (!isConfettiActive.value || !confettiCanvas.value) return;

  ctx.clearRect(0, 0, confettiCanvas.value.width, confettiCanvas.value.height);

  confettiParticles.value.forEach((particle, index) => {
    // Update position
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += particle.gravity;
    particle.rotation += particle.rotationSpeed;

    // Remove particles that are off screen
    if (particle.y > confettiCanvas.value!.height + 10) {
      confettiParticles.value.splice(index, 1);
      return;
    }

    // Draw particle
    ctx.save();
    ctx.translate(particle.x, particle.y);
    ctx.rotate((particle.rotation * Math.PI) / 180);
    ctx.fillStyle = particle.color;
    ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
    ctx.restore();
  });

  requestAnimationFrame(() => animateConfetti(ctx));
}

function handleResize() {
  if (confettiCanvas.value) {
    confettiCanvas.value.width = window.innerWidth;
    confettiCanvas.value.height = window.innerHeight;
  }
}

// Lifecycle
onMounted(() => {
  if (props.autoHide) {
    hideTimer.value = window.setTimeout(() => {
      dismiss();
    }, props.autoHideDelay);
  }

  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  if (hideTimer.value) {
    clearTimeout(hideTimer.value);
  }

  window.removeEventListener('resize', handleResize);
  isConfettiActive.value = false;
});
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition ease-out duration-300"
      enter-from-class="opacity-0 transform translate-y-2 scale-95"
      enter-to-class="opacity-100 transform translate-y-0 scale-100"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="opacity-100 transform translate-y-0 scale-100"
      leave-to-class="opacity-0 transform translate-y-2 scale-95"
    >
      <div
        v-if="isVisible"
        class="fixed top-4 right-4 z-50 max-w-sm"
        role="alert"
        aria-live="polite"
        aria-atomic="true"
      >
        <div
          class="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <!-- Toast Header -->
          <div class="bg-gradient-to-r from-yellow-400 to-yellow-500 px-4 py-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <span class="text-2xl" aria-hidden="true">
                  {{ badge.icon_emoji || '🏆' }}
                </span>
                <span class="text-white font-semibold text-sm"> New Badge! </span>
              </div>
              <button
                @click="dismiss"
                class="text-white hover:text-yellow-100 transition-colors"
                :aria-label="`Dismiss ${badge.title} badge notification`"
              >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fill-rule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>

          <!-- Toast Content -->
          <div class="p-4">
            <div class="flex items-start space-x-3">
              <div class="flex-shrink-0">
                <div
                  class="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center"
                >
                  <span class="text-2xl">
                    {{ badge.icon_emoji || '🏆' }}
                  </span>
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                  {{ badge.title }}
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {{ badge.description }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-500 mt-2">
                  {{ badge.award_reason }}
                </p>
              </div>
            </div>
          </div>

          <!-- Toast Actions -->
          <div class="px-4 pb-4 flex justify-between items-center">
            <button
              @click="viewBadges"
              class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
            >
              View all badges
            </button>
            <button
              @click="celebrate"
              class="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-md text-sm font-medium transition-colors"
              :disabled="isConfettiActive"
            >
              🎉 Celebrate
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Confetti Canvas -->
    <canvas
      v-if="isConfettiActive && !prefersReducedMotion"
      ref="confettiCanvas"
      class="fixed inset-0 pointer-events-none z-40"
      aria-hidden="true"
    ></canvas>
  </Teleport>
</template>


<!-- script moved above template to satisfy component-tags-order rule -->

<style scoped>
/* Additional toast styles if needed */
.toast-shadow {
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
}
</style>
