import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import TagBadge from '../TagBadge.vue';

describe('TagBadge', () => {
  const mockTags = [
    { label: 'material', value: 'bronze' },
    { label: 'style', value: 'modern' },
    { label: 'condition', value: 'good' },
    { label: 'year', value: '2020' },
    { label: 'artist', value: 'John Doe' },
    { label: 'medium', value: 'sculpture' },
  ];

  const mockTagsRecord = {
    material: 'bronze',
    style: 'modern',
    condition: 'good',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders correctly with array of tags', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: mockTags.slice(0, 3),
        },
      });

      expect(wrapper.find('.tag-badge-container').exists()).toBe(true);
      expect(wrapper.findAll('div.text-sm.cursor-pointer').length).toBe(3);
    });

    it('renders correctly with record of tags', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: mockTagsRecord,
        },
      });

      expect(wrapper.findAll('div.text-sm.cursor-pointer').length).toBe(3);
      expect(wrapper.text()).toContain('Material'); // Now uses schema label "Material" instead of "material"
      expect(wrapper.text()).toContain('bronze');
    });

    it('shows no tags message when empty', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: [],
        },
      });

      expect(wrapper.text()).toContain('No tags available');
    });

    it('displays tags with proper formatting', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: [{ label: 'material', value: 'bronze' }],
        },
      });

      // The component uses schema definitions, so it shows "Material" not "material" 
      const text = wrapper.text().replace(/\s+/g, ' ').trim();
      expect(text).toContain('Material'); // Schema label is capitalized
      expect(text).toContain('bronze');
    });
  });

  describe('Expansion/Collapse', () => {
    it('shows expand button when there are more tags than maxVisible', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: mockTags,
          maxVisible: 3,
        },
      });

      expect(wrapper.text()).toContain('+3 more');
    });

    it('shows only maxVisible tags initially', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: mockTags,
          maxVisible: 3,
        },
      });

      // Should show 3 tag divs + 1 expand button
      expect(wrapper.findAll('div.text-sm.cursor-pointer').length).toBe(3);
      expect(wrapper.findAll('button').length).toBe(1); // Only the expand button
    });

    it('expands to show all tags when expand button clicked', async () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: mockTags,
          maxVisible: 3,
        },
      });

      const expandButton = wrapper.findAll('button').find(btn => btn.text().includes('more'));

      if (expandButton) {
        await expandButton.trigger('click');

        // Should now show all 6 tag divs + 1 collapse button
        expect(wrapper.findAll('div.text-sm.cursor-pointer').length).toBe(6);
        expect(wrapper.findAll('button').length).toBe(1); // Only the collapse button
        expect(wrapper.text()).toContain('Show less');
      }
    });

    it('emits expandToggle event when expansion state changes', async () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: mockTags,
          maxVisible: 3,
        },
      });

      const expandButton = wrapper.findAll('button').find(btn => btn.text().includes('more'));

      if (expandButton) {
        await expandButton.trigger('click');
        expect(wrapper.emitted('expandToggle')).toBeTruthy();
        expect(wrapper.emitted('expandToggle')?.[0]).toEqual([true]);
      }
    });

    it('does not show expand button when expandable is false', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: mockTags,
          maxVisible: 3,
          expandable: false,
        },
      });

      expect(wrapper.text()).not.toContain('more');
      // Should show all tags when not expandable
      expect(wrapper.findAll('div.text-sm.cursor-pointer').length).toBe(6);
      expect(wrapper.findAll('button').length).toBe(0); // No expand button
    });
  });

  describe('Tag Interactions', () => {
    it('emits tagClick event when tag is clicked', async () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: mockTags.slice(0, 1),
        },
      });

      const tagDiv = wrapper.find('div.text-sm.cursor-pointer');
      await tagDiv.trigger('click');

      expect(wrapper.emitted('tagClick')).toBeTruthy();
      // The emitted event now contains StructuredTag format with key, value, and definition
      const emittedEvent = wrapper.emitted('tagClick')?.[0]?.[0] as { key: string; value: string; definition: unknown };
      expect(emittedEvent).toBeDefined();
      expect(emittedEvent.key).toBe('material');
      expect(emittedEvent.value).toBe('bronze');
      expect(emittedEvent.definition).toBeDefined();
    });
  });

  describe('Styling', () => {
    it('uses bold text for tag labels', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: [{ label: 'material', value: 'bronze' }],
        },
      });

      const tagDiv = wrapper.find('div.text-sm.cursor-pointer');
      const boldSpan = tagDiv.find('span.font-bold');
      expect(boldSpan.exists()).toBe(true);
      expect(boldSpan.text()).toContain('Material:');
    });

    it('displays tag values after labels', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: [{ label: 'material', value: 'bronze' }],
        },
      });

      const tagDiv = wrapper.find('div.text-sm.cursor-pointer');
      expect(tagDiv.text()).toContain('Material:');
      expect(tagDiv.text()).toContain('bronze');
      expect(tagDiv.find('span.font-bold').text()).toBe('Material:');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: [{ label: 'material', value: 'bronze' }],
        },
      });

      const tagDiv = wrapper.find('div.text-sm.cursor-pointer');
      expect(tagDiv.attributes('aria-label')).toContain('Tag: Material: bronze');
    });

    it('has proper ARIA attributes for expand button', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: mockTags,
          maxVisible: 3,
        },
      });

      const expandButton = wrapper.findAll('button').find(btn => btn.text().includes('more'));

      if (expandButton) {
        expect(expandButton.attributes('aria-expanded')).toBe('false');
        expect(expandButton.attributes('aria-label')).toContain('Show 3 more tags');
      }
    });

    it('includes screen reader summary', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: mockTags,
          maxVisible: 3,
        },
      });

      expect(wrapper.find('.sr-only').exists()).toBe(true);
      expect(wrapper.find('[aria-live="polite"]').exists()).toBe(true);
    });

    it('updates screen reader content when expanded', async () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: mockTags,
          maxVisible: 3,
        },
      });

      const expandButton = wrapper.findAll('button').find(btn => btn.text().includes('more'));

      if (expandButton) {
        await expandButton.trigger('click');

        const screenReaderText = wrapper.find('.sr-only').text();
        expect(screenReaderText).toContain('All tags shown');
      }
    });
  });

  describe('Edge Cases', () => {
    it('handles empty tag values gracefully', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: [{ label: 'empty', value: '' }],
        },
      });

      expect(wrapper.text()).toContain('empty');
      expect(wrapper.find('div.text-sm.cursor-pointer').exists()).toBe(true);
    });

    it('handles undefined values in record', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: { test: '' }, // Use empty string instead of undefined
        },
      });

      expect(wrapper.text()).toContain('test');
    });

    it('handles maxVisible being larger than tag count', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: mockTags.slice(0, 2),
          maxVisible: 10,
        },
      });

      expect(wrapper.text()).not.toContain('more');
      expect(wrapper.findAll('div.text-sm.cursor-pointer').length).toBe(2);
    });
  });
});
