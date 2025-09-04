/**
 * Tests for ArtworkCard component
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ArtworkCard from '../ArtworkCard.vue'
import type { SearchResult } from '../../types'

describe('ArtworkCard', () => {
  const mockArtwork: SearchResult = {
    id: 'test-artwork-1',
    lat: 49.2827,
    lon: -123.1207,
    type_name: 'street_art',
    tags: {
      title: 'Beautiful Mural',
      artist: 'Test Artist',
      material: 'Paint',
      year: '2023'
    },
    recent_photo: 'https://example.com/photo.jpg',
    photo_count: 3,
    distance_km: 0.5
  }

  it('should render artwork information correctly', () => {
    const wrapper = mount(ArtworkCard, {
      props: {
        artwork: mockArtwork
      }
    })

    expect(wrapper.text()).toContain('Beautiful Mural')
    expect(wrapper.text()).toContain('Street Art')
    expect(wrapper.text()).toContain('Test Artist')
    expect(wrapper.text()).toContain('Paint')
    expect(wrapper.text()).toContain('2023')
  })

  it('should show photo when recent_photo is available', () => {
    const wrapper = mount(ArtworkCard, {
      props: {
        artwork: mockArtwork
      }
    })

    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe(mockArtwork.recent_photo)
    expect(img.attributes('alt')).toContain('Beautiful Mural')
  })

  it('should show placeholder when no photo is available', () => {
    const artworkWithoutPhoto: SearchResult = {
      ...mockArtwork,
      recent_photo: undefined
    }

    const wrapper = mount(ArtworkCard, {
      props: {
        artwork: artworkWithoutPhoto
      }
    })

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('should display distance when showDistance is true', () => {
    const wrapper = mount(ArtworkCard, {
      props: {
        artwork: mockArtwork,
        showDistance: true
      }
    })

    expect(wrapper.text()).toContain('500m away') // 0.5km = 500m in the component logic
  })

  it('should display distance in meters when less than 1km', () => {
    const artworkNearby: SearchResult = {
      ...mockArtwork,
      distance_km: 0.3
    }

    const wrapper = mount(ArtworkCard, {
      props: {
        artwork: artworkNearby,
        showDistance: true
      }
    })

    expect(wrapper.text()).toContain('300m away')
  })

  it('should show photo count correctly', () => {
    const wrapper = mount(ArtworkCard, {
      props: {
        artwork: mockArtwork,
        compact: true // Use compact mode to see photo count in text
      }
    })

    expect(wrapper.text()).toContain('3 photos')
  })

  it('should show "1 photo" for single photo', () => {
    const artworkOnePhoto: SearchResult = {
      ...mockArtwork,
      photo_count: 1
    }

    const wrapper = mount(ArtworkCard, {
      props: {
        artwork: artworkOnePhoto,
        compact: true // Use compact mode to see photo count in text
      }
    })

    expect(wrapper.text()).toContain('1 photo')
  })

  it('should show "No photos" when photo_count is 0', () => {
    const artworkNoPhotos: SearchResult = {
      ...mockArtwork,
      photo_count: 0
    }

    const wrapper = mount(ArtworkCard, {
      props: {
        artwork: artworkNoPhotos,
        compact: true // Use compact mode to see photo count in text
      }
    })

    expect(wrapper.text()).toContain('No photos')
  })

  it('should render in compact mode', () => {
    const wrapper = mount(ArtworkCard, {
      props: {
        artwork: mockArtwork,
        compact: true
      }
    })

    expect(wrapper.find('.h-32').exists()).toBe(true)
    expect(wrapper.find('.flex').exists()).toBe(true)
  })

  it('should emit click event when clicked', async () => {
    const wrapper = mount(ArtworkCard, {
      props: {
        artwork: mockArtwork,
        clickable: true
      }
    })

    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toEqual([[mockArtwork]])
  })

  it('should handle keyboard navigation', async () => {
    const wrapper = mount(ArtworkCard, {
      props: {
        artwork: mockArtwork,
        clickable: true
      }
    })

    await wrapper.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('click')).toEqual([[mockArtwork]])

    await wrapper.trigger('keydown', { key: ' ' })
    expect(wrapper.emitted('click')).toHaveLength(2)
  })

  it('should not emit click when not clickable', async () => {
    const wrapper = mount(ArtworkCard, {
      props: {
        artwork: mockArtwork,
        clickable: false
      }
    })

    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeFalsy()
  })

  it('should not emit click when loading', async () => {
    const wrapper = mount(ArtworkCard, {
      props: {
        artwork: mockArtwork,
        loading: true
      }
    })

    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeFalsy()
  })

  it('should show loading overlay when loading', () => {
    const wrapper = mount(ArtworkCard, {
      props: {
        artwork: mockArtwork,
        loading: true
      }
    })

    expect(wrapper.find('.animate-spin').exists()).toBe(true)
    expect(wrapper.find('.opacity-50').exists()).toBe(true)
  })

  it('should fallback to type name when no title in tags', () => {
    const artworkNoTitle: SearchResult = {
      ...mockArtwork,
      tags: {
        artist: 'Test Artist'
      }
    }

    const wrapper = mount(ArtworkCard, {
      props: {
        artwork: artworkNoTitle
      }
    })

    expect(wrapper.text()).toContain('Street Art')
  })

  it('should handle null tags gracefully', () => {
    const artworkNullTags: SearchResult = {
      ...mockArtwork,
      tags: null
    }

    const wrapper = mount(ArtworkCard, {
      props: {
        artwork: artworkNullTags
      }
    })

    expect(wrapper.text()).toContain('Street Art')
    expect(wrapper.text()).not.toContain('Test Artist')
  })

  it('should emit imageLoad and imageError events', async () => {
    const wrapper = mount(ArtworkCard, {
      props: {
        artwork: mockArtwork
      }
    })

    const img = wrapper.find('img')
    
    await img.trigger('load')
    expect(wrapper.emitted('imageLoad')).toHaveLength(1)

    await img.trigger('error')
    expect(wrapper.emitted('imageError')).toHaveLength(1)
  })

  it('should have proper accessibility attributes', () => {
    const wrapper = mount(ArtworkCard, {
      props: {
        artwork: mockArtwork
      }
    })

    const article = wrapper.find('article')
    expect(article.attributes('role')).toBe('button')
    expect(article.attributes('aria-label')).toContain('Beautiful Mural')
    expect(article.attributes('tabindex')).toBe('0')
  })

  it('should show photo count badge for multiple photos', () => {
    const wrapper = mount(ArtworkCard, {
      props: {
        artwork: mockArtwork
      }
    })

    expect(wrapper.find('.absolute.top-2.right-2').text()).toContain('3 photos')
  })

  it('should not show photo count badge for single photo', () => {
    const artworkOnePhoto: SearchResult = {
      ...mockArtwork,
      photo_count: 1
    }

    const wrapper = mount(ArtworkCard, {
      props: {
        artwork: artworkOnePhoto
      }
    })

    expect(wrapper.find('.absolute.top-2.right-2').exists()).toBe(false)
  })
})