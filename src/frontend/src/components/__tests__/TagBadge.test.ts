import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import TagBadge from '../TagBadge.vue'

describe('TagBadge', () => {
  const mockTags = [
    { label: 'material', value: 'bronze' },
    { label: 'style', value: 'modern' },
    { label: 'condition', value: 'good' },
    { label: 'year', value: '2020' },
    { label: 'artist', value: 'John Doe' },
    { label: 'medium', value: 'sculpture' }
  ]

  const mockTagsRecord = {
    material: 'bronze',
    style: 'modern',
    condition: 'good'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders correctly with array of tags', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: mockTags.slice(0, 3)
        }
      })

      expect(wrapper.find('.tag-badge-container').exists()).toBe(true)
      expect(wrapper.findAll('button').length).toBe(3)
    })

    it('renders correctly with record of tags', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: mockTagsRecord
        }
      })

      expect(wrapper.findAll('button').length).toBe(3)
      expect(wrapper.text()).toContain('Material')
      expect(wrapper.text()).toContain('bronze')
    })

    it('shows no tags message when empty', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: []
        }
      })

      expect(wrapper.text()).toContain('No tags available')
    })

    it('displays tags with proper formatting', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: [{ label: 'material', value: 'bronze' }]
        }
      })

      expect(wrapper.text()).toContain('Material bronze')
    })
  })

  describe('Expansion/Collapse', () => {
    it('shows expand button when there are more tags than maxVisible', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: mockTags,
          maxVisible: 3
        }
      })

      expect(wrapper.text()).toContain('+3 more')
    })

    it('shows only maxVisible tags initially', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: mockTags,
          maxVisible: 3
        }
      })

      // Should show 3 tag buttons + 1 expand button
      expect(wrapper.findAll('button').length).toBe(4)
    })

    it('expands to show all tags when expand button clicked', async () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: mockTags,
          maxVisible: 3
        }
      })

      const expandButton = wrapper.findAll('button').find(btn => 
        btn.text().includes('more')
      )
      
      if (expandButton) {
        await expandButton.trigger('click')
        
        // Should now show all 6 tag buttons + 1 collapse button
        expect(wrapper.findAll('button').length).toBe(7)
        expect(wrapper.text()).toContain('Show less')
      }
    })

    it('emits expandToggle event when expansion state changes', async () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: mockTags,
          maxVisible: 3
        }
      })

      const expandButton = wrapper.findAll('button').find(btn => 
        btn.text().includes('more')
      )
      
      if (expandButton) {
        await expandButton.trigger('click')
        expect(wrapper.emitted('expandToggle')).toBeTruthy()
        expect(wrapper.emitted('expandToggle')?.[0]).toEqual([true])
      }
    })

    it('does not show expand button when expandable is false', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: mockTags,
          maxVisible: 3,
          expandable: false
        }
      })

      expect(wrapper.text()).not.toContain('more')
      // Should show all tags when not expandable
      expect(wrapper.findAll('button').length).toBe(6)
    })
  })

  describe('Tag Interactions', () => {
    it('emits tagClick event when tag is clicked', async () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: mockTags.slice(0, 1)
        }
      })

      const tagButton = wrapper.find('button')
      await tagButton.trigger('click')

      expect(wrapper.emitted('tagClick')).toBeTruthy()
      expect(wrapper.emitted('tagClick')?.[0]).toEqual([mockTags[0]])
    })
  })

  describe('Styling Variants', () => {
    it('applies default variant classes', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: [{ label: 'test', value: 'value' }],
          variant: 'default',
          colorScheme: 'blue'
        }
      })

      const tagButton = wrapper.find('button')
      expect(tagButton.classes()).toContain('bg-blue-600')
      expect(tagButton.classes()).toContain('text-white')
    })

    it('applies outline variant classes', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: [{ label: 'test', value: 'value' }],
          variant: 'outline',
          colorScheme: 'blue'
        }
      })

      const tagButton = wrapper.find('button')
      expect(tagButton.classes()).toContain('border')
      expect(tagButton.classes()).toContain('border-blue-300')
    })

    it('applies compact variant classes', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: [{ label: 'test', value: 'value' }],
          variant: 'compact',
          colorScheme: 'gray'
        }
      })

      const tagButton = wrapper.find('button')
      expect(tagButton.classes()).toContain('bg-gray-100')
    })

    it('applies different color schemes', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: [{ label: 'test', value: 'value' }],
          colorScheme: 'green'
        }
      })

      const tagButton = wrapper.find('button')
      expect(tagButton.classes()).toContain('bg-green-600')
    })

    it('applies different sizes', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: [{ label: 'test', value: 'value' }],
          size: 'lg'
        }
      })

      const tagButton = wrapper.find('button')
      expect(tagButton.classes()).toContain('text-base')
      expect(tagButton.classes()).toContain('px-4')
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: [{ label: 'material', value: 'bronze' }]
        }
      })

      const tagButton = wrapper.find('button')
      expect(tagButton.attributes('aria-label')).toContain('Tag: Material: bronze')
      expect(tagButton.attributes('type')).toBe('button')
    })

    it('has proper ARIA attributes for expand button', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: mockTags,
          maxVisible: 3
        }
      })

      const expandButton = wrapper.findAll('button').find(btn => 
        btn.text().includes('more')
      )
      
      if (expandButton) {
        expect(expandButton.attributes('aria-expanded')).toBe('false')
        expect(expandButton.attributes('aria-label')).toContain('Show 3 more tags')
      }
    })

    it('includes screen reader summary', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: mockTags,
          maxVisible: 3
        }
      })

      expect(wrapper.find('.sr-only').exists()).toBe(true)
      expect(wrapper.find('[aria-live="polite"]').exists()).toBe(true)
    })

    it('updates screen reader content when expanded', async () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: mockTags,
          maxVisible: 3
        }
      })

      const expandButton = wrapper.findAll('button').find(btn => 
        btn.text().includes('more')
      )
      
      if (expandButton) {
        await expandButton.trigger('click')
        
        const screenReaderText = wrapper.find('.sr-only').text()
        expect(screenReaderText).toContain('All tags shown')
      }
    })
  })

  describe('Edge Cases', () => {
    it('handles empty tag values gracefully', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: [{ label: 'empty', value: '' }]
        }
      })

      expect(wrapper.text()).toContain('Empty')
      expect(wrapper.find('button').exists()).toBe(true)
    })

    it('handles undefined values in record', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: { test: undefined as any }
        }
      })

      expect(wrapper.text()).toContain('Test undefined')
    })

    it('handles maxVisible being larger than tag count', () => {
      const wrapper = mount(TagBadge, {
        props: {
          tags: mockTags.slice(0, 2),
          maxVisible: 10
        }
      })

      expect(wrapper.text()).not.toContain('more')
      expect(wrapper.findAll('button').length).toBe(2)
    })
  })
})