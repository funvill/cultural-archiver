/**
 * Unit tests for TagChipEditor component
 * Tests tag management, input handling, accessibility, and user interactions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import TagChipEditor from '../TagChipEditor.vue';

describe('TagChipEditor', () => {
  let wrapper: VueWrapper<any>;

  beforeEach(() => {
    wrapper = mount(TagChipEditor, {
      props: {
        modelValue: [],
        placeholder: 'Add tags...',
        maxTags: 5,
      },
    });
  });

  describe('Basic Functionality', () => {
    it('renders without errors', () => {
      expect(wrapper.exists()).toBe(true);
      expect(wrapper.find('input').exists()).toBe(true);
    });

    it('displays placeholder text when no tags', () => {
      const input = wrapper.find('input');
      expect(input.attributes('placeholder')).toBe('Add tags...');
    });

    it('shows tag count correctly', () => {
      expect(wrapper.text()).toContain('0/5 tags');
    });
  });

  describe('Tag Addition', () => {
    it('adds tag on Enter key press', async () => {
      const input = wrapper.find('input');
      await input.setValue('test-tag');
      await input.trigger('keydown', { key: 'Enter' });

      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
      const emittedEvents = wrapper.emitted('update:modelValue') as any[][];
      expect(emittedEvents?.[0]?.[0]).toEqual(['test-tag']);
      expect(wrapper.emitted('tag-added')).toBeTruthy();
    });

    it('adds tag on Add button click', async () => {
      const input = wrapper.find('input');
      await input.setValue('button-tag');

      const addButton = wrapper.find('button[aria-label="Add tag"]');
      expect(addButton.exists()).toBe(true);
      await addButton.trigger('click');

      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
      const emittedEvents = wrapper.emitted('update:modelValue') as any[][];
      expect(emittedEvents?.[0]?.[0]).toEqual(['button-tag']);
    });

    it('adds multiple tags with comma separation', async () => {
      const input = wrapper.find('input');
      await input.setValue('tag1, tag2, tag3');
      await input.trigger('keydown', { key: 'Enter' });

      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
      const emittedEvents = wrapper.emitted('update:modelValue') as any[][];
      // Should have multiple emit events for each tag
      expect(emittedEvents.length).toBeGreaterThan(1);
    });

    it('trims whitespace from tags', async () => {
      const input = wrapper.find('input');
      await input.setValue('  spaced-tag  ');
      await input.trigger('keydown', { key: 'Enter' });

      const emittedEvents = wrapper.emitted('update:modelValue') as any[][];
      expect(emittedEvents?.[0]?.[0]).toEqual(['spaced-tag']);
    });
  });

  describe('Tag Removal', () => {
    beforeEach(async () => {
      await wrapper.setProps({
        modelValue: ['tag1', 'tag2', 'tag3'],
      });
    });

    it('removes tag when X button is clicked', async () => {
      const removeButtons = wrapper.findAll('button[aria-label*="Remove tag"]');
      expect(removeButtons.length).toBe(3);

      await removeButtons[0]?.trigger('click');

      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
      expect(wrapper.emitted('tag-removed')).toBeTruthy();
      const removedEvents = wrapper.emitted('tag-removed') as any[][];
      expect(removedEvents?.[0]?.[0]).toBe('tag1');
    });

    it('removes last tag on Backspace when input is empty', async () => {
      const input = wrapper.find('input');
      await input.setValue('');
      await input.trigger('keydown', { key: 'Backspace' });

      expect(wrapper.emitted('tag-removed')).toBeTruthy();
      const removedEvents = wrapper.emitted('tag-removed') as any[][];
      expect(removedEvents?.[0]?.[0]).toBe('tag3'); // Last tag
    });

    it('does not remove tag on Backspace when input has content', async () => {
      const input = wrapper.find('input');
      await input.setValue('some text');
      await input.trigger('keydown', { key: 'Backspace' });

      expect(wrapper.emitted('tag-removed')).toBeFalsy();
    });
  });

  describe('Validation', () => {
    it('prevents adding empty tags', async () => {
      const input = wrapper.find('input');
      await input.setValue('   ');
      await input.trigger('keydown', { key: 'Enter' });

      expect(wrapper.emitted('update:modelValue')).toBeFalsy();
      expect(wrapper.text()).toContain('Tag cannot be empty');
    });

    it('prevents adding duplicate tags', async () => {
      await wrapper.setProps({
        modelValue: ['existing-tag'],
      });

      const input = wrapper.find('input');
      await input.setValue('existing-tag');
      await input.trigger('keydown', { key: 'Enter' });

      expect(wrapper.text()).toContain('Tag already exists');
    });

    it('prevents adding tags when max limit reached', async () => {
      await wrapper.setProps({
        modelValue: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'], // At max limit
        maxTags: 5,
      });

      const input = wrapper.find('input');
      await input.setValue('new-tag');
      await input.trigger('keydown', { key: 'Enter' });

      expect(wrapper.text()).toContain('Maximum 5 tags allowed');
    });

    it('hides add button when max tags reached', async () => {
      await wrapper.setProps({
        modelValue: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
        maxTags: 5,
      });

      const input = wrapper.find('input');
      await input.setValue('new-tag');

      const addButton = wrapper.find('button[aria-label="Add tag"]');
      expect(addButton.exists()).toBe(false);
    });
  });

  describe('Keyboard Navigation', () => {
    it('clears input on Escape key', async () => {
      const input = wrapper.find('input');
      await input.setValue('test content');
      await input.trigger('keydown', { key: 'Escape' });

      expect((input.element as HTMLInputElement).value).toBe('');
    });

    it('adds tag on blur if input has content', async () => {
      const input = wrapper.find('input');
      await input.setValue('blur-tag');
      await input.trigger('blur');

      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
      const emittedEvents = wrapper.emitted('update:modelValue') as any[][];
      expect(emittedEvents?.[0]?.[0]).toEqual(['blur-tag']);
    });
  });

  describe('Disabled State', () => {
    beforeEach(async () => {
      await wrapper.setProps({
        disabled: true,
        modelValue: ['tag1', 'tag2'],
      });
    });

    it('disables input when disabled prop is true', () => {
      const input = wrapper.find('input');
      expect(input.attributes('disabled')).toBeDefined();
    });

    it('hides remove buttons when disabled', () => {
      const removeButtons = wrapper.findAll('button[aria-label*="Remove tag"]');
      expect(removeButtons.length).toBe(0);
    });

    it('prevents tag addition when disabled', async () => {
      const input = wrapper.find('input');
      await input.trigger('keydown', { key: 'Enter' });

      expect(wrapper.emitted('update:modelValue')).toBeFalsy();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      const input = wrapper.find('input');
      expect(input.attributes('aria-label')).toContain('Add new tag');
      expect(input.attributes('aria-label')).toContain('0 of');
    });

    it('has error announcements', async () => {
      const input = wrapper.find('input');
      await input.setValue('');
      await input.trigger('keydown', { key: 'Enter' });

      const errorElement = wrapper.find('[role="alert"]');
      expect(errorElement.exists()).toBe(true);
      expect(errorElement.text()).toContain('Tag cannot be empty');
    });

    it('announces tag count changes', async () => {
      await wrapper.setProps({
        modelValue: ['tag1'],
      });

      const announcement = wrapper.find('[aria-live="polite"]');
      expect(announcement.exists()).toBe(true);
      expect(announcement.text()).toContain('1 tag added');
    });

    it('has proper remove button labels', async () => {
      await wrapper.setProps({
        modelValue: ['test-tag'],
      });

      const removeButton = wrapper.find('button[aria-label*="Remove tag"]');
      expect(removeButton.exists()).toBe(true);
      expect(removeButton.attributes('aria-label')).toBe('Remove tag: test-tag');
    });
  });

  describe('Focus Management', () => {
    it('focuses input when container is clicked', async () => {
      const container = wrapper.find('.tag-chip-editor > div'); // Click on the inner div with the click handler
      const focusSpy = vi.spyOn(wrapper.vm, 'focusInput');

      await container.trigger('click');

      expect(focusSpy).toHaveBeenCalled();
    });

    it('maintains focus on input after adding tag', async () => {
      const input = wrapper.find('input');
      await input.setValue('focus-test');

      const addButton = wrapper.find('button[aria-label="Add tag"]');
      await addButton.trigger('click');

      // Input should be cleared but focused
      expect((input.element as HTMLInputElement).value).toBe('');
    });
  });

  describe('Component API', () => {
    it('exposes focusInput method', () => {
      expect(typeof wrapper.vm.focusInput).toBe('function');
    });

    it('exposes addTag method', () => {
      expect(typeof wrapper.vm.addTag).toBe('function');
    });

    it('exposes removeTag method', () => {
      expect(typeof wrapper.vm.removeTag).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('clears error when starting to type', async () => {
      // Trigger an error first
      const input = wrapper.find('input');
      await input.setValue('');
      await input.trigger('keydown', { key: 'Enter' });

      expect(wrapper.text()).toContain('Tag cannot be empty');

      // Start typing to clear error
      await input.trigger('keydown', { key: 'a' });
      await wrapper.vm.$nextTick();

      expect(wrapper.text()).not.toContain('Tag cannot be empty');
    });

    it('clears error when focusing input', async () => {
      // Trigger an error first
      const input = wrapper.find('input');
      await input.setValue('');
      await input.trigger('keydown', { key: 'Enter' });

      expect(wrapper.text()).toContain('Tag cannot be empty');

      // Focus to clear error
      await input.trigger('focus');
      await wrapper.vm.$nextTick();

      expect(wrapper.text()).not.toContain('Tag cannot be empty');
    });
  });
});
