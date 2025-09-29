<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import BadgeGrid from '../components/BadgeGrid.vue';
import { apiService } from '../services/api';

interface PublicProfile {
  uuid: string;
  profile_name: string;
  badges: Array<{
    badge: any;
    awarded_at: string;
    award_reason: string;
    metadata?: Record<string, unknown>;
  }>;
  member_since: string;
}

const route = useRoute();

const profile = ref<PublicProfile | null>(null);
const isLoading = ref(true);
const error = ref('');

const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch (error) {
    return 'Unknown date';
  }
};

const loadProfile = async () => {
  const uuid = route.params.uuid as string;

  if (!uuid) {
    error.value = 'Invalid profile URL';
    isLoading.value = false;
    return;
  }

  try {
    isLoading.value = true;
    const response = await apiService.getPublicUserProfile(uuid);

    if (response.success && response.data) {
      profile.value = response.data;
    } else {
      error.value = response.error || 'Failed to load profile';
    }
  } catch (err: any) {
    console.error('Failed to load public profile:', err);

    if (err.status === 404) {
      error.value = 'This user profile is not available or does not exist.';
    } else {
      error.value = err.message || 'Failed to load profile';
    }
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadProfile();
});

</script>

<template>
    <!-- Page Header -->
    <AppShell>
      <template #header>
        <div class="flex items-center space-x-4">
          <button
            @click="$router.go(-1)"
            class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Go back"
          >
            <svg
              class="w-5 h-5 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1 class="text-xl font-semibold text-gray-900">
            {{ profile?.profile_name || 'User Profile' }}
          </h1>
        </div>
      </template>

      <!-- Main Content -->
      <div class="max-w-4xl mx-auto px-4 py-6">
        <!-- Loading State -->
        <div v-if="isLoading" class="space-y-6">
          <div class="animate-pulse">
            <!-- Profile Header Skeleton -->
            <div class="bg-white rounded-lg shadow p-6 mb-6">
              <div class="flex items-center space-x-4">
                <div class="w-16 h-16 bg-gray-200 rounded-full"></div>
                <div class="space-y-2">
                  <div class="h-6 bg-gray-200 rounded w-48"></div>
                  <div class="h-4 bg-gray-200 rounded w-32"></div>
                </div>
              </div>
            </div>

            <!-- Badges Skeleton -->
            <div class="bg-white rounded-lg shadow p-6">
              <div class="h-6 bg-gray-200 rounded w-32 mb-4"></div>
              <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                <div v-for="i in 6" :key="i" class="h-24 bg-gray-200 rounded-lg"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="text-center py-12">
          <div
            class="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center"
          >
            <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h2 class="text-lg font-medium text-gray-900 mb-2">Profile not found</h2>
          <p class="text-gray-600 mb-4">
            {{ error }}
          </p>
          <button
            @click="$router.push('/')"
            class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Return Home
          </button>
        </div>

        <!-- Profile Content -->
        <div v-else-if="profile" class="space-y-6">
          <!-- Profile Header -->
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center space-x-4">
              <!-- Profile Avatar (using first letter of profile name) -->
              <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <span class="text-2xl font-semibold text-blue-600">
                  {{ profile.profile_name.charAt(0).toUpperCase() }}
                </span>
              </div>

              <div>
                <h2 class="text-2xl font-bold text-gray-900">{{ profile.profile_name }}</h2>
                <p class="text-gray-600">Member since {{ formatDate(profile.member_since) }}</p>
                <div class="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                  <span>{{ profile.badges.length }} badges earned</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Badges Section -->
          <div class="bg-white rounded-lg shadow p-6">
            <BadgeGrid :badges="profile.badges" :loading="false" />
          </div>

          <!-- Future: Activity Timeline, Stats, etc. -->
        </div>
      </div>
    </AppShell>
</template>



<style scoped>
.public-profile-view {
  @apply min-h-screen bg-gray-50;
}
</style>
