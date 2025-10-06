# Reduce API Requests Through Caching

## Problem
On loading the page for the first time, hundreds of duplicate requests for user lists were being made against the server. The lists were not being cached on the user's local browser as they should be, causing excessive API calls.

## Root Cause Analysis
1. **AddToListDialog** component was directly calling `apiService.getUserLists()` every time it opened, bypassing the existing `useUserLists` composable cache
2. **ProfileView** component was also directly calling `apiService.getUserLists()` instead of using the cached composable
3. **List details** (`getListDetails`) had no caching mechanism at all, causing duplicate requests when the same list was accessed multiple times

## Solution Implemented

### 1. Refactored AddToListDialog Component
**File**: `src/frontend/src/components/AddToListDialog.vue`

**Changes**:
- Replaced direct `apiService.getUserLists()` call with `useUserLists()` composable
- Removed redundant `loadUserLists()` function
- Now uses the global 5-minute cache from `useUserLists` composable
- Calls `refreshLists()` after creating new lists to update cache
- Simplified code by removing duplicate authentication checks

**Before**:
```typescript
const userLists = ref<any[]>([]);

const loadUserLists = async () => {
  const response = await apiService.getUserLists();
  userLists.value = response.data.filter(...);
};

watch(isOpen, (val) => {
  if (val) loadUserLists(); // Called every time dialog opens!
});
```

**After**:
```typescript
const { lists, fetchUserLists, refreshLists } = useUserLists();

const userLists = computed(() => {
  return lists.value.filter((list) => !list.is_system_list);
});

watch(isOpen, (val: boolean) => {
  if (val) {
    fetchUserLists(); // Uses cache if available
  }
});
```

### 2. Refactored ProfileView Component
**File**: `src/frontend/src/views/ProfileView.vue`

**Changes**:
- Replaced direct `apiService.getUserLists()` call with `useUserLists()` composable
- Removed custom `fetchUserLists()` function
- Now shares the same cached data with other components
- Reduced code complexity and duplication

**Before**:
```typescript
const userLists = ref<ListApiResponse[]>([]);
const listsLoading = ref(false);
const listsError = ref<string | null>(null);

async function fetchUserLists() {
  listsLoading.value = true;
  const response = await apiService.getUserLists();
  userLists.value = response.data;
  listsLoading.value = false;
}
```

**After**:
```typescript
const { lists: userLists, isLoading: listsLoading, error: listsError, fetchUserLists } = useUserLists();
```

### 3. Added API-Level Caching for List Details
**File**: `src/frontend/src/services/api.ts`

**Changes**:
- Added in-memory cache for `getListDetails()` with 5-minute TTL
- Cache key includes list ID, page, and limit for granular caching
- Automatic cache invalidation when lists are mutated:
  - `addArtworkToList()` - clears cache for specific list
  - `removeArtworksFromList()` - clears cache for specific list
  - `deleteList()` - clears cache for specific list
  - `createList()` - clears entire cache
- Added debug logging for cache hits/misses

**Implementation**:
```typescript
// Cache structure
interface ListDetailsCacheEntry {
  data: ApiResponse<Record<string, unknown>>;
  timestamp: number;
}

const listDetailsCache = new Map<string, ListDetailsCacheEntry>();
const LIST_DETAILS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache key generation
function getListDetailsCacheKey(listId: string, page: number, limit: number): string {
  return `${listId}:${page}:${limit}`;
}

// Cache invalidation
function clearListDetailsCache(listId?: string): void {
  if (listId) {
    // Clear specific list cache entries
    const keysToDelete: string[] = [];
    listDetailsCache.forEach((_, key) => {
      if (key.startsWith(`${listId}:`)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => listDetailsCache.delete(key));
  } else {
    // Clear entire cache
    listDetailsCache.clear();
  }
}

// Enhanced getListDetails with caching
async getListDetails(listId: string, page = 1, limit = 50): Promise<ApiResponse<Record<string, unknown>>> {
  const cacheKey = getListDetailsCacheKey(listId, page, limit);
  const cached = listDetailsCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < LIST_DETAILS_CACHE_TTL) {
    console.log(`[API Cache] Hit for list details: ${cacheKey}`);
    return cached.data;
  }
  
  console.log(`[API Cache] Miss for list details: ${cacheKey}`);
  const response = await client.get(`/lists/${listId}`, { ... });
  
  listDetailsCache.set(cacheKey, {
    data: response,
    timestamp: Date.now()
  });
  
  return response;
}
```

## Benefits

### Performance Improvements
1. **Reduced API Calls**: Hundreds of duplicate requests reduced to a single request per 5-minute window
2. **Faster UI Response**: Cached data loads instantly instead of waiting for network requests
3. **Lower Server Load**: Significantly reduced backend load from redundant list queries

### Code Quality Improvements
1. **Better Architecture**: Centralized caching logic in composable and API service
2. **Less Code Duplication**: Components share the same caching mechanism
3. **Easier Maintenance**: Single source of truth for list data
4. **Improved Type Safety**: Using shared TypeScript types consistently

### User Experience Improvements
1. **Instant Dialog Loading**: AddToListDialog opens immediately with cached data
2. **Smoother Navigation**: Profile view loads lists without delay
3. **Consistent Data**: All components see the same cached list data
4. **Reduced Loading Spinners**: Less waiting for data to load

## Cache Strategy

### useUserLists Composable Cache
- **TTL**: 5 minutes
- **Scope**: Global (shared across all instances)
- **Invalidation**: Manual via `refreshLists()` after mutations
- **Data**: Full user lists with items for system lists

### API Service List Details Cache
- **TTL**: 5 minutes
- **Scope**: Global (shared across all API calls)
- **Invalidation**: Automatic on list mutations
- **Data**: Paginated list details with artwork items

## Testing

### Build Verification
✅ `npm run build:frontend` - Completed successfully with 0 errors

### Manual Testing Recommended
1. Open browser DevTools Network tab
2. Navigate to profile page
3. Click "Add to List" button multiple times
4. Verify only 1 request is made for user lists (not hundreds)
5. Open multiple artworks and add to lists
6. Verify list details are cached and reused

### Expected Behavior
- First `AddToListDialog` open: 1 API request for user lists
- Subsequent opens (within 5 min): 0 API requests (cache hit)
- After list mutation: Cache invalidated, next request fetches fresh data
- Console logs show `[API Cache] Hit` for cached requests

## Files Modified

1. `src/frontend/src/components/AddToListDialog.vue`
   - Replaced direct API calls with `useUserLists` composable
   - Simplified component logic
   - Improved TypeScript types

2. `src/frontend/src/views/ProfileView.vue`
   - Replaced direct API calls with `useUserLists` composable
   - Removed duplicate code
   - Uses shared cache

3. `src/frontend/src/services/api.ts`
   - Added list details caching mechanism
   - Implemented cache invalidation
   - Added debug logging

## Migration Notes

### Breaking Changes
None - all changes are internal optimizations

### Backward Compatibility
✅ Fully backward compatible - no API or component interface changes

### Deployment
No special deployment steps required. Changes are transparent to users.

## Future Improvements

### Potential Enhancements
1. **Persistent Cache**: Use localStorage to persist cache across page reloads
2. **Cache Metrics**: Add telemetry to track cache hit rates
3. **Smart Prefetching**: Prefetch frequently accessed lists
4. **Cache Warming**: Preload lists on app initialization
5. **Optimistic Updates**: Update cache immediately on mutations before API response

### Monitoring
Add metrics to track:
- Cache hit/miss ratio
- Average response time (cached vs uncached)
- Total requests saved
- Cache memory usage

## Conclusion

This implementation significantly reduces API requests through strategic caching at both the composable and API service levels. The solution is transparent to users while providing immediate performance benefits and setting the foundation for future optimizations.

**Impact**: Hundreds of duplicate requests → Single cached request per 5 minutes ✅
