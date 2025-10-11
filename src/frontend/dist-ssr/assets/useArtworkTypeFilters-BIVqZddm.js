import { ref, computed } from 'vue';

const DEFAULT_ARTWORK_TYPES = [
  { key: "mural", label: "Mural", enabled: true, color: "#4f46e5" },
  { key: "sculpture", label: "Sculpture", enabled: true, color: "#059669" },
  { key: "monument", label: "Monument", enabled: true, color: "#e11d48" },
  { key: "installation", label: "Installation", enabled: true, color: "#c026d3" },
  { key: "statue", label: "Statue", enabled: true, color: "#d97706" },
  { key: "mosaic", label: "Mosaic", enabled: true, color: "#0891b2" },
  { key: "graffiti", label: "Graffiti", enabled: true, color: "#ca8a04" },
  { key: "street_art", label: "Street Art", enabled: true, color: "#db2777" },
  { key: "tiny_library", label: "Tiny Library", enabled: true, color: "#0d9488" },
  { key: "memorial_or_monument", label: "Memorial", enabled: true, color: "#e11d48" },
  { key: "totem_pole", label: "Totem Pole", enabled: true, color: "#d97706" },
  { key: "fountain_or_water_feature", label: "Fountain", enabled: true, color: "#0891b2" },
  { key: "two-dimensional_artwork", label: "2D Artwork", enabled: true, color: "#4f46e5" },
  { key: "site-integrated_work", label: "Site-Integrated Work", enabled: true, color: "#c026d3" },
  { key: "media_work", label: "Media Work", enabled: true, color: "#db2777" },
  { key: "figurative", label: "Figurative", enabled: true, color: "#059669" },
  { key: "bust", label: "Bust", enabled: true, color: "#d97706" },
  { key: "socially_engaged_art", label: "Social Art", enabled: true, color: "#db2777" },
  { key: "relief", label: "Relief", enabled: true, color: "#0891b2" },
  { key: "stone", label: "Stone", enabled: true, color: "#78716c" },
  { key: "gateway", label: "Gateway", enabled: true, color: "#2563eb" },
  { key: "other", label: "Other", enabled: true, color: "#6366f1" },
  { key: "unknown", label: "Unknown", enabled: true, color: "#6b7280" }
];
function useArtworkTypeFilters() {
  const artworkTypes = ref([...DEFAULT_ARTWORK_TYPES]);
  const enabledTypes = computed(
    () => artworkTypes.value.filter((type) => type.enabled).map((type) => type.key)
  );
  const allTypesEnabled = computed(() => artworkTypes.value.every((type) => type.enabled));
  const anyTypeEnabled = computed(() => artworkTypes.value.some((type) => type.enabled));
  function isArtworkTypeEnabled(artworkType) {
    const normalizedType = artworkType.toLowerCase();
    const typeToggle = artworkTypes.value.find(
      (toggle) => toggle.key === normalizedType
    );
    if (typeToggle) {
      return typeToggle.enabled;
    }
    const otherToggle = artworkTypes.value.find(
      (toggle) => toggle.key === "other"
    );
    return otherToggle ? otherToggle.enabled : false;
  }
  function filterArtworks(artworks) {
    return artworks.filter((artwork) => {
      const typeName = artwork.type_name || "Unknown";
      return isArtworkTypeEnabled(typeName);
    });
  }
  function toggleArtworkType(key) {
    const typeToggle = artworkTypes.value.find((type) => type.key === key);
    if (typeToggle) {
      typeToggle.enabled = !typeToggle.enabled;
    }
  }
  function enableAllTypes() {
    artworkTypes.value.forEach((type) => {
      type.enabled = true;
    });
  }
  function disableAllTypes() {
    artworkTypes.value.forEach((type) => {
      type.enabled = false;
    });
  }
  function resetToDefaults() {
    artworkTypes.value = [...DEFAULT_ARTWORK_TYPES];
  }
  function getTypeColor(artworkType) {
    const normalizedType = artworkType.toLowerCase();
    const typeToggle = artworkTypes.value.find((type) => type.key === normalizedType);
    if (typeToggle) {
      return typeToggle.color;
    }
    const otherToggle = artworkTypes.value.find((type) => type.key === "other");
    return otherToggle?.color || "#6366f1";
  }
  return {
    // State
    artworkTypes,
    // Computed
    enabledTypes,
    allTypesEnabled,
    anyTypeEnabled,
    // Methods
    isArtworkTypeEnabled,
    filterArtworks,
    toggleArtworkType,
    enableAllTypes,
    disableAllTypes,
    resetToDefaults,
    getTypeColor
  };
}

export { useArtworkTypeFilters as u };
//# sourceMappingURL=useArtworkTypeFilters-BIVqZddm.js.map
