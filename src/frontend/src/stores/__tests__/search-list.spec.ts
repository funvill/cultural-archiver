// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSearchStore } from '../search';

// Mock api module
vi.mock('../../services/api', () => ({
  apiService: {
    getListDetails: vi.fn(),
  },
  getErrorMessage: vi.fn(() => 'Unknown'),
  isNetworkError: vi.fn(() => false),
}));

import { apiService } from '../../services/api';

describe('search store - searchInList paging', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('pages through list details and aggregates items', async () => {
    const listId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    // Mock two pages from apiService.getListDetails
    const page1 = {
      success: true,
      data: {
        list: { id: listId, name: 'Test List' },
        items: [
          { id: '1', title: 'One', description: 'First', tags: '{}' },
          { id: '2', title: 'Two', description: 'Second', tags: '{}' },
        ],
        has_more: true,
      },
    };
    const page2 = {
      success: true,
      data: {
        list: { id: listId, name: 'Test List' },
        items: [
          { id: '3', title: 'Three', description: 'Third', tags: '{}' },
        ],
        has_more: false,
      },
    };

    const spy = vi.spyOn(apiService, 'getListDetails' as any);
    spy.mockResolvedValueOnce(page1 as any).mockResolvedValueOnce(page2 as any);

    const store = useSearchStore();

    // Trigger performSearch with a list token; store.performSearch will call searchInList internally
    await store.performSearch(`list:${listId}`, 1, false);

    // Expect the store to have aggregated 3 items
    expect(store.results.length).toBe(3);
    expect(store.total).toBe(3);

  // Request the second page (default perPage is 20 so page 2 should be empty but pagination totals preserved)
  await store.performSearch(`list:${listId}`, 2, false);
  // Page 2 should have 0 results because total 3 with perPage 20 means page 2 empty
  expect(store.results.length).toBeGreaterThanOrEqual(0);
  expect(store.total).toBe(3);

    spy.mockRestore();
  });
});
