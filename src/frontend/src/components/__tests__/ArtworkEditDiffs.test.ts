/**
 * Tests for ArtworkEditDiffs component
 */

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ArtworkEditDiffs from '../ArtworkEditDiffs.vue';
import type { ArtworkEditDiff } from '../../../../shared/types';

describe('ArtworkEditDiffs', () => {
  const mockTagDiffs: ArtworkEditDiff[] = [
    {
      field_name: 'tags',
      old_value: JSON.stringify({
        tags: {
          tourism: 'artwork',
          artwork_type: 'statue',
          name: 'Old Name',
        },
        version: '1.0.0',
      }),
      new_value: JSON.stringify({
        tags: {
          tourism: 'artwork',
          artwork_type: 'mural',
          name: 'New Name',
          height: 3.5,
        },
        version: '1.0.0',
      }),
      formatted_old: 'Artwork Classification: Type: statue\nReference Data: Name: Old Name',
      formatted_new: 'Artwork Classification: Type: mural\nReference Data: Name: New Name\nPhysical Properties: Height: 3.5m',
    },
  ];

  const mockTextDiffs: ArtworkEditDiff[] = [
    {
      field_name: 'title',
      old_value: 'Old Title',
      new_value: 'New Title',
    },
    {
      field_name: 'description',
      old_value: null,
      new_value: 'New description added',
    },
  ];

  const mockMixedDiffs: ArtworkEditDiff[] = [
    ...mockTextDiffs,
    ...mockTagDiffs,
  ];

  describe('Field Organization', () => {
    it('should group diffs by field name', () => {
      const wrapper = mount(ArtworkEditDiffs, {
        props: { diffs: mockMixedDiffs },
      });

      // Should show separate sections for each field
      expect(wrapper.text()).toContain('Title');
      expect(wrapper.text()).toContain('Description');
      expect(wrapper.text()).toContain('Tags');
    });

    it('should sort fields by priority', () => {
      const wrapper = mount(ArtworkEditDiffs, {
        props: { diffs: mockMixedDiffs },
      });

      const fieldHeaders = wrapper.findAll('h4');
      const fieldNames = fieldHeaders.map(h => h.text());

      // Title should come before tags (higher priority)
      const titleIndex = fieldNames.findIndex(name => name.includes('Title'));
      const tagsIndex = fieldNames.findIndex(name => name.includes('Tags'));
      
      expect(titleIndex).toBeLessThan(tagsIndex);
    });
  });

  describe('Change Type Indicators', () => {
    it('should show appropriate change type labels', () => {
      const wrapper = mount(ArtworkEditDiffs, {
        props: { diffs: mockTextDiffs },
      });

      expect(wrapper.text()).toContain('Modified'); // title change
      expect(wrapper.text()).toContain('Added'); // description added
    });

    it('should apply appropriate colors for change types', () => {
      const wrapper = mount(ArtworkEditDiffs, {
        props: { diffs: mockTextDiffs },
      });

      // Should have green background for added field
      expect(wrapper.find('.bg-green-50').exists()).toBe(true);
      // Should have blue background for modified field
      expect(wrapper.find('.bg-blue-50').exists()).toBe(true);
    });
  });

  describe('Tag Field Handling', () => {
    it('should use TagDiffDisplay for tag fields', () => {
      const wrapper = mount(ArtworkEditDiffs, {
        props: { diffs: mockTagDiffs },
        global: {
          stubs: {
            TagDiffDisplay: {
              template: '<div class="tag-diff-stub">Tag diff content</div>',
            },
          },
        },
      });

      expect(wrapper.find('.tag-diff-stub').exists()).toBe(true);
    });

    it('should use standard diff display for non-tag fields', () => {
      const wrapper = mount(ArtworkEditDiffs, {
        props: { diffs: mockTextDiffs },
      });

      // Should show current/proposed labels for text fields
      expect(wrapper.text()).toContain('Current');
      expect(wrapper.text()).toContain('Proposed');
      expect(wrapper.text()).toContain('Old Title');
      expect(wrapper.text()).toContain('New Title');
    });
  });

  describe('Compact Mode', () => {
    it('should hide header in compact mode', () => {
      const wrapper = mount(ArtworkEditDiffs, {
        props: { 
          diffs: mockTextDiffs,
          compact: true,
        },
      });

      expect(wrapper.text()).not.toContain('Proposed Changes');
      expect(wrapper.text()).not.toContain('Review the following changes');
    });

    it('should show header in non-compact mode', () => {
      const wrapper = mount(ArtworkEditDiffs, {
        props: { 
          diffs: mockTextDiffs,
          compact: false,
        },
      });

      expect(wrapper.text()).toContain('Proposed Changes');
      expect(wrapper.text()).toContain('Review the following changes');
    });
  });

  describe('Field Descriptions', () => {
    it('should show field descriptions for known fields', () => {
      const wrapper = mount(ArtworkEditDiffs, {
        props: { diffs: mockTextDiffs },
      });

      expect(wrapper.text()).toContain('Artwork title or name');
      expect(wrapper.text()).toContain('Detailed artwork description');
    });

    it('should handle unknown field names gracefully', () => {
      const unknownFieldDiff: ArtworkEditDiff[] = [
        {
          field_name: 'unknown_field',
          old_value: 'old',
          new_value: 'new',
        },
      ];

      const wrapper = mount(ArtworkEditDiffs, {
        props: { diffs: unknownFieldDiff },
      });

      expect(wrapper.text()).toContain('Unknown Field');
    });
  });

  describe('Value Formatting', () => {
    it('should format null values as "(empty)"', () => {
      const nullValueDiffs: ArtworkEditDiff[] = [
        {
          field_name: 'title',
          old_value: null,
          new_value: 'New Title',
        },
      ];

      const wrapper = mount(ArtworkEditDiffs, {
        props: { diffs: nullValueDiffs },
      });

      expect(wrapper.text()).toContain('(empty)');
    });

    it('should format empty strings as "(blank)"', () => {
      const emptyStringDiffs: ArtworkEditDiff[] = [
        {
          field_name: 'description',
          old_value: '',
          new_value: 'New description',
        },
      ];

      const wrapper = mount(ArtworkEditDiffs, {
        props: { diffs: emptyStringDiffs },
      });

      expect(wrapper.text()).toContain('(blank)');
    });
  });

  describe('Layout and Structure', () => {
    it('should render all provided diffs', () => {
      const wrapper = mount(ArtworkEditDiffs, {
        props: { diffs: mockMixedDiffs },
        global: {
          stubs: {
            TagDiffDisplay: {
              template: '<div class="tag-diff-stub">Tag changes</div>',
            },
          },
        },
      });

      // Should show all three fields
      expect(wrapper.text()).toContain('Title');
      expect(wrapper.text()).toContain('Description');
      expect(wrapper.text()).toContain('Tags');
    });

    it('should handle empty diffs array', () => {
      const wrapper = mount(ArtworkEditDiffs, {
        props: { diffs: [] },
      });

      // Should render without errors
      expect(wrapper.exists()).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('should use proper heading structure', () => {
      const wrapper = mount(ArtworkEditDiffs, {
        props: { diffs: mockTextDiffs },
      });

      const h3 = wrapper.find('h3');
      const h4s = wrapper.findAll('h4');
      const h5s = wrapper.findAll('h5');

      expect(h3.exists()).toBe(true);
      expect(h4s.length).toBeGreaterThan(0);
      expect(h5s.length).toBeGreaterThan(0);
    });

    it('should provide descriptive text for changes', () => {
      const wrapper = mount(ArtworkEditDiffs, {
        props: { diffs: mockTextDiffs },
      });

      // Should contain descriptive text about the nature of changes
      expect(wrapper.text()).toContain('Current');
      expect(wrapper.text()).toContain('Proposed');
    });
  });
});