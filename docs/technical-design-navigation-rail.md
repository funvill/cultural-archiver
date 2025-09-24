# Technical Design: Navigation Rail Components

**Version:** 1.0  
**Date:** 2025-09-23  
**Based on:** `tasks/prd-navigation-rail-gui-update.md`

## Component Architecture

### 1. NavigationRail.vue (Primary Desktop Component)

**Purpose**: Left-side navigation rail for desktop and large screens.

**Props:**
```typescript
interface NavigationRailProps {
  isExpanded?: boolean;  // Control expanded/collapsed state
  currentRoute: string;  // Active route for highlighting
  userRole?: 'admin' | 'moderator' | 'user'; // Role-based visibility
  notificationCount?: number; // Badge count for notifications
}
```

**Events:**
```typescript
interface NavigationRailEvents {
  'toggle-expanded': () => void;
  'search-submit': (query: string) => void;
  'notification-click': () => void;
  'profile-click': () => void;
  'logout-click': () => void;
  'about-modal-open': () => void;
}
```

**Structure:**
```
NavigationRail
├── Header Section
│   ├── Logo + App Name
│   └── Intro Blurb + "Read More" link
├── Navigation Links
│   ├── Map (with active state)
│   ├── Artwork Index
│   └── Artist Index
├── Search Bar
├── Role-Based Items
│   ├── Admin Link (if admin)
│   └── Moderator Link (if moderator)
├── Spacer
└── Bottom Actions
    ├── Notifications
    ├── Profile
    ├── Logout
    └── Collapse/Expand Toggle
```

### 2. BottomNavigation.vue (Mobile Component)

**Purpose**: Bottom navigation bar for mobile/small screens.

**Props:**
```typescript
interface BottomNavigationProps {
  currentRoute: string;
  notificationCount?: number;
  showNotifications?: boolean;
}
```

**Events:**
```typescript
interface BottomNavigationEvents {
  'menu-toggle': () => void;
  'notification-click': () => void;
  'fab-click': () => void; // Submit New Artwork
}
```

**Layout:**
```
[Menu Icon] ---- [FAB] ---- [Notification Icon]
```

### 3. NavigationDrawer.vue (Mobile Overlay)

**Purpose**: Mobile drawer that slides in from left when hamburger menu is tapped.

**Props:**
```typescript
interface NavigationDrawerProps {
  isOpen: boolean;
  currentRoute: string;
  userRole?: 'admin' | 'moderator' | 'user';
}
```

**Events:**
```typescript
interface NavigationDrawerEvents {
  'update:isOpen': (value: boolean) => void;
  'search-submit': (query: string) => void;
  'profile-click': () => void;
  'logout-click': () => void;
  'about-modal-open': () => void;
}
```

## Responsive Breakpoints

Based on Material Design 3 guidelines:

```css
/* Desktop - Navigation Rail */
@media (min-width: 600px) {
  .navigation-rail { display: flex; }
  .bottom-navigation { display: none; }
}

/* Mobile - Bottom Navigation */
@media (max-width: 599px) {
  .navigation-rail { display: none; }
  .bottom-navigation { display: flex; }
}
```

## State Management

### LocalStorage Persistence
```typescript
interface NavigationState {
  isRailExpanded: boolean;
}

// Save state
localStorage.setItem('navigationState', JSON.stringify({ isRailExpanded }));

// Restore state
const saved = localStorage.getItem('navigationState');
const state = saved ? JSON.parse(saved) : { isRailExpanded: true };
```

### Composable: useNavigation
```typescript
export const useNavigation = () => {
  const isRailExpanded = ref(true);
  const showMobileDrawer = ref(false);
  
  // Load state from localStorage
  onMounted(() => {
    const saved = localStorage.getItem('navigationState');
    if (saved) {
      const state = JSON.parse(saved);
      isRailExpanded.value = state.isRailExpanded ?? true;
    }
  });
  
  // Save state changes
  watch(isRailExpanded, (newValue) => {
    localStorage.setItem('navigationState', JSON.stringify({
      isRailExpanded: newValue
    }));
  });
  
  return {
    isRailExpanded,
    showMobileDrawer,
    toggleRail: () => isRailExpanded.value = !isRailExpanded.value,
    toggleMobileDrawer: () => showMobileDrawer.value = !showMobileDrawer.value,
    closeMobileDrawer: () => showMobileDrawer.value = false
  };
};
```

## Material Design 3 Guidelines Implementation

### Colors & Theming
```css
:root {
  --md-sys-color-surface-container: #f3f3f3;
  --md-sys-color-on-surface: #1c1b1f;
  --md-sys-color-primary: #6750a4;
  --md-sys-color-on-primary: #ffffff;
  --md-sys-color-secondary-container: #e8def8;
}
```

### Active State Indicators
```css
.nav-item.active {
  background-color: var(--md-sys-color-secondary-container);
  border-radius: 28px; /* Material 3 pill shape */
  color: var(--md-sys-color-on-secondary-container);
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  width: 4px;
  height: 100%;
  background-color: var(--md-sys-color-primary);
  border-radius: 0 2px 2px 0;
}
```

### Animations
```css
.rail-transition {
  transition: width 250ms cubic-bezier(0.4, 0, 0.2, 1);
}

.drawer-slide {
  transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1);
}

.fab-elevation {
  box-shadow: 0px 6px 10px 0px rgba(0, 0, 0, 0.14),
              0px 1px 18px 0px rgba(0, 0, 0, 0.12),
              0px 3px 5px -1px rgba(0, 0, 0, 0.20);
}
```

## Component File Structure

```
src/frontend/src/components/navigation/
├── NavigationRail.vue
├── BottomNavigation.vue
├── NavigationDrawer.vue
├── NavigationItem.vue (shared component)
└── AboutModal.vue (for "Read More" functionality)

src/frontend/src/composables/
└── useNavigation.ts

src/frontend/src/components/
└── AppShell.vue (modified to use new navigation)
```

## Integration Points

### AppShell.vue Changes
```vue
<template>
  <div class="app-layout">
    <!-- Desktop Navigation Rail -->
    <NavigationRail
      v-if="!isMobile"
      :is-expanded="navigation.isRailExpanded.value"
      :current-route="$route.path"
      :user-role="authStore.userRole"
      :notification-count="notificationStore.count"
      @toggle-expanded="navigation.toggleRail"
      @search-submit="handleSearch"
      @about-modal-open="showAboutModal = true"
    />
    
    <!-- Mobile Bottom Navigation -->
    <BottomNavigation
      v-if="isMobile"
      :current-route="$route.path"
      :notification-count="notificationStore.count"
      @menu-toggle="navigation.toggleMobileDrawer"
      @fab-click="handleFabClick"
    />
    
    <!-- Mobile Drawer Overlay -->
    <NavigationDrawer
      v-if="isMobile"
      :is-open="navigation.showMobileDrawer.value"
      :current-route="$route.path"
      :user-role="authStore.userRole"
      @update:isOpen="navigation.showMobileDrawer.value = $event"
      @search-submit="handleSearch"
    />
    
    <!-- Main Content -->
    <main class="main-content" :class="mainContentClasses">
      <RouterView />
    </main>
  </div>
</template>
```

This technical design provides a comprehensive blueprint for implementing the navigation rail system according to the PRD requirements and Material Design 3 guidelines.