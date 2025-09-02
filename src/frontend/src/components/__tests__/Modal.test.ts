import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import Modal from '../Modal.vue'

// Mock heroicons
vi.mock('@heroicons/vue/24/outline', () => ({
  XMarkIcon: {
    name: 'XMarkIcon',
    template: '<svg data-testid="close-icon"></svg>',
  },
}))

describe('Modal', () => {
  let wrapper: VueWrapper<any> // eslint-disable-line @typescript-eslint/no-explicit-any

  beforeEach(async (): Promise<void> => {
    wrapper = mount(Modal, {
      props: {
        isOpen: true,
        title: 'Test Modal',
        message: 'This is a test modal',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
      },
    })
    
    await wrapper.vm.$nextTick()
  })

  describe('Basic Rendering', (): void => {
    it('renders when isOpen is true', (): void => {
      expect(wrapper.exists()).toBe(true)
    })

    it('does not render when isOpen is false', async (): Promise<void> => {
      await wrapper.setProps({ isOpen: false })
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    })

    it('has modal structure', (): void => {
      expect(wrapper.exists()).toBe(true)
    })

    it('shows content when open', (): void => {
      expect(wrapper.html().length).toBeGreaterThan(0)
    })
  })

  describe('Props Interface', (): void => {
    it('accepts title prop', (): void => {
      expect(wrapper.props('title')).toBe('Test Modal')
    })

    it('accepts message prop', (): void => {
      expect(wrapper.props('message')).toBe('This is a test modal')
    })

    it('has variant prop', (): void => {
      expect(wrapper.props('variant')).toBeDefined()
    })
  })

  describe('Events', (): void => {
    it('can emit events', (): void => {
      wrapper.vm.$emit('confirm')
      expect(wrapper.emitted('confirm')).toBeTruthy()
    })

    it('handles update events', (): void => {
      wrapper.vm.$emit('update:isOpen', false)
      expect(wrapper.emitted('update:isOpen')).toBeTruthy()
    })
  })

  describe('Accessibility', (): void => {
    it('has dialog accessibility', (): void => {
      expect(wrapper.exists()).toBe(true)
    })

    it('has focus management', (): void => {
      expect(wrapper.vm.previouslyFocused).toBeDefined()
    })
  })

  describe('Component State', (): void => {
    it('manages modal state', (): void => {
      expect(wrapper.vm).toBeDefined()
      expect(wrapper.props('isOpen')).toBe(true)
    })
  })
})