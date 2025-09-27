/**
 * Utilities for parsing and handling list filtering in search queries
 */

export interface ListFilter {
  listId: string;
  listName?: string;
}

/**
 * Parse list filter tokens from a search query
 * Supports syntax: "list:uuid" or "list:uuid some other terms"
 */
export function parseListFilters(query: string): {
  listFilters: ListFilter[];
  remainingQuery: string;
} {
  const listFilters: ListFilter[] = [];
  let remainingQuery = query;

  // Match list:uuid patterns
  const listTokenRegex = /\blist:([a-f0-9\-]{36})\b/gi;
  let match;

  while ((match = listTokenRegex.exec(query)) !== null) {
    listFilters.push({
      listId: match[1] || '',
    });
  }

  // Remove list tokens from the query
  remainingQuery = query.replace(listTokenRegex, '').trim();
  // Clean up multiple spaces
  remainingQuery = remainingQuery.replace(/\s+/g, ' ').trim();

  return {
    listFilters,
    remainingQuery,
  };
}

/**
 * Build a search query string with list filters
 */
export function buildSearchQueryWithListFilter(
  baseQuery: string,
  listFilter?: ListFilter
): string {
  const cleanBase = baseQuery.replace(/\blist:[a-f0-9\-]{36}\b/gi, '').trim();
  
  if (listFilter) {
    const listToken = `list:${listFilter.listId}`;
    return cleanBase ? `${listToken} ${cleanBase}` : listToken;
  }
  
  return cleanBase;
}

/**
 * Format a list filter for display
 */
export function formatListFilter(filter: ListFilter): string {
  return filter.listName ? `List: ${filter.listName}` : `List: ${filter.listId.substring(0, 8)}...`;
}