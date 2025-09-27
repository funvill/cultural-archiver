import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the api module before importing the store
vi.mock('../../services/api', () => ({
  apiService: {
    getListDetails: vi.fn(),
  },
  getErrorMessage: () => 'Unknown',
  isNetworkError: () => false,
}));

import { setActivePinia, createPinia } from 'pinia';
import { useSearchStore } from '../search';
import { apiService } from '../../services/api';

describe('search store - searchInList paging (JS)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('aggregates pages from getListDetails and paginates results', async () => {
    const listId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

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
        items: [{ id: '3', title: 'Three', description: 'Third', tags: '{}' }],
        has_more: false,
      },
    };

    const spy = vi.spyOn(apiService, 'getListDetails');
    spy.mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);

    const store = useSearchStore();

    await store.performSearch(`list:${listId}`, 1, false);

    expect(store.results.length).toBe(3);
    expect(store.total).toBe(3);

    // Request second page - should preserve total
    await store.performSearch(`list:${listId}`, 2, false);
    expect(store.total).toBe(3);

    spy.mockRestore();
  });
});
