<!--
TagChipEditor.vue - Editable tag chips component extending TagBadge functionality

Features:
- Add tags with input field and "Add" button
- Remove tags with X button on each chip  
- Validation for duplicate tags and empty values
- Comma-separated tag input with automatic chip conversion
- Keyboard navigation (Enter to add, Backspace to remove)
- Accessibility with ARIA labels and screen reader support
- Consistent styling with existing TagBadge component
-->

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
// Note: Creating our own simple tag display since TagBadge is designed for key-value pairs

interface Props {
  modelValue: string[];
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: string[]): void;
  (e: 'tag-added', tag: string): void;
  (e: 'tag-removed', tag: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Add tags...',
  maxTags: 20,
  disabled: false,
});

const emit = defineEmits<Emits>();

// Component state
const inputValue = ref('');
const inputRef = ref<HTMLInputElement>();
const error = ref<string | null>(null);
const focused = ref(false);

// Computed properties
const tags = computed({
  get: () => props.modelValue,
  set: (value: string[]) => emit('update:modelValue', value),
});

const canAddMore = computed(() => tags.value.length < props.maxTags);
const inputId = computed(() => `tag-input-${Math.random().toString(36).substr(2, 9)}`);
const inputAttrs = computed(() => {
  const attrs: Record<string, string> = {};
  if (error.value) {
    attrs['aria-describedby'] = `${inputId.value}-error`;
  }
  return attrs;
});

// Tag management
function addTag(tagText: string) {
  if (props.disabled) return;

  const trimmedTag = tagText.trim();

  // Validation
  if (!trimmedTag) {
    error.value = 'Tag cannot be empty';
    return;
  }

  if (tags.value.includes(trimmedTag)) {
    error.value = 'Tag already exists';
    return;
  }

  if (!canAddMore.value) {
    error.value = `Maximum ${props.maxTags} tags allowed`;
    return;
  }

  // Add tag
  const newTags = [...tags.value, trimmedTag];
  tags.value = newTags;
  emit('tag-added', trimmedTag);

  // Clear input and error
  inputValue.value = '';
  error.value = null;
}

function removeTag(tagToRemove: string) {
  if (props.disabled) return;

  const newTags = tags.value.filter(tag => tag !== tagToRemove);
  tags.value = newTags;
  emit('tag-removed', tagToRemove);
  error.value = null;
}

function removeLastTag() {
  if (props.disabled || tags.value.length === 0) return;

  const lastTag = tags.value[tags.value.length - 1];
  if (lastTag) {
    removeTag(lastTag);
  }
}

// Input handling
function handleInputKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault();
    const input = inputValue.value.trim();

    if (input) {
      // Check for comma-separated values
      if (input.includes(',')) {
        const newTags = input
          .split(',')
          .map(tag => tag.trim())
          .filter(tag => tag);
        for (const tag of newTags) {
          addTag(tag);
        }
      } else {
        addTag(input);
      }
    } else {
      // Show error for empty input when Enter is pressed
      error.value = 'Tag cannot be empty';
    }
  } else {
    // Clear error when user starts typing (but not on Enter)
    error.value = null;
  }

  if (event.key === 'Backspace' && !inputValue.value && tags.value.length > 0) {
    event.preventDefault();
    removeLastTag();
  }

  if (event.key === 'Escape') {
    inputValue.value = '';
    inputRef.value?.blur();
  }
}

function handleInputBlur() {
  focused.value = false;

  // Add tag on blur if there's content
  const input = inputValue.value.trim();
  if (input) {
    addTag(input);
  }
}

function handleInputFocus() {
  focused.value = true;
  error.value = null;
}

function handleAddButtonClick() {
  const input = inputValue.value.trim();
  if (input) {
    addTag(input);
  }
  inputRef.value?.focus();
}

// Focus input programmatically
function focusInput() {
  nextTick(() => {
    inputRef.value?.focus();
  });
}

defineExpose({
  focusInput,
  addTag,
  removeTag,
});
</script>

<template>
  <div
    class="tag-chip-editor"
    :class="{
      'opacity-50': disabled,
      'ring-2 ring-blue-500': focused && !disabled,
    }"
  >
    <!-- Tag display area -->
    <div
      class="min-h-[2.5rem] p-2 border border-gray-300 rounded-md bg-white transition-colors"
      :class="{
        'border-red-300 bg-red-50': error,
        'border-blue-500': focused && !error && !disabled,
        'bg-gray-50 cursor-not-allowed': disabled,
      }"
      @click="!disabled && focusInput()"
    >
      <div class="flex flex-wrap gap-1.5 items-center">
        <!-- Existing tags -->
        <div
          v-for="(tag, index) in tags"
          :key="`tag-${index}-${tag}`"
          class="inline-flex items-center group"
        >
          <!-- Simple tag chip with remove button -->
          <span
            class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 transition-colors group-hover:bg-blue-200"
            :class="{ 'cursor-not-allowed opacity-60': disabled }"
          >
            {{ tag }}
            <button
              v-if="!disabled"
              type="button"
              @click.stop="removeTag(tag)"
              class="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-blue-600 hover:bg-blue-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
              :aria-label="`Remove tag: ${tag}`"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </span>
        </div>

        <!-- Input field -->
        <div class="flex-1 min-w-[120px] flex items-center gap-2">
          <input
            ref="inputRef"
            v-model="inputValue"
            :id="inputId"
            type="text"
            :placeholder="tags.length === 0 ? placeholder || '' : ''"
            :disabled="!!disabled"
            class="flex-1 border-0 outline-none bg-transparent placeholder-gray-400 text-sm"
            :aria-label="`Add new tag. ${tags.length} of ${maxTags} tags used.`"
            v-bind="inputAttrs"
            @keydown="handleInputKeydown"
            @blur="handleInputBlur"
            @focus="handleInputFocus"
          />

          <!-- Add button -->
          <button
            v-if="inputValue.trim() && canAddMore && !disabled"
            type="button"
            @click="handleAddButtonClick"
            class="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
            aria-label="Add tag"
          >
            <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Add
          </button>
        </div>
      </div>
    </div>

    <!-- Helper text and error message -->
    <div class="mt-1 flex justify-between items-start">
      <div class="text-xs text-gray-500">
        <span v-if="!error">
          {{ tags.length }}/{{ maxTags }} tags
          <span v-if="tags.length === 0" class="ml-2"> • Separate with commas or press Enter </span>
        </span>
        <span
          v-if="error"
          :id="`${inputId}-error`"
          class="text-red-600"
          role="alert"
          aria-live="polite"
        >
          {{ error }}
        </span>
      </div>

      <div v-if="tags.length > 0" class="text-xs text-gray-400">
        Press Backspace to remove last tag
      </div>
    </div>

    <!-- Screen reader announcements -->
    <div aria-live="polite" aria-atomic="true" class="sr-only">
      <span v-if="tags.length === 1">1 tag added</span>
      <span v-else-if="tags.length > 1">{{ tags.length }} tags added</span>
    </div>
  </div>
</template>

<style scoped>
.tag-chip-editor {
  @apply relative;
}

/* Ensure focus states work properly */
.tag-chip-editor:focus-within .border-gray-300 {
  @apply border-blue-500;
}

/* Smooth transitions for all interactive elements */
.tag-chip-editor * {
  transition: all 0.15s ease-in-out;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .tag-chip-editor {
    @apply border-2;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .tag-chip-editor *,
  .transition-transform,
  .transition-colors {
    transition: none !important;
  }
}
</style>
