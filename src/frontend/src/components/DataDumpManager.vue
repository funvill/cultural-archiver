<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { adminService } from '../services/admin';
import type { GenerateDataDumpResponse, ListDataDumpsResponse } from '../../../shared/types';

/**
 * Data Dump Manager Component
 *
 * Provides interface for generating and managing public data dumps
 * with progress tracking, error handling, and download links.
 */

// Reactive state
const dataDumps = ref<ListDataDumpsResponse['data'] | null>(null);
const isLoading = ref(false);
const isGenerating = ref(false);
const error = ref<string | null>(null);
const generationError = ref<string | null>(null);
const lastGenerated = ref<GenerateDataDumpResponse['data'] | null>(null);

// Computed properties
const hasDataDumps = computed(() => dataDumps.value?.dumps && dataDumps.value.dumps.length > 0);
const canGenerate = computed(() => !isGenerating.value && !isLoading.value);

// Format file size for display
function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// Format date for display
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString();
}

// Load data dumps list
async function loadDataDumps(): Promise<void> {
  try {
    isLoading.value = true;
    error.value = null;

    const response = await adminService.getDataDumps();
    dataDumps.value = response.data || null;
  } catch (err) {
    console.error('Failed to load data dumps:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load data dumps';
  } finally {
    isLoading.value = false;
  }
}

// Generate new data dump
async function generateDataDump(): Promise<void> {
  try {
    isGenerating.value = true;
    generationError.value = null;
    lastGenerated.value = null;

    const response = await adminService.generateDataDump();
    lastGenerated.value = response.data || null;

    // Show success message and refresh list
    if (response.data) {
      console.log('Data dump generated successfully:', response.data.filename);
      // Refresh the list after a short delay to ensure it's available
      setTimeout(() => {
        loadDataDumps();
      }, 1000);
    }

    if (response.warnings && response.warnings.length > 0) {
      console.warn('Data dump generated with warnings:', response.warnings);
    }
  } catch (err) {
    console.error('Failed to generate data dump:', err);
    generationError.value = err instanceof Error ? err.message : 'Failed to generate data dump';
  } finally {
    isGenerating.value = false;
  }
}

// Refresh data
async function refresh(): Promise<void> {
  await loadDataDumps();
}

// Download data dump
function downloadDump(downloadUrl: string, filename: string): void {
  // Create a temporary link to trigger download
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';

  // Append to document, click, and remove
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Initialize component
onMounted(async () => {
  await loadDataDumps();
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-medium text-gray-900 dark:text-white">Public Data Dumps</h2>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Generate and manage CC0-licensed public datasets for researchers and developers
          </p>
        </div>
        <div class="flex items-center space-x-3">
          <button
            @click="refresh"
            :disabled="isLoading"
            class="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            :aria-label="isLoading ? 'Refreshing...' : 'Refresh list'"
          >
            <svg
              class="w-4 h-4 mr-2"
              :class="{ 'animate-spin': isLoading }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {{ isLoading ? 'Refreshing...' : 'Refresh' }}
          </button>

          <button
            @click="generateDataDump"
            :disabled="!canGenerate"
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            :aria-label="isGenerating ? 'Generating data dump...' : 'Generate new data dump'"
          >
            <svg
              class="w-4 h-4 mr-2"
              :class="{ 'animate-spin': isGenerating }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                v-if="!isGenerating"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
              <path
                v-else
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {{ isGenerating ? 'Generating...' : 'Generate Data Dump' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Generation Success Message -->
    <div
      v-if="lastGenerated"
      class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4"
    >
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-green-800 dark:text-green-200">
            Data dump generated successfully
          </h3>
          <div class="mt-2 text-sm text-green-700 dark:text-green-300">
            <p><strong>File:</strong> {{ lastGenerated.filename }}</p>
            <p><strong>Size:</strong> {{ formatFileSize(lastGenerated.size) }}</p>
            <p><strong>Generated:</strong> {{ formatDate(lastGenerated.generated_at) }}</p>
            <div class="mt-2">
              <a
                :href="lastGenerated.download_url"
                target="_blank"
                rel="noopener noreferrer"
                class="font-medium underline hover:no-underline"
              >
                Download Now
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Generation Error -->
    <div
      v-if="generationError"
      class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4"
    >
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800 dark:text-red-200">
            Data dump generation failed
          </h3>
          <p class="mt-1 text-sm text-red-700 dark:text-red-300">{{ generationError }}</p>
        </div>
      </div>
    </div>

    <!-- Loading Error -->
    <div
      v-if="error"
      class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4"
    >
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800 dark:text-red-200">
            Failed to load data dumps
          </h3>
          <p class="mt-1 text-sm text-red-700 dark:text-red-300">{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Data Dumps List -->
    <div class="bg-white dark:bg-gray-800 shadow rounded-lg">
      <div class="px-4 py-5 sm:p-6">
        <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
          Generated Data Dumps
        </h3>

        <!-- Loading State -->
        <div v-if="isLoading && !hasDataDumps" class="text-center py-8">
          <div
            class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"
          ></div>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading data dumps...</p>
        </div>

        <!-- Empty State -->
        <div v-else-if="!hasDataDumps && !isLoading" class="text-center py-8">
          <svg
            class="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No data dumps</h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Generate your first public data dump to get started.
          </p>
          <div class="mt-6">
            <button
              @click="generateDataDump"
              :disabled="!canGenerate"
              class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Generate Data Dump
            </button>
          </div>
        </div>

        <!-- Data Dumps Table -->
        <div v-else class="overflow-hidden">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th
                    scope="col"
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                  >
                    File
                  </th>
                  <th
                    scope="col"
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                  >
                    Content
                  </th>
                  <th
                    scope="col"
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                  >
                    Size
                  </th>
                  <th
                    scope="col"
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                  >
                    Generated
                  </th>
                  <th
                    scope="col"
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody
                class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700"
              >
                <tr
                  v-for="dump in dataDumps?.dumps"
                  :key="dump.id"
                  class="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ dump.filename }}
                    </div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">ID: {{ dump.id }}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900 dark:text-white space-y-1">
                      <div>{{ dump.metadata.total_artworks.toLocaleString() }} artworks</div>
                      <div>{{ dump.metadata.total_creators.toLocaleString() }} creators</div>
                      <div>{{ dump.metadata.total_tags.toLocaleString() }} tags</div>
                      <div>{{ dump.metadata.total_photos.toLocaleString() }} photos</div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {{ formatFileSize(dump.size) }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {{ formatDate(dump.generated_at) }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      @click="downloadDump(dump.download_url, dump.filename)"
                      class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20 hover:bg-blue-200 dark:hover:bg-blue-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <svg
                        class="w-4 h-4 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      Download
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Summary -->
          <div
            v-if="dataDumps?.total"
            class="bg-gray-50 dark:bg-gray-700 px-6 py-3 border-t border-gray-200 dark:border-gray-600"
          >
            <div class="text-sm text-gray-600 dark:text-gray-400">
              Total: {{ dataDumps.total }} data dump{{ dataDumps.total !== 1 ? 's' : '' }} • Last
              updated: {{ formatDate(dataDumps.retrieved_at) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Information Card -->
    <div
      class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4"
    >
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-blue-800 dark:text-blue-200">
            About Public Data Dumps
          </h3>
          <div class="mt-2 text-sm text-blue-700 dark:text-blue-300">
            <ul class="list-disc pl-5 space-y-1">
              <li>Contains only approved artwork with public metadata</li>
              <li>Excludes sensitive user information (emails, tokens, IPs)</li>
              <li>Released under CC0 1.0 Universal Public Domain Dedication</li>
              <li>Includes JSON data files and thumbnail photos (800px)</li>
              <li>Intended for researchers, developers, and public use</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
