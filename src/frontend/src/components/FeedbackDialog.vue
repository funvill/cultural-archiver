<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useFeedbackStore } from '../stores/feedback';
import { MAX_FEEDBACK_NOTE_LENGTH } from '../../../shared/types';
import type { CreateFeedbackRequest } from '../../../shared/types';

// Props
interface Props {
  open: boolean;
  subjectType: 'artwork' | 'artist';
  subjectId: string;
  mode: 'missing' | 'comment';
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'comment',
});

// Emits
const emit = defineEmits<{
  close: [];
  cancel: [];
  success: [feedbackId: string];
}>();

// Store
const feedbackStore = useFeedbackStore();

// Constants
const DEFAULT_MISSING_TEXT = 'The artwork is missing';

// State
const note = ref<string>('');
const sending = ref(false);
const error = ref<string | null>(null);
const initialNote = ref<string>(''); // Track original note value

// Computed
const title = computed(() => {
  if (props.mode === 'missing') {
    return props.subjectType === 'artwork' ? 'Report Missing Artwork' : 'Report Missing Artist';
  }
  return 'Report an Issue';
});

const placeholder = computed(() => {
  if (props.mode === 'missing') {
    return 'Add additional details (optional)';
  }
  return 'Describe the issue you observed...';
});

const sendDisabled = computed(() => {
  const trimmed = note.value.trim();
  return trimmed.length === 0 || trimmed.length > MAX_FEEDBACK_NOTE_LENGTH || sending.value;
});

const hasChanges = computed(() => {
  return note.value !== initialNote.value;
});

// Watch for dialog open/close
watch(() => props.open, (isOpen: boolean) => {
  if (isOpen) {
    // Reset state when dialog opens
    if (props.mode === 'missing') {
      note.value = DEFAULT_MISSING_TEXT;
      initialNote.value = DEFAULT_MISSING_TEXT;
    } else {
      note.value = '';
      initialNote.value = '';
    }
    error.value = null;
    sending.value = false;
  }
});

// Methods
function onCancel() {
  // If user has made changes, confirm before closing
  if (hasChanges.value) {
    const confirmed = confirm('You have unsaved changes. Are you sure you want to close?');
    if (!confirmed) {
      return;
    }
  }
  
  emit('close');
  emit('cancel');
}

async function onSend() {
  if (sendDisabled.value) return;

  sending.value = true;
  error.value = null;

  try {
    const request: CreateFeedbackRequest = {
      subject_type: props.subjectType,
      subject_id: props.subjectId,
      issue_type: props.mode === 'missing' ? 'missing' : 'comment',
      note: note.value.trim(),
    };

    const response = await feedbackStore.submitFeedback(request);
    
    // Success - emit success event and close dialog
    emit('success', response.id);
    emit('close');
  } catch (err) {
    console.error('Error sending feedback:', err);
    error.value = err instanceof Error ? err.message : 'Failed to send feedback. Please try again.';
  } finally {
    sending.value = false;
  }
}

// Handle keyboard events
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    onCancel();
  } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !sendDisabled.value) {
    onSend();
  }
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    @click.self="onCancel"
    @keydown="onKeydown"
  >
    <div
      class="w-full max-w-lg bg-white rounded-lg shadow-xl"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="`feedback-dialog-title-${subjectId}`"
    >
      <div class="p-6">
        <!-- Header -->
        <h3
          :id="`feedback-dialog-title-${subjectId}`"
          class="text-xl font-semibold text-gray-900 mb-2"
        >
          {{ title }}
        </h3>
        <p class="text-sm text-gray-600 mb-4">
          This feedback will be sent privately to moderators who will review and update the content.
        </p>

        <!-- Textarea -->
        <div class="mb-4">
          <label :for="`feedback-note-${subjectId}`" class="sr-only">
            Feedback note
          </label>
          <textarea
            :id="`feedback-note-${subjectId}`"
            v-model="note"
            :placeholder="placeholder"
            :maxlength="MAX_FEEDBACK_NOTE_LENGTH"
            class="w-full h-32 p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            :aria-invalid="error ? 'true' : 'false'"
            :aria-describedby="error ? `feedback-error-${subjectId}` : ''"
          />
          
          <!-- Character counter -->
          <div class="flex justify-between items-center mt-2">
            <span class="text-sm text-gray-500" aria-live="polite">
              {{ note.length }} / {{ MAX_FEEDBACK_NOTE_LENGTH }}
            </span>
          </div>
        </div>

        <!-- Error message -->
        <div
          v-if="error"
          :id="`feedback-error-${subjectId}`"
          class="mb-4 p-3 bg-red-50 border border-red-200 rounded-md"
          role="alert"
        >
          <p class="text-sm text-red-600">{{ error }}</p>
        </div>

        <!-- Actions -->
        <div class="flex justify-end space-x-3">
          <button
            type="button"
            @click="onCancel"
            :disabled="sending"
            class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="onSend"
            :disabled="sendDisabled"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span v-if="sending">Sending...</span>
            <span v-else>Send</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Ensure dialog is above all other content */
.z-50 {
  z-index: 50;
}
</style>
