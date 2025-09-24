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
  
  // Responsive breakpoints based on Material Design guidelines
  const isMobile = computed(() => width.value < 600)
  const isTablet = computed(() => width.value >= 600 && width.value < 1024)
  const isDesktop = computed(() => width.value >= 1024)
  
  // Specific to our navigation design
  const showNavigationRail = computed(() => width.value >= 600)
  const showBottomNavigation = computed(() => width.value < 600)
  
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