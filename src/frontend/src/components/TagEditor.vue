<!--
TagEditor.vue - Structured tag editor component for artwork tagging system

Features:
- Category-based organization of tag types
- Smart input detection (dropdown for enums, date picker, etc.)
- Real-time validation with error messages
- Tag removal via context menu
- Mobile-responsive design
- Keyboard navigation and accessibility
- Empty state guidance with examples
- OpenStreetMap-compatible tagging
-->

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import {
  getTagDefinition,
  getCategoriesOrderedForDisplay,
  getTagsByCategory,
  getAllTagKeysAlphabetically,
  validateTagValue,
  formatTagValueForDisplay,
  type TagDefinition,
} from '../services/tagSchema';

// Types
interface StructuredTags {
  [key: string]: string;
}

interface Props {
  modelValue: StructuredTags;
  disabled?: boolean;
  maxTags?: number;
}

interface Emits {
  (e: 'update:modelValue', value: StructuredTags): void;
  (e: 'tag-added', key: string, value: string): void;
  (e: 'tag-removed', key: string): void;
  (e: 'validation-error', errors: Record<string, string>): void;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  maxTags: 30,
});

const emit = defineEmits<Emits>();

// State
const selectedTagKey = ref('');
const tagValue = ref('');
const isAddingTag = ref(false);
const showDropdown = ref(false);
const validationErrors = ref<Record<string, string>>({});
const focusedTagKey = ref<string | null>(null);

// Refs
const dropdownRef = ref<HTMLElement>();
const valueInputRef = ref<HTMLInputElement>();
const tagKeySelectRef = ref<HTMLSelectElement>();

// Computed
const tags = computed({
  get: () => props.modelValue,
  set: (value: StructuredTags) => emit('update:modelValue', value),
});

const categories = computed(() => getCategoriesOrderedForDisplay());

const availableTagKeys = computed(() => {
  const allKeys = getAllTagKeysAlphabetically();
  return allKeys.filter(def => !tags.value.hasOwnProperty(def.key));
});

const canAddMoreTags = computed(() => {
  return Object.keys(tags.value).length < props.maxTags;
});

const selectedTagDefinition = computed(() => {
  return selectedTagKey.value ? getTagDefinition(selectedTagKey.value) : null;
});

const currentTagError = computed(() => {
  return selectedTagKey.value ? validationErrors.value[selectedTagKey.value] : null;
});

const tagsByCategory = computed(() => {
  const result: Record<string, Array<{ key: string; value: string; definition: TagDefinition }>> = {};
  
  categories.value.forEach(category => {
    result[category.key] = [];
  });

  // Add 'other' category for unrecognized tags
  result.other = [];

  for (const [key, value] of Object.entries(tags.value)) {
    const definition = getTagDefinition(key);
    if (definition) {
      result[definition.category] = result[definition.category] || [];
      result[definition.category].push({ key, value, definition });
    } else {
      result.other.push({ 
        key, 
        value, 
        definition: {
          key,
          label: key,
          description: 'Unknown tag',
          category: 'other',
          dataType: 'text' as const,
        } as TagDefinition
      });
    }
  }

  // Remove empty categories
  for (const categoryKey of Object.keys(result)) {
    if (result[categoryKey].length === 0) {
      delete result[categoryKey];
    }
  }

  return result;
});

const hasAnyTags = computed(() => {
  return Object.keys(tags.value).length > 0;
});

const exampleTags = [
  { key: 'tourism', value: 'artwork' },
  { key: 'artwork_type', value: 'statue' },
  { key: 'material', value: 'bronze' },
  { key: 'artist_name', value: 'Jane Doe' },
  { key: 'start_date', value: '1998' },
];

// Methods
function startAddingTag() {
  if (props.disabled || !canAddMoreTags.value) return;
  
  isAddingTag.value = true;
  selectedTagKey.value = '';
  tagValue.value = '';
  showDropdown.value = true;
  
  nextTick(() => {
    tagKeySelectRef.value?.focus();
  });
}

function cancelAddingTag() {
  isAddingTag.value = false;
  showDropdown.value = false;
  selectedTagKey.value = '';
  tagValue.value = '';
  clearValidationError(selectedTagKey.value);
}

function selectTagKey(key: string) {
  selectedTagKey.value = key;
  tagValue.value = '';
  showDropdown.value = false;
  clearValidationError(key);
  
  nextTick(() => {
    valueInputRef.value?.focus();
  });
}

function addTag() {
  if (!selectedTagKey.value || !tagValue.value.trim()) {
    return;
  }

  const validation = validateTagValue(selectedTagKey.value, tagValue.value);
  
  if (!validation.valid) {
    setValidationError(selectedTagKey.value, validation.error || 'Invalid value');
    return;
  }

  const newTags = { ...tags.value };
  newTags[selectedTagKey.value] = tagValue.value.trim();
  tags.value = newTags;

  emit('tag-added', selectedTagKey.value, tagValue.value.trim());

  // Reset form
  cancelAddingTag();
}

function removeTag(key: string) {
  if (props.disabled) return;

  const newTags = { ...tags.value };
  delete newTags[key];
  tags.value = newTags;

  emit('tag-removed', key);
  clearValidationError(key);
}

function setValidationError(key: string, error: string) {
  validationErrors.value = {
    ...validationErrors.value,
    [key]: error,
  };
  emit('validation-error', validationErrors.value);
}

function clearValidationError(key: string) {
  if (!key) return;
  
  const errors = { ...validationErrors.value };
  delete errors[key];
  validationErrors.value = errors;
  emit('validation-error', validationErrors.value);
}

function handleKeyPress(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault();
    addTag();
  } else if (event.key === 'Escape') {
    cancelAddingTag();
  }
}

function getCategoryLabel(categoryKey: string): string {
  const category = categories.value.find(cat => cat.key === categoryKey);
  return category?.label || (categoryKey === 'other' ? 'Other' : categoryKey);
}

function formatValueForDisplay(key: string, value: string): string {
  return formatTagValueForDisplay(key, value);
}

// Watch for validation on value changes
watch([selectedTagKey, tagValue], () => {
  if (selectedTagKey.value && tagValue.value) {
    const validation = validateTagValue(selectedTagKey.value, tagValue.value);
    if (!validation.valid) {
      setValidationError(selectedTagKey.value, validation.error || 'Invalid value');
    } else {
      clearValidationError(selectedTagKey.value);
    }
  }
});

// Handle clicks outside dropdown
function handleClickOutside(event: Event) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    showDropdown.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

// Clean up event listener
onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div class="tag-editor" :class="{ 'opacity-50 cursor-not-allowed': disabled }">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-900">Tags</h3>
      <div class="text-sm text-gray-500">
        {{ Object.keys(tags).length }}/{{ maxTags }} tags
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-if="!hasAnyTags && !isAddingTag"
      class="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300"
    >
      <svg
        class="mx-auto h-12 w-12 text-gray-400 mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z"
        />
      </svg>
      <h3 class="text-sm font-medium text-gray-900 mb-2">No tags yet</h3>
      <p class="text-sm text-gray-500 mb-4">
        Add structured metadata to help others discover and learn about this artwork.
      </p>
      
      <!-- Example tags -->
      <div class="text-left max-w-md mx-auto mb-6">
        <p class="text-xs font-medium text-gray-700 mb-2">Try adding tags like these:</p>
        <div class="flex flex-wrap gap-1">
          <span
            v-for="example in exampleTags"
            :key="example.key"
            class="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-700"
          >
            {{ example.key }}: {{ example.value }}
          </span>
        </div>
      </div>
      
      <button
        v-if="!disabled && canAddMoreTags"
        @click="startAddingTag"
        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
      >
        <svg class="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
          />
        </svg>
        Add Your First Tag
      </button>
    </div>

    <!-- Tags organized by category -->
    <div v-else class="space-y-6">
      <div
        v-for="(categoryTags, categoryKey) in tagsByCategory"
        :key="categoryKey"
        class="bg-white border border-gray-200 rounded-lg p-4"
      >
        <h4 class="font-medium text-gray-900 mb-3">
          {{ getCategoryLabel(categoryKey) }}
        </h4>
        
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="tag in categoryTags"
            :key="tag.key"
            class="flex items-center justify-between p-3 bg-gray-50 rounded-md group hover:bg-gray-100 transition-colors"
            :class="{ 'ring-2 ring-blue-500': focusedTagKey === tag.key }"
          >
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-900">
                {{ tag.definition.label }}
              </div>
              <div class="text-sm text-gray-600 truncate" :title="tag.value">
                {{ formatValueForDisplay(tag.key, tag.value) }}
              </div>
            </div>
            
            <button
              v-if="!disabled"
              @click="removeTag(tag.key)"
              @focus="focusedTagKey = tag.key"
              @blur="focusedTagKey = null"
              class="ml-2 p-1 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 opacity-0 group-hover:opacity-100 transition-all"
              :aria-label="`Remove ${tag.definition.label} tag`"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Add new tag section -->
      <div v-if="canAddMoreTags && !disabled" class="border-t pt-4">
        <div v-if="!isAddingTag">
          <button
            @click="startAddingTag"
            class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <svg class="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Add Tag
          </button>
        </div>

        <div v-else ref="dropdownRef" class="bg-white border border-gray-300 rounded-md p-4 shadow-sm">
          <div class="space-y-4">
            <!-- Tag key selection -->
            <div>
              <label for="tag-key-select" class="block text-sm font-medium text-gray-700 mb-1">
                Tag Type
              </label>
              <select
                id="tag-key-select"
                ref="tagKeySelectRef"
                v-model="selectedTagKey"
                class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                @change="selectTagKey(selectedTagKey)"
              >
                <option value="">Select a tag type...</option>
                <optgroup
                  v-for="category in categories"
                  :key="category.key"
                  :label="category.label"
                >
                  <option
                    v-for="tagDef in getTagsByCategory(category.key).filter(def => !tags.hasOwnProperty(def.key))"
                    :key="tagDef.key"
                    :value="tagDef.key"
                  >
                    {{ tagDef.label }}
                  </option>
                </optgroup>
              </select>
            </div>

            <!-- Tag value input -->
            <div v-if="selectedTagDefinition">
              <label for="tag-value-input" class="block text-sm font-medium text-gray-700 mb-1">
                {{ selectedTagDefinition.label }}
                <span v-if="selectedTagDefinition.required" class="text-red-500">*</span>
              </label>
              
              <!-- Different input types based on data type -->
              <select
                v-if="selectedTagDefinition.dataType === 'enum'"
                id="tag-value-input"
                v-model="tagValue"
                class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                :class="{ 'border-red-300 bg-red-50': currentTagError }"
                @keypress="handleKeyPress"
              >
                <option value="">Select...</option>
                <option
                  v-for="option in selectedTagDefinition.enumValues"
                  :key="option"
                  :value="option"
                >
                  {{ option }}
                </option>
              </select>

              <select
                v-else-if="selectedTagDefinition.dataType === 'yes_no'"
                id="tag-value-input"
                v-model="tagValue"
                class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                :class="{ 'border-red-300 bg-red-50': currentTagError }"
                @keypress="handleKeyPress"
              >
                <option value="">Select...</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>

              <input
                v-else
                id="tag-value-input"
                ref="valueInputRef"
                v-model="tagValue"
                :type="selectedTagDefinition.dataType === 'number' ? 'number' : selectedTagDefinition.dataType === 'url' ? 'url' : 'text'"
                :placeholder="selectedTagDefinition.placeholder"
                :maxlength="selectedTagDefinition.maxLength"
                :min="selectedTagDefinition.min"
                :max="selectedTagDefinition.max"
                class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                :class="{ 'border-red-300 bg-red-50': currentTagError }"
                @keypress="handleKeyPress"
              />

              <!-- Help text -->
              <p v-if="selectedTagDefinition.description" class="mt-1 text-xs text-gray-500">
                {{ selectedTagDefinition.description }}
                <a
                  v-if="selectedTagDefinition.helpUrl"
                  :href="selectedTagDefinition.helpUrl"
                  target="_blank"
                  class="text-blue-600 hover:text-blue-500"
                  aria-label="Learn more (opens in new window)"
                >
                  Learn more
                  <svg class="inline h-3 w-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </p>

              <!-- Error message -->
              <p v-if="currentTagError" class="mt-1 text-xs text-red-600" role="alert">
                {{ currentTagError }}
              </p>
            </div>

            <!-- Action buttons -->
            <div class="flex justify-end space-x-2 pt-2 border-t">
              <button
                @click="cancelAddingTag"
                class="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                @click="addTag"
                :disabled="!selectedTagKey || !tagValue.trim() || !!currentTagError"
                class="px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add Tag
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Screen reader announcements -->
    <div aria-live="polite" aria-atomic="true" class="sr-only">
      <span v-if="Object.keys(tags).length === 1">1 tag added</span>
      <span v-else-if="Object.keys(tags).length > 1">{{ Object.keys(tags).length }} tags added</span>
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

/* High contrast mode support */
@media (prefers-contrast: high) {
  .tag-editor {
    @apply border-2;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .tag-editor *,
  .transition-colors,
  .transition-all {
    transition: none !important;
  }
}

/* Ensure proper spacing on mobile */
@media (max-width: 640px) {
  .tag-editor .grid.sm\\:grid-cols-2.lg\\:grid-cols-3 {
    @apply grid-cols-1;
  }
}
</style>