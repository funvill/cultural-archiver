<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  context?: 'submission' | 'general';
  showSignIn?: boolean;
  compact?: boolean;
}

interface Emits {
  (e: 'signIn'): void;
}

const props = withDefaults(defineProps<Props>(), {
  context: 'general',
  showSignIn: true,
  compact: false,
});

const emit = defineEmits<Emits>();

const warningMessage = computed(() => {
  switch (props.context) {
    case 'submission':
      return 'Your submissions are anonymous and cannot be claimed later. Create an account to track your contributions.';
    default:
      return 'You are browsing anonymously. Sign in to access additional features and track your content.';
  }
});

const warningIcon = computed(() => {
  switch (props.context) {
    case 'submission':
      return '⚠️';
    default:
      return 'ℹ️';
  }
});

function handleSignIn() {
  emit('signIn');
}
</script>

<template>
  <div
    :class="[
      'flex items-start gap-3 p-4 rounded-lg border',
      compact ? 'p-3' : 'p-4',
      context === 'submission'
        ? 'bg-orange-50 border-orange-200 text-orange-800'
        : 'bg-blue-50 border-blue-200 text-blue-800',
    ]"
    role="alert"
    :aria-label="`Anonymous user warning: ${warningMessage}`"
  >
    <!-- Icon -->
    <div :class="['flex-shrink-0 text-lg', compact ? 'text-base' : 'text-lg']" aria-hidden="true">
      {{ warningIcon }}
    </div>

    <!-- Content -->
    <div class="flex-1 min-w-0">
      <p :class="['font-medium leading-snug', compact ? 'text-sm' : 'text-base']">
        {{ warningMessage }}
      </p>

      <!-- Sign In Button -->
      <button
        v-if="showSignIn"
        @click="handleSignIn"
        :class="[
          'mt-2 px-3 py-1.5 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
          compact ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1.5',
          context === 'submission'
            ? 'bg-orange-100 text-orange-900 hover:bg-orange-200 focus:ring-orange-500'
            : 'bg-blue-100 text-blue-900 hover:bg-blue-200 focus:ring-blue-500',
        ]"
        type="button"
      >
        Sign In / Create Account
      </button>
    </div>

    <!-- Close button for dismissible version (not implemented as per PRD) -->
    <!-- The PRD specifies no dismissal option for anonymous warnings -->
  </div>
</template>
