import { computed, ref } from 'vue';
import { i as isClient, a as apiService } from '../ssr-entry-server.js';

const globalUserListsCache = ref([]);
const globalCacheTimestamp = ref(0);
const globalIsLoading = ref(false);
const globalError = ref(null);
const CACHE_DURATION = 5 * 60 * 1e3;
function useUserLists() {
  const lists = globalUserListsCache;
  const isLoading = globalIsLoading;
  const error = globalError;
  const visitedArtworks = computed(() => {
    const visitedList = globalUserListsCache.value.find(
      (list) => list.is_system_list && list.name === "Visited"
    );
    if (!visitedList?.items) return /* @__PURE__ */ new Set();
    return new Set(visitedList.items.map((artwork) => artwork.id));
  });
  const starredArtworks = computed(() => {
    const starredList = globalUserListsCache.value.find(
      (list) => list.is_system_list && list.name === "Starred"
    );
    if (!starredList?.items) return /* @__PURE__ */ new Set();
    return new Set(starredList.items.map((artwork) => artwork.id));
  });
  const lovedArtworks = computed(() => {
    const lovedList = globalUserListsCache.value.find(
      (list) => list.is_system_list && list.name === "Loved"
    );
    if (!lovedList?.items) return /* @__PURE__ */ new Set();
    return new Set(lovedList.items.map((artwork) => artwork.id));
  });
  const submissionsArtworks = computed(() => {
    const submissionsList = globalUserListsCache.value.find(
      (list) => list.is_system_list && list.name === "Submissions"
    );
    if (!submissionsList?.items) return /* @__PURE__ */ new Set();
    return new Set(submissionsList.items.map((artwork) => artwork.id));
  });
  const isCacheFresh = () => {
    return globalUserListsCache.value.length > 0 && Date.now() - globalCacheTimestamp.value < CACHE_DURATION;
  };
  const fetchUserLists = async () => {
    if (isCacheFresh()) {
      return;
    }
    if (globalIsLoading.value) {
      console.log("[useUserLists] Already loading, skipping duplicate request");
      return;
    }
    globalIsLoading.value = true;
    globalError.value = null;
    try {
      const response = await apiService.getUserLists();
      if (response.success) {
        const userLists = response.data || [];
        const systemLists = userLists.filter((list) => list.is_system_list);
        const listsWithItems = [];
        for (const list of systemLists) {
          try {
            const detailsResponse = await apiService.getListDetails(list.id, 1, 100);
            if (detailsResponse.success && detailsResponse.data) {
              listsWithItems.push({
                ...list,
                items: detailsResponse.data.items || [],
                item_count: detailsResponse.data.total || 0
              });
            } else {
              listsWithItems.push(list);
            }
          } catch (err) {
            console.warn(`Failed to fetch details for list ${list.name}:`, err);
            listsWithItems.push(list);
          }
        }
        const customLists = userLists.filter((list) => !list.is_system_list);
        listsWithItems.push(...customLists);
        globalUserListsCache.value = listsWithItems;
        globalCacheTimestamp.value = Date.now();
        console.log("[useUserLists] Fetched and cached user lists:", {
          totalLists: listsWithItems.length,
          systemLists: systemLists.length,
          customLists: customLists.length,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      } else {
        globalError.value = "Failed to fetch user lists";
      }
    } catch (err) {
      globalError.value = err instanceof Error ? err.message : "Failed to fetch user lists";
      console.error("Error fetching user lists:", err);
    } finally {
      globalIsLoading.value = false;
    }
  };
  const isArtworkInList = (artworkId, listType) => {
    switch (listType) {
      case "visited":
        return visitedArtworks.value.has(artworkId);
      case "starred":
        return starredArtworks.value.has(artworkId);
      case "loved":
        return lovedArtworks.value.has(artworkId);
      case "submissions":
        return submissionsArtworks.value.has(artworkId);
      default:
        return false;
    }
  };
  const addToList = async (artworkId, listType) => {
    const listNames = {
      visited: "Visited",
      starred: "Starred",
      loved: "Loved",
      submissions: "Submissions"
    };
    const targetList = globalUserListsCache.value.find(
      (list) => list.is_system_list && list.name === listNames[listType]
    );
    if (!targetList) {
      console.error(`${listNames[listType]} list not found`);
      return false;
    }
    try {
      const response = await apiService.addArtworkToList(targetList.id, artworkId);
      if (response.success) {
        if (targetList.items) {
          if (!targetList.items.some((item) => item.id === artworkId)) {
            await refreshLists();
          }
        } else {
          await refreshLists();
        }
        return true;
      } else {
        console.error(`Failed to add artwork to ${listNames[listType]} list:`, response.error);
        return false;
      }
    } catch (err) {
      console.error(`Error adding artwork to ${listNames[listType]} list:`, err);
      return false;
    }
  };
  const removeFromList = async (artworkId, listType) => {
    const listNames = {
      visited: "Visited",
      starred: "Starred",
      loved: "Loved",
      submissions: "Submissions"
    };
    const targetList = globalUserListsCache.value.find(
      (list) => list.is_system_list && list.name === listNames[listType]
    );
    if (!targetList) {
      console.error(`${listNames[listType]} list not found`);
      return false;
    }
    try {
      const response = await apiService.removeArtworksFromList(targetList.id, [artworkId]);
      if (response.success) {
        if (targetList.items) {
          targetList.items = targetList.items.filter((item) => item.id !== artworkId);
          if (targetList.item_count !== void 0) {
            targetList.item_count = Math.max(0, targetList.item_count - 1);
          }
        }
        globalCacheTimestamp.value = Date.now();
        return true;
      } else {
        console.error(`Failed to remove artwork from ${listNames[listType]} list:`, response.error);
        return false;
      }
    } catch (err) {
      console.error(`Error removing artwork from ${listNames[listType]} list:`, err);
      return false;
    }
  };
  const refreshLists = async () => {
    globalCacheTimestamp.value = 0;
    await fetchUserLists();
  };
  if (isClient && globalUserListsCache.value.length === 0 && !globalIsLoading.value && globalCacheTimestamp.value === 0) {
    Promise.resolve().then(() => {
      void fetchUserLists();
    });
  }
  return {
    // State
    lists,
    isLoading,
    error,
    // Computed sets
    visitedArtworks,
    starredArtworks,
    lovedArtworks,
    submissionsArtworks,
    // Methods
    fetchUserLists,
    isArtworkInList,
    addToList,
    removeFromList,
    refreshLists
  };
}

export { useUserLists as u };
//# sourceMappingURL=useUserLists-CYQ0cJyO.js.map
