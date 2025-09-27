import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import AddToListDialog from '../AddToListDialog.vue';
import { createTestingPinia } from '@pinia/testing';
import { apiService } from '../../services/api';

// Mock the API service
vi.mock('../../services/api', () => ({
  apiService: {
    getUserLists: vi.fn(),
    createList: vi.fn(),
    addArtworkToList: vi.fn(),
  },
}));

const mockApiService = apiService as any;

const mockLists = [
  {
    id: 'list-1',
    name: 'My Custom List',
    item_count: 5,
    is_system: false,
    is_readonly: false,
    is_private: false,
  },
  {
    id: 'list-2', 
    name: 'Want to see',
    item_count: 10,
    is_system: true,
    is_readonly: false,
    is_private: false,
  },
  {
    id: 'list-3',
    name: 'Full List',
    item_count: 1000,
    is_system: false,
    is_readonly: false,
    is_private: false,
  },
];

describe('AddToListDialog', () => {
  let wrapper: any;
  const testArtworkId = 'artwork-123';

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockApiService.getUserLists.mockResolvedValue({
      success: true,
      data: mockLists,
    });
    
    wrapper = mount(AddToListDialog, {
      props: {
        modelValue: true,
        artworkId: testArtworkId,
      },
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
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
    await wrapper.setProps({ isOpen: false });
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

  it('should indicate system lists', async () => {
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));
    
    const systemListItems = wrapper.findAll('.text-blue-600');
    expect(systemListItems.some((item: any) => item.text().includes('System'))).toBe(true);
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
    const fullListCheckbox = checkboxes.find((checkbox: any) => {
      const parent = checkbox.element.parentElement;
      return parent && parent.textContent?.includes('Full List');
    });
    
    expect(fullListCheckbox?.element.disabled).toBe(true);
  });

  it('should allow creating new lists', async () => {
    const newListName = 'New Test List';
    
    mockApiService.createList.mockResolvedValue({
      success: true,
      data: {
        list: {
          id: 'new-list-id',
          name: newListName,
          item_count: 0,
          is_system: false,
          is_readonly: false,
          is_private: false,
        },
      },
    });

    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));

    // Find and fill the new list input
    const newListInput = wrapper.find('input[placeholder*="new list"]');
    expect(newListInput.exists()).toBe(true);
    
    await newListInput.setValue(newListName);
    await newListInput.trigger('keyup.enter');

    expect(mockApiService.createList).toHaveBeenCalledWith(newListName);
  });

  it('should validate new list names', async () => {
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));

    const newListInput = wrapper.find('input[placeholder*="new list"]');
    
    // Test empty name
    await newListInput.setValue('');
    await newListInput.trigger('keyup.enter');
    expect(mockApiService.createList).not.toHaveBeenCalled();

    // Test too long name
    const longName = 'A'.repeat(256);
    await newListInput.setValue(longName);
    await newListInput.trigger('keyup.enter');
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
    const firstCheckbox = wrapper.find('input[type="checkbox"]:not(:disabled)');
    await firstCheckbox.setChecked(true);

    // Click Done button
    const doneButton = wrapper.find('button').filter((btn: any) => btn.text().includes('Done'));
    await doneButton.trigger('click');

    expect(mockApiService.addArtworkToList).toHaveBeenCalledWith('list-1', testArtworkId);
  });

  it('should emit close event when dialog is closed', async () => {
    const closeButton = wrapper.find('button[aria-label="Close"]');
    await closeButton.trigger('click');

    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('should show loading states', async () => {
    // Mock loading state
    wrapper.vm.isLoading = true;
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Loading');
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
        plugins: [createTestingPinia({ createSpy: vi.fn })],
        stubs: {
          teleport: true,
        },
      },
    });

    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(wrapper.text()).toContain('Failed to load lists');
  });

  it('should show authentication requirement for unauthenticated users', async () => {
    wrapper = mount(AddToListDialog, {
      props: {
        modelValue: true,
        artworkId: testArtworkId,
      },
      global: {
        plugins: [createTestingPinia({
          createSpy: vi.fn,
          initialState: {
            auth: { isLoggedIn: false }
          }
        })],
        stubs: {
          teleport: true,
        },
      },
    });

    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Please log in');
  });

  it('should handle list creation errors gracefully', async () => {
    mockApiService.createList.mockResolvedValue({
      success: false,
      error: 'List name already exists',
    });

    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));

    const newListInput = wrapper.find('input[placeholder*="new list"]');
    await newListInput.setValue('Duplicate Name');
    await newListInput.trigger('keyup.enter');

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

    const firstCheckbox = wrapper.find('input[type="checkbox"]:not(:disabled)');
    await firstCheckbox.setChecked(true);

    const doneButton = wrapper.find('button').filter((btn: any) => btn.text().includes('Done'));
    await doneButton.trigger('click');

    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('full');
  });

  it('should prevent adding to readonly lists', async () => {
    const readonlyLists = [
      ...mockLists,
      {
        id: 'readonly-list',
        name: 'Validated',
        item_count: 5,
        is_system: true,
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
        plugins: [createTestingPinia({ createSpy: vi.fn })],
        stubs: {
          teleport: true,
        },
      },
    });

    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));

    // Validated list should not appear in the dialog (it's private)
    expect(wrapper.text()).not.toContain('Validated');
  });
});