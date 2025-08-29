<script setup lang="ts">
import { useAnnouncer } from '../composables/useAnnouncer'

const { announcement, announcementLevel } = useAnnouncer()
</script>

<template>
  <!-- Screen Reader Live Region for Announcements -->
  <div 
    class="sr-only" 
    :aria-live="announcementLevel"
    aria-atomic="true"
    role="status"
  >
    {{ announcement }}
  </div>
</template>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>