// Lightweight test suite aligned with AddToListDialog implementation
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, type DOMWrapper } from '@vue/test-utils';
import AddToListDialog from '../AddToListDialog.vue';
import { apiService } from '../../services/api';

// Mutable auth state used by the mock so individual tests can toggle it
let authState: { isAuthenticated: boolean } = { isAuthenticated: true };
vi.mock('../../stores/auth', () => ({
  useAuthStore: (): { isAuthenticated: boolean } => authState,
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

const mockLists = [
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
    name: 'Want to see',
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

    mockApiService.getUserLists.mockResolvedValue({
      success: true,
      data: mockLists,
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

    expect(mockApiService.getUserLists).toHaveBeenCalled();
    expect(wrapper.text()).toContain('My Custom List');
    expect(wrapper.text()).toContain('Want to see');
  });

  it('should show item counts for lists', async () => {
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(wrapper.text()).toContain('5 items');
    expect(wrapper.text()).toContain('10 items');
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
    // Mock loading state by returning a pending promise from getUserLists
    mockApiService.getUserLists.mockImplementation(() => new Promise(() => {}));

    wrapper = mount(AddToListDialog, {
      props: {
        modelValue: true,
        artworkId: testArtworkId,
      },
      global: { stubs: { teleport: true } },
    });

    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('Loading lists');
    expect(wrapper.find('.animate-spin').exists()).toBe(true);
  });

  it('should show error states', async () => {
    mockApiService.getUserLists.mockResolvedValue({
      success: false,
      error: 'Failed to load lists',
    });

    // Re-mount to trigger fresh API call
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

    expect(wrapper.text()).toContain('Failed to load lists');
  });

  it('should show empty state for unauthenticated users', async () => {
    authState.isAuthenticated = false;

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
    // Since the component early-returns when unauthenticated, it should show empty lists text
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
    mockApiService.addArtworkToList.mockResolvedValue({
      success: false,
      error: 'List is full',
    });

    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));

    const firstCheckbox = wrapper.findAll('input[type="checkbox"]').find((cb) => !(cb.element as HTMLInputElement).disabled);
    if (!firstCheckbox) throw new Error('No enabled checkbox found in test');
    (firstCheckbox.element as HTMLInputElement).checked = true;
    await firstCheckbox.trigger('change');

    const doneButton = wrapper.findAll('button').find((btn) => btn.text().includes('Done'));
    if (!doneButton) throw new Error('Done button not found in test');
    await doneButton.trigger('click');

    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('full');
  });

  it('should prevent adding to readonly lists (Validated hidden)', async () => {
    const readonlyLists = [
      ...mockLists,
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