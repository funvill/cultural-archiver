import { mount } from '@vue/test-utils';
import { reactive } from 'vue';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SearchView from '../views/SearchView.vue';

// Mock router composables
interface MockRoute {
  params: Record<string, unknown>;
  query: Record<string, unknown>;
}
interface MockRouter {
  push: (path: string) => void;
}
const mockRouterPush = vi.fn();
vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router');
  return {
    ...actual,
    useRoute: (): MockRoute => ({
      params: {},
      query: { source: 'fast-upload' },
    }),
    useRouter: (): MockRouter => ({
      push: mockRouterPush,
    }),
  };
});

// Mock fast upload session store
interface MockFastUploadStore {
  photos: Array<{ id: string; name: string; preview?: string }>;
  location: { latitude: number; longitude: number } | null;
  detectedSources: unknown;
  setSession: (payload: unknown) => void;
  hasPhotos: boolean;
}
vi.mock('../stores/fastUploadSession', () => ({
  useFastUploadSessionStore: (): MockFastUploadStore => ({
    photos: [{ id: 'p1', name: 'test.jpg', preview: 'data:' }],
    location: { latitude: 49.0, longitude: -123.0 },
    detectedSources: { exif: { detected: true } },
    setSession: vi.fn(),
    hasPhotos: true,
  }),
}));

// Mock search store with no results after location search
interface MockSearchStore {
  initialize: () => void;
  performLocationSearch: () => void;
  clearSearch: () => void;
  setQuery: (q: string) => void;
  query: string;
  hasResults: boolean;
  isLoading: boolean;
  error: string | null;
  suggestions: unknown[];
  recentQueries: string[];
  results: unknown[];
  totalResults: number;
  total: number;
  hasSearched: boolean;
}
// Reactive mock store so Vue watchers track mutations
const mockSearchStore = reactive<MockSearchStore>({
  initialize: vi.fn(),
  performLocationSearch: vi.fn().mockImplementation(() => {
    mockSearchStore.isLoading = true;
    setTimeout(() => {
      mockSearchStore.query = 'Near (49.0000, -123.0000)';
      mockSearchStore.hasSearched = true;
      mockSearchStore.isLoading = false;
    }, 0);
  }),
  clearSearch: vi.fn(),
  setQuery: (q: string) => {
    mockSearchStore.query = q;
  },
  query: 'Near (49.0000, -123.0000)',
  hasResults: false,
  isLoading: true, // start loading true then toggle to false to trigger watcher
  error: null,
  suggestions: [],
  recentQueries: [],
  results: [],
  totalResults: 0,
  total: 0,
  hasSearched: true,
});
vi.mock('../stores/search', () => ({
  useSearchStore: (): MockSearchStore => mockSearchStore,
}));

describe('SearchView Fast Add Auto Redirect', () => {
  beforeEach(() => {
    mockRouterPush.mockClear();
    sessionStorage.clear();
  });

  it('redirects to new artwork when no nearby results and from fast upload', async () => {
    // Seed fast upload session so component treats this as a fast workflow visit
    sessionStorage.setItem(
      'fast-upload-session',
      JSON.stringify({
        photos: [{ id: 'p1', name: 'test.jpg' }],
        location: { latitude: 49.0, longitude: -123.0 },
        detectedSources: { exif: { detected: true } },
      })
    );

    const wrapper = mount(SearchView);
    await wrapper.vm.$nextTick();

    // Extended polling for redirect (await performLocationSearch async effects)
    let redirected = false;
    for (let i = 0; i < 30 && !redirected; i++) {
      await new Promise(r => setTimeout(r, 12));
      await wrapper.vm.$nextTick();
      const calls: string[][] = mockRouterPush.mock.calls as unknown as string[][];
      redirected = calls.some(c => typeof c[0] === 'string' && c[0].startsWith('/artwork/new'));
      if (!redirected && i === 5) mockSearchStore.performLocationSearch();
    }

    expect(redirected).toBe(true);
  });
});
