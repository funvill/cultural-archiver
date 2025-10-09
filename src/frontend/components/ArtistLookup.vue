<script setup lang="ts">
import { ref, watch } from 'vue';

type Artist = { id: string; name: string; description_short?: string };

const props = defineProps<{ modelValue?: Artist[]; limit?: number }>();
const emit = defineEmits(['update:modelValue']);

const query = ref('');
const results = ref<Artist[]>([]);
const selected = ref<Artist[]>(props.modelValue ? [...props.modelValue] : []);
const showDropdown = ref(false);
const highlighted = ref(-1);
const limit = props.limit ?? 10;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

watch(() => props.modelValue, (v: Artist[] | undefined) => {
  selected.value = v ? [...v] : [];
});

function onInput() {
  showDropdown.value = true;
  highlighted.value = -1;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(fetchResults, 300);
}

async function fetchResults() {
  if (!query.value || query.value.trim().length === 0) {
    results.value = [];
    return;
  }

  try {
    const q = encodeURIComponent(query.value.trim());
    const res = await fetch(`/api/artists/search?q=${q}&limit=${limit}`);
    if (!res.ok) {
      results.value = [];
      return;
    }
    const data = await res.json();
    results.value = Array.isArray(data) ? data : (data?.data || []);
  } catch (err) {
    results.value = [];
  }
}

function select(artist: Artist) {
  if (!selected.value.find((a: Artist) => a.id === artist.id)) {
    selected.value.push(artist);
    emit('update:modelValue', selected.value.slice());
  }
  query.value = '';
  results.value = [];
  showDropdown.value = false;
}

function removeArtist(id: string) {
  selected.value = selected.value.filter((a: Artist) => a.id !== id);
  emit('update:modelValue', selected.value.slice());
}

function highlightNext() {
  if (!results.value.length) return;
  highlighted.value = Math.min(results.value.length - 1, highlighted.value + 1);
}

function highlightPrev() {
  if (!results.value.length) return;
  highlighted.value = Math.max(0, highlighted.value - 1);
}

function selectHighlighted() {
  if (highlighted.value >= 0 && highlighted.value < results.value.length) {
    const item = results.value[highlighted.value];
    if (item) select(item);
  }
}
</script>

<template>
  <div class="artist-lookup">
    <label class="block text-sm font-medium text-gray-700">Artists</label>
    <div class="mt-1 flex items-center flex-wrap gap-2">
      <template v-for="artist in selected" :key="artist.id">
        <span class="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-sm">
          <span class="mr-2">{{ artist.name }}</span>
          <button type="button" @click="removeArtist(artist.id)" aria-label="Remove artist" class="text-gray-500 hover:text-gray-700">×</button>
        </span>
      </template>
    </div>

    <div class="relative mt-2">
      <input
        v-model="query"
        @input="onInput"
        @keydown.down.prevent="highlightNext"
        @keydown.up.prevent="highlightPrev"
        @keydown.enter.prevent="selectHighlighted"
        type="text"
        class="w-full border rounded px-3 py-2"
        placeholder="Search artists..."
        aria-autocomplete="list"
        :aria-expanded="showDropdown"
      />

      <ul v-if="showDropdown && results.length" class="absolute z-10 w-full bg-white border mt-1 max-h-56 overflow-auto">
        <li
          v-for="(r, idx) in results"
          :key="r.id"
          :class="['px-3 py-2 cursor-pointer', { 'bg-blue-50': idx === highlighted } ]"
          @mousedown.prevent="select(r)"
          @mouseover="highlighted = idx"
        >
          <div class="flex items-center justify-between">
            <div>
              <div class="font-medium">{{ r.name }}</div>
              <div class="text-xs text-gray-500">{{ r.description_short || '' }}</div>
            </div>
          </div>
        </li>
      </ul>

      <div v-else-if="showDropdown && !results.length" class="absolute z-10 w-full bg-white border mt-1 px-3 py-2 text-gray-500">No results</div>
    </div>
  </div>
</template>

<style scoped>
.artist-lookup { max-width: 600px; }
</style>
