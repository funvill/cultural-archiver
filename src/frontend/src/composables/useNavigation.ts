import { ref, onMounted, watch } from 'vue';

interface NavigationState {
  isRailExpanded: boolean;
}

/**
 * Navigation composable for managing navigation rail state
 * Handles expand/collapse state and mobile drawer visibility
 * Persists rail state to localStorage
 */
export const useNavigation = () => {
  const isRailExpanded = ref(true);
  const showMobileDrawer = ref(false);

  // Load state from localStorage on mount
  onMounted(() => {
    try {
      const saved = localStorage.getItem('navigationState');
      if (saved) {
        const state: NavigationState = JSON.parse(saved);
        isRailExpanded.value = state.isRailExpanded ?? true;
      }
    } catch (error) {
      console.warn('Failed to load navigation state from localStorage:', error);
      // Fall back to default expanded state
      isRailExpanded.value = true;
    }
  });

  // Save state changes to localStorage
  watch(isRailExpanded, (newValue) => {
    try {
      const state: NavigationState = {
        isRailExpanded: newValue,
      };
      localStorage.setItem('navigationState', JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to save navigation state to localStorage:', error);
    }
  });

  // Actions
  const toggleRail = (): void => {
    isRailExpanded.value = !isRailExpanded.value;
  };

  const expandRail = (): void => {
    isRailExpanded.value = true;
  };

  const collapseRail = (): void => {
    isRailExpanded.value = false;
  };

  const toggleMobileDrawer = (): void => {
    showMobileDrawer.value = !showMobileDrawer.value;
  };

  const openMobileDrawer = (): void => {
    showMobileDrawer.value = true;
  };

  const closeMobileDrawer = (): void => {
    showMobileDrawer.value = false;
  };

  return {
    // State
    isRailExpanded,
    showMobileDrawer,
    
    // Actions
    toggleRail,
    expandRail,
    collapseRail,
    toggleMobileDrawer,
    openMobileDrawer,
    closeMobileDrawer,
  };
};