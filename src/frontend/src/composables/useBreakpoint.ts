import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { Ref, ComputedRef } from 'vue'

export interface UseBreakpointReturn {
  width: Ref<number>
  isMobile: ComputedRef<boolean>
  isTablet: ComputedRef<boolean>
  isDesktop: ComputedRef<boolean>
  showNavigationRail: ComputedRef<boolean>
  showBottomNavigation: ComputedRef<boolean>
}

export function useBreakpoint(): UseBreakpointReturn {
  const width = ref(0)
  
  // Responsive breakpoints aligned with Tailwind's defaults (md = 768px)
  const isMobile = computed(() => width.value < 768)
  const isTablet = computed(() => width.value >= 768 && width.value < 1024)
  const isDesktop = computed(() => width.value >= 1024)

  // Specific to our navigation design
  // Navigation rail only shows on large screens (lg = 1024px+)
  // Bottom navigation shows on all screen sizes
  const showNavigationRail = computed(() => width.value >= 1024)
  const showBottomNavigation = computed(() => true) // Always show bottom navigation
  
  const updateWidth = (): void => {
    width.value = window.innerWidth
  }
  
  onMounted(() => {
    updateWidth()
    window.addEventListener('resize', updateWidth)
  })
  
  onUnmounted(() => {
    window.removeEventListener('resize', updateWidth)
  })
  
  return {
    width,
    isMobile,
    isTablet,
    isDesktop,
    showNavigationRail,
    showBottomNavigation
  }
}