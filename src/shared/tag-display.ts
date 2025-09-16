/**
 * Tag Display Utilities
 * 
 * Utilities for formatting and categorizing tags for display purposes
 */

import { getCategoriesOrderedForDisplay, getTagDefinition } from './tag-schema';

/**
 * Categorize tags by their schema category for display
 * Returns tags organized by category with an "Other" category for uncategorized tags
 */
export function categorizeTagsForDisplay(tags: Record<string, string>): Record<string, Array<{ key: string; value: string; label: string }>> {
  const categories = getCategoriesOrderedForDisplay();
  const result: Record<string, Array<{ key: string; value: string; label: string }>> = {};

  // Initialize all known categories
  categories.forEach(category => {
    result[category.key] = [];
  });

  // Add "Other" category for uncategorized tags
  result['other'] = [];

  // Categorize each tag
  Object.entries(tags).forEach(([key, value]) => {
    const definition = getTagDefinition(key);
    const label = definition ? definition.label : key;
    const tagData = { key, value, label };

    if (definition && definition.category) {
      const categoryArray = result[definition.category];
      if (categoryArray) {
        categoryArray.push(tagData);
      } else {
        result['other']?.push(tagData);
      }
    } else {
      result['other']?.push(tagData);
    }
  });

  // Remove empty categories
  Object.keys(result).forEach(categoryKey => {
    const categoryTags = result[categoryKey];
    if (categoryTags && categoryTags.length === 0) {
      delete result[categoryKey];
    }
  });

  return result;
}