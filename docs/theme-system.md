# Theme System Documentation

## Overview
This document provides comprehensive guidance for working with the Cultural Archiver theme system. The theme system provides consistent styling across the application with support for multiple theme variants, icon hover effects, and complete UI component coverage.

## Architecture

### Theme Type Definition
**File**: `src/frontend/src/theme/theme.ts`

The theme system is built around a comprehensive TypeScript interface that defines all available theme properties:

```typescript
export type Theme = {
  // Core Material Design colors
  primary: string;
  primaryVariant?: string;
  secondary?: string;
  success?: string;
  warning?: string;
  background?: string;
  surface?: string;
  error?: string;
  onPrimary?: string;
  onSecondary?: string;
  onSuccess?: string;
  onWarning?: string;
  onBackground?: string;
  onSurface?: string;
  onError?: string;
  
  // Navigation-specific colors
  navLink?: string;
  navLinkHover?: string;
  navBorder?: string;
  navActive?: string;
  navActiveBackground?: string;
  
  // Utility colors
  textMuted?: string;
  textSubtle?: string;
  hoverBackground?: string;
  
  // Icon hover effects (NEW)
  iconHover?: string;
  iconHoverBackground?: string;
  navIconHover?: string;
  navIconHoverBackground?: string;
  
  // Content area colors
  contentBackground?: string;
  cardBackground?: string;
  cardBorder?: string;
  sectionBorder?: string;
  
  // Form and input colors  
  inputBackground?: string;
  inputBorder?: string;
  inputText?: string;
  placeholderText?: string;
  
  // Button variants
  buttonSecondary?: string;
  buttonSecondaryHover?: string;
  buttonOutline?: string;
  buttonOutlineHover?: string;
  
  // Badge and tag colors
  tagBackground?: string;
  tagText?: string;
  badgeBackground?: string;
  badgeText?: string;
};
```

### CSS Variable Mapping
**File**: `src/frontend/src/style.css`

The theme system uses CSS custom properties (variables) to provide theme-aware styling:

```css
/* Core theme variables - automatically set by applyTheme() */
:root {
  --md-primary: /* theme.primary */;
  --md-secondary: /* theme.secondary */;
  --md-background: /* theme.background */;
  --md-surface: /* theme.surface */;
  --md-error: /* theme.error */;
  /* ... and many more */
  
  /* Icon hover variables (NEW) */
  --md-icon-hover: /* theme.iconHover */;
  --md-icon-hover-background: /* theme.iconHoverBackground */;
  --md-nav-icon-hover: /* theme.navIconHover */;
  --md-nav-icon-hover-background: /* theme.navIconHoverBackground */;
}
```

## Available Themes

### 1. Default Material Theme
Clean, professional theme based on Material Design principles:
- Primary: Blue (#1e88e5)
- Secondary: Purple (#8e24aa) 
- Background: Light gray (#f8fafc)
- **Icon Hover**: Blue with scaling effects

### 2. Bauhaus Theme
Bold, artistic theme inspired by Bauhaus design:
- Primary: Deep red (#e63946)
- Secondary: Warm yellow (#f4d35e)
- Background: White with yellow accents
- **Icon Hover**: Red with scaling effects

### 3. Vancouver Theme
Natural theme inspired by Vancouver's landscape:
- Primary: Sky blue (#0284c7)
- Secondary: Emerald green (#10b981)
- Background: Teal-tinted white (#f0fdfa)
- **Icon Hover**: Sky blue with scaling effects

### 4. Dark Gallery Theme
Professional dark theme for art galleries:
- Primary: Warm gold (#f59e0b)
- Background: Dark gray (#1f2937)
- **Icon Hover**: Gold with scaling effects

### 5. Earthy Cultural Theme
Warm, cultural theme with earth tones:
- Primary: Terra cotta (#c2410c)
- Secondary: Sage green (#84cc16)
- Background: Warm beige (#fef7ed)
- **Icon Hover**: Terra cotta with scaling effects

### 6. High Contrast Debug Theme
Special debugging theme with high-contrast colors to identify unthemed elements:
- Primary: Hot pink (#ff1493)
- Secondary: Lime green (#00ff00)
- Background: Orange (#ffa500)
- **Use for**: Finding unthemed UI elements during development

## Icon Hover Enhancement System

### Overview
The icon hover system provides emphasized visual feedback when users interact with icons throughout the application. All interactive icons now have smooth scaling and color-fill effects on hover.

### CSS Classes

#### `.theme-icon-hover`
For general interactive icons:
```css
.theme-icon-hover { 
  transition: all 0.2s ease-in-out;
}
.theme-icon-hover:hover { 
  color: var(--md-icon-hover);
  background-color: var(--md-icon-hover-background);
  transform: scale(1.05); /* 5% scale increase */
}
```

#### `.theme-nav-icon-hover`
For navigation-specific icons (more emphasis):
```css
.theme-nav-icon-hover { 
  transition: all 0.2s ease-in-out;
  border-radius: 0.375rem;
  padding: 0.25rem;
}
.theme-nav-icon-hover:hover { 
  color: var(--md-nav-icon-hover);
  background-color: var(--md-nav-icon-hover-background);
  transform: scale(1.1); /* 10% scale increase */
}
```

#### Group Hover Support
For icons inside buttons:
```css
.group:hover .theme-icon-hover,
.group:focus .theme-icon-hover { 
  color: var(--md-icon-hover);
  transform: scale(1.05);
}
```

### Implementation Examples

#### Navigation Icon (NavigationRail.vue)
```vue
<button class="group p-2">
  <HomeIcon class="w-6 h-6 theme-nav-icon-hover" />
</button>
```

#### Modal Close Button (PromptModal.vue)  
```vue
<button class="group p-1">
  <XMarkIcon class="w-6 h-6 theme-icon-hover" />
</button>
```

#### Interactive Button Icon
```vue
<button class="group flex items-center">
  <span>Edit</span>
  <PencilIcon class="w-4 h-4 ml-2 theme-icon-hover" />
</button>
```

## Theme Utility Classes

### Core Color Classes
```css
.theme-primary { color: var(--md-primary); }
.theme-secondary { color: var(--md-secondary); }
.theme-success { color: var(--md-success); }
.theme-warning { color: var(--md-warning); }
.theme-error { color: var(--md-error); }
.theme-background { background-color: var(--md-background); }
.theme-surface { background-color: var(--md-surface); }
.theme-on-primary { color: var(--md-on-primary); }
.theme-on-secondary { color: var(--md-on-secondary); }
/* ... and many more */
```

### Navigation Classes
```css
.theme-nav-link { color: var(--md-nav-link); }
.theme-nav-link-hover { color: var(--md-nav-link-hover); }
.theme-nav-border { border-color: var(--md-nav-border); }
.theme-nav-active { color: var(--md-nav-active); }
.theme-nav-active-background { background-color: var(--md-nav-active-background); }
```

### Content & Form Classes
```css
.theme-content-background { background-color: var(--md-content-background); }
.theme-card-background { background-color: var(--md-card-background); }
.theme-input-background { background-color: var(--md-input-background); }
.theme-input-border { border-color: var(--md-input-border); }
.theme-button-secondary { background-color: var(--md-button-secondary); }
/* ... and many more */
```

## Usage Guide for Developers

### 1. Applying Themes
```typescript
import { applyTheme, defaultMaterialTheme, bauhausTheme } from '@/theme/theme';

// Apply a theme
applyTheme(defaultMaterialTheme);

// Switch themes dynamically
applyTheme(bauhausTheme);
```

### 2. Using Theme Classes in Components

#### Replace Hard-coded Colors
```vue
<!-- ❌ Before: Hard-coded Tailwind colors -->
<div class="text-gray-700 border-gray-200 hover:bg-gray-50">
  <button class="text-blue-600 hover:text-blue-800">
    <HomeIcon class="w-5 h-5" />
  </button>
</div>

<!-- ✅ After: Theme-aware classes -->  
<div class="theme-text-muted theme-nav-border theme-hover-background">
  <button class="theme-nav-link hover:theme-nav-link-hover group">
    <HomeIcon class="w-5 h-5 theme-nav-icon-hover" />
  </button>
</div>
```

#### Navigation Component Example
```vue
<template>
  <nav class="theme-surface theme-nav-border border-r">
    <div class="flex flex-col space-y-2 p-4">
      <router-link 
        v-for="item in navItems" 
        :key="item.path"
        :to="item.path"
        class="flex items-center px-3 py-2 rounded-md theme-nav-link hover:theme-nav-link-hover hover:theme-nav-active-background group"
        :class="{ 'theme-nav-active theme-nav-active-background': isActive(item.path) }"
      >
        <component 
          :is="item.icon" 
          class="w-5 h-5 mr-3 theme-nav-icon-hover" 
        />
        {{ item.label }}
      </router-link>
    </div>
  </nav>
</template>
```

### 3. Creating New Themes

#### Step 1: Define Theme Object
```typescript
export const myCustomTheme: Theme = {
  // Core colors (required)
  primary: '#your-primary-color',
  secondary: '#your-secondary-color', 
  background: '#your-background-color',
  surface: '#your-surface-color',
  error: '#your-error-color',
  success: '#your-success-color',
  warning: '#your-warning-color',
  
  // On-colors (required)
  onPrimary: '#ffffff',
  onSecondary: '#ffffff',
  onBackground: '#your-text-color',
  onSurface: '#your-text-color',
  onError: '#ffffff',
  onSuccess: '#ffffff',
  onWarning: '#your-warning-text-color',
  
  // Navigation colors (recommended)
  navLink: '#your-nav-link-color',
  navLinkHover: '#your-nav-hover-color',
  navBorder: '#your-border-color',
  navActive: '#your-active-color',
  navActiveBackground: '#your-active-bg-color',
  
  // Icon hover colors (recommended)
  iconHover: '#your-icon-hover-color',
  iconHoverBackground: 'rgba(your-color, 0.1)',
  navIconHover: '#your-nav-icon-hover-color', 
  navIconHoverBackground: 'rgba(your-nav-color, 0.15)',
  
  // Utility colors (optional but recommended)
  textMuted: '#your-muted-text',
  textSubtle: '#your-subtle-text',
  hoverBackground: '#your-hover-bg',
  
  // Content area colors (optional)
  contentBackground: '#your-content-bg',
  cardBackground: '#your-card-bg',
  cardBorder: '#your-card-border',
  
  // Form colors (optional)
  inputBackground: '#your-input-bg',
  inputBorder: '#your-input-border',
  inputText: '#your-input-text',
  placeholderText: '#your-placeholder-text',
  
  // Button variants (optional)
  buttonSecondary: '#your-secondary-button',
  buttonSecondaryHover: '#your-secondary-button-hover',
  
  // Tags and badges (optional)
  tagBackground: '#your-tag-bg',
  tagText: '#your-tag-text',
  badgeBackground: '#your-badge-bg', 
  badgeText: '#your-badge-text',
};
```

#### Step 2: Test with Debug Theme
```typescript
import { HighContrastDebugTheme, applyTheme } from '@/theme/theme';

// Apply debug theme to identify unthemed elements
applyTheme(HighContrastDebugTheme);

// Any element that shows hot pink, lime green, or orange 
// needs to be converted to use theme classes
```

#### Step 3: Validate Theme Coverage
1. Apply your new theme
2. Navigate through all major app sections
3. Look for any hard-coded colors that don't match your theme
4. Replace hard-coded Tailwind classes with theme utility classes

### 4. Adding New Theme Properties

#### Step 1: Extend Theme Type
```typescript
// In src/frontend/src/theme/theme.ts
export type Theme = {
  // ... existing properties ...
  
  // Add your new property
  myNewColor?: string;
  myNewHoverColor?: string;
};
```

#### Step 2: Update applyTheme Function
```typescript
export function applyTheme(theme: Theme): void {
  // ... existing setCssVar calls ...
  
  // Add your new CSS variables
  setCssVar('--md-my-new-color', theme.myNewColor);
  setCssVar('--md-my-new-hover-color', theme.myNewHoverColor);
}
```

#### Step 3: Add CSS Utility Classes
```css
/* In src/frontend/src/style.css */
.theme-my-new-color { color: var(--md-my-new-color, #default-color); }
.theme-my-new-hover-color { color: var(--md-my-new-hover-color, #default-hover); }
```

#### Step 4: Update All Themes
```typescript
// Update each theme object to include the new properties
export const defaultMaterialTheme: Theme = {
  // ... existing properties ...
  myNewColor: '#1e88e5',
  myNewHoverColor: '#1565c0',
};

export const bauhausTheme: Theme = {
  // ... existing properties ...
  myNewColor: '#e63946',
  myNewHoverColor: '#b22234',
};
// ... update all other themes
```

## Component Integration

### Components with Theme Support ✅

#### Navigation Components
- **NavigationRail.vue**: Complete theme integration with icon hover effects
- **NavControls.vue**: Complete theme integration with icon hover effects

#### UI Components  
- **PromptModal.vue**: Close button with icon hover effects

#### View Components (Partial)
- **NewArtworkView.vue**: Back button and modal close with icon hover effects
- **FastPhotoUploadView.vue**: Photo removal buttons with icon hover effects
- **ArtworkDetailView.vue**: Action buttons ready for theme integration
- **SearchView.vue**: Add artwork button identified for enhancement

### Integration Patterns

#### Basic Icon Button
```vue
<template>
  <button class="group p-2 theme-hover-background rounded-md">
    <IconComponent class="w-5 h-5 theme-icon-hover" />
  </button>
</template>
```

#### Navigation Link with Icon
```vue
<template>
  <router-link 
    class="group flex items-center theme-nav-link hover:theme-nav-link-hover hover:theme-nav-active-background"
  >
    <IconComponent class="w-5 h-5 theme-nav-icon-hover mr-3" />
    Link Text
  </router-link>
</template>
```

#### Card Component
```vue
<template>
  <div class="theme-card-background theme-card-border border rounded-lg p-4">
    <h3 class="theme-on-surface text-lg font-semibold">Title</h3>
    <p class="theme-text-muted">Subtitle</p>
    <button class="group mt-4">
      <ActionIcon class="w-4 h-4 theme-icon-hover" />
    </button>
  </div>
</template>
```

## Debugging & Testing

### Using the High Contrast Debug Theme

The `HighContrastDebugTheme` is designed to make unthemed elements immediately visible:

```typescript
import { HighContrastDebugTheme, applyTheme } from '@/theme/theme';

// Apply debug theme
applyTheme(HighContrastDebugTheme);
```

**What to look for:**
- **Hot Pink (#ff1493)**: Elements using `--md-primary` 
- **Lime Green (#00ff00)**: Elements using `--md-secondary`
- **Orange (#ffa500)**: Elements using `--md-background`
- **Bright Yellow (#ffff00)**: Elements using `--md-surface`
- **Gray elements**: Likely using hard-coded Tailwind classes (need conversion)

### Testing Checklist

#### Theme Coverage Test
1. Apply each theme variant
2. Navigate through all major app sections:
   - Navigation rail and controls
   - Search and map views  
   - Artwork detail pages
   - Modal dialogs
   - Form inputs
3. Verify all elements change colors appropriately

#### Icon Hover Test
1. Hover over all interactive icons
2. Verify scaling and color change effects
3. Check navigation icons for emphasized hover (1.1x scale)
4. Check general icons for subtle hover (1.05x scale)

#### Accessibility Test
1. Apply high contrast debug theme
2. Check for adequate color contrast ratios
3. Verify focus states are visible
4. Test keyboard navigation

## Migration Guide

### Converting Existing Components to Theme System

#### Step 1: Identify Hard-coded Colors
```bash
# Search for Tailwind color classes
grep -r "text-gray-" src/frontend/src/
grep -r "bg-blue-" src/frontend/src/
grep -r "border-red-" src/frontend/src/
```

#### Step 2: Map to Theme Classes
```vue
<!-- Common replacements -->

<!-- Text colors -->
text-gray-900     → theme-on-background
text-gray-700     → theme-text-muted  
text-gray-500     → theme-text-subtle
text-blue-600     → theme-primary
text-red-600      → theme-error

<!-- Background colors -->
bg-white          → theme-surface
bg-gray-50        → theme-background
bg-gray-100       → theme-hover-background
bg-blue-600       → theme-primary

<!-- Border colors -->
border-gray-200   → theme-nav-border
border-gray-300   → theme-card-border
border-blue-600   → theme-primary

<!-- Interactive elements -->
hover:bg-gray-100 → hover:theme-hover-background
hover:text-blue-800 → hover:theme-nav-link-hover
```

#### Step 3: Add Icon Hover Classes
```vue
<!-- Before -->
<HomeIcon class="w-5 h-5" />

<!-- After -->
<HomeIcon class="w-5 h-5 theme-nav-icon-hover" />

<!-- For buttons, add group class -->
<button class="group p-2">
  <HomeIcon class="w-5 h-5 theme-nav-icon-hover" />
</button>
```

#### Step 4: Test with Debug Theme
Apply `HighContrastDebugTheme` and verify no elements have inappropriate colors.

## Best Practices

### Do's ✅
- Always use theme utility classes instead of hard-coded colors
- Add `group` class to buttons containing icons with hover effects
- Use `theme-nav-icon-hover` for navigation icons (more emphasis)
- Use `theme-icon-hover` for general interactive icons
- Test new components with multiple themes including debug theme
- Provide fallback colors in CSS custom properties
- Document any new theme properties you add

### Don'ts ❌
- Don't use hard-coded Tailwind color classes (e.g., `text-blue-600`)
- Don't skip the icon hover classes for interactive icons
- Don't forget to add group hover support for button icons
- Don't create themes without all core properties defined
- Don't mix theme classes with hard-coded colors in the same component
- Don't forget to update all existing themes when adding new properties

## Performance Considerations

### CSS Variable Performance
- CSS custom properties have minimal performance impact
- Variables are resolved at paint time, not layout time
- Theme switching is instant with no re-parsing required

### Icon Hover Performance
- Transform animations use GPU acceleration
- Transition duration (0.2s) is optimized for perceived responsiveness
- Scale transforms don't trigger layout recalculation

## Future Enhancements

### Planned Features
1. **Theme Persistence**: Save user theme preference to localStorage
2. **System Theme Detection**: Automatically detect light/dark system preference
3. **Theme Preview**: Live preview when selecting themes
4. **Custom Theme Builder**: UI for creating custom themes
5. **Theme Validation**: Runtime validation for theme completeness

### Extension Points
1. **Animation Themes**: Different hover animation styles per theme
2. **Sound Themes**: Audio feedback on interactions (accessibility)
3. **Layout Themes**: Different spacing and sizing variants
4. **Typography Themes**: Font family variants per theme

## Support & Troubleshooting

### Common Issues

#### Theme Not Applied
**Problem**: Theme changes don't appear
**Solution**: Verify `applyTheme()` is called and CSS variables are set in browser dev tools

#### Icons Not Hovering
**Problem**: Icon hover effects not working
**Solution**: Check for `theme-icon-hover` or `theme-nav-icon-hover` classes and `group` class on parent buttons

#### Hard-coded Colors Visible
**Problem**: Some elements don't change with theme
**Solution**: Use High Contrast Debug Theme to identify unthemed elements, replace with theme utility classes

#### Performance Issues
**Problem**: Theme switching feels slow
**Solution**: Check for unnecessary re-renders, ensure CSS transitions are optimal

### Getting Help
1. Check browser dev tools for CSS variable values
2. Use High Contrast Debug Theme for visual debugging  
3. Review component integration patterns in this documentation
4. Test with multiple themes to ensure proper coverage

## Complete Example

Here's a complete example showing a fully themed component with icon hover effects:

```vue
<template>
  <div class="theme-surface theme-card-border border rounded-lg p-6">
    <!-- Header with close button -->
    <div class="flex items-center justify-between mb-4">
      <h2 class="theme-on-surface text-xl font-semibold">Settings</h2>
      <button 
        @click="close"
        class="group p-1 theme-hover-background rounded-md"
        aria-label="Close settings"
      >
        <XMarkIcon class="w-5 h-5 theme-icon-hover" />
      </button>
    </div>
    
    <!-- Content with navigation -->
    <nav class="theme-nav-border border-b mb-4">
      <div class="flex space-x-4">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="group flex items-center px-3 py-2 theme-nav-link hover:theme-nav-link-hover"
          :class="{ 'theme-nav-active theme-nav-active-background': activeTab === tab.id }"
        >
          <component 
            :is="tab.icon" 
            class="w-4 h-4 mr-2 theme-nav-icon-hover" 
          />
          {{ tab.label }}
        </button>
      </div>
    </nav>
    
    <!-- Form inputs -->
    <div class="space-y-4">
      <div>
        <label class="block theme-on-surface text-sm font-medium mb-2">
          Username
        </label>
        <input
          type="text"
          class="w-full px-3 py-2 theme-input-background theme-input-border border rounded-md theme-input-text"
          :class="{ 'theme-error': hasError }"
          placeholder="Enter your username"
        />
      </div>
      
      <!-- Action buttons -->
      <div class="flex justify-end space-x-3 mt-6">
        <button class="group px-4 py-2 theme-button-secondary hover:theme-button-secondary-hover rounded-md">
          <XMarkIcon class="w-4 h-4 mr-2 theme-icon-hover" />
          Cancel
        </button>
        <button class="group px-4 py-2 theme-primary theme-on-primary rounded-md">
          <CheckIcon class="w-4 h-4 mr-2 theme-icon-hover" />
          Save
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XMarkIcon, CheckIcon, CogIcon, UserIcon } from '@heroicons/vue/24/outline'
import { ref } from 'vue'

const activeTab = ref('general')
const hasError = ref(false)

const tabs = [
  { id: 'general', label: 'General', icon: CogIcon },
  { id: 'profile', label: 'Profile', icon: UserIcon },
]

const close = () => {
  // Handle close
}
</script>
```

This example demonstrates:
- Complete theme integration using utility classes
- Icon hover effects with appropriate classes
- Group hover support for button icons
- Navigation with active states
- Form inputs with theme-aware styling
- Proper semantic HTML and accessibility

---

**Last Updated**: September 27, 2025
**Version**: 2.0 - Enhanced with Icon Hover System