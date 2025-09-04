<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/vue/24/outline'

// Props interface
interface Props {
  modelValue: string
  placeholder?: string
  suggestions?: string[]
  loading?: boolean
  showClearButton?: boolean
  disabled?: boolean
  autofocus?: boolean
  debounceMs?: number
}

// Emits interface
interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'search', query: string): void
  (e: 'clear'): void
  (e: 'focus'): void
  (e: 'blur'): void
  (e: 'suggestionSelect', suggestion: string): void
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Search artworks... try: mural, tag:street-art',
  suggestions: () => [],
  loading: false,
  showClearButton: true,
  disabled: false,
  autofocus: false,
  debounceMs: 300
})

const emit = defineEmits<Emits>()

// State
const inputRef = ref<HTMLInputElement>()
const containerRef = ref<HTMLElement>()
const showSuggestions = ref(false)
const highlightedIndex = ref(-1)
const debounceTimer = ref<number | null>(null)

// Computed
const localValue = computed({
  get: () => props.modelValue,
  set: (value: string) => {
    emit('update:modelValue', value)
    debouncedSearch(value)
  }
})

const hasSuggestions = computed(() => 
  props.suggestions.length > 0 && showSuggestions.value && localValue.value.length > 0
)

const showClear = computed(() => 
  props.showClearButton && localValue.value.length > 0 && !props.disabled
)

const activeDescendant = computed(() => 
  highlightedIndex.value >= 0 ? `suggestion-${highlightedIndex.value}` : ''
)

// Methods
function debouncedSearch(query: string): void {
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value)
  }

  debounceTimer.value = window.setTimeout(() => {
    if (query.trim().length > 0) {
      emit('search', query.trim())
    }
  }, props.debounceMs)
}

function handleInput(event: Event): void {
  const target = event.target as HTMLInputElement
  localValue.value = target.value
  
  // Show suggestions when user types
  if (target.value.length > 0) {
    showSuggestions.value = true
    highlightedIndex.value = -1
  } else {
    showSuggestions.value = false
  }
}

function handleFocus(): void {
  emit('focus')
  if (localValue.value.length > 0 && props.suggestions.length > 0) {
    showSuggestions.value = true
  }
}

function handleBlur(): void {
  emit('blur')
  // Delay hiding suggestions to allow click on suggestion
  setTimeout(() => {
    showSuggestions.value = false
    highlightedIndex.value = -1
  }, 200)
}

function handleKeydown(event: KeyboardEvent): void {
  if (!hasSuggestions.value) {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (localValue.value.trim().length > 0) {
        emit('search', localValue.value.trim())
        hideSuggestions()
      }
    }
    return
  }

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      highlightedIndex.value = Math.min(
        highlightedIndex.value + 1,
        props.suggestions.length - 1
      )
      break

    case 'ArrowUp':
      event.preventDefault()
      highlightedIndex.value = Math.max(highlightedIndex.value - 1, -1)
      break

    case 'Enter':
      event.preventDefault()
      if (highlightedIndex.value >= 0 && highlightedIndex.value < props.suggestions.length) {
        const suggestion = props.suggestions[highlightedIndex.value]
        if (suggestion) {
          selectSuggestion(suggestion)
        }
      } else if (localValue.value.trim().length > 0) {
        emit('search', localValue.value.trim())
        hideSuggestions()
      }
      break

    case 'Escape':
      event.preventDefault()
      hideSuggestions()
      inputRef.value?.blur()
      break

    case 'Tab':
      hideSuggestions()
      break
  }
}

function selectSuggestion(suggestion: string): void {
  localValue.value = suggestion
  emit('suggestionSelect', suggestion)
  emit('search', suggestion)
  hideSuggestions()
  inputRef.value?.focus()
}

function hideSuggestions(): void {
  showSuggestions.value = false
  highlightedIndex.value = -1
}

function clearInput(): void {
  localValue.value = ''
  emit('clear')
  showSuggestions.value = false
  inputRef.value?.focus()
}

function handleClickOutside(event: Event): void {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    hideSuggestions()
  }
}

// Lifecycle
onMounted(() => {
  if (props.autofocus) {
    nextTick(() => {
      inputRef.value?.focus()
    })
  }
  
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value)
  }
  document.removeEventListener('click', handleClickOutside)
})

// Expose methods for parent components
defineExpose({
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
  clear: clearInput
})
</script>

<template>
  <div 
    ref="containerRef"
    class="relative w-full"
  >
    <!-- Search Input -->
    <div class="relative">
      <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <MagnifyingGlassIcon 
          class="h-5 w-5 text-gray-400"
          :class="{ 'animate-pulse': loading }"
          aria-hidden="true"
        />
      </div>
      
      <input
        ref="inputRef"
        :value="localValue"
        type="search"
        :placeholder="placeholder || 'Search artworks...'"
        :disabled="disabled || false"
        class="
          block w-full pl-10 pr-12 py-3 
          border border-gray-300 rounded-lg
          bg-white text-gray-900 placeholder-gray-500
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
          sm:text-sm
        "
        :class="{
          'pr-20': showClear,
          'border-gray-300': !hasSuggestions,
          'border-blue-500 ring-1 ring-blue-500': hasSuggestions
        }"
        autocomplete="off"
        spellcheck="false"
        role="combobox"
        :aria-expanded="hasSuggestions"
        v-bind="activeDescendant ? { 'aria-activedescendant': activeDescendant } : {}"
        aria-autocomplete="list"
        aria-describedby="search-description"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown="handleKeydown"
      >
      
      <!-- Clear Button -->
      <div 
        v-if="showClear"
        class="absolute inset-y-0 right-0 flex items-center pr-3"
      >
        <button
          type="button"
          class="
            p-1 text-gray-400 hover:text-gray-600
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            rounded-full
          "
          :disabled="disabled || false"
          @click="clearInput"
          aria-label="Clear search"
        >
          <XMarkIcon class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>

    <!-- Screen reader description -->
    <div id="search-description" class="sr-only">
      Use arrow keys to navigate suggestions, Enter to select, Escape to close
    </div>

    <!-- Suggestions Dropdown -->
    <div
      v-if="hasSuggestions"
      class="
        absolute z-20 w-full mt-1 bg-white
        border border-gray-200 rounded-lg shadow-lg
        max-h-60 overflow-auto
      "
      role="listbox"
      aria-label="Search suggestions"
    >
      <ul class="py-1">
        <li
          v-for="(suggestion, index) in suggestions"
          :key="`suggestion-${index}`"
          :id="`suggestion-${index}`"
          class="
            px-4 py-2 cursor-pointer text-sm
            hover:bg-gray-50 focus:bg-gray-50
            flex items-center space-x-2
          "
          :class="{
            'bg-blue-50 text-blue-700': index === highlightedIndex,
            'text-gray-900': index !== highlightedIndex
          }"
          role="option"
          :aria-selected="index === highlightedIndex"
          @click="selectSuggestion(suggestion)"
          @mouseenter="highlightedIndex = index"
        >
          <MagnifyingGlassIcon class="h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden="true" />
          <span class="truncate">{{ suggestion }}</span>
        </li>
      </ul>
    </div>

    <!-- Loading Indicator -->
    <div
      v-if="loading && localValue.length > 0"
      class="absolute right-3 top-1/2 transform -translate-y-1/2"
      aria-hidden="true"
    >
      <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
    </div>
  </div>
</template>

<style scoped>
/* Custom search input styling */
input[type="search"]::-webkit-search-decoration,
input[type="search"]::-webkit-search-cancel-button,
input[type="search"]::-webkit-search-results-button,
input[type="search"]::-webkit-search-results-decoration {
  display: none;
}

/* Ensure suggestions dropdown appears above other content */
.relative {
  position: relative;
  z-index: 10;
}
</style>