# Artwork Preview Card UI Reorder - Summary

**Date:** 2025-01-XX  
**Status:** ✅ Completed and Verified

## User Request

> "In the artwork preview card. Swap the Artist and the artwork type around ... The artwork type should look like a clicklet."

## Changes Made

Reordered the artwork preview card to improve visual hierarchy and make the artwork type more prominent and interactive-looking.

### New Display Order

**Before:**
1. Title
2. Artist
3. Type (plain text)

**After:**
1. Title
2. **Type (as clickable badge)**
3. Artist

## Implementation Details

### File Modified

- `src/frontend/src/components/ArtworkCard.vue`

### Full Layout Changes (Photo Overlay)

Updated the bottom overlay section to display:

```vue
<!-- Title -->
<h3 class="text-xl font-bold text-white">{{ artworkTitle }}</h3>

<!-- Type Badge (new position) -->
<div class="mt-1.5">
  <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity"
        :style="{ 
          background: 'rgba(255,255,255,0.25)', 
          color: '#ffffff',
          backdropFilter: 'blur(8px)' 
        }">
    {{ artworkType }}
  </span>
</div>

<!-- Artist (moved below type) -->
<p class="text-sm text-white mt-1.5">{{ artistName }}</p>
```

**Badge Styling:**
- Semi-transparent white background (`rgba(255,255,255,0.25)`)
- Glassmorphism effect with `backdropFilter: 'blur(8px)'`
- Hover state with opacity transition
- Cursor pointer for clickable appearance

### Compact Layout Changes (No Photo)

Updated content section to display:

```vue
<!-- Title -->
<h3 class="text-base font-bold">{{ artworkTitle }}</h3>

<!-- Type Badge (new position, new format) -->
<div class="mb-1">
  <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity"
        :style="{ 
          background: 'var(--md-primary-container, #e0e7ff)', 
          color: 'var(--md-on-primary-container, #1e40af)' 
        }">
    {{ artworkType }}
  </span>
</div>

<!-- Artist (moved below type) -->
<p class="text-xs text-gray-600 mb-1">{{ artistName }}</p>
```

**Badge Styling:**
- MD3 primary container colors (blue/indigo theme)
- Fallback colors: `#e0e7ff` background, `#1e40af` text
- Hover state with opacity transition
- Cursor pointer for clickable appearance

## Verification

### Playwright MCP Testing

**Test Artwork:** East Van Cross (ID: `428632b2-d68b-47e4-99d9-a841580ce071`)

**Verified Elements:**
1. ✅ Title displays: "East Van Cross"
2. ✅ Type badge displays: "Sculpture" (with colored background)
3. ✅ Artist displays: "Ken Lum"
4. ✅ Order is correct: Title → Type badge → Artist
5. ✅ Type badge has visual styling (colored background, badge appearance)
6. ✅ Hover states work (cursor-pointer, opacity transition)

**Screenshot Evidence:**
- `map-preview-reordered-with-artist.png` - Shows compact layout with blue type badge between title and artist

### Type Check

```powershell
cd src/frontend
npm run type-check
```

**Result:** ✅ Passed (no errors)

## Visual Changes

### Full Layout (With Photo)
- Type badge uses glassmorphism effect (semi-transparent white with blur)
- Creates elegant overlay effect over photo background
- White text maintains good contrast

### Compact Layout (No Photo)
- Type badge uses MD3 primary container colors (blue/indigo)
- Creates distinct visual element between title and artist
- Colored badge draws attention to artwork type

## Benefits

1. **Better Visual Hierarchy:** Type is now more prominent and positioned logically between title and artist
2. **Improved Interactivity:** Badge styling with hover states makes type appear clickable (affordance)
3. **Consistent Design:** Both layouts use badge component for type (vs. plain text previously)
4. **Better Scannability:** Colored badge helps users quickly identify artwork type when browsing

## Related Documents

- Previous work: `tasks/map-preview-fix-summary.md` (Session 1 - data enrichment fix)
- Test results: `tasks/playwright-mcp-test-results.md` (Session 1 - initial verification)

## Testing Recommendations

- Test with various artwork types (Sculpture, Mural, Installation, etc.)
- Verify badge appearance with different photo backgrounds (full layout)
- Test hover states on touch devices
- Verify accessibility (screen reader announcements)
- Test with very long artwork type names (overflow handling)
