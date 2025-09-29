<script setup lang="ts">
import { defineProps } from 'vue';
import BadgeCard from './BadgeCard.vue';
import type { UserBadgeResponse } from '../types';

interface Props {
  badges: UserBadgeResponse['user_badges'];
  loading?: boolean;
}

defineProps<Props>();
</script>

<template>
  <div class="badge-grid">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-900">
        Badges
        <span v-if="badges.length > 0" class="text-sm font-normal text-gray-500 ml-2">
          ({{ badges.length }})
        </span>
      </h3>
    </div>

    <!-- Badge Grid -->
    <div
      v-if="badges.length > 0"
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
    >
      <BadgeCard
        v-for="userBadge in badges"
        :key="userBadge.badge.id"
        :badge="userBadge.badge"
        :awarded-at="userBadge.awarded_at"
        :award-reason="userBadge.award_reason"
        v-bind="userBadge.metadata ? { metadata: userBadge.metadata } : {}"
      />
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-8">
      <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
        <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
          />
        </svg>
      </div>
      <h4 class="text-sm font-medium text-gray-900 mb-1">No badges yet</h4>
      <p class="text-sm text-gray-500">Complete activities to earn your first badge!</p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      <div v-for="i in 6" :key="i" class="animate-pulse">
        <div class="bg-gray-200 rounded-lg h-24 w-full"></div>
      </div>
    </div>
  </div>
</template>

<!-- script moved above template to satisfy component-tags-order rule -->

<style scoped>
.badge-grid {
  @apply w-full;
}
</style>
