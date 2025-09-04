/**
 * Tests for SearchInput component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SearchInput from '../SearchInput.vue'

// Mock Heroicons
vi.mock('@heroicons/vue/24/outline', () => ({
  MagnifyingGlassIcon: { name: 'MagnifyingGlassIcon', template: '<div data-testid="search-icon"></div>' },
  XMarkIcon: { name: 'XMarkIcon', template: '<div data-testid="clear-icon"></div>' }
}))

describe('SearchInput', () => {
  beforeEach(() => {
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  it('should render with default props', () => {
    const wrapper = mount(SearchInput, {
      props: {
        modelValue: ''
      }
    })

    expect(wrapper.find('input').exists()).toBe(true)
    expect(wrapper.find('[data-testid="search-icon"]').exists()).toBe(true)
    expect(wrapper.find('input').attributes('placeholder')).toContain('Search artworks')
  })

  it('should emit update:modelValue when input changes', async () => {
    const wrapper = mount(SearchInput, {
      props: {
        modelValue: ''
      }
    })

    const input = wrapper.find('input')
    await input.setValue('test query')

    expect(wrapper.emitted('update:modelValue')).toEqual([['test query']])
  })

  it('should show clear button when there is input', async () => {
    const wrapper = mount(SearchInput, {
      props: {
        modelValue: 'test'
      }
    })

    expect(wrapper.find('[data-testid="clear-icon"]').exists()).toBe(true)
  })

  it('should emit clear event when clear button is clicked', async () => {
    const wrapper = mount(SearchInput, {
      props: {
        modelValue: 'test'
      }
    })

    const clearButton = wrapper.find('button')
    await clearButton.trigger('click')

    expect(wrapper.emitted('clear')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toEqual([['']]) // Only one emission for clear
  })

  it('should show suggestions dropdown when suggestions are provided', async () => {
    const wrapper = mount(SearchInput, {
      props: {
        modelValue: 'test',
        suggestions: ['test suggestion 1', 'test suggestion 2']
      }
    })

    const input = wrapper.find('input')
    await input.trigger('focus')

    expect(wrapper.find('[role="listbox"]').exists()).toBe(true)
    expect(wrapper.findAll('[role="option"]')).toHaveLength(2)
  })

  it('should emit suggestionSelect when suggestion is clicked', async () => {
    const wrapper = mount(SearchInput, {
      props: {
        modelValue: 'test',
        suggestions: ['test suggestion']
      }
    })

    const input = wrapper.find('input')
    await input.trigger('focus')

    const suggestion = wrapper.find('[role="option"]')
    await suggestion.trigger('click')

    expect(wrapper.emitted('suggestionSelect')).toEqual([['test suggestion']])
    expect(wrapper.emitted('search')).toEqual([['test suggestion']])
  })

  it('should handle keyboard navigation in suggestions', async () => {
    const wrapper = mount(SearchInput, {
      props: {
        modelValue: 'test',
        suggestions: ['suggestion 1', 'suggestion 2']
      }
    })

    const input = wrapper.find('input')
    await input.trigger('focus')

    // Arrow down should highlight first suggestion
    await input.trigger('keydown', { key: 'ArrowDown' })
    let highlighted = wrapper.find('.bg-blue-50')
    expect(highlighted.text()).toContain('suggestion 1')

    // Arrow down should highlight second suggestion
    await input.trigger('keydown', { key: 'ArrowDown' })
    highlighted = wrapper.find('.bg-blue-50')
    expect(highlighted.text()).toContain('suggestion 2')

    // Arrow up should go back to first
    await input.trigger('keydown', { key: 'ArrowUp' })
    highlighted = wrapper.find('.bg-blue-50')
    expect(highlighted.text()).toContain('suggestion 1')
  })

  it('should emit search on Enter key', async () => {
    const wrapper = mount(SearchInput, {
      props: {
        modelValue: 'test query'
      }
    })

    const input = wrapper.find('input')
    await input.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('search')).toEqual([['test query']])
  })

  it('should debounce search emission', async () => {
    const wrapper = mount(SearchInput, {
      props: {
        modelValue: '',
        debounceMs: 300
      }
    })

    const input = wrapper.find('input')
    await input.setValue('test')

    // Should not emit search immediately
    expect(wrapper.emitted('search')).toBeFalsy()

    // Fast forward time
    vi.advanceTimersByTime(300)

    expect(wrapper.emitted('search')).toEqual([['test']])
  })

  it('should handle focus and blur events', async () => {
    const wrapper = mount(SearchInput, {
      props: {
        modelValue: ''
      }
    })

    const input = wrapper.find('input')
    
    await input.trigger('focus')
    expect(wrapper.emitted('focus')).toHaveLength(1)

    await input.trigger('blur')
    expect(wrapper.emitted('blur')).toHaveLength(1)
  })

  it('should show loading indicator when loading prop is true', () => {
    const wrapper = mount(SearchInput, {
      props: {
        modelValue: 'test',
        loading: true
      }
    })

    expect(wrapper.find('.animate-spin').exists()).toBe(true)
  })

  it('should be disabled when disabled prop is true', () => {
    const wrapper = mount(SearchInput, {
      props: {
        modelValue: '',
        disabled: true
      }
    })

    const input = wrapper.find('input')
    expect(input.attributes('disabled')).toBeDefined()
  })

  it('should have proper accessibility attributes', async () => {
    const wrapper = mount(SearchInput, {
      props: {
        modelValue: 'test',
        suggestions: ['suggestion 1']
      }
    })

    const input = wrapper.find('input')
    expect(input.attributes('role')).toBe('combobox')
    expect(input.attributes('aria-autocomplete')).toBe('list')
    expect(input.attributes('aria-describedby')).toBe('search-description')

    // Trigger focus to show suggestions
    await input.trigger('focus')
    
    const listbox = wrapper.find('[role="listbox"]')
    expect(listbox.exists()).toBe(true)
    expect(listbox.attributes('aria-label')).toBe('Search suggestions')
  })

  it('should expose focus and clear methods', () => {
    const wrapper = mount(SearchInput, {
      props: {
        modelValue: 'test'
      }
    })

    const component = wrapper.vm
    expect(typeof component.focus).toBe('function')
    expect(typeof component.clear).toBe('function')
  })
})