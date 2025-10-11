const TAG_CATEGORIES = [
  {
    key: "classification",
    label: "Artwork Classification",
    description: "Basic artwork identification and categorization",
    order: 1
  },
  {
    key: "physical",
    label: "Physical Properties",
    description: "Material, dimensions, and physical characteristics",
    order: 2
  },
  {
    key: "historical",
    label: "Historical Information",
    description: "Creation dates, artists, and historical context",
    order: 3
  },
  {
    key: "location",
    label: "Location Details",
    description: "Access information and location-specific data",
    order: 4
  },
  {
    key: "reference",
    label: "Reference Data",
    description: "External links and reference information",
    order: 5
  }
];
const TAG_DEFINITIONS = [
  // Artwork Classification
  {
    key: "artwork_type",
    label: "Artwork Type",
    description: "Primary type or form of the artwork",
    category: "classification",
    dataType: "enum",
    enumValues: [
      "statue",
      "mural",
      "sculpture",
      "installation",
      "monument",
      "mosaic",
      "graffiti",
      "street_art",
      "tiny_library"
    ],
    helpUrl: "https://wiki.openstreetmap.org/wiki/Key:artwork_type"
  },
  {
    key: "keywords",
    label: "Keywords",
    description: "Comma separated list of descriptive keywords (max 500 chars). Each becomes searchable.",
    category: "classification",
    dataType: "text",
    maxLength: 500,
    placeholder: "e.g., outdoor, landmark, bronze, abstract",
    helpUrl: "https://wiki.openstreetmap.org/wiki/Key:description"
  },
  {
    key: "subject",
    label: "Subject Matter",
    description: "What the artwork depicts or represents",
    category: "classification",
    dataType: "text",
    maxLength: 200,
    placeholder: 'e.g., "historical figure", "abstract", "nature"'
  },
  {
    key: "style",
    label: "Artistic Style",
    description: "Artistic style or movement",
    category: "classification",
    dataType: "text",
    maxLength: 100,
    placeholder: 'e.g., "modern", "classical", "street art"'
  },
  {
    key: "status",
    label: "Status",
    description: "Current status of the artwork",
    category: "classification",
    dataType: "enum",
    enumValues: ["active", "removed", "relocated", "under_construction", "planned"]
  },
  // Physical Properties
  {
    key: "material",
    label: "Material",
    description: "Primary construction material",
    category: "physical",
    dataType: "text",
    maxLength: 100,
    placeholder: 'e.g., "bronze", "concrete", "paint on wall"'
  },
  {
    key: "materials",
    label: "Materials",
    description: "Primary construction materials (legacy plural form)",
    category: "physical",
    dataType: "text",
    maxLength: 100,
    placeholder: 'e.g., "bronze", "concrete", "paint on wall"'
  },
  {
    key: "dimensions",
    label: "Dimensions",
    description: "Physical dimensions of the artwork (e.g., height, width, depth)",
    category: "physical",
    dataType: "text",
    maxLength: 100,
    placeholder: 'e.g., "2.4m tall", "15.5m x 3m x 2m"'
  },
  {
    key: "condition",
    label: "Condition",
    description: "Current physical condition",
    category: "physical",
    dataType: "enum",
    enumValues: ["excellent", "good", "fair", "poor"]
  },
  // Historical Information
  {
    key: "start_date",
    label: "Installation Date",
    description: "When the artwork was created or installed",
    category: "historical",
    dataType: "date",
    placeholder: "YYYY or YYYY-MM-DD (e.g., 1998 or 2011-07-15)"
  },
  // Location Details
  {
    key: "access",
    label: "Public Access",
    description: "Whether the public can access this artwork",
    category: "location",
    dataType: "enum",
    enumValues: ["yes", "private", "customers", "no"],
    helpUrl: "https://wiki.openstreetmap.org/wiki/Key:access"
  },
  {
    key: "fee",
    label: "Fee Required",
    description: "Whether an admission fee is required",
    category: "location",
    dataType: "yes_no"
  },
  {
    key: "city",
    label: "City",
    description: "City where the artwork is located",
    category: "location",
    dataType: "text",
    placeholder: "Vancouver, New York, London",
    maxLength: 100
  },
  {
    key: "province",
    label: "Province/State",
    description: "Province or state where the artwork is located",
    category: "location",
    dataType: "text",
    placeholder: "British Columbia, California, Ontario",
    maxLength: 100
  },
  {
    key: "country",
    label: "Country",
    description: "Country where the artwork is located",
    category: "location",
    dataType: "text",
    placeholder: "Canada, United States, United Kingdom",
    maxLength: 100
  },
  // Reference Data
  {
    key: "website",
    label: "Website",
    description: "Related website URL",
    category: "reference",
    dataType: "url",
    placeholder: "https://example.org/artwork-info"
  },
  {
    key: "wikipedia",
    label: "Wikipedia",
    description: "Wikipedia article reference",
    category: "reference",
    dataType: "text",
    maxLength: 200,
    placeholder: "en:Article_Name",
    helpUrl: "https://wiki.openstreetmap.org/wiki/Key:wikipedia"
  }
];
function getTagDefinition(key) {
  return TAG_DEFINITIONS.find((def) => def.key === key);
}
function getTagsByCategory(categoryKey) {
  return TAG_DEFINITIONS.filter((def) => def.category === categoryKey);
}
function getCategoriesOrderedForDisplay() {
  return [...TAG_CATEGORIES].sort((a, b) => a.order - b.order);
}
function validateTagValue(key, rawValue) {
  const definition = getTagDefinition(key);
  if (!definition) {
    return { valid: false, error: "Unknown tag key" };
  }
  const value = rawValue == null ? "" : String(rawValue);
  if (!value.trim()) {
    if (definition.required) {
      return { valid: false, error: "This tag is required" };
    }
    return { valid: true };
  }
  const trimmedValue = value.trim();
  switch (definition.dataType) {
    case "enum":
      if (definition.enumValues && !definition.enumValues.includes(trimmedValue)) {
        return {
          valid: false,
          error: `Must be one of: ${definition.enumValues.join(", ")}`
        };
      }
      break;
    case "number":
      const num = parseFloat(trimmedValue);
      if (isNaN(num)) {
        return { valid: false, error: "Must be a valid number" };
      }
      if (definition.min !== void 0 && num < definition.min) {
        return { valid: false, error: `Must be at least ${definition.min}` };
      }
      if (definition.max !== void 0 && num > definition.max) {
        return { valid: false, error: `Must be at most ${definition.max}` };
      }
      break;
    case "date":
      const dateRegex = /^\d{4}(-\d{2}-\d{2})?$/;
      if (!dateRegex.test(trimmedValue)) {
        return { valid: false, error: "Must be in format YYYY or YYYY-MM-DD" };
      }
      break;
    case "yes_no":
      if (!["yes", "no"].includes(trimmedValue.toLowerCase())) {
        return { valid: false, error: 'Must be "yes" or "no"' };
      }
      break;
    case "url":
      try {
        new URL(trimmedValue);
      } catch {
        return { valid: false, error: "Must be a valid URL" };
      }
      break;
    case "wikidata_id":
      const wikidataRegex = /^Q\d+$/;
      if (!wikidataRegex.test(trimmedValue)) {
        return { valid: false, error: "Must be a valid Wikidata ID (e.g., Q12345)" };
      }
      break;
    case "text":
      if (definition.maxLength && trimmedValue.length > definition.maxLength) {
        return {
          valid: false,
          error: `Must be ${definition.maxLength} characters or less`
        };
      }
      break;
  }
  return { valid: true };
}
function formatTagValueForDisplay(key, value) {
  const definition = getTagDefinition(key);
  if (!definition) return value;
  switch (definition.dataType) {
    case "yes_no":
      return value.toLowerCase() === "yes" ? "Yes" : "No";
    case "date":
      if (value.length === 4) {
        return value;
      }
      try {
        const date = new Date(value);
        return date.toLocaleDateString();
      } catch {
        return value;
      }
    case "url":
      try {
        const url = new URL(value);
        return `${url.hostname}...`;
      } catch {
        return value;
      }
    default:
      return value;
  }
}

export { TAG_CATEGORIES as T, getTagDefinition as a, getTagsByCategory as b, formatTagValueForDisplay as f, getCategoriesOrderedForDisplay as g, validateTagValue as v };
//# sourceMappingURL=tagSchema-DxDwFgYK.js.map
