# Artwork Card Final Updates - October 3, 2025

## Changes Made

### 1. Reordered Display Elements

**New Order:**
1. **Title** - Artwork name
2. **Artist** - Artist name  
3. **Type** - Artwork type (as clickable badge)

**Previous Order:**
1. Title
2. Type (as clickable badge)
3. Artist

### 2. Photo Count Overlay

Added "No photos" text overlay on thumbnail placeholder when no photo is available.

**Implementation:**
- **Compact Layout:** Small badge overlay (`text-xs`) centered on thumbnail
- **Full Layout:** Medium badge overlay (`text-sm`) centered on photo area
- Badge styling: Dark semi-transparent background (`rgba(0,0,0,0.6)`) with white text
- Non-interactive (`pointer-events-none`) so clicks pass through to card

## File Modified

`src/frontend/src/components/ArtworkCard.vue`

## Visual Changes

### Compact Layout (No Photo)
```
┌─────────────────────────┐
│ [Thumbnail]             │ ← "No photos" badge overlays here
│   "No photos"           │
│                         │
│ East Van Cross          │ ← Title
│ Ken Lum                 │ ← Artist  
│ [Sculpture]             │ ← Type badge
└─────────────────────────┘
```

### Full Layout (With Photo)
```
┌─────────────────────────┐
│                         │
│      [Photo]            │
│                         │
│ ────────────────────────│
│ East Van Cross          │ ← Title (in gradient overlay)
│ Ken Lum                 │ ← Artist
│ [Sculpture]             │ ← Type badge (glassmorphism)
└─────────────────────────┘
```

### Full Layout (No Photo)
```
┌─────────────────────────┐
│    [Icon]               │
│   "No photos"           │ ← Overlay badge
│                         │
│ ────────────────────────│
│ East Van Cross          │ ← Title
│ Ken Lum                 │ ← Artist
│ [Sculpture]             │ ← Type badge
└─────────────────────────┘
```

## Testing

### Playwright MCP Verification

**Test Data:**
- Artwork: East Van Cross (ID: 428632b2-d68b-47e4-99d9-a841580ce071)
- Artist: Ken Lum
- Type: Sculpture
- No photos

**Verified Elements:**
1. ✅ Order: Title → Artist → Type
2. ✅ "No photos" badge displays over thumbnail
3. ✅ Badge has dark background with white text
4. ✅ Type badge remains clickable with hover state
5. ✅ Layout responsive and clean

**Screenshot:** `map-preview-final-order-with-overlay.png`

## Code Changes Summary

### Compact Layout Changes

1. **Reordered content section:**
   - Title → Artist → Type (was: Title → Type → Artist)
   
2. **Added photo count overlay:**
   ```vue
   <div v-if="!hasPhoto" class="absolute inset-0 flex items-center justify-center pointer-events-none">
     <span class="text-xs font-medium px-2 py-1 rounded" :style="{ background: 'rgba(0,0,0,0.6)', color: '#ffffff' }">
       {{ photoCount }}
     </span>
   </div>
   ```

3. **Removed photo count from bottom:**
   - Removed `<span>{{ photoCount }}</span>` from bottom metadata area
   - Only shows distance now (if available)

### Full Layout Changes

1. **Reordered bottom overlay:**
   - Title → Artist → Type (was: Title → Type → Artist)

2. **Added photo count overlay:**
   ```vue
   <div v-if="!hasPhoto" class="absolute inset-0 flex items-center justify-center pointer-events-none">
     <span class="text-sm font-medium px-3 py-1.5 rounded" :style="{ background: 'rgba(0,0,0,0.6)', color: '#ffffff' }">
       {{ photoCount }}
     </span>
   </div>
   ```

## Benefits

1. **Cleaner Layout:** Photo count now integrated into thumbnail area instead of taking up separate space
2. **Better Visual Hierarchy:** Title → Artist → Type follows logical reading order
3. **Improved Scannability:** "No photos" immediately visible on thumbnail
4. **Space Efficiency:** Removed redundant photo count text from bottom metadata
5. **Consistent Badging:** Type badge maintains clickable appearance across both layouts

## Related Documents

- Previous update: `tasks/artwork-preview-ui-reorder-summary.md` (Session 2 - Type before Artist)
- Original fix: `tasks/map-preview-fix-summary.md` (Session 1 - Data enrichment)
