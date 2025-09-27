<script setup lang="ts">
import { computed } from 'vue';

// Props interface
interface Props {
  icon: string;
  label?: string;
  active?: boolean;
  loading?: boolean;
  disabled?: boolean;
  count?: number;
  variant?: 'default' | 'filled' | 'outlined';
  size?: 'sm' | 'md' | 'lg';
  ariaLabel?: string;
  showLabel?: boolean;
  showSuccessAnimation?: boolean;
}

// Emits interface
interface Emits {
  (e: 'click'): void;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'outlined',
  size: 'md',
  showLabel: false,
  showSuccessAnimation: false,
});

const emit = defineEmits<Emits>();

// Computed styles based on props
const chipClasses = computed(() => {
  const base = 'inline-flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';
  
  // Size classes
  const sizeClasses = {
    sm: 'h-8 px-2 text-xs',
    md: 'h-10 px-3 text-sm',
    lg: 'h-12 px-4 text-base',
  };

  // Base variant classes
  let variantClasses = '';
  if (props.variant === 'filled' && props.active) {
    variantClasses = 'bg-red-500 text-white hover:bg-red-600';
  } else if (props.variant === 'filled') {
    variantClasses = 'bg-gray-100 text-gray-700 hover:bg-gray-200';
  } else {
    // outlined (default)
    variantClasses = props.active 
      ? 'border-2 border-red-500 bg-red-50 text-red-700 hover:bg-red-100'
      : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400';
  }

  // Disabled state
  if (props.disabled || props.loading) {
    variantClasses = 'border border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed';
  }

  return [base, sizeClasses[props.size], variantClasses].join(' ');
});

const iconClasses = computed(() => {
  const base = 'transition-transform duration-200';
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5', 
    lg: 'w-6 h-6',
  };

  // Add animation classes for hover/focus and success effects
  const animationClass = !props.disabled && !props.loading ? 'group-hover:animate-pulse group-focus:animate-pulse' : '';
  const successClass = props.showSuccessAnimation ? 'animate-bounce' : '';
  
  return [base, sizeClasses[props.size], animationClass, successClass].join(' ');
});

const shouldShowLabel = computed(() => {
  return props.showLabel && props.label && !props.loading;
});

function handleClick(): void {
  if (!isDisabled.value) {
    emit('click');
  }
}

// Generate appropriate aria-label
const effectiveAriaLabel = computed(() => {
  if (props.ariaLabel) return props.ariaLabel;
  
  let label = props.label || 'Action';
  if (props.count !== undefined) {
    label += ` (${props.count})`;
  }
  if (props.active) {
    label += ' - Active';
  }
  if (props.loading) {
    label += ' - Loading';
  }
  return label;
});

const isDisabled = computed(() => {
  return props.disabled || props.loading;
});

const ariaPressed = computed(() => {
  return props.active ? 'true' : 'false';
});
</script>

<template>
  <button
    type="button"
    :class="chipClasses"
    :disabled="isDisabled"
    :aria-label="effectiveAriaLabel"
    :aria-pressed="ariaPressed"
    class="group"
    v-bind="$attrs"
    @click="handleClick"
  >
    <!-- Loading spinner -->
    <svg 
      v-if="loading"
      :class="iconClasses"
      class="animate-spin"
      fill="none" 
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25"/>
      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" class="opacity-75"/>
    </svg>

    <!-- Heart icon (for loved) -->
    <template v-else-if="icon === 'heart'">
      <svg :class="iconClasses" fill="currentColor" viewBox="0 0 24 24">
        <path v-if="active" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        <path v-else d="M12.1 18.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05zM16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.31C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3z"/>
      </svg>
    </template>

    <!-- Flag icon (for been here) -->
    <template v-else-if="icon === 'flag'">
      <svg :class="iconClasses" fill="currentColor" viewBox="0 0 24 24">
        <path v-if="active" d="M5 21V4h9l.4 2h5.6v7h-5.6l-.4-2H7v10H5z"/>
        <path v-else d="M5 21V4h9l.4 2h5.6v7h-5.6l-.4-2H7v10H5zm2-12h7.6l.4 2h3V8h-3l-.4-2H7v3z"/>
      </svg>
    </template>

    <!-- Star icon (for want to see) -->
    <template v-else-if="icon === 'star'">
      <svg :class="iconClasses" fill="currentColor" viewBox="0 0 24 24">
        <path v-if="active" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
        <path v-else d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28z"/>
      </svg>
    </template>

    <!-- Bookmark icon (for add to list) -->
    <template v-else-if="icon === 'bookmark'">
      <svg :class="iconClasses" fill="currentColor" viewBox="0 0 24 24">
        <path v-if="active" d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
        <path v-else d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z"/>
      </svg>
    </template>

    <!-- Document Add icon (for add log) -->
    <template v-else-if="icon === 'document-add'">
      <svg :class="iconClasses" fill="currentColor" viewBox="0 0 24 24">
        <path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h16c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z"/>
        <path d="M11 14h2v2h2v2h-2v2h-2v-2H9v-2h2v-2z"/>
      </svg>
    </template>

    <!-- Share icon -->
    <template v-else-if="icon === 'share'">
      <svg :class="iconClasses" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
      </svg>
    </template>

    <!-- Pencil icon (for edit) -->
    <template v-else-if="icon === 'pencil'">
      <svg :class="iconClasses" fill="currentColor" viewBox="0 0 24 24">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
      </svg>
    </template>

    <!-- Default fallback icon -->
    <template v-else>
      <svg :class="iconClasses" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="2"/>
      </svg>
    </template>

    <!-- Label text -->
    <span v-if="shouldShowLabel" class="ml-2 font-medium">
      {{ label }}
    </span>

    <!-- Count badge -->
    <span v-if="count !== undefined && count > 0" class="ml-1 px-1.5 py-0.5 text-xs font-medium bg-gray-200 text-gray-800 rounded-full">
      {{ count > 999 ? '999+' : count }}
    </span>
  </button>
</template>

<style scoped>
/* Ensure proper accessibility focus styles */
.group:focus {
  box-shadow: 0 0 0 2px #3b82f6;
}

/* Custom pulse animation for icon twitch effect */
@keyframes twitch {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

/* Success pop animation */
@keyframes success-pop {
  0% { transform: scale(1); }
  25% { transform: scale(1.2); }
  50% { transform: scale(0.95); }
  100% { transform: scale(1); }
}

.group:hover .group-hover\:animate-pulse,
.group:focus .group-focus\:animate-pulse {
  animation: twitch 0.3s ease-in-out;
}

.animate-bounce {
  animation: success-pop 0.5s ease-out;
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .group:hover .group-hover\:animate-pulse,
  .group:focus .group-focus\:animate-pulse,
  .animate-spin,
  .animate-bounce {
    animation: none !important;
  }
  
  * {
    transition: none !important;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  button {
    border: 1px solid currentColor !important;
  }
}

/* Ensure minimum touch target size on mobile */
@media (max-width: 640px) {
  button {
    min-height: 44px;
    min-width: 44px;
  }
}
</style>