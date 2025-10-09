<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeftIcon } from '@heroicons/vue/24/outline';
import ArtistLookup from '../components/ArtistLookup.vue';
import MiniMap from '../components/MiniMap.vue';
import LocationPickerModal from '../components/FastWorkflow/LocationPickerModal.vue';
import ConsentSection from '../components/FastWorkflow/ConsentSection.vue';

type ArtistRef = { id: string; name: string };

const route = useRoute();
const router = useRouter();
const id = String(route.params.id || '');

const loading = ref(true);
const submitting = ref(false);
const artwork = reactive<Record<string, any>>({});
const showLocationPicker = ref(false);
const isDirty = ref(false);
const originalFormState = ref<string>('');

// Consent state
const consentCheckboxes = ref({
  cc0Licensing: false,
  termsAndGuidelines: false,
  photoRights: false,
});

const allConsentsAccepted = computed(() => {
  return Object.values(consentCheckboxes.value).every(Boolean);
});

const form = reactive<{ 
  title: string; 
  description: string; 
  artists: ArtistRef[];
  lat: number;
  lon: number;
}>({
  title: '',
  description: '',
  artists: [],
  lat: 0,
  lon: 0,
});

// Setup beforeunload event to warn about unsaved changes
function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (isDirty.value) {
    e.preventDefault();
    e.returnValue = '';
  }
}

// Setup router navigation guard
const removeGuard = router.beforeEach((_to, from, next) => {
  if (isDirty.value && from.path.includes('/artwork/') && from.path.includes('/edit')) {
    const answer = window.confirm(
      'You have unsaved changes. Are you sure you want to leave this page?'
    );
    if (!answer) {
      next(false);
      return;
    }
  }
  next();
});

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
  if (removeGuard) removeGuard();
});

onMounted(async () => {
  // Add beforeunload listener
  window.addEventListener('beforeunload', handleBeforeUnload);
  
  try {
    const res = await fetch(`/api/artworks/${id}`);
    if (res.ok) {
      const response = await res.json();
      const data = response.data; // Extract the nested data object
      Object.assign(artwork, data || {});
      // Title fallback: prefer explicit title, then tags_parsed.title
      form.title = data?.title || data?.tags_parsed?.title || '';

      // Description fallback: prefer explicit description, then tags_parsed.description, then first logbook entry notes
      if (data?.description && String(data.description).trim()) {
        form.description = data.description;
      } else if (data?.tags_parsed?.description && String(data.tags_parsed.description).trim()) {
        form.description = data.tags_parsed.description;
      } else if (data?.logbook_entries && data.logbook_entries.length > 0 && data.logbook_entries[0].notes) {
        form.description = data.logbook_entries[0].notes;
      } else {
        form.description = '';
      }

      // Artists: prefer linked artists array, then tags_parsed.artist_ids (comma-separated or array), then tags_parsed.artist (name string)
      if (Array.isArray(data?.artists) && data.artists.length > 0) {
        form.artists = data.artists.map((a: any) => ({ id: String(a.id), name: String(a.name || 'Unknown') }));
      } else if (data?.tags_parsed?.artist_ids) {
        const idsRaw = data.tags_parsed.artist_ids;
        const ids = Array.isArray(idsRaw) ? idsRaw : String(idsRaw).split(',').map((s: string) => s.trim()).filter(Boolean);
        form.artists = ids.map((aid: any) => ({ id: String(aid), name: String(aid) }));
      } else if (data?.tags_parsed?.artist) {
        // No linked artist record; populate a placeholder creator name in artists list
        form.artists = [{ id: 'unknown', name: String(data.tags_parsed.artist) }];
      } else {
        form.artists = [];
      }

      // Location: from artwork coordinates
      form.lat = data?.lat || 0;
      form.lon = data?.lon || 0;

      // Store original state after loading
      originalFormState.value = JSON.stringify(form);
      
      // Watch for changes
      const checkDirty = () => {
        isDirty.value = originalFormState.value !== JSON.stringify(form);
      };
      
      // Simple interval check for changes (works better than deep watchers)
      const interval = setInterval(checkDirty, 500);
      
      // Clean up interval on unmount
      onBeforeUnmount(() => {
        clearInterval(interval);
      });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to load artwork', e);
  } finally {
    loading.value = false;
  }
});

async function saveEdit() {
  submitting.value = true;
  try {
    const old_data = {
      title: artwork.title || '',
      description: artwork.description || '',
      artists: (artwork.artists || []).map((a: any) => String(a.id)),
      lat: artwork.lat || 0,
      lon: artwork.lon || 0,
    };
    const new_data = {
      title: form.title,
      description: form.description,
      artists: form.artists.map((a: ArtistRef) => String(a.id)),
      lat: form.lat,
      lon: form.lon,
    };

    const body = {
      artwork_id: id,
      old_data,
      new_data,
      consent_version: '1.0',
    };

    const res = await fetch('/api/submissions/artwork-edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      // Clear dirty flag on successful save
      isDirty.value = false;
      
      const data = await res.json().catch(() => ({}));
      // navigate to artwork detail with success param
      // prefer named route if available
      router.push({ name: 'ArtworkDetail', params: { id }, query: { submitted: String((data as any).submission_id || true) } }).catch(() => {});
    } else {
      const err = await res.json().catch(() => ({}));
      // eslint-disable-next-line no-console
      console.error('Submission failed', err);
      // eslint-disable-next-line no-alert
      alert('Submission failed: ' + (err.message || res.statusText));
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Submission error', e);
    // eslint-disable-next-line no-alert
    alert('Submission error');
  } finally {
    submitting.value = false;
  }
}

function openLocationPicker() {
  showLocationPicker.value = true;
}

function handleLocationSelected(lat: number, lon: number) {
  form.lat = lat;
  form.lon = lon;
  showLocationPicker.value = false;
}

// Handle consent change from ConsentSection
function handleConsentChanged(consents: { cc0Licensing: boolean; termsAndGuidelines: boolean; photoRights: boolean }) {
  consentCheckboxes.value = consents;
}
</script>

<template>
  <div class="max-w-3xl mx-auto p-4">
    <!-- Back to Artwork Link -->
    <div class="mb-4">
      <router-link 
        :to="{ name: 'ArtworkDetail', params: { id } }" 
        class="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium"
      >
        <ArrowLeftIcon class="w-4 h-4 mr-1" />
        Back to Artwork
      </router-link>
    </div>

    <h1 class="text-2xl font-semibold mb-6">Edit Artwork</h1>

    <div v-if="loading" class="text-center py-8">Loading...</div>

    <div v-else class="bg-white shadow-md rounded-lg p-6">
      <!-- Title -->
      <div class="mb-6">
        <label class="block text-sm font-medium text-gray-700 mb-1">Title</label>
        <input 
          v-model="form.title" 
          class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
          maxlength="200"
          placeholder="Enter artwork title..."
        />
        <p class="text-xs text-gray-500 mt-1">Max 200 characters</p>
      </div>

      <!-- Artists - moved under title -->
      <div class="mb-6">
        <ArtistLookup v-model="form.artists" />
      </div>

      <!-- Description -->
      <div class="mb-6">
        <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <details class="mb-2 text-xs text-gray-600">
          <summary class="cursor-pointer hover:text-gray-800 font-medium">Markdown formatting tips</summary>
          <ul class="mt-2 ml-4 space-y-1 font-mono bg-gray-50 p-2 rounded">
            <li><strong>**bold**</strong> → <strong>bold</strong></li>
            <li><em>_italic_</em> → <em>italic</em></li>
            <li># Heading 1, ## Heading 2</li>
            <li>* item for bullet lists</li>
            <li>[text](https://link) for links</li>
          </ul>
        </details>
        <textarea 
          v-model="form.description" 
          class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
          rows="12" 
          maxlength="10000"
          placeholder="Describe the artwork, its history, significance, or any interesting details..."
        ></textarea>
        <p class="text-xs text-gray-500 mt-1">Max 10000 characters</p>
      </div>

      <!-- Location -->
      <div class="mb-6">
        <label class="block text-sm font-medium text-gray-700 mb-2">Location</label>
        
        <!-- Mini Map Display -->
        <div v-if="form.lat !== 0 && form.lon !== 0" class="mb-3">
          <MiniMap 
            :latitude="form.lat" 
            :longitude="form.lon" 
            height="300px"
            class="rounded-md overflow-hidden border border-gray-300"
          />
        </div>
        
        <!-- Coordinates Display -->
        <div class="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-md border border-gray-200 mb-2">
          <div class="text-sm">
            <span class="font-medium text-gray-700">Coordinates:</span>
            <span class="ml-2 text-gray-600">{{ form.lat.toFixed(6) }}, {{ form.lon.toFixed(6) }}</span>
          </div>
          <button
            type="button"
            @click="openLocationPicker"
            class="text-sm text-blue-600 hover:text-blue-800 font-medium focus:outline-none focus:underline"
          >
            Select Location
          </button>
        </div>
        <p class="text-xs text-gray-500">Click "Select Location" to update the artwork's coordinates</p>
      </div>

      <!-- Consent Section -->
      <div class="mb-6">
        <ConsentSection 
          consent-version="1.0"
          @consent-changed="handleConsentChanged"
        />
      </div>

      <!-- Action Buttons: Cancel on left, Save on right -->
      <div class="flex items-center justify-between pt-4 border-t border-gray-200">
        <router-link
          :to="{ name: 'ArtworkDetail', params: { id } }"
          class="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50 font-medium focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          Cancel
        </router-link>

        <button
          @click="saveEdit"
          :disabled="submitting || !form.title.trim() || !allConsentsAccepted"
          class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {{ submitting ? 'Saving...' : 'Save Changes' }}
        </button>
      </div>
    </div>

    <!-- Location Picker Modal -->
    <LocationPickerModal
      v-if="showLocationPicker"
      :initialLat="form.lat"
      :initialLon="form.lon"
      @close="showLocationPicker = false"
      @locationSelected="handleLocationSelected"
    />
  </div>
</template>

<style scoped>
/* Minimal styling; existing Tailwind classes are used */
</style>
