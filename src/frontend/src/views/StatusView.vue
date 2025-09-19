<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { apiService, getErrorMessage } from '../services/api';
import { getApiBaseUrl } from '../utils/api-config';

const isLoading = ref(true);
const status = ref<string>('');
const stats = ref<any>(null);
const healthData = ref<any>(null);
const error = ref<string>('');

// Expose API base URL and build date for debug
const apiBaseUrl = getApiBaseUrl();
// Use the build timestamp injected at build time, fallback to current date if not set
const buildDate = import.meta.env.VITE_BUILD_DATE || new Date().toISOString();
const environment = import.meta.env.MODE;

const checkSystemHealth = async (): Promise<void> => {
  try {
    // Check API status
    const statusResponse = await apiService.getStatus();
    status.value = statusResponse.message || 'API connected successfully';

    // Try to get stats for additional health info
    try {
      const statsResponse = await apiService.getReviewStats();
      stats.value = statsResponse.data;
    } catch (statsError) {
      console.warn('Failed to fetch stats:', statsError);
    }

    // Additional health checks could be added here
    healthData.value = {
      apiConnected: true,
      buildDate: buildDate,
      apiBaseUrl: apiBaseUrl,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    status.value = `API connection failed: ${getErrorMessage(err)}`;
    error.value = getErrorMessage(err);
    healthData.value = {
      apiConnected: false,
      buildDate: buildDate,
      apiBaseUrl: apiBaseUrl,
      timestamp: new Date().toISOString(),
    };
    console.warn('API status check failed:', err);
  } finally {
    isLoading.value = false;
  }
};

// Clear local settings (except user token) to allow first-time popup to show again
const clearLocalSettings = (): void => {
  const confirmMessage = 'This will clear all local settings (map preferences, search history, etc.) except your user account. The welcome popup will show again on next page load. Are you sure?';
  
  if (!confirm(confirmMessage)) {
    return;
  }

  try {
    // Get all localStorage keys
    const keys = Object.keys(localStorage);
    
    // Keys to preserve (do not clear)
    const preserveKeys = ['user-token'];
    
    // Clear all keys except preserved ones
    keys.forEach(key => {
      if (!preserveKeys.includes(key)) {
        localStorage.removeItem(key);
      }
    });
    
    alert('Local settings cleared successfully! Refresh the page to see the welcome popup again.');
  } catch (err) {
    console.error('Failed to clear local settings:', err);
    alert('Failed to clear local settings. Please try again.');
  }
};

onMounted(() => {
  checkSystemHealth();
});
</script>

<template>
  <div class="status-view">
    <!-- Header -->
    <div class="bg-gray-50 border-b border-gray-200">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="text-center">
          <h1 class="text-3xl font-bold text-gray-900 mb-2">System Status</h1>
          <p class="text-lg text-gray-600">
            Current status and health information for Cultural Archiver
          </p>
        </div>
      </div>
    </div>

    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- API Status Card -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div class="p-6">
          <h2 class="text-lg font-semibold mb-4 flex items-center">
            <svg 
              :class="['w-5 h-5 mr-2', error ? 'text-red-600' : 'text-green-600']" 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path
                v-if="!error"
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd"
              />
              <path
                v-else
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clip-rule="evenodd"
              />
            </svg>
            API Status
          </h2>
          
          <div v-if="isLoading" class="text-gray-600 flex items-center">
            <svg
              class="animate-spin -ml-1 mr-2 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Checking system health...
          </div>
          
          <div v-else>
            <p :class="['text-lg mb-4', error ? 'text-red-700' : 'text-green-700']">
              {{ status }}
            </p>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div class="space-y-2">
                <div class="flex justify-between">
                  <span class="font-medium text-gray-600">API Connected:</span>
                  <span :class="[healthData?.apiConnected ? 'text-green-600' : 'text-red-600']">
                    {{ healthData?.apiConnected ? 'Yes' : 'No' }}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="font-medium text-gray-600">API Base URL:</span>
                  <span class="text-gray-900 font-mono text-xs">{{ apiBaseUrl }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="font-medium text-gray-600">Build Date:</span>
                  <span class="text-gray-900">{{ new Date(buildDate).toLocaleString() }}</span>
                </div>
              </div>
              
              <div class="space-y-2">
                <div class="flex justify-between">
                  <span class="font-medium text-gray-600">Last Check:</span>
                  <span class="text-gray-900">{{ healthData?.timestamp ? new Date(healthData.timestamp).toLocaleString() : 'N/A' }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="font-medium text-gray-600">Environment:</span>
                  <span class="text-gray-900">{{ environment }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- System Statistics Card -->
      <div v-if="stats" class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div class="p-6">
          <h2 class="text-lg font-semibold mb-4 flex items-center">
            <svg class="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
            </svg>
            System Statistics
          </h2>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="text-center p-4 bg-blue-50 rounded-lg">
              <div class="text-2xl font-bold text-blue-600">{{ stats.totalSubmissions || 0 }}</div>
              <div class="text-sm text-gray-600">Total Submissions</div>
            </div>
            <div class="text-center p-4 bg-green-50 rounded-lg">
              <div class="text-2xl font-bold text-green-600">{{ stats.approvedSubmissions || 0 }}</div>
              <div class="text-sm text-gray-600">Approved Submissions</div>
            </div>
            <div class="text-center p-4 bg-yellow-50 rounded-lg">
              <div class="text-2xl font-bold text-yellow-600">{{ stats.pendingSubmissions || 0 }}</div>
              <div class="text-sm text-gray-600">Pending Review</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Refresh Button -->
      <div class="text-center space-y-4">
        <button
          @click="checkSystemHealth"
          :disabled="isLoading"
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg
            :class="['w-4 h-4 mr-2', isLoading ? 'animate-spin' : '']"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {{ isLoading ? 'Checking...' : 'Refresh Status' }}
        </button>
        
        <!-- Clear Local Settings Button -->
        <button
          @click="clearLocalSettings"
          class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg
            class="w-4 h-4 mr-2"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H8a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Clear Local Settings
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.status-view {
  min-height: 100vh;
  background-color: #f9fafb;
}
</style>