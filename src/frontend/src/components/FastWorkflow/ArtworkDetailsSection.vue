<!--
  Artwork Details Section
  Form for entering new artwork information
-->

<script setup lang="ts">
import { ref } from 'vue';
import { XMarkIcon, InformationCircleIcon } from '@heroicons/vue/24/outline';

interface Props {
  title: string;
  artworkType: string;
  tags: Record<string, string | number>;
  note: string;
}

interface CustomTag {
  key: string;
  value: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update': [details: {
    title?: string;
    artworkType?: string;
    tags?: Record<string, string | number>;
    note?: string;
  }];
}>();

// Local state for custom tags
const customTags = ref<CustomTag[]>([]);

// Initialize custom tags from existing tags
const commonTagKeys = ['material', 'artist', 'year_created', 'style'];
Object.entries(props.tags).forEach(([key, value]) => {
  if (!commonTagKeys.includes(key)) {
    customTags.value.push({ key, value: String(value) });
  }
});

// Methods
function updateTitle(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('update', { title: target.value });
}

function updateArtworkType(event: Event) {
  const target = event.target as HTMLSelectElement;
  emit('update', { artworkType: target.value });
}

function updateNote(event: Event) {
  const target = event.target as HTMLTextAreaElement;
  if (target.value.length <= 500) {
    emit('update', { note: target.value });
  }
}

function updateTag(key: string, event: Event) {
  const target = event.target as HTMLInputElement;
  const value = key === 'year_created' ? (target.value ? parseInt(target.value, 10) : '') : target.value;
  
  const newTags = { ...props.tags };
  if (target.value.trim() === '') {
    delete newTags[key];
  } else {
    newTags[key] = value;
  }
  
  emit('update', { tags: newTags });
}

function addCustomTag() {
  customTags.value.push({ key: '', value: '' });
}

function removeCustomTag(index: number) {
  const tag = customTags.value[index];
  if (tag) {
    customTags.value.splice(index, 1);
    
    // Remove from tags if it exists
    if (tag.key) {
      const newTags = { ...props.tags };
      delete newTags[tag.key];
      emit('update', { tags: newTags });
    }
  }
}

function updateCustomTagKey(index: number, event: Event) {
  const target = event.target as HTMLInputElement;
  const tag = customTags.value[index];
  if (!tag) return;
  
  const oldKey = tag.key;
  tag.key = target.value;
  
  // Update tags object
  const newTags = { ...props.tags };
  if (oldKey && oldKey !== target.value) {
    delete newTags[oldKey];
  }
  if (target.value && tag.value) {
    newTags[target.value] = tag.value;
  }
  
  emit('update', { tags: newTags });
}

function updateCustomTagValue(index: number, event: Event) {
  const target = event.target as HTMLInputElement;
  const tag = customTags.value[index];
  if (!tag) return;
  
  tag.value = target.value;
  
  // Update tags object
  const key = tag.key;
  if (key) {
    const newTags = { ...props.tags };
    if (target.value.trim() === '') {
      delete newTags[key];
    } else {
      newTags[key] = target.value;
    }
    emit('update', { tags: newTags });
  }
}
</script>

<template>
  <div class="artwork-details-section">
    <div class="mb-6">
      <h4 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        New Artwork Details
      </h4>
      <p class="text-sm text-gray-600 dark:text-gray-300">
        Provide basic information about the cultural artwork. Only the title is required.
      </p>
    </div>

    <div class="space-y-6">
      <!-- Title (Required) -->
      <div>
        <label for="artwork-title" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Title *
        </label>
        <input
          id="artwork-title"
          type="text"
          :value="title"
          @input="updateTitle"
          placeholder="e.g., Bronze Sculpture, Street Mural, Memorial Plaque"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          required
        />
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          A descriptive name for the artwork
        </p>
      </div>

      <!-- Artwork Type -->
      <div>
        <label for="artwork-type" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Artwork Type
        </label>
        <select
          id="artwork-type"
          :value="artworkType"
          @change="updateArtworkType"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
        >
          <option value="public_art">Public Art</option>
          <option value="sculpture">Sculpture</option>
          <option value="mural">Mural/Wall Art</option>
          <option value="memorial">Memorial</option>
          <option value="architectural">Architectural Feature</option>
          <option value="installation">Installation</option>
          <option value="other">Other</option>
        </select>
      </div>

      <!-- Tags -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tags (Optional)
        </label>
        <div class="space-y-4">
          <!-- Common Tag Inputs -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="tag-material" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Material
              </label>
              <input
                id="tag-material"
                type="text"
                :value="tags.material || ''"
                @input="updateTag('material', $event)"
                placeholder="bronze, wood, concrete..."
                class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label for="tag-artist" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Artist/Creator
              </label>
              <input
                id="tag-artist"
                type="text"
                :value="tags.artist || ''"
                @input="updateTag('artist', $event)"
                placeholder="Artist or organization name"
                class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label for="tag-year" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Year Created
              </label>
              <input
                id="tag-year"
                type="number"
                :value="tags.year_created || ''"
                @input="updateTag('year_created', $event)"
                placeholder="e.g., 1995"
                min="1800"
                :max="new Date().getFullYear()"
                class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label for="tag-style" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Style/Theme
              </label>
              <input
                id="tag-style"
                type="text"
                :value="tags.style || ''"
                @input="updateTag('style', $event)"
                placeholder="modern, abstract, historical..."
                class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <!-- Custom Tags -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">
                Custom Tags
              </label>
              <button
                type="button"
                @click="addCustomTag"
                class="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                + Add Tag
              </button>
            </div>

            <div v-if="customTags.length > 0" class="space-y-2">
              <div
                v-for="(tag, index) in customTags"
                :key="index"
                class="flex items-center space-x-2"
              >
                <input
                  :value="tag.key"
                  @input="updateCustomTagKey(index, $event)"
                  placeholder="Tag name"
                  class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <input
                  :value="tag.value"
                  @input="updateCustomTagValue(index, $event)"
                  placeholder="Value"
                  class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <button
                  type="button"
                  @click="removeCustomTag(index)"
                  class="p-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                >
                  <XMarkIcon class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Tags help others find and categorize the artwork. Add as many details as you know.
        </p>
      </div>

      <!-- Notes -->
      <div>
        <label for="artwork-note" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Additional Notes (Optional)
        </label>
        <textarea
          id="artwork-note"
          :value="note"
          @input="updateNote"
          rows="4"
          placeholder="Any additional information about the artwork, its history, condition, or significance..."
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
        ></textarea>
        <div class="mt-1 flex justify-between">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Share any context that would help others understand or locate the artwork
          </p>
          <span class="text-sm text-gray-400">
            {{ note.length }}/500
          </span>
        </div>
      </div>
    </div>

    <!-- Quick Fill Tips -->
    <div class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <h5 class="flex items-center font-medium text-blue-900 dark:text-blue-100 mb-2">
        <InformationCircleIcon class="w-5 h-5 mr-2" />
        Quick Tips
      </h5>
      <ul class="text-sm text-blue-800 dark:text-blue-200 space-y-1">
        <li>• Only the title is required - you can always add more details later</li>
        <li>• Look for plaques or signs near the artwork for artist and date information</li>
        <li>• Describe materials, colors, or unique features to help with identification</li>
        <li>• Include historical context or significance if you know it</li>
      </ul>
    </div>
  </div>
</template>