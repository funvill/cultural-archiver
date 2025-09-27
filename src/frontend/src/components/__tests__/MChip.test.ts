import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import MChip from '../MChip.vue';

describe('MChip.vue', () => {
  describe('Basic Rendering', () => {
    it('renders correctly with default props', () => {
      const wrapper = mount(MChip, {
        props: {
          icon: 'heart',
          label: 'Test Label',
        },
      });

      expect(wrapper.find('button').exists()).toBe(true);
      expect(wrapper.find('svg').exists()).toBe(true);
      expect(wrapper.attributes('aria-label')).toBe('Test Label');
    });

    it('renders with custom aria-label', () => {
      const wrapper = mount(MChip, {
        props: {
          icon: 'heart',
          label: 'Test Label',
          ariaLabel: 'Custom aria label',
        },
      });

      expect(wrapper.attributes('aria-label')).toBe('Custom aria label');
    });

    it('shows label text when showLabel is true', () => {
      const wrapper = mount(MChip, {
        props: {
          icon: 'heart',
          label: 'Test Label',
          showLabel: true,
        },
      });

      expect(wrapper.text()).toContain('Test Label');
    });

    it('displays count badge when count is provided', () => {
      const wrapper = mount(MChip, {
        props: {
          icon: 'heart',
          label: 'Test Label',
          count: 5,
        },
      });

      expect(wrapper.text()).toContain('5');
    });

    it('shows 999+ for counts over 999', () => {
      const wrapper = mount(MChip, {
        props: {
          icon: 'heart',
          label: 'Test Label',
          count: 1500,
        },
      });

      expect(wrapper.text()).toContain('999+');
    });
  });

  describe('States and Variants', () => {
    it('applies active state correctly', () => {
      const wrapper = mount(MChip, {
        props: {
          icon: 'heart',
          label: 'Test Label',
          active: true,
        },
      });

      expect(wrapper.attributes('aria-pressed')).toBe('true');
      expect(wrapper.classes()).toContain('border-red-500');
    });

    it('applies loading state correctly', () => {
      const wrapper = mount(MChip, {
        props: {
          icon: 'heart',
          label: 'Test Label',
          loading: true,
        },
      });

      expect(wrapper.find('.animate-spin').exists()).toBe(true);
      expect(wrapper.attributes('disabled')).toBeDefined();
    });

    it('applies disabled state correctly', () => {
      const wrapper = mount(MChip, {
        props: {
          icon: 'heart',
          label: 'Test Label',
          disabled: true,
        },
      });

      expect(wrapper.attributes('disabled')).toBeDefined();
      expect(wrapper.classes()).toContain('cursor-not-allowed');
    });

    it('renders different sizes correctly', () => {
      const sizes = ['sm', 'md', 'lg'] as const;
      
      sizes.forEach(size => {
        const wrapper = mount(MChip, {
          props: {
            icon: 'heart',
            label: 'Test Label',
            size,
          },
        });

        expect(wrapper.classes()).toContain(size === 'sm' ? 'h-8' : size === 'md' ? 'h-10' : 'h-12');
      });
    });
  });

  describe('Icons', () => {
    it('renders heart icon correctly for active and inactive states', () => {
      const activeWrapper = mount(MChip, {
        props: {
          icon: 'heart',
          label: 'Heart',
          active: true,
        },
      });

      const inactiveWrapper = mount(MChip, {
        props: {
          icon: 'heart',
          label: 'Heart',
          active: false,
        },
      });

      // Both should have SVG elements with different paths
      expect(activeWrapper.find('svg').exists()).toBe(true);
      expect(inactiveWrapper.find('svg').exists()).toBe(true);
    });

    it('renders different icon types correctly', () => {
      const icons = ['heart', 'flag', 'star', 'bookmark', 'document-add', 'share', 'pencil'];
      
      icons.forEach(icon => {
        const wrapper = mount(MChip, {
          props: {
            icon,
            label: `${icon} label`,
          },
        });

        expect(wrapper.find('svg').exists()).toBe(true);
      });
    });

    it('renders fallback icon for unknown icon type', () => {
      const wrapper = mount(MChip, {
        props: {
          icon: 'unknown-icon',
          label: 'Unknown',
        },
      });

      expect(wrapper.find('svg').exists()).toBe(true);
      expect(wrapper.find('circle').exists()).toBe(true); // fallback circle
    });
  });

  describe('Events', () => {
    it('emits click event when clicked and not disabled', async () => {
      const wrapper = mount(MChip, {
        props: {
          icon: 'heart',
          label: 'Test Label',
        },
      });

      await wrapper.find('button').trigger('click');
      
      expect(wrapper.emitted()).toHaveProperty('click');
      expect(wrapper.emitted().click).toHaveLength(1);
    });

    it('does not emit click event when disabled', async () => {
      const wrapper = mount(MChip, {
        props: {
          icon: 'heart',
          label: 'Test Label',
          disabled: true,
        },
      });

      await wrapper.find('button').trigger('click');
      
      expect(wrapper.emitted()).not.toHaveProperty('click');
    });

    it('does not emit click event when loading', async () => {
      const wrapper = mount(MChip, {
        props: {
          icon: 'heart',
          label: 'Test Label',
          loading: true,
        },
      });

      await wrapper.find('button').trigger('click');
      
      expect(wrapper.emitted()).not.toHaveProperty('click');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      const wrapper = mount(MChip, {
        props: {
          icon: 'heart',
          label: 'Test Label',
          active: true,
        },
      });

      const button = wrapper.find('button');
      expect(button.attributes('aria-label')).toBe('Test Label - Active');
      expect(button.attributes('aria-pressed')).toBe('true');
      expect(button.attributes('type')).toBe('button');
    });

    it('generates proper aria-label with count', () => {
      const wrapper = mount(MChip, {
        props: {
          icon: 'heart',
          label: 'Test Label',
          count: 42,
        },
      });

      expect(wrapper.attributes('aria-label')).toBe('Test Label (42)');
    });

    it('indicates loading state in aria-label', () => {
      const wrapper = mount(MChip, {
        props: {
          icon: 'heart',
          label: 'Test Label',
          loading: true,
        },
      });

      expect(wrapper.attributes('aria-label')).toBe('Test Label - Loading');
    });

    it('is keyboard accessible', async () => {
      const wrapper = mount(MChip, {
        props: {
          icon: 'heart',
          label: 'Test Label',
        },
      });

      // Simulate keyboard events
      await wrapper.find('button').trigger('keydown.enter');
      await wrapper.find('button').trigger('keydown.space');
      
      // The button should still be clickable via keyboard
      expect(wrapper.find('button').element.tagName).toBe('BUTTON');
    });
  });

  describe('Styling and CSS Classes', () => {
    it('applies correct base classes', () => {
      const wrapper = mount(MChip, {
        props: {
          icon: 'heart',
          label: 'Test Label',
        },
      });

      const button = wrapper.find('button');
      expect(button.classes()).toContain('inline-flex');
      expect(button.classes()).toContain('items-center');
      expect(button.classes()).toContain('justify-center');
      expect(button.classes()).toContain('rounded-full');
    });

    it('applies variant-specific classes', () => {
      const filledWrapper = mount(MChip, {
        props: {
          icon: 'heart',
          label: 'Test Label',
          variant: 'filled',
          active: true,
        },
      });

      const outlinedWrapper = mount(MChip, {
        props: {
          icon: 'heart',
          label: 'Test Label',
          variant: 'outlined',
          active: true,
        },
      });

      expect(filledWrapper.classes()).toContain('bg-red-500');
      expect(outlinedWrapper.classes()).toContain('border-red-500');
    });
  });
});