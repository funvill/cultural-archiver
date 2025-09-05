<script setup lang="ts">
import { computed } from 'vue';
import TagDiffDisplay from './TagDiffDisplay.vue';
import type { ArtworkEditDiff } from '../../../shared/types';

interface Props {
  diffs: ArtworkEditDiff[];
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  compact: false
});

// Group diffs by field type for better organization
const groupedDiffs = computed(() => {
  const groups: Record<string, ArtworkEditDiff[]> = {};
  
  props.diffs.forEach(diff => {
    if (!groups[diff.field_name]) {
      groups[diff.field_name] = [];
    }
    groups[diff.field_name]!.push(diff);
  });
  
  return groups;
});

// Define field display names and priorities
const fieldDisplayInfo: Record<string, { label: string; priority: number; description?: string }> = {
  title: { label: 'Title', priority: 1, description: 'Artwork title or name' },
  description: { label: 'Description', priority: 2, description: 'Detailed artwork description' },
  tags: { label: 'Tags', priority: 3, description: 'Structured artwork metadata' },
  created_by: { label: 'Artist/Creator', priority: 4, description: 'Artist or creator information' },
};

// Sort fields by priority and then alphabetically
const sortedFieldNames = computed(() => {
  return Object.keys(groupedDiffs.value).sort((a, b) => {
    const aPriority = fieldDisplayInfo[a]?.priority || 999;
    const bPriority = fieldDisplayInfo[b]?.priority || 999;
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    return a.localeCompare(b);
  });
});

function getFieldLabel(fieldName: string): string {
  return fieldDisplayInfo[fieldName]?.label || fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function getFieldDescription(fieldName: string): string | undefined {
  return fieldDisplayInfo[fieldName]?.description;
}

function isTagField(fieldName: string): boolean {
  return fieldName === 'tags';
}

function formatValue(value: string | null, fieldName: string): string {
  if (value === null || value === undefined) {
    return '(empty)';
  }
  
  if (value === '') {
    return '(blank)';
  }
  
  // For non-tag fields, return the value as is
  if (!isTagField(fieldName)) {
    return value;
  }
  
  // For tags, this will be handled by TagDiffDisplay component
  return value;
}

function getChangeTypeColor(oldValue: string | null, newValue: string | null): string {
  if (oldValue === null && newValue !== null) {
    return 'border-green-200 bg-green-50';
  } else if (oldValue !== null && newValue === null) {
    return 'border-red-200 bg-red-50';
  } else {
    return 'border-blue-200 bg-blue-50';
  }
}

function getChangeTypeLabel(oldValue: string | null, newValue: string | null): string {
  if (oldValue === null && newValue !== null) {
    return 'Added';
  } else if (oldValue !== null && newValue === null) {
    return 'Removed';
  } else {
    return 'Modified';
  }
}

// Helper to safely get first diff from a group
function getFirstDiff(diffs?: ArtworkEditDiff[]): ArtworkEditDiff | null {
  return diffs?.[0] || null;
}
</script>

<template>
  <div class="artwork-edit-diffs">
    <div v-if="!compact" class="mb-4">
      <h3 class="text-lg font-medium text-gray-900 mb-2">Proposed Changes</h3>
      <p class="text-sm text-gray-600">
        Review the following changes proposed by the user:
      </p>
    </div>
    
    <div class="space-y-4">
      <div
        v-for="fieldName in sortedFieldNames"
        :key="fieldName"
        :class="[
          'border rounded-lg p-4',
          (() => {
            const firstDiff = getFirstDiff(groupedDiffs[fieldName]);
            if (!firstDiff) return 'border-gray-200 bg-gray-50';
            return getChangeTypeColor(firstDiff.old_value, firstDiff.new_value);
          })()
        ]"
      >
        <!-- Field Header -->
        <div class="flex items-center justify-between mb-3">
          <div class="flex-1">
            <div class="flex items-center space-x-2">
              <h4 class="font-medium text-gray-900">{{ getFieldLabel(fieldName) }}</h4>
              <span 
                :class="[
                  'px-2 py-1 text-xs font-medium rounded-full',
                  (() => {
                    const firstDiff = getFirstDiff(groupedDiffs[fieldName]);
                    if (!firstDiff) return 'bg-gray-100 text-gray-700';
                    const colorClass = getChangeTypeColor(firstDiff.old_value, firstDiff.new_value);
                    if (colorClass.includes('green')) return 'bg-green-100 text-green-700';
                    if (colorClass.includes('red')) return 'bg-red-100 text-red-700';
                    return 'bg-blue-100 text-blue-700';
                  })()
                ]"
              >
                {{
                  (() => {
                    const firstDiff = getFirstDiff(groupedDiffs[fieldName]);
                    if (!firstDiff) return 'Unknown';
                    return getChangeTypeLabel(firstDiff.old_value, firstDiff.new_value);
                  })()
                }}
              </span>
            </div>
            <p v-if="getFieldDescription(fieldName)" class="text-xs text-gray-500 mt-1">
              {{ getFieldDescription(fieldName) }}
            </p>
          </div>
        </div>
        
        <!-- Field Content -->
        <div v-for="diff in groupedDiffs[fieldName]" :key="`${fieldName}-${diff.old_value}-${diff.new_value}`">
          <!-- Special handling for tags -->
          <TagDiffDisplay
            v-if="isTagField(fieldName)"
            :old-value="diff.old_value || undefined"
            :new-value="diff.new_value || undefined"
            :formatted-old="diff.formatted_old"
            :formatted-new="diff.formatted_new"
          />
          
          <!-- Standard field diff display -->
          <div v-else class="space-y-3">
            <div v-if="diff.old_value !== undefined && diff.new_value !== undefined" class="grid grid-cols-2 gap-4">
              <div>
                <h5 class="text-xs font-medium text-gray-700 mb-2">Current</h5>
                <div class="p-3 bg-white border border-gray-200 rounded-md">
                  <p class="text-sm text-gray-700 whitespace-pre-wrap">
                    {{ formatValue(diff.old_value, fieldName) }}
                  </p>
                </div>
              </div>
              <div>
                <h5 class="text-xs font-medium text-gray-700 mb-2">Proposed</h5>
                <div class="p-3 bg-white border border-gray-200 rounded-md">
                  <p class="text-sm text-gray-700 whitespace-pre-wrap">
                    {{ formatValue(diff.new_value, fieldName) }}
                  </p>
                </div>
              </div>
            </div>
            
            <div v-else-if="diff.new_value">
              <h5 class="text-xs font-medium text-gray-700 mb-2">Proposed Value</h5>
              <div class="p-3 bg-white border border-gray-200 rounded-md">
                <p class="text-sm text-gray-700 whitespace-pre-wrap">
                  {{ formatValue(diff.new_value, fieldName) }}
                </p>
              </div>
            </div>
            
            <div v-else-if="diff.old_value">
              <h5 class="text-xs font-medium text-gray-700 mb-2">Removing Value</h5>
              <div class="p-3 bg-white border border-gray-200 rounded-md">
                <p class="text-sm text-gray-700 whitespace-pre-wrap">
                  {{ formatValue(diff.old_value, fieldName) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.artwork-edit-diffs {
  font-size: 0.875rem;
}
</style>