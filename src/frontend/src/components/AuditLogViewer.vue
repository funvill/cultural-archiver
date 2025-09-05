<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { adminService } from '../services/admin';
import type {
  AuditLogsResponse,
  AuditLogEntry,
  AuditLogQuery,
  ModerationDecision,
  AdminActionType,
} from '../../../shared/types';

// Local interface for form binding that allows undefined values
interface AuditLogFilters {
  type: 'moderation' | 'admin' | undefined;
  actor: string;
  decision: ModerationDecision | undefined;
  action_type: AdminActionType | undefined;
  startDate: string;
  endDate: string;
  page: number;
  limit: number;
}

/**
 * Audit Log Viewer Component
 *
 * Provides a comprehensive interface for viewing and filtering audit logs
 * with advanced filtering options, pagination, and responsive design.
 */

// State
const auditLogs = ref<AuditLogsResponse | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);
const selectedLog = ref<AuditLogEntry | null>(null);
const currentPage = ref(1);
const pageSize = ref(25);

// Filter state - using local interface that allows undefined for form binding
const filters = ref<AuditLogFilters>({
  type: undefined,
  actor: '',
  decision: undefined,
  action_type: undefined,
  startDate: '',
  endDate: '',
  page: 1,
  limit: 25,
});

// Computed
const totalPages = computed(() => {
  if (!auditLogs.value) return 1;
  return Math.ceil(auditLogs.value.total / pageSize.value);
});

// Methods
async function loadAuditLogs(): Promise<void> {
  isLoading.value = true;
  error.value = null;

  try {
    // Convert local filters to AuditLogQuery format, removing empty values
    const query: AuditLogQuery = {
      page: currentPage.value,
      limit: pageSize.value,
    };

    // Add optional fields only if they have values
    if (filters.value.type) {
      query.type = filters.value.type;
    }
    if (filters.value.actor && filters.value.actor.trim()) {
      query.actor = filters.value.actor.trim();
    }
    if (filters.value.decision) {
      query.decision = filters.value.decision;
    }
    if (filters.value.action_type) {
      query.action_type = filters.value.action_type;
    }
    if (filters.value.startDate && filters.value.startDate.trim()) {
      query.startDate = new Date(filters.value.startDate).toISOString();
    }
    if (filters.value.endDate && filters.value.endDate.trim()) {
      query.endDate = new Date(filters.value.endDate).toISOString();
    }

    const response = await adminService.getAuditLogs(query);
    auditLogs.value = response;
  } catch (err) {
    console.error('Failed to load audit logs:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load audit logs';
  } finally {
    isLoading.value = false;
  }
}

// Apply filters immediately (for select dropdowns)
function applyFilters(): void {
  filters.value.page = 1;
  currentPage.value = 1;
  loadAuditLogs();
}

// Apply filters with debounce (for text inputs)
let filterTimeout: ReturnType<typeof setTimeout> | null = null;
function applyFiltersDebounced(): void {
  if (filterTimeout) {
    clearTimeout(filterTimeout);
  }

  filterTimeout = setTimeout(() => {
    filters.value.page = 1;
    currentPage.value = 1;
    loadAuditLogs();
  }, 500);
}

// Reset filters
function resetFilters(): void {
  filters.value = {
    type: undefined,
    actor: '',
    decision: undefined,
    action_type: undefined,
    startDate: '',
    endDate: '',
    page: 1,
    limit: 25,
  };
  currentPage.value = 1;
  loadAuditLogs();
}

// Pagination
function previousPage(): void {
  if (currentPage.value > 1) {
    currentPage.value--;
    filters.value.page = currentPage.value;
    loadAuditLogs();
  }
}

function nextPage(): void {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
    filters.value.page = currentPage.value;
    loadAuditLogs();
  }
}

// Lifecycle
onMounted(() => {
  loadAuditLogs();
});

// Details modal
function showDetails(log: AuditLogEntry): void {
  selectedLog.value = log;
}

function closeDetails(): void {
  selectedLog.value = null;
}

// Utility functions
function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

function getActionColor(action: string): string {
  switch (action) {
    case 'approved':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
    case 'skipped':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
    case 'grant_permission':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
    case 'revoke_permission':
      return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
    case 'view_audit_logs':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h2 class="text-lg font-medium text-gray-900 dark:text-white">Audit Logs</h2>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        View and filter moderation decisions and administrative actions
      </p>
    </div>

    <!-- Filters -->
    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Log Type Filter -->
        <div>
          <label
            for="type-filter"
            class="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Log Type
          </label>
          <select
            id="type-filter"
            v-model="filters.type"
            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            @change="applyFilters"
          >
            <option value="">All Types</option>
            <option value="moderation">Moderation</option>
            <option value="admin">Admin Actions</option>
          </select>
        </div>

        <!-- Decision Filter (for moderation logs) -->
        <div v-if="filters.type === 'moderation' || !filters.type">
          <label
            for="decision-filter"
            class="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Decision
          </label>
          <select
            id="decision-filter"
            v-model="filters.decision"
            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            @change="applyFilters"
          >
            <option value="">All Decisions</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="skipped">Skipped</option>
          </select>
        </div>

        <!-- Action Type Filter (for admin logs) -->
        <div v-if="filters.type === 'admin' || !filters.type">
          <label
            for="action-filter"
            class="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Action Type
          </label>
          <select
            id="action-filter"
            v-model="filters.action_type"
            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            @change="applyFilters"
          >
            <option value="">All Actions</option>
            <option value="grant_permission">Grant Permission</option>
            <option value="revoke_permission">Revoke Permission</option>
            <option value="view_audit_logs">View Audit Logs</option>
          </select>
        </div>

        <!-- Actor Filter -->
        <div>
          <label
            for="actor-filter"
            class="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Actor (User UUID)
          </label>
          <input
            id="actor-filter"
            v-model="filters.actor"
            type="text"
            placeholder="User UUID..."
            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            @input="applyFiltersDebounced"
          />
        </div>
      </div>

      <!-- Date Range Filters -->
      <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            for="start-date"
            class="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Start Date
          </label>
          <input
            id="start-date"
            v-model="filters.startDate"
            type="datetime-local"
            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            @change="applyFilters"
          />
        </div>
        <div>
          <label for="end-date" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            End Date
          </label>
          <input
            id="end-date"
            v-model="filters.endDate"
            type="datetime-local"
            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            @change="applyFilters"
          />
        </div>
      </div>

      <!-- Filter Actions -->
      <div class="mt-4 flex justify-between items-center">
        <button
          @click="resetFilters"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
        >
          Reset Filters
        </button>
        <div class="text-sm text-gray-500 dark:text-gray-400">
          {{ auditLogs?.total || 0 }} total entries
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-8">
      <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading audit logs...</p>
    </div>

    <!-- Error State -->
    <div
      v-else-if="error"
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
            Error loading audit logs
          </h3>
          <p class="mt-1 text-sm text-red-700 dark:text-red-300">{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Audit Logs Table -->
    <div
      v-else-if="auditLogs"
      class="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md"
    >
      <div v-if="auditLogs.logs.length === 0" class="text-center py-8">
        <svg
          class="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No audit logs found</h3>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          No audit logs match your current filter criteria.
        </p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th
                scope="col"
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
              >
                Date/Time
              </th>
              <th
                scope="col"
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
              >
                Type
              </th>
              <th
                scope="col"
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
              >
                Actor
              </th>
              <th
                scope="col"
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
              >
                Action
              </th>
              <th
                scope="col"
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
              >
                Target
              </th>
              <th
                scope="col"
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
              >
                Details
              </th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            <tr
              v-for="log in auditLogs.logs"
              :key="log.id"
              class="hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                {{ formatDateTime(log.created_at) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  :class="[
                    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                    log.type === 'admin'
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                      : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
                  ]"
                >
                  {{ log.type }}
                </span>
              </td>
              <td class="px-6 py-4 text-sm text-gray-900 dark:text-white">
                <div class="truncate max-w-xs">
                  {{ log.actor_email || 'Unknown' }}
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                  {{ log.actor_uuid }}
                </div>
              </td>
              <td class="px-6 py-4 text-sm text-gray-900 dark:text-white">
                <span
                  :class="[
                    'inline-flex items-center px-2 py-1 rounded text-xs font-medium',
                    getActionColor(log.action),
                  ]"
                >
                  {{ log.action }}
                </span>
              </td>
              <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                <div class="truncate max-w-xs">
                  {{ log.target || '-' }}
                </div>
              </td>
              <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                <button
                  @click="showDetails(log)"
                  class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  View Details
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div
        class="bg-white dark:bg-gray-800 px-4 py-3 border-t border-gray-200 dark:border-gray-700 sm:px-6"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <button
              @click="previousPage"
              :disabled="currentPage <= 1"
              class="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Previous
            </button>
            <span class="text-sm text-gray-700 dark:text-gray-300">
              Page {{ currentPage }} of {{ totalPages }}
            </span>
            <button
              @click="nextPage"
              :disabled="currentPage >= totalPages"
              class="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Next
            </button>
          </div>
          <div class="text-sm text-gray-700 dark:text-gray-300">
            Showing {{ auditLogs.logs.length }} of {{ auditLogs.total }} entries
          </div>
        </div>
      </div>
    </div>

    <!-- Details Modal -->
    <div
      v-if="selectedLog"
      class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
      @click="closeDetails"
    >
      <div
        class="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white dark:bg-gray-800"
        @click.stop
      >
        <div class="mt-3">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Audit Log Details</h3>
            <button
              @click="closeDetails"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                Basic Information
              </h4>
              <dl class="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                <div>
                  <dt class="text-sm text-gray-500 dark:text-gray-400">ID</dt>
                  <dd class="text-sm text-gray-900 dark:text-white font-mono">
                    {{ selectedLog.id }}
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500 dark:text-gray-400">Type</dt>
                  <dd class="text-sm text-gray-900 dark:text-white">{{ selectedLog.type }}</dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500 dark:text-gray-400">Actor</dt>
                  <dd class="text-sm text-gray-900 dark:text-white">
                    {{ selectedLog.actor_email || 'Unknown' }}
                    <div class="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {{ selectedLog.actor_uuid }}
                    </div>
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500 dark:text-gray-400">Action</dt>
                  <dd class="text-sm text-gray-900 dark:text-white">{{ selectedLog.action }}</dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500 dark:text-gray-400">Target</dt>
                  <dd class="text-sm text-gray-900 dark:text-white">
                    {{ selectedLog.target || '-' }}
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-gray-500 dark:text-gray-400">Date/Time</dt>
                  <dd class="text-sm text-gray-900 dark:text-white">
                    {{ formatDateTime(selectedLog.created_at) }}
                  </dd>
                </div>
              </dl>
            </div>

            <div v-if="selectedLog.details">
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Details</h4>
              <pre
                class="mt-2 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded overflow-auto max-h-40"
                >{{ JSON.stringify(selectedLog.details, null, 2) }}</pre
              >
            </div>

            <div v-if="selectedLog.metadata">
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Metadata</h4>
              <pre
                class="mt-2 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded overflow-auto max-h-40"
                >{{ JSON.stringify(selectedLog.metadata, null, 2) }}</pre
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
