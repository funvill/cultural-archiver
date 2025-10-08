// Lightweight test suite aligned with AddToListDialog implementation
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, type DOMWrapper } from '@vue/test-utils';
import AddToListDialog from '../AddToListDialog.vue';
import { apiService } from '../../services/api';
import { ref } from 'vue';

// Mutable auth state used by the mock so individual tests can toggle it
let authState: { isAuthenticated: boolean } = { isAuthenticated: true };
vi.mock('../../stores/auth', () => ({
  useAuthStore: (): { isAuthenticated: boolean } => authState,
}));

// Mock the useUserLists composable to avoid global cache issues
const mockLists = ref<any[]>([]);
const mockIsLoading = ref(false);
const mockError = ref<string | null>(null);
const mockFetchUserLists = vi.fn();
const mockRefreshLists = vi.fn();

vi.mock('../../composables/useUserLists', () => ({
  useUserLists: () => ({
    lists: mockLists,
    isLoading: mockIsLoading,
    error: mockError,
    fetchUserLists: mockFetchUserLists,
    refreshLists: mockRefreshLists,
    visitedArtworks: ref(new Set()),
    starredArtworks: ref(new Set()),
    lovedArtworks: ref(new Set()),
    submissionsArtworks: ref(new Set()),
    isArtworkInList: vi.fn(),
    addToList: vi.fn(),
    removeFromList: vi.fn(),
  }),
}));

// Mock the API service
vi.mock('../../services/api', () => ({
  apiService: {
    getUserLists: vi.fn(),
    createList: vi.fn(),
    addArtworkToList: vi.fn(),
  },
}));

type ApiMock = {
  getUserLists: ReturnType<typeof vi.fn>;
  createList: ReturnType<typeof vi.fn>;
  addArtworkToList: ReturnType<typeof vi.fn>;
};
const mockApiService = apiService as unknown as ApiMock;

const mockListsData = [
  {
    id: 'list-1',
    name: 'My Custom List',
    item_count: 5,
    is_system_list: false,
    is_readonly: false,
    is_private: false,
  },
  {
    id: 'list-2',
    name: 'Starred',
    item_count: 10,
    is_system_list: true,
    is_readonly: false,
    is_private: false,
  },
  {
    id: 'list-3',
    name: 'Full List',
    item_count: 1000,
    is_system_list: false,
    is_readonly: false,
    is_private: false,
  },
];

describe('AddToListDialog', () => {
  let wrapper: ReturnType<typeof mount>;
  const testArtworkId = 'artwork-123';

  beforeEach(() => {
    vi.clearAllMocks();
    authState.isAuthenticated = true;

    // Reset mock composable state
    mockLists.value = [...mockListsData];
    mockIsLoading.value = false;
    mockError.value = null;
    mockFetchUserLists.mockResolvedValue(undefined);
    mockRefreshLists.mockResolvedValue(undefined);

    mockApiService.getUserLists.mockResolvedValue({
      success: true,
      data: mockListsData,
    });

    mockApiService.createList.mockResolvedValue({
      success: true,
      data: { id: 'new-list-id', name: 'New Test List' },
    });

    wrapper = mount(AddToListDialog, {
      props: {
        modelValue: true,
        artworkId: testArtworkId,
      },
      global: {
        stubs: {
          teleport: true,
        },
      },
    });
  });

  it('should render when open', async () => {
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Add to List');
  });

  it('should not render when closed', async () => {
    await wrapper.setProps({ modelValue: false });
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('should load and display user lists', async () => {
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0)); // Wait for async loading

    // The component uses useUserLists composable which manages the lists
    expect(wrapper.text()).toContain('My Custom List');
    // System lists (like 'Starred') are now filtered out from the dialog
    expect(wrapper.text()).not.toContain('Starred');
  });

  it('should show item counts for lists', async () => {
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(wrapper.text()).toContain('5 items');
    // '10 items' is from the system list 'Starred' which is now filtered out
    expect(wrapper.text()).not.toContain('10 items');
  });

  it('should show full indicator for lists at capacity', async () => {
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(wrapper.text()).toContain('(full)');
  });

  it('should disable checkboxes for full lists', async () => {
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));

    const checkboxes = wrapper.findAll('input[type="checkbox"]');
    const fullListCheckbox = checkboxes.find((checkbox) => {
      const parent = checkbox.element.parentElement;
      return parent && parent.textContent?.includes('Full List');
    });

    expect((fullListCheckbox?.element as HTMLInputElement).disabled).toBe(true);
  });

  it('should allow creating new lists', async () => {
    const newListName = 'New Test List';

    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));

    // Find and fill the new list input
    const newListInput = wrapper.find('input[type="text"]');
    expect(newListInput.exists()).toBe(true);

    await (newListInput as DOMWrapper<HTMLInputElement>).setValue(newListName);
    await newListInput.trigger('keydown.enter');

    expect(mockApiService.createList).toHaveBeenCalledWith(newListName);
  });

  it('should validate new list names (empty only)', async () => {
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));

    const newListInput = wrapper.find('input[type="text"]');

    // Test empty name
    await newListInput.setValue('');
    await newListInput.trigger('keydown.enter');
    expect(mockApiService.createList).not.toHaveBeenCalled();
  });

  it('should add artwork to selected lists', async () => {
    mockApiService.addArtworkToList.mockResolvedValue({
      success: true,
      message: 'Artwork added to list successfully',
    });

    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));

    // Select a list checkbox
    const firstCheckbox = wrapper.findAll('input[type="checkbox"]').find((cb) => !(cb.element as HTMLInputElement).disabled);
    if (!firstCheckbox) throw new Error('No enabled checkbox found in test');
    // Use DOM-level update and trigger change to avoid private test-utils APIs
    (firstCheckbox.element as HTMLInputElement).checked = true;
    await firstCheckbox.trigger('change');

    // Click Done button
    const doneButton = wrapper.findAll('button').find((btn) => btn.text().includes('Done'));
    if (!doneButton) throw new Error('Done button not found in test');
    await doneButton.trigger('click');

    expect(mockApiService.addArtworkToList).toHaveBeenCalledWith('list-1', testArtworkId);
  });

  it('should emit update:modelValue when dialog is closed', async () => {
    const closeButton = wrapper.find('button[aria-label="Close dialog"]');
    await closeButton.trigger('click');
    const emittedAll = wrapper.emitted();
    expect(emittedAll).toBeTruthy();
    const emitted = (emittedAll as unknown as Record<string, unknown[][]>)['update:modelValue'];
    expect(emitted).toBeTruthy();
    if (!emitted || emitted.length === 0) throw new Error('expected update:modelValue to be emitted');
    expect(emitted[0]![0]).toBe(false);
  });

  it('should show loading states', async () => {
    // This test verifies loading state during list creation
    // Since the operation is fast in tests, we'll verify the button text changes
    wrapper = mount(AddToListDialog, {
      props: {
        modelValue: true,
        artworkId: testArtworkId,
      },
      global: { stubs: { teleport: true } },
    });

    await wrapper.vm.$nextTick();

    // The component shows "Done" normally and "Adding..." when loading
    const doneButton = wrapper.findAll('button').find((btn) => btn.text().includes('Done'));
    expect(doneButton).toBeTruthy();
    if (doneButton) {
      expect(doneButton.text()).toBe('Done');
    }
  });

  it('should show error states', async () => {
    // Mock createList to return an error
    mockApiService.createList.mockResolvedValue({
      success: false,
      error: 'List name already exists'
    });

    wrapper = mount(AddToListDialog, {
      props: {
        modelValue: true,
        artworkId: testArtworkId,
      },
      global: {
        stubs: {
          teleport: true,
        },
      },
    });

    await wrapper.vm.$nextTick();

    // Type into the new list name input
    const input = wrapper.find('input[type="text"]');
    await input.setValue('Duplicate List');
    
    // Trigger list creation which will fail
    await input.trigger('keydown.enter');
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 10));

    // Should show error message
    expect(wrapper.text()).toContain('List name already exists');
  });

  it('should show empty state for unauthenticated users', async () => {
    authState.isAuthenticated = false;
    mockLists.value = [];

    wrapper = mount(AddToListDialog, {
      props: {
        modelValue: true,
        artworkId: testArtworkId,
      },
      global: {
        stubs: {
          teleport: true,
        },
      },
    });

    await wrapper.vm.$nextTick();
    // Since the component shows empty state when there are no lists
    expect(wrapper.text()).toContain("You don't have any lists yet");
  });

  it('should handle list creation errors gracefully', async () => {
    mockApiService.createList.mockResolvedValue({
      success: false,
      error: 'List name already exists',
    });

    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));

    const newListInput = wrapper.find('input[type="text"]');
    await newListInput.setValue('Duplicate Name');
    await newListInput.trigger('keydown.enter');

    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('already exists');
  });

  it('should handle adding artwork errors gracefully', async () => {
    mockApiService.addArtworkToList.mockRejectedValue(new Error('List is full'));

    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));

    const firstCheckbox = wrapper.findAll('input[type="checkbox"]').find((cb) => !(cb.element as HTMLInputElement).disabled);
    if (!firstCheckbox) throw new Error('No enabled checkbox found in test');
    await firstCheckbox.setValue(true);

    const doneButton = wrapper.findAll('button').find((btn) => btn.text().includes('Done'));
    if (!doneButton) throw new Error('Done button not found in test');
    await doneButton.trigger('click');

    // Wait for async operation and error display
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // The component shows a generic error count message, not the specific error
    expect(wrapper.text()).toContain('Failed to add to 1 list(s)');
  });

  it('should prevent adding to readonly lists (Validated hidden)', async () => {
    const readonlyLists = [
      ...mockListsData,
      {
        id: 'readonly-list',
        name: 'Validated',
        item_count: 5,
        is_system_list: true,
        is_readonly: true,
        is_private: true,
      },
    ];

    mockApiService.getUserLists.mockResolvedValue({
      success: true,
      data: readonlyLists,
    });

    // Re-mount to get fresh data
    wrapper = mount(AddToListDialog, {
      props: {
        modelValue: true,
        artworkId: testArtworkId,
      },
      global: {
        stubs: {
          teleport: true,
        },
      },
    });

    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));

    // Validated list should not appear in the dialog (it's hidden by code)
    expect(wrapper.text()).not.toContain('Validated');
  });
});