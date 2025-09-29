import { ref, onMounted, watch } from 'vue';
import type { Ref } from 'vue';

interface NavigationState {
  isRailExpanded: boolean;
}

export interface UseNavigationReturn {
  isRailExpanded: Ref<boolean>;
  showMobileDrawer: Ref<boolean>;
  toggleRail: () => void;
  expandRail: () => void;
  collapseRail: () => void;
  toggleMobileDrawer: () => void;
  openMobileDrawer: () => void;
  closeMobileDrawer: () => void;
}

/**
 * Navigation composable for managing navigation rail state
 * Handles expand/collapse state and mobile drawer visibility
 * Persists rail state to localStorage
 */
export const useNavigation = (): UseNavigationReturn => {
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
  watch(isRailExpanded, (newValue: boolean) => {
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