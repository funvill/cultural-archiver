<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  getCategoriesOrderedForDisplay,
  getTagDefinition,
  formatTagValueForDisplay,
  type TagDefinition,
} from '../services/tagSchema';

// Types
interface Tag {
  label: string;
  value: string;
}

interface StructuredTag {
  key: string;
  value: string;
  definition: TagDefinition | undefined;
}

// Props interface
interface Props {
  tags: Tag[] | Record<string, string> | StructuredTag[];
  maxVisible?: number;
  variant?: 'default' | 'outline' | 'compact';
  size?: 'sm' | 'md' | 'lg';
  colorScheme?: 'blue' | 'gray' | 'green' | 'purple' | 'orange';
  expandable?: boolean;
  showCategories?: boolean;
  collapsible?: boolean;
}

// Emits interface
interface Emits {
  (e: 'tagClick', tag: Tag | StructuredTag): void;
  (e: 'expandToggle', expanded: boolean): void;
  (e: 'categoryToggle', category: string, expanded: boolean): void;
}

const props = withDefaults(defineProps<Props>(), {
  maxVisible: 5,
  variant: 'default',
  size: 'md',
  colorScheme: 'blue',
  expandable: true,
  showCategories: false,
  collapsible: false,
});

const emit = defineEmits<Emits>();

// State
const isExpanded = ref(false);
const expandedCategories = ref<Set<string>>(new Set());

// Computed
const normalizedTags = computed((): StructuredTag[] => {
  if (Array.isArray(props.tags)) {
    // Handle existing Tag[] or StructuredTag[] format
    if (props.tags.length > 0 && props.tags[0] && 'key' in props.tags[0]) {
      return props.tags as StructuredTag[];
    } else {
      // Convert Tag[] to StructuredTag[]
      return (props.tags as Tag[]).map(tag => ({
        key: tag.label,
        value: tag.value,
        definition: getTagDefinition(tag.label),
      }));
    }
  }

  // Convert record to array of structured tags
  return Object.entries(props.tags).map(([key, value]) => ({
    key,
    value: String(value),
    definition: getTagDefinition(key),
  }));
});

const tagsByCategory = computed(() => {
  if (!props.showCategories) {
    return { all: normalizedTags.value };
  }

  const categories = getCategoriesOrderedForDisplay();
  const result: Record<string, StructuredTag[]> = {};

  // Initialize all categories
  categories.forEach(category => {
    result[category.key] = [];
  });

  // Add 'other' category for unrecognized tags
  result.other = [];

  // Organize tags by category
  normalizedTags.value.forEach(tag => {
    const categoryKey = tag.definition?.category || 'other';
    if (!result[categoryKey]) {
      result[categoryKey] = [];
    }
    const category = result[categoryKey];
    if (category) {
      category.push(tag);
    }
  });

  // Remove empty categories
  Object.keys(result).forEach(key => {
    const category = result[key];
    if (category && category.length === 0) {
      delete result[key];
    }
  });

  return result;
});

const visibleTags = computed((): StructuredTag[] => {
  if (!props.expandable || isExpanded.value || normalizedTags.value.length <= props.maxVisible) {
    return normalizedTags.value;
  }

  return normalizedTags.value.slice(0, props.maxVisible);
});

const hiddenCount = computed((): number => {
  if (!props.expandable || isExpanded.value) return 0;
  return Math.max(0, normalizedTags.value.length - props.maxVisible);
});

const hasHiddenTags = computed((): boolean => {
  return props.expandable && normalizedTags.value.length > props.maxVisible;
});

// Methods
function handleTagClick(tag: StructuredTag): void {
  emit('tagClick', tag);
}

function toggleExpanded(): void {
  isExpanded.value = !isExpanded.value;
  emit('expandToggle', isExpanded.value);
}

function toggleCategory(categoryKey: string): void {
  if (expandedCategories.value.has(categoryKey)) {
    expandedCategories.value.delete(categoryKey);
  } else {
    expandedCategories.value.add(categoryKey);
  }
  emit('categoryToggle', categoryKey, expandedCategories.value.has(categoryKey));
}

function isCategoryExpanded(categoryKey: string): boolean {
  return !props.collapsible || expandedCategories.value.has(categoryKey);
}

function formatTagDisplay(tag: StructuredTag): string {
  if (tag.definition) {
    const formattedValue = formatTagValueForDisplay(tag.key, tag.value);
    return `${tag.definition.label}: ${formattedValue}`;
  }

  // Fallback for unknown tags
  const formattedLabel = tag.key.charAt(0).toUpperCase() + tag.key.slice(1);
  return `${formattedLabel}: ${tag.value}`;
}

function getCategoryLabel(categoryKey: string): string {
  const categories = getCategoriesOrderedForDisplay();
  const category = categories.find(cat => cat.key === categoryKey);
  return category?.label || (categoryKey === 'other' ? 'Other' : categoryKey);
}

// Initialize expanded categories (start with first category expanded if collapsible)
if (props.collapsible) {
  const categories = Object.keys(tagsByCategory.value);
  if (categories.length > 0 && categories[0]) {
    expandedCategories.value.add(categories[0]);
  }
}
</script>

<template>
  <div class="tag-badge-container">
    <!-- No tags message -->
    <div v-if="normalizedTags.length === 0" class="text-sm text-gray-500 italic">
      No tags available
    </div>

    <!-- Category-based display -->
    <div v-else-if="showCategories" class="space-y-4">
      <div
        v-for="(categoryTags, categoryKey) in tagsByCategory"
        :key="categoryKey"
        class="border border-gray-200 rounded-lg overflow-hidden"
      >
        <!-- Category header -->
        <div
          v-if="collapsible"
          class="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
          @click="toggleCategory(categoryKey)"
          :aria-expanded="isCategoryExpanded(categoryKey)"
          role="button"
        >
          <h4 class="text-sm font-medium text-gray-900">
            {{ getCategoryLabel(categoryKey) }}
            <span class="text-xs text-gray-500 ml-1">({{ categoryTags.length }})</span>
          </h4>
          <svg
            class="h-4 w-4 text-gray-500 transition-transform duration-200"
            :class="{ 'rotate-180': isCategoryExpanded(categoryKey) }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>

        <div v-else class="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <h4 class="text-sm font-medium text-gray-900">
            {{ getCategoryLabel(categoryKey) }}
            <span class="text-xs text-gray-500 ml-1">({{ categoryTags.length }})</span>
          </h4>
        </div>

        <!-- Category tags -->
        <div v-show="isCategoryExpanded(categoryKey)" class="p-3">
          <div class="space-y-1">
            <div
              v-for="(tag, index) in categoryTags"
              :key="`${tag.key}-${tag.value}-${index}`"
              class="text-sm"
              @click="handleTagClick(tag)"
              :aria-label="`Tag: ${formatTagDisplay(tag)}`"
            >
              <span class="font-bold">{{ tag.definition?.label || tag.key }}:</span>
              <span class="ml-1"> {{ formatTagValueForDisplay(tag.key, tag.value) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Simple list display (original behavior) -->
    <div v-else class="space-y-1">
      <!-- Visible tags -->
      <div
        v-for="(tag, index) in visibleTags"
        :key="`${tag.key}-${tag.value}-${index}`"
        class="text-sm cursor-pointer hover:bg-gray-50 p-1 rounded"
        @click="handleTagClick(tag)"
        :aria-label="`Tag: ${formatTagDisplay(tag)}`"
      >
        <span class="font-bold">{{ tag.definition?.label || tag.key }}:</span>
        <span class="ml-1"> {{ formatTagValueForDisplay(tag.key, tag.value) }}</span>
      </div>

      <!-- Show more/less toggle -->
      <button
        v-if="hasHiddenTags"
        @click="toggleExpanded"
        class="inline-flex items-center px-3 py-1 text-sm font-medium text-gray-600 bg-gray-100 rounded-full hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors duration-200"
        :aria-label="isExpanded ? 'Show fewer tags' : `Show ${hiddenCount} more tags`"
        :aria-expanded="isExpanded"
        type="button"
      >
        <span v-if="!isExpanded"> +{{ hiddenCount }} more </span>
        <span v-else> Show less </span>

        <!-- Icon -->
        <svg
          class="ml-1 w-4 h-4 transition-transform duration-200"
          :class="{ 'rotate-180': isExpanded }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
    </div>

    <!-- Screen reader summary -->
    <div class="sr-only" aria-live="polite">
      <span v-if="normalizedTags.length > 0">
        {{ normalizedTags.length }} tags available.
        <span v-if="!showCategories">
          {{
            isExpanded
              ? 'All tags shown.'
              : `Showing ${visibleTags.length} of ${normalizedTags.length} tags.`
          }}
        </span>
        <span v-else> Organized by {{ Object.keys(tagsByCategory).length }} categories. </span>
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
