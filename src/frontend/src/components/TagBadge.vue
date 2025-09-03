<script setup lang="ts">
import { ref, computed } from 'vue'

// Types
interface Tag {
  label: string
  value: string
}

// Props interface
interface Props {
  tags: Tag[] | Record<string, string>
  maxVisible?: number
  variant?: 'default' | 'outline' | 'compact'
  size?: 'sm' | 'md' | 'lg'
  colorScheme?: 'blue' | 'gray' | 'green' | 'purple' | 'orange'
  expandable?: boolean
}

// Emits interface
interface Emits {
  (e: 'tagClick', tag: Tag): void
  (e: 'expandToggle', expanded: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  maxVisible: 5,
  variant: 'default',
  size: 'md',
  colorScheme: 'blue',
  expandable: true
})

const emit = defineEmits<Emits>()

// State
const isExpanded = ref(false)

// Computed
const normalizedTags = computed((): Tag[] => {
  if (Array.isArray(props.tags)) {
    return props.tags
  }
  
  // Convert record to array of tags
  return Object.entries(props.tags).map(([label, value]) => ({
    label,
    value: String(value)
  }))
})

const visibleTags = computed((): Tag[] => {
  if (!props.expandable || isExpanded.value || normalizedTags.value.length <= props.maxVisible) {
    return normalizedTags.value
  }
  
  return normalizedTags.value.slice(0, props.maxVisible)
})

const hiddenCount = computed((): number => {
  if (!props.expandable || isExpanded.value) return 0
  return Math.max(0, normalizedTags.value.length - props.maxVisible)
})

const hasHiddenTags = computed((): boolean => {
  return props.expandable && normalizedTags.value.length > props.maxVisible
})

const sizeClasses = computed((): string => {
  const sizeMap = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2'
  }
  return sizeMap[props.size]
})

const colorClasses = computed((): string => {
  const baseClasses = 'transition-colors duration-200'
  
  if (props.variant === 'outline') {
    const outlineMap = {
      blue: 'border-blue-300 text-blue-700 hover:bg-blue-50 focus:ring-blue-500',
      gray: 'border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500',
      green: 'border-green-300 text-green-700 hover:bg-green-50 focus:ring-green-500',
      purple: 'border-purple-300 text-purple-700 hover:bg-purple-50 focus:ring-purple-500',
      orange: 'border-orange-300 text-orange-700 hover:bg-orange-50 focus:ring-orange-500'
    }
    return `${baseClasses} border ${outlineMap[props.colorScheme]}`
  }
  
  if (props.variant === 'compact') {
    const compactMap = {
      blue: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
      gray: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
      green: 'bg-green-100 text-green-800 hover:bg-green-200',
      purple: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
      orange: 'bg-orange-100 text-orange-800 hover:bg-orange-200'
    }
    return `${baseClasses} ${compactMap[props.colorScheme]}`
  }
  
  // Default variant
  const defaultMap = {
    blue: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    gray: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
    green: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
    purple: 'bg-purple-600 text-white hover:bg-purple-700 focus:ring-purple-500',
    orange: 'bg-orange-600 text-white hover:bg-orange-700 focus:ring-orange-500'
  }
  return `${baseClasses} ${defaultMap[props.colorScheme]}`
})

const tagClasses = computed((): string => {
  const baseClasses = 'inline-flex items-center rounded-full font-medium focus:outline-none focus:ring-2 focus:ring-offset-2'
  return `${baseClasses} ${sizeClasses.value} ${colorClasses.value}`
})

// Methods
function handleTagClick(tag: Tag): void {
  emit('tagClick', tag)
}

function toggleExpanded(): void {
  isExpanded.value = !isExpanded.value
  emit('expandToggle', isExpanded.value)
}

function formatTagDisplay(tag: Tag): string {
  // Capitalize first letter of label for display
  const formattedLabel = tag.label.charAt(0).toUpperCase() + tag.label.slice(1)
  return `${formattedLabel}: ${tag.value}`
}
</script>

<template>
  <div class="tag-badge-container">
    <!-- No tags message -->
    <div v-if="normalizedTags.length === 0" class="text-sm text-gray-500 italic">
      No tags available
    </div>
    
    <!-- Tags display -->
    <div v-else class="flex flex-wrap gap-2 items-center">
      <!-- Visible tags -->
      <button
        v-for="(tag, index) in visibleTags"
        :key="`${tag.label}-${tag.value}-${index}`"
        :class="tagClasses"
        @click="handleTagClick(tag)"
        :aria-label="`Tag: ${formatTagDisplay(tag)}`"
        type="button"
      >
        <span class="capitalize">{{ tag.label }}</span>
        <span class="ml-1">{{ tag.value }}</span>
      </button>
      
      <!-- Show more/less toggle -->
      <button
        v-if="hasHiddenTags"
        @click="toggleExpanded"
        class="inline-flex items-center px-3 py-1 text-sm font-medium text-gray-600 bg-gray-100 rounded-full hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors duration-200"
        :aria-label="isExpanded ? 'Show fewer tags' : `Show ${hiddenCount} more tags`"
        :aria-expanded="isExpanded"
        type="button"
      >
        <span v-if="!isExpanded">
          +{{ hiddenCount }} more
        </span>
        <span v-else>
          Show less
        </span>
        
        <!-- Icon -->
        <svg 
          class="ml-1 w-4 h-4 transition-transform duration-200"
          :class="{ 'rotate-180': isExpanded }"
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
    
    <!-- Screen reader summary -->
    <div class="sr-only" aria-live="polite">
      <span v-if="normalizedTags.length > 0">
        {{ normalizedTags.length }} tags available.
        {{ isExpanded ? 'All tags shown.' : `Showing ${visibleTags.length} of ${normalizedTags.length} tags.` }}
      </span>
    </div>
  </div>
</template>

<style scoped>
/* Screen reader only class */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Smooth transitions */
.tag-badge-container button {
  transition: all 0.15s ease-in-out;
}

/* Rotation for expand/collapse icon */
.rotate-180 {
  transform: rotate(180deg);
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .tag-badge-container button {
    border: 1px solid currentColor;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .tag-badge-container * {
    transition: none !important;
    animation: none !important;
  }
  
  .rotate-180 {
    transform: none !important;
  }
}

/* Focus styles for better visibility */
.tag-badge-container button:focus {
  box-shadow: 0 0 0 2px currentColor;
}

/* Ensure proper spacing on smaller screens */
@media (max-width: 640px) {
  .tag-badge-container .flex {
    gap: 0.375rem; /* Slightly smaller gap on mobile */
  }
}
</style>