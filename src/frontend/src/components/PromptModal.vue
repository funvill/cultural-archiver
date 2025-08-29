<template>
  <teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 overflow-y-auto"
      @keydown.escape="handleEscape"
      @click="handleBackdropClick"
      role="dialog"
      :aria-modal="true"
      :aria-labelledby="titleId"
      :aria-describedby="descriptionId"
    >
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity" />
      
      <!-- Modal Panel -->
      <div class="flex min-h-full items-center justify-center p-4">
        <div
          ref="modalPanel"
          class="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6 transform transition-all"
          @click.stop
        >
          <!-- Header -->
          <div class="mb-4">
            <div class="flex items-center justify-between">
              <h3 :id="titleId" class="text-lg font-semibold text-gray-900">
                {{ title }}
              </h3>
              <button
                v-if="showCloseButton"
                @click="cancel"
                class="text-gray-400 hover:text-gray-600 focus:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md p-1"
                aria-label="Close modal"
              >
                <XMarkIcon class="w-6 h-6" aria-hidden="true" />
              </button>
            </div>
          </div>

          <!-- Content -->
          <div :id="descriptionId" class="mb-6">
            <p v-if="message" class="text-gray-600 mb-4">{{ message }}</p>
            
            <!-- Input Field -->
            <div>
              <label v-if="inputLabel" :for="inputId" class="block text-sm font-medium text-gray-700 mb-2">
                {{ inputLabel }}
              </label>
              <textarea
                v-if="multiline"
                :id="inputId"
                ref="inputElement"
                v-model="inputValue"
                v-bind="{
                  ...(placeholder ? { placeholder } : {}),
                  ...(maxLength ? { maxlength: maxLength } : {}),
                  ...(required ? { required: true } : {})
                }"
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                :class="{ 'border-red-500 focus:ring-red-500 focus:border-red-500': hasError }"
                rows="3"
                :aria-describedby="hasError ? `${inputId}-error` : undefined"
                :aria-invalid="hasError"
                @keydown.ctrl.enter="confirm"
                @keydown.meta.enter="confirm"
              />
              <input
                v-else
                :id="inputId"
                ref="inputElement"
                v-model="inputValue"
                type="text"
                v-bind="{
                  ...(placeholder ? { placeholder } : {}),
                  ...(maxLength ? { maxlength: maxLength } : {}),
                  ...(required ? { required: true } : {})
                }"
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                :class="{ 'border-red-500 focus:ring-red-500 focus:border-red-500': hasError }"
                :aria-describedby="hasError ? `${inputId}-error` : undefined"
                :aria-invalid="hasError"
                @keydown.enter="confirm"
              />
              
              <!-- Character count -->
              <div v-if="maxLength" class="flex justify-between items-center mt-1">
                <p v-if="hasError" :id="`${inputId}-error`" class="text-sm text-red-600" role="alert">
                  {{ errorMessage }}
                </p>
                <span v-else class="text-sm text-gray-500">
                  {{ inputValue.length }}/{{ maxLength }}
                </span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex justify-end space-x-3">
            <button
              ref="cancelButton"
              @click="cancel"
              type="button"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              {{ cancelText }}
            </button>
            <button
              ref="confirmButton"
              @click="confirm"
              type="button"
              :disabled="!canConfirm"
              class="px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              :class="confirmButtonClass"
            >
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted, computed } from 'vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'

interface Props {
  isOpen: boolean
  title?: string
  message?: string
  inputLabel?: string
  placeholder?: string
  defaultValue?: string
  confirmText?: string
  cancelText?: string
  showCloseButton?: boolean
  variant?: 'primary' | 'danger' | 'warning'
  preventEscapeClose?: boolean
  preventBackdropClose?: boolean
  required?: boolean
  multiline?: boolean
  maxLength?: number
  validator?: (value: string) => string | null
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Input Required',
  confirmText: 'OK',
  cancelText: 'Cancel',
  showCloseButton: true,
  variant: 'primary',
  preventEscapeClose: false,
  preventBackdropClose: false,
  required: false,
  multiline: false
})

interface Emits {
  (e: 'update:isOpen', value: boolean): void
  (e: 'confirm', value: string): void
  (e: 'cancel'): void
  (e: 'close'): void
}

const emit = defineEmits<Emits>()

// Refs
const modalPanel = ref<HTMLElement>()
const inputElement = ref<HTMLInputElement | HTMLTextAreaElement>()
const confirmButton = ref<HTMLElement>()
const cancelButton = ref<HTMLElement>()

// State
const inputValue = ref('')
const previouslyFocused = ref<HTMLElement | null>(null)

// Computed
const inputId = computed(() => `prompt-input-${Math.random().toString(36).substr(2, 9)}`)
const titleId = computed(() => `prompt-title-${Math.random().toString(36).substr(2, 9)}`)
const descriptionId = computed(() => `prompt-description-${Math.random().toString(36).substr(2, 9)}`)

const confirmButtonClass = computed(() => {
  const baseClass = 'focus:ring-2 focus:ring-offset-2'
  switch (props.variant) {
    case 'danger':
      return `${baseClass} bg-red-600 hover:bg-red-700 focus:ring-red-500`
    case 'warning':
      return `${baseClass} bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500`
    default:
      return `${baseClass} bg-blue-600 hover:bg-blue-700 focus:ring-blue-500`
  }
})

const errorMessage = computed(() => {
  if (props.validator) {
    return props.validator(inputValue.value)
  }
  return null
})

const hasError = computed(() => {
  return errorMessage.value !== null
})

const canConfirm = computed(() => {
  if (props.required && !inputValue.value.trim()) {
    return false
  }
  if (hasError.value) {
    return false
  }
  return true
})

// Methods
function close() {
  emit('update:isOpen', false)
  emit('close')
  restoreFocus()
}

function confirm() {
  if (!canConfirm.value) return
  
  emit('confirm', inputValue.value)
  close()
}

function cancel() {
  emit('cancel')
  close()
}

function handleEscape(event: KeyboardEvent) {
  if (!props.preventEscapeClose && event.key === 'Escape') {
    cancel()
  }
}

function handleBackdropClick() {
  if (!props.preventBackdropClose) {
    cancel()
  }
}

// Focus management
function setInitialFocus() {
  nextTick(() => {
    inputElement.value?.focus()
    inputElement.value?.select()
  })
}

function saveFocus() {
  previouslyFocused.value = document.activeElement as HTMLElement
}

function restoreFocus() {
  nextTick(() => {
    previouslyFocused.value?.focus()
    previouslyFocused.value = null
  })
}

// Tab trapping
function handleKeydown(event: KeyboardEvent) {
  if (!props.isOpen || event.key !== 'Tab') return
  
  const panel = modalPanel.value
  if (!panel) return
  
  const focusableElements = panel.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  
  const firstElement = focusableElements[0] as HTMLElement
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement
  
  if (event.shiftKey) {
    // Shift+Tab: moving backwards
    if (document.activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
    }
  } else {
    // Tab: moving forwards
    if (document.activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
    }
  }
}

// Body scroll management
function disableBodyScroll() {
  document.body.style.overflow = 'hidden'
}

function enableBodyScroll() {
  document.body.style.overflow = ''
}

// Watchers and lifecycle
import { watch } from 'vue'

watch(() => props.isOpen, (newValue) => {
  if (newValue) {
    saveFocus()
    disableBodyScroll()
    inputValue.value = props.defaultValue || ''
    setInitialFocus()
  } else {
    enableBodyScroll()
  }
})

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  
  // If modal opens on mount
  if (props.isOpen) {
    saveFocus()
    disableBodyScroll()
    inputValue.value = props.defaultValue || ''
    setInitialFocus()
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  enableBodyScroll()
  
  // Restore focus if modal was open when component unmounts
  if (props.isOpen) {
    restoreFocus()
  }
})
</script>

<style scoped>
/* Ensure modal is above everything */
.fixed.inset-0.z-50 {
  z-index: 9999;
}

/* Smooth animations */
.transition-opacity {
  transition: opacity 0.2s ease-in-out;
}

.transition-all {
  transition: all 0.2s ease-in-out;
}

/* Focus styles */
button:focus,
input:focus,
textarea:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
}

/* Animation for modal appearance */
@keyframes modal-fade-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.transform.transition-all {
  animation: modal-fade-in 0.2s ease-out;
}

/* Error state styling */
.border-red-500 {
  border-color: #ef4444;
}

.border-red-500:focus {
  --tw-ring-color: #ef4444;
}
</style>