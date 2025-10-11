<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import { themes, applyThemeByName } from '../theme/theme';
import { apiService } from '../services/api';
import { canUseLocalStorage, isClient } from '../lib/isClient';

const available = computed(() => Object.keys(themes));
const selected = ref<string>('');

// Initialize selected from localStorage on client mount
onMounted(() => {
  if (!canUseLocalStorage()) return;
  try {
    const saved = localStorage.getItem('user-theme');
    if (saved) selected.value = saved;
  } catch (e) {
    // ignore
  }
});

watch(selected, async (val: string) => {
  if (!val) return;
  // Apply immediately (safe on client)
  if (isClient) applyThemeByName(val);

  // Try to persist to server, fallback to localStorage
  try {
    await apiService.updateUserPreferences({ theme: val });
    if (canUseLocalStorage()) {
      try {
        localStorage.setItem('user-theme', val);
      } catch (e) {}
    }
  } catch (err) {
    if (canUseLocalStorage()) {
      try {
        localStorage.setItem('user-theme', val);
      } catch (e) {
        // ignore
      }
    }
  }
});
</script>

<template>
  <div class="theme-toggle inline-flex items-center space-x-2">
    <label class="text-sm theme-on-surface">Theme</label>
    <select v-model="selected" class="px-3 py-2 rounded theme-surface theme-on-surface" :style="{ borderColor: 'var(--md-outline, #9ca3af)' }">
      <option disabled value="">Select a theme</option>
      <option v-for="name in available" :key="name" :value="name">{{ name }}</option>
    </select>
  </div>
</template>

<style scoped>
.theme-toggle select { min-width: 160px; }
</style>
