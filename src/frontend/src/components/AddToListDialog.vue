<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { apiService } from '../services/api';

// Props
interface Props {
  artworkId: string;
  modelValue: boolean; // v-model binding for dialog visibility
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean];

  addedToList: [listName: string];
}>();

// Stores
const authStore = useAuthStore();

// State
const loading = ref(false);
const error = ref<string | null>(null);
const userLists = ref<any[]>([]);
const newListName = ref('');
const selectedLists = ref<Set<string>>(new Set());

// Computed
const isOpen = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
});

// Load user's lists
const loadUserLists = async () => {
  if (!authStore.isAuthenticated) return;
  
  loading.value = true;
  error.value = null;
  
  try {
    const response = await apiService.getUserLists();
    if (response.success && response.data) {
      userLists.value = response.data.filter((list: any) => 
        !list.is_system_list // Only show user lists, hide all system lists
      );
    } else {
      error.value = response.error || 'Failed to load lists';
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load lists';
  } finally {
    loading.value = false;
  }
};

// Create new list
const createList = async () => {
  if (!newListName.value.trim()) return;
  
  loading.value = true;
  error.value = null;
  
  try {
    const response = await apiService.createList(newListName.value.trim());
    
    if (response.success && response.data) {
      // Add the new list to the local array
      userLists.value.push({
        id: response.data.id,
        name: response.data.name,
        item_count: 0,
        is_system_list: false,
        is_readonly: false
      });
      
      // Select the new list
      selectedLists.value.add(response.data.id);
      newListName.value = '';
    } else {
      error.value = response.error || 'Failed to create list';
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to create lists';
  } finally {
    loading.value = false;
  }
};

// Add artwork to selected lists
const addToLists = async () => {
  if (selectedLists.value.size === 0 && !newListName.value.trim()) return;
  
  // Create new list first if specified
  if (newListName.value.trim()) {
    await createList();
    if (error.value) return; // Stop if creation failed
  }
  
  loading.value = true;
  error.value = null;
  
  try {
    const promises = Array.from(selectedLists.value).map(listId => 
      apiService.addArtworkToList(listId, props.artworkId)
    );
    
    const results = await Promise.allSettled(promises);
    const failures = results.filter((result): result is PromiseRejectedResult => 
      result.status === 'rejected'
    );
    
    if (failures.length === 0) {
      const listNames = Array.from(selectedLists.value).map(listId => 
        userLists.value.find(list => list.id === listId)?.name || 'Unknown List'
      );
      

      emit('addedToList', listNames.join(', '));
      closeDialog();
    } else {
      error.value = `Failed to add to ${failures.length} list(s)`;
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to add to lists';
  } finally {
    loading.value = false;
  }
};

// Toggle list selection
const toggleList = (listId: string) => {
  if (selectedLists.value.has(listId)) {
    selectedLists.value.delete(listId);
  } else {
    selectedLists.value.add(listId);
  }
};

// Close dialog
const closeDialog = () => {
  isOpen.value = false;
  selectedLists.value.clear();
  newListName.value = '';
  error.value = null;
};

// Load lists when dialog opens
// Load lists when dialog opens (watch v-model) so lists appear whenever the
// dialog is toggled open. Also load once on mount in case it's already open.
onMounted(() => {
  if (isOpen.value) {
    loadUserLists();
  }
});

watch(isOpen, (val) => {
  if (val) loadUserLists();
});
</script>

<template>
  <div 
    v-if="isOpen" 
    @click="closeDialog"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
    @keydown.escape="closeDialog"
  >
    <div 
      @click.stop
      class="bg-white rounded-lg shadow-xl max-w-md w-full max-h-96 overflow-hidden"
      role="dialog"
      aria-labelledby="dialog-title"
      aria-modal="true"
    >
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-200">
        <h3 id="dialog-title" class="text-lg font-medium text-gray-900">
          Add to List
        </h3>
        <button 
          @click="closeDialog"
          class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full p-1"
          aria-label="Close dialog"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <!-- Content -->
      <div class="px-6 py-4 max-h-64 overflow-y-auto">
        <!-- Loading state -->
        <div v-if="loading" class="flex items-center justify-center py-8">
          <svg class="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="ml-2 text-gray-600">Loading lists...</span>
        </div>
        
        <!-- Error state -->
        <div v-else-if="error" class="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p class="text-sm text-red-700">{{ error }}</p>
        </div>
        
        <!-- Lists -->
        <div v-else class="space-y-3">
          <!-- Existing lists -->
          <div v-if="userLists.length > 0">
            <h4 class="text-sm font-medium text-gray-900 mb-2">Your Lists</h4>
            <div class="space-y-2">
              <label 
                v-for="list in userLists" 
                :key="list.id"
                class="flex items-center p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                :class="{ 'opacity-50': list.item_count >= 1000 }"
              >
                <input 
                  type="checkbox"
                  :checked="selectedLists.has(list.id)"
                  @change="toggleList(list.id)"
                  :disabled="list.item_count >= 1000"
                  class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <div class="ml-3 flex-1">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-gray-900">
                      {{ list.name }}
                      <span v-if="list.item_count >= 1000" class="text-xs text-gray-500">(full)</span>
                    </span>
                    <span class="text-xs text-gray-500">{{ list.item_count }} items</span>
                  </div>
                </div>
              </label>
            </div>
          </div>
          
          <!-- Create new list -->
          <div class="border-t border-gray-200 pt-3">
            <h4 class="text-sm font-medium text-gray-900 mb-2">Create New List</h4>
            <input 
              v-model="newListName"
              type="text"
              placeholder="Enter list name..."
              maxlength="255"
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              @keydown.enter="addToLists"
            />
            <p class="text-xs text-gray-500 mt-1">{{ newListName.length }}/255 characters</p>
          </div>
          
          <!-- Empty state -->
          <div v-if="userLists.length === 0 && !newListName.trim()" class="text-center py-6">
            <p class="text-sm text-gray-500">You don't have any lists yet.</p>
            <p class="text-xs text-gray-400 mt-1">Create your first list by entering a name above.</p>
          </div>
        </div>
      </div>
      
      <!-- Footer -->
      <div class="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
        <button 
          @click="closeDialog"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          Cancel
        </button>
        <button 
          @click="addToLists"
          :disabled="loading || (selectedLists.size === 0 && !newListName.trim())"
          class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {{ loading ? 'Adding...' : 'Done' }}
        </button>
      </div>
    </div>
  </div>
</template>