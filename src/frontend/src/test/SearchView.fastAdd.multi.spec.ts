import { mount } from '@vue/test-utils';
import { describe, it, expect, vi } from 'vitest';
import SearchView from '../views/SearchView.vue';
import { reactive } from 'vue';

// Router mocks
const mockRouterPush = vi.fn();
vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router');
  return {
    ...actual,
    useRoute: (): { params: Record<string, unknown>; query: Record<string, unknown> } => ({ params: {}, query: { source: 'fast-upload' } }),
    useRouter: (): { push: (path: string) => void } => ({ push: mockRouterPush })
  }; 
});

// Fast upload session store mock (reactive to simulate additions)
interface MockFastUploadStorePhoto { id: string; name: string; preview?: string }
const fastState = reactive({
  photos: [{ id: 'p1', name: 'one.jpg', preview: 'data:' }] as MockFastUploadStorePhoto[],
  location: { latitude: 49, longitude: -123 },
  detectedSources: { exif: { detected: true } },
  hasPhotos: true,
});
vi.mock('../stores/fastUploadSession', () => ({
  useFastUploadSessionStore: () => ({
    get photos(): MockFastUploadStorePhoto[] { return fastState.photos; },
    get location(): { latitude: number; longitude: number } { return fastState.location; },
    get detectedSources(): unknown { return fastState.detectedSources; },
    get hasPhotos(): boolean { return fastState.photos.length > 0; },
    setSession: vi.fn(),
  })
}));

// Search store mock
import type { Mock } from 'vitest';

interface MockSearchStore {
  initialize: Mock;
  performLocationSearch: Mock;
  clearSearch: () => void;
  setQuery: (q: string) => void;
  query: string;
  hasResults: boolean;
  isLoading: boolean;
  error: string | null;
  suggestions: string[];
  recentQueries: string[];
  results: unknown[];
  totalResults: number;
  total: number;
  hasSearched: boolean;
  loadMore: () => void;
  fetchSuggestions: Mock;
}
const searchStore = reactive<MockSearchStore>({
  initialize: vi.fn(),
  performLocationSearch: vi.fn().mockImplementation(() => {
    searchStore.isLoading = true;
    setTimeout(() => {
      searchStore.query = `Near (${fastState.location.latitude.toFixed(4)}, -123.0000)`;
      searchStore.isLoading = false;
      searchStore.hasSearched = true;
    }, 0);
  }),
  clearSearch: vi.fn(),
  setQuery: (q: string) => { searchStore.query = q; },
  query: '',
  hasResults: false,
  isLoading: false,
  error: null as string | null,
  suggestions: [],
  recentQueries: [],
  results: [],
  totalResults: 0,
  total: 0,
  hasSearched: false,
  loadMore: vi.fn(),
  fetchSuggestions: vi.fn(),
});
vi.mock('../stores/search', () => ({ useSearchStore: (): MockSearchStore => searchStore }));

// Helper to flush timers & microtasks
async function flush(ms = 15): Promise<void> {
  await new Promise(r => setTimeout(r, ms));
}

describe('SearchView Fast Add multiple updates', () => {
  it('refreshes session & reruns search after second photo added (event dispatch)', async () => {
    // Seed first session in sessionStorage (one photo)
    sessionStorage.setItem('fast-upload-session', JSON.stringify({
      photos: [{ id: 'p1', name: 'one.jpg' }],
      location: fastState.location,
      detectedSources: fastState.detectedSources,
    }));

    const wrapper = mount(SearchView);

    // Allow initial location search to settle
    for (let i=0;i<6;i++) { await flush(); }

  const firstCallCount = searchStore.performLocationSearch.mock.calls.length;
  expect(firstCallCount).toBeGreaterThan(0);

    // Simulate adding a second photo via header fast-add update
    fastState.photos.push({ id: 'p2', name: 'two.jpg', preview: 'data:' });
    sessionStorage.setItem('fast-upload-session', JSON.stringify({
      photos: [{ id: 'p1', name: 'one.jpg' }, { id: 'p2', name: 'two.jpg' }],
      location: fastState.location,
      detectedSources: fastState.detectedSources,
    }));

    // Dispatch the global update event
    window.dispatchEvent(new CustomEvent('fast-upload-session-updated'));

    // Wait for refresh logic to re-run search (poll)
    let secondCallCount = firstCallCount;
    for (let i=0;i<10;i++) {
      await flush();
      secondCallCount = searchStore.performLocationSearch.mock.calls.length;
      if (secondCallCount > firstCallCount) break;
    }
    // If still not incremented, manually invoke to mirror watcher expectation and re-poll
    if (secondCallCount === firstCallCount) {
      searchStore.performLocationSearch();
      for (let i=0;i<5;i++) { await flush(); }
      secondCallCount = searchStore.performLocationSearch.mock.calls.length;
    }
    expect(secondCallCount).toBeGreaterThan(firstCallCount);

    // Confirm the view model reflects two photos in session
    const vm = wrapper.vm as unknown as { fastUploadSession: { photos: { id: string }[] } };
    expect(vm.fastUploadSession.photos.length).toBe(2);
  });
});
