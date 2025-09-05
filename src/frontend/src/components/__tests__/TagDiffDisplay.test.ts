/**
 * Tests for TagDiffDisplay component
 */

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import TagDiffDisplay from '../TagDiffDisplay.vue';

describe('TagDiffDisplay', () => {
  const mockOldTags = JSON.stringify({
    tags: {
      tourism: 'artwork',
      artwork_type: 'statue',
      name: 'Old Name',
      artist_name: 'Old Artist',
      material: 'stone',
    },
    version: '1.0.0',
  });

  const mockNewTags = JSON.stringify({
    tags: {
      tourism: 'artwork',
      artwork_type: 'mural',
      name: 'New Name',
      artist_name: 'Old Artist',
      material: 'stone',
      height: 3.5,
    },
    version: '1.0.0',
  });

  describe('Tag Change Detection', () => {
    it('should detect added tags', () => {
      const wrapper = mount(TagDiffDisplay, {
        props: {
          oldValue: JSON.stringify({ tags: { tourism: 'artwork' } }),
          newValue: JSON.stringify({ tags: { tourism: 'artwork', name: 'New Art' } }),
        },
      });

      expect(wrapper.text()).toContain('New Art');
      expect(wrapper.text()).toContain('➕');
    });

    it('should detect removed tags', () => {
      const wrapper = mount(TagDiffDisplay, {
        props: {
          oldValue: JSON.stringify({ tags: { tourism: 'artwork', name: 'Old Art' } }),
          newValue: JSON.stringify({ tags: { tourism: 'artwork' } }),
        },
      });

      expect(wrapper.text()).toContain('Old Art');
      expect(wrapper.text()).toContain('➖');
    });

    it('should detect modified tags', () => {
      const wrapper = mount(TagDiffDisplay, {
        props: {
          oldValue: JSON.stringify({ tags: { artwork_type: 'statue' } }),
          newValue: JSON.stringify({ tags: { artwork_type: 'mural' } }),
        },
      });

      expect(wrapper.text()).toContain('statue');
      expect(wrapper.text()).toContain('mural');
      expect(wrapper.text()).toContain('✏️');
    });

    it('should handle complex tag changes', () => {
      const wrapper = mount(TagDiffDisplay, {
        props: {
          oldValue: mockOldTags,
          newValue: mockNewTags,
        },
      });

      // Should detect the artwork_type change (statue -> mural)
      expect(wrapper.text()).toContain('artwork_type');
      expect(wrapper.text()).toContain('statue');
      expect(wrapper.text()).toContain('mural');

      // Should detect the name change
      expect(wrapper.text()).toContain('name');
      expect(wrapper.text()).toContain('Old Name');
      expect(wrapper.text()).toContain('New Name');

      // Should detect the added height
      expect(wrapper.text()).toContain('height');
      expect(wrapper.text()).toContain('3.5');
    });
  });

  describe('Category Organization', () => {
    it('should group changes by category', () => {
      const wrapper = mount(TagDiffDisplay, {
        props: {
          oldValue: mockOldTags,
          newValue: mockNewTags,
        },
      });

      // Should show category labels
      const categories = wrapper.findAll('h5');
      expect(categories.length).toBeGreaterThan(0);
    });
  });

  describe('Fallback Display', () => {
    it('should use formatted text when no structured tags are available', () => {
      const wrapper = mount(TagDiffDisplay, {
        props: {
          formattedOld: 'Physical Properties: Material: stone',
          formattedNew: 'Physical Properties: Material: bronze, Height: 3.5m',
        },
      });

      expect(wrapper.text()).toContain('Before');
      expect(wrapper.text()).toContain('After');
      expect(wrapper.text()).toContain('Physical Properties');
      expect(wrapper.text()).toContain('stone');
      expect(wrapper.text()).toContain('bronze');
    });

    it('should show no changes indicator when no changes are present', () => {
      const wrapper = mount(TagDiffDisplay, {
        props: {
          oldValue: mockOldTags,
          newValue: mockOldTags,
        },
      });

      expect(wrapper.text()).toContain('No tag changes');
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed JSON gracefully', () => {
      const wrapper = mount(TagDiffDisplay, {
        props: {
          oldValue: 'invalid json',
          newValue: JSON.stringify({ tags: { name: 'New Art' } }),
        },
      });

      // Should still show the new tag
      expect(wrapper.text()).toContain('New Art');
      expect(wrapper.text()).toContain('➕');
    });

    it('should handle null and undefined values', () => {
      const wrapper = mount(TagDiffDisplay, {
        props: {
          oldValue: null,
          newValue: undefined,
        },
      });

      expect(wrapper.text()).toContain('No tag changes');
    });

    it('should handle empty tag objects', () => {
      const wrapper = mount(TagDiffDisplay, {
        props: {
          oldValue: JSON.stringify({ tags: {} }),
          newValue: JSON.stringify({ tags: {} }),
        },
      });

      expect(wrapper.text()).toContain('No tag changes');
    });
  });

  describe('Visual Elements', () => {
    it('should display appropriate change icons', () => {
      const wrapper = mount(TagDiffDisplay, {
        props: {
          oldValue: JSON.stringify({ tags: { name: 'Old Name' } }),
          newValue: JSON.stringify({ tags: { name: 'New Name', height: 3.5 } }),
        },
      });

      const html = wrapper.html();
      
      // Should contain change icons
      expect(html).toContain('✏️'); // Modified
      expect(html).toContain('➕'); // Added
    });

    it('should apply appropriate CSS classes for change types', () => {
      const wrapper = mount(TagDiffDisplay, {
        props: {
          oldValue: JSON.stringify({ tags: { old_tag: 'value' } }),
          newValue: JSON.stringify({ tags: { new_tag: 'value' } }),
        },
      });

      expect(wrapper.find('.text-green-600').exists()).toBe(true); // Added
      expect(wrapper.find('.text-red-600').exists()).toBe(true); // Removed
    });
  });
});