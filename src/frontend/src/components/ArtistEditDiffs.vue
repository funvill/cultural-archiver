<script setup lang="ts">
import { computed } from 'vue';

interface Diff {
  field_name: string;
  old_value: string | null;
  new_value: string | null;
}

const props = withDefaults(defineProps<{ diffs: Diff[]; compact?: boolean }>(), { compact: false });

const grouped = computed(() => {
  const g: Record<string, Diff[]> = {};
  props.diffs.forEach(d => {
    if (!g[d.field_name]) {
      g[d.field_name] = [];
    }
    g[d.field_name]!.push(d);
  });
  return g;
});

function highlightChanges(oldVal: string | null, newVal: string | null) {
  if (oldVal === null || newVal === null) return escapeHtml(newVal || '(empty)');
  // Simple diff: find longest common prefix/suffix and highlight the differing middle
  const oldStr = String(oldVal);
  const newStr = String(newVal);
  let prefix = 0;
  while (prefix < oldStr.length && prefix < newStr.length && oldStr[prefix] === newStr[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < oldStr.length - prefix &&
    suffix < newStr.length - prefix &&
    oldStr[oldStr.length - 1 - suffix] === newStr[newStr.length - 1 - suffix]
  )
    suffix++;

  const commonStart = escapeHtml(newStr.slice(0, prefix));
  const changed = escapeHtml(newStr.slice(prefix, newStr.length - suffix || undefined));
  const commonEnd = escapeHtml(newStr.slice(newStr.length - suffix));

  return `${commonStart}<span class=\"bg-yellow-100 px-1 rounded\">${changed}</span>${commonEnd}`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
</script>

<template>
  <div class="artist-edit-diffs">
    <div v-if="!compact" class="mb-4">
      <h3 class="text-lg font-medium text-gray-900 mb-2">Proposed Artist Changes</h3>
      <p class="text-sm text-gray-600">Review the following changes proposed by the user.</p>
    </div>

    <div class="space-y-4">
      <div v-for="(group, field) in grouped" :key="field" class="border rounded-lg p-4 bg-white">
        <div class="flex items-center justify-between mb-3">
          <div>
            <h4 class="font-medium text-gray-900">{{ field.replace(/_/g, ' ') }}</h4>
          </div>
        </div>

        <div v-for="diff in group" :key="diff.field_name + diff.old_value + diff.new_value">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <h5 class="text-xs font-medium text-gray-700 mb-2">Current</h5>
              <div class="p-3 bg-gray-50 border border-gray-200 rounded-md">
                <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ diff.old_value || '(empty)' }}</p>
              </div>
            </div>
            <div>
              <h5 class="text-xs font-medium text-gray-700 mb-2">Proposed</h5>
              <div class="p-3 bg-white border border-gray-200 rounded-md">
                <p class="text-sm text-gray-700 whitespace-pre-wrap" v-html="highlightChanges(diff.old_value, diff.new_value)"></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.artist-edit-diffs p span { font-weight: 600; }
</style>
