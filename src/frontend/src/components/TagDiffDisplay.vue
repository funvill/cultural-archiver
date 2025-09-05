<script setup lang="ts">
import { computed } from 'vue';
import { TAG_CATEGORIES } from '../services/tagSchema';

interface Props {
  oldValue?: string | null | undefined;
  newValue?: string | null | undefined;
  formattedOld?: string | undefined;
  formattedNew?: string | undefined;
}

const props = defineProps<Props>();

// Parse structured tags from JSON values
function parseStructuredTags(value?: string | null): Record<string, any> {
  if (!value) return {};
  
  try {
    const parsed = JSON.parse(value);
    return parsed.tags || parsed || {};
  } catch {
    return {};
  }
}

// Compare old and new tags to identify changes
const tagChanges = computed(() => {
  const oldTags = parseStructuredTags(props.oldValue);
  const newTags = parseStructuredTags(props.newValue);
  
  const allKeys = new Set([...Object.keys(oldTags), ...Object.keys(newTags)]);
  const changes: Array<{
    key: string;
    type: 'added' | 'removed' | 'modified';
    oldValue?: any;
    newValue?: any;
    category?: string;
  }> = [];

  allKeys.forEach(key => {
    const oldVal = oldTags[key];
    const newVal = newTags[key];
    
    if (oldVal === undefined && newVal !== undefined) {
      changes.push({ key, type: 'added', newValue: newVal });
    } else if (oldVal !== undefined && newVal === undefined) {
      changes.push({ key, type: 'removed', oldValue: oldVal });
    } else if (oldVal !== newVal) {
      changes.push({ key, type: 'modified', oldValue: oldVal, newValue: newVal });
    }
  });

  return changes;
});

// Group changes by category for better organization
const changesByCategory = computed(() => {
  const categories = TAG_CATEGORIES;
  const grouped: Record<string, typeof tagChanges.value> = {};
  const uncategorized: typeof tagChanges.value = [];

  tagChanges.value.forEach(change => {
    const category = categories.find((cat: any) => 
      cat.tags.some((tag: any) => tag.key === change.key)
    );

    if (category) {
      if (!grouped[category.key]) {
        grouped[category.key] = [];
      }
      grouped[category.key]!.push({
        ...change,
        category: category.label,
      });
    } else {
      uncategorized.push(change);
    }
  });

  if (uncategorized.length > 0) {
    grouped.other = uncategorized;
  }

  return grouped;
});

const hasChanges = computed(() => tagChanges.value.length > 0);

function getChangeIcon(type: 'added' | 'removed' | 'modified'): string {
  switch (type) {
    case 'added': return '➕';
    case 'removed': return '➖';
    case 'modified': return '✏️';
    default: return '•';
  }
}

function getChangeColor(type: 'added' | 'removed' | 'modified'): string {
  switch (type) {
    case 'added': return 'text-green-600 bg-green-50';
    case 'removed': return 'text-red-600 bg-red-50';
    case 'modified': return 'text-blue-600 bg-blue-50';
    default: return 'text-gray-600 bg-gray-50';
  }
}
</script>

<template>
  <div class="tag-diff-display">
    <!-- Show structured diff if we have actual tag changes -->
    <div v-if="hasChanges" class="space-y-4">
      <h4 class="text-sm font-medium text-gray-900 mb-3">Tag Changes</h4>
      
      <div 
        v-for="(changes, categoryKey) in changesByCategory"
        :key="categoryKey"
        class="space-y-2"
      >
        <h5 class="text-xs font-medium text-gray-700 uppercase tracking-wider">
          {{ changes[0]?.category || 'Other' }}
        </h5>
        
        <div class="space-y-2">
          <div
            v-for="change in changes"
            :key="change.key"
            :class="[
              'p-3 rounded-md border-l-4',
              getChangeColor(change.type)
            ]"
          >
            <div class="flex items-start space-x-2">
              <span class="text-sm">{{ getChangeIcon(change.type) }}</span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center space-x-2">
                  <span class="font-medium text-sm">{{ change.key }}</span>
                </div>
                
                <!-- Show old value for removed/modified -->
                <div v-if="change.type === 'removed' || change.type === 'modified'" class="mt-1">
                  <span class="text-xs text-gray-500">Old:</span>
                  <span class="ml-1 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {{ change.oldValue }}
                  </span>
                </div>
                
                <!-- Show new value for added/modified -->
                <div v-if="change.type === 'added' || change.type === 'modified'" class="mt-1">
                  <span class="text-xs text-gray-500">New:</span>
                  <span class="ml-1 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {{ change.newValue }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Fallback to formatted text display -->
    <div v-else-if="formattedOld || formattedNew" class="space-y-3">
      <div v-if="formattedOld && formattedNew" class="grid grid-cols-2 gap-4">
        <div>
          <h5 class="text-xs font-medium text-gray-700 mb-2">Before</h5>
          <div class="p-3 bg-red-50 border-l-4 border-red-200 rounded-md">
            <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ formattedOld }}</p>
          </div>
        </div>
        <div>
          <h5 class="text-xs font-medium text-gray-700 mb-2">After</h5>
          <div class="p-3 bg-green-50 border-l-4 border-green-200 rounded-md">
            <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ formattedNew }}</p>
          </div>
        </div>
      </div>
      
      <div v-else-if="formattedNew">
        <h5 class="text-xs font-medium text-gray-700 mb-2">Added</h5>
        <div class="p-3 bg-green-50 border-l-4 border-green-200 rounded-md">
          <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ formattedNew }}</p>
        </div>
      </div>
      
      <div v-else-if="formattedOld">
        <h5 class="text-xs font-medium text-gray-700 mb-2">Removed</h5>
        <div class="p-3 bg-red-50 border-l-4 border-red-200 rounded-md">
          <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ formattedOld }}</p>
        </div>
      </div>
    </div>
    
    <!-- No changes indicator -->
    <div v-else class="text-sm text-gray-500 italic">
      No tag changes
    </div>
  </div>
</template>

<style scoped>
.tag-diff-display {
  font-size: 0.875rem;
}
</style>