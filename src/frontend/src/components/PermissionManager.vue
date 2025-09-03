<!--
Permission Manager Component

Provides UI for managing user permissions with grant/revoke functionality,
search, filtering, and confirmation dialogs for administrative actions.
-->

<template>
  <div class="space-y-6">
    <!-- Header and Controls -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h2 class="text-lg font-medium text-gray-900 dark:text-white">
          User Permissions
        </h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage moderator and admin permissions for users
        </p>
      </div>
      
      <button
        @click="showGrantDialog = true"
        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Grant Permission
      </button>
    </div>

    <!-- Search and Filters -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label for="search" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Search Users
        </label>
        <input
          id="search"
          v-model="searchQuery"
          type="text"
          placeholder="Search by email..."
          class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          @input="debouncedSearch"
        />
      </div>
      
      <div>
        <label for="permission-filter" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Filter by Permission
        </label>
        <select
          id="permission-filter"
          v-model="permissionFilter"
          class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          @change="loadPermissions"
        >
          <option value="">All Permissions</option>
          <option value="moderator">Moderators</option>
          <option value="admin">Admins</option>
        </select>
      </div>
      
      <div class="flex items-end">
        <button
          @click="resetFilters"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
        >
          Reset Filters
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-8">
      <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading permissions...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800 dark:text-red-200">
            Error loading permissions
          </h3>
          <p class="mt-1 text-sm text-red-700 dark:text-red-300">{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Permissions Table -->
    <div v-else-if="permissions" class="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
      <div v-if="permissions.users.length === 0" class="text-center py-8">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No users found</h3>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          No users match your current search and filter criteria.
        </p>
      </div>
      
      <ul v-else class="divide-y divide-gray-200 dark:divide-gray-700">
        <li v-for="user in permissions.users" :key="user.user_uuid" class="px-6 py-4">
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                    <svg class="h-6 w-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
                <div class="ml-4">
                  <div class="text-sm font-medium text-gray-900 dark:text-white">
                    {{ user.email || 'Unknown Email' }}
                  </div>
                  <div class="text-sm text-gray-500 dark:text-gray-400">
                    {{ user.user_uuid }}
                  </div>
                </div>
              </div>
              
              <!-- Permissions -->
              <div class="mt-2 flex flex-wrap gap-2">
                <span
                  v-for="permission in user.permissions"
                  :key="permission.permission"
                  :class="[
                    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                    permission.permission === 'admin'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                  ]"
                >
                  {{ permission.permission }}
                </span>
              </div>
              
              <!-- Permission Details -->
              <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span v-for="(permission, index) in user.permissions" :key="permission.permission">
                  {{ permission.permission }} granted {{ formatDate(permission.granted_at) }}{{ permission.notes ? ` - ${permission.notes}` : '' }}
                  <span v-if="index < user.permissions.length - 1"> • </span>
                </span>
              </div>
            </div>
            
            <!-- Actions -->
            <div class="flex items-center space-x-2">
              <button
                @click="openRevokeDialog(user)"
                :disabled="user.permissions.length === 0"
                class="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
              >
                Revoke
              </button>
            </div>
          </div>
        </li>
      </ul>
      
      <!-- Pagination -->
      <div v-if="permissions.total > permissions.users.length" class="bg-white dark:bg-gray-800 px-4 py-3 border-t border-gray-200 dark:border-gray-700 sm:px-6">
        <div class="flex items-center justify-between">
          <div class="text-sm text-gray-700 dark:text-gray-300">
            Showing {{ permissions.users.length }} of {{ permissions.total }} users
          </div>
          <div class="text-sm text-gray-500 dark:text-gray-400">
            <!-- Pagination controls would go here -->
          </div>
        </div>
      </div>
    </div>

    <!-- Grant Permission Dialog -->
    <div v-if="showGrantDialog" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" @click="closeGrantDialog">
      <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800" @click.stop>
        <div class="mt-3">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Grant Permission
          </h3>
          
          <form @submit.prevent="grantPermission" class="space-y-4">
            <div>
              <label for="grant-user-uuid" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                User UUID
              </label>
              <input
                id="grant-user-uuid"
                v-model="grantForm.userUuid"
                type="text"
                required
                placeholder="550e8400-e29b-41d4-a716-446655440000"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            
            <div>
              <label for="grant-permission" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Permission
              </label>
              <select
                id="grant-permission"
                v-model="grantForm.permission"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">Select Permission</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            
            <div>
              <label for="grant-reason" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Reason (Optional)
              </label>
              <textarea
                id="grant-reason"
                v-model="grantForm.reason"
                rows="3"
                placeholder="Reason for granting this permission..."
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              ></textarea>
            </div>
            
            <div class="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                @click="closeGrantDialog"
                class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="isSubmitting"
                class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ isSubmitting ? 'Granting...' : 'Grant Permission' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Revoke Permission Dialog -->
    <div v-if="showRevokeDialog" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" @click="closeRevokeDialog">
      <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800" @click.stop>
        <div class="mt-3">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Revoke Permission
          </h3>
          
          <div v-if="revokeTarget" class="mb-4">
            <p class="text-sm text-gray-600 dark:text-gray-400">
              You are about to revoke permissions for:
            </p>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ revokeTarget.email || 'Unknown Email' }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ revokeTarget.user_uuid }}
            </p>
          </div>
          
          <form @submit.prevent="revokePermission" class="space-y-4">
            <div>
              <label for="revoke-permission" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Permission to Revoke
              </label>
              <select
                id="revoke-permission"
                v-model="revokeForm.permission"
                required
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">Select Permission</option>
                <option
                  v-for="permission in revokeTarget?.permissions"
                  :key="permission.permission"
                  :value="permission.permission"
                >
                  {{ permission.permission }}
                </option>
              </select>
            </div>
            
            <div>
              <label for="revoke-reason" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Reason (Optional)
              </label>
              <textarea
                id="revoke-reason"
                v-model="revokeForm.reason"
                rows="3"
                placeholder="Reason for revoking this permission..."
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              ></textarea>
            </div>
            
            <div class="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                @click="closeRevokeDialog"
                class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="isSubmitting"
                class="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ isSubmitting ? 'Revoking...' : 'Revoke Permission' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { adminService } from '../services/admin'
import type {
  GetPermissionsResponse,
  UserWithPermissions,
  Permission,
} from '../../../shared/types'

// Events
const emit = defineEmits<{
  permissionChanged: []
}>()

// Reactive state
const permissions = ref<GetPermissionsResponse | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
const searchQuery = ref('')
const permissionFilter = ref<Permission | ''>('')

// Dialog state
const showGrantDialog = ref(false)
const showRevokeDialog = ref(false)
const isSubmitting = ref(false)
const revokeTarget = ref<UserWithPermissions | null>(null)

// Form state
const grantForm = ref({
  userUuid: '',
  permission: '' as Permission | '',
  reason: '',
})

const revokeForm = ref({
  permission: '' as Permission | '',
  reason: '',
})

// Load permissions data
async function loadPermissions(): Promise<void> {
  try {
    isLoading.value = true
    error.value = null
    
    const filters: Record<string, unknown> = {}
    
    if (searchQuery.value.trim()) {
      filters.search = searchQuery.value.trim()
    }
    
    if (permissionFilter.value) {
      filters.permission = permissionFilter.value
    }
    
    const response = await adminService.getUserPermissions(filters)
    permissions.value = response
  } catch (err) {
    console.error('Failed to load permissions:', err)
    error.value = err instanceof Error ? err.message : 'Failed to load permissions'
  } finally {
    isLoading.value = false
  }
}

// Debounced search
let searchTimeout: number | null = null
function debouncedSearch(): void {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  
  searchTimeout = window.setTimeout(() => {
    loadPermissions()
  }, 500)
}

// Reset filters
function resetFilters(): void {
  searchQuery.value = ''
  permissionFilter.value = ''
  loadPermissions()
}

// Grant permission dialog
function closeGrantDialog(): void {
  showGrantDialog.value = false
  grantForm.value = {
    userUuid: '',
    permission: '',
    reason: '',
  }
}

async function grantPermission(): Promise<void> {
  if (!grantForm.value.userUuid || !grantForm.value.permission) {
    return
  }
  
  try {
    isSubmitting.value = true
    
    await adminService.grantPermission({
      userUuid: grantForm.value.userUuid,
      permission: grantForm.value.permission as Permission,
      reason: grantForm.value.reason || undefined,
    })
    
    closeGrantDialog()
    await loadPermissions()
    emit('permissionChanged')
  } catch (err) {
    console.error('Failed to grant permission:', err)
    error.value = err instanceof Error ? err.message : 'Failed to grant permission'
  } finally {
    isSubmitting.value = false
  }
}

// Revoke permission dialog
function openRevokeDialog(user: UserWithPermissions): void {
  revokeTarget.value = user
  revokeForm.value = {
    permission: '',
    reason: '',
  }
  showRevokeDialog.value = true
}

function closeRevokeDialog(): void {
  showRevokeDialog.value = false
  revokeTarget.value = null
  revokeForm.value = {
    permission: '',
    reason: '',
  }
}

async function revokePermission(): Promise<void> {
  if (!revokeTarget.value || !revokeForm.value.permission) {
    return
  }
  
  try {
    isSubmitting.value = true
    
    await adminService.revokePermission({
      userUuid: revokeTarget.value.user_uuid,
      permission: revokeForm.value.permission as Permission,
      reason: revokeForm.value.reason || undefined,
    })
    
    closeRevokeDialog()
    await loadPermissions()
    emit('permissionChanged')
  } catch (err) {
    console.error('Failed to revoke permission:', err)
    error.value = err instanceof Error ? err.message : 'Failed to revoke permission'
  } finally {
    isSubmitting.value = false
  }
}

// Utility functions
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString()
}

// Initialize component
onMounted(async () => {
  await loadPermissions()
})
</script>