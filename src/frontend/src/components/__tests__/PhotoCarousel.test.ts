import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import PhotoCarousel from '../PhotoCarousel.vue';

// Mock the announcer composable
vi.mock('../../composables/useAnnouncer', () => ({
  useAnnouncer: (): {
    announceInfo: ReturnType<typeof vi.fn>;
    announceError: ReturnType<typeof vi.fn>;
    announceSuccess: ReturnType<typeof vi.fn>;
  } => ({
    announceInfo: vi.fn(),
    announceError: vi.fn(),
    announceSuccess: vi.fn(),
  }),
}));

describe('PhotoCarousel', () => {
  const mockPhotos = [
    'https://example.com/photo1.jpg',
    'https://example.com/photo2.jpg',
    'https://example.com/photo3.jpg',
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders correctly with photos', () => {
      const wrapper = mount(PhotoCarousel, {
        props: {
          photos: mockPhotos,
        },
      });

      expect(wrapper.find('img').exists()).toBe(true);
      expect(wrapper.find('.photo-carousel').exists()).toBe(true);
    });

    it('shows fallback when no photos provided', () => {
      const wrapper = mount(PhotoCarousel, {
        props: {
          photos: [],
        },
      });

      expect(wrapper.text()).toContain('No photos available');
      expect(wrapper.find('img').exists()).toBe(false);
    });

    it('shows navigation controls for multiple photos', () => {
      const wrapper = mount(PhotoCarousel, {
        props: {
          photos: mockPhotos,
        },
      });

      expect(wrapper.findAll('button').length).toBeGreaterThan(0);
      expect(wrapper.text()).toContain('1 / 3');
    });

    it('hides navigation controls for single photo', () => {
      const wrapper = mount(PhotoCarousel, {
        props: {
          photos: [mockPhotos[0]!], // Use non-null assertion since we know it exists
        },
      });

      // Should not show navigation arrows or counter
      expect(wrapper.find('.absolute.inset-0').exists()).toBe(false);
      expect(wrapper.text()).not.toContain('1 / 1');
    });
  });

  describe('Navigation', () => {
    it('emits update:currentIndex when navigation buttons clicked', async () => {
      const wrapper = mount(PhotoCarousel, {
        props: {
          photos: mockPhotos,
          currentIndex: 0,
        },
      });

      const nextButton = wrapper
        .findAll('button')
        .find(btn => btn.attributes('aria-label')?.includes('Next photo'));

      if (nextButton) {
        await nextButton.trigger('click');
        expect(wrapper.emitted('update:currentIndex')).toBeTruthy();
        expect(wrapper.emitted('update:currentIndex')?.[0]).toEqual([1]);
      }
    });

    it('wraps around when navigating past end', async () => {
      const wrapper = mount(PhotoCarousel, {
        props: {
          photos: mockPhotos,
          currentIndex: 2, // Last photo
        },
      });

      const nextButton = wrapper
        .findAll('button')
        .find(btn => btn.attributes('aria-label')?.includes('Next photo'));

      if (nextButton) {
        await nextButton.trigger('click');
        expect(wrapper.emitted('update:currentIndex')?.[0]).toEqual([0]);
      }
    });

    it('wraps around when navigating before beginning', async () => {
      const wrapper = mount(PhotoCarousel, {
        props: {
          photos: mockPhotos,
          currentIndex: 0, // First photo
        },
      });

      const prevButton = wrapper
        .findAll('button')
        .find(btn => btn.attributes('aria-label')?.includes('Previous photo'));

      if (prevButton) {
        await prevButton.trigger('click');
        expect(wrapper.emitted('update:currentIndex')?.[0]).toEqual([2]);
      }
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      const wrapper = mount(PhotoCarousel, {
        props: {
          photos: mockPhotos,
          altTextPrefix: 'Test artwork',
        },
      });

      const mainElement = wrapper.find('[role="img"]');
      expect(mainElement.exists()).toBe(true);
      expect(mainElement.attributes('aria-label')).toContain('Test artwork');
      expect(mainElement.attributes('tabindex')).toBe('0');
    });

    it('includes screen reader navigation help for multiple photos', () => {
      const wrapper = mount(PhotoCarousel, {
        props: {
          photos: mockPhotos,
        },
      });

      expect(wrapper.find('#photo-navigation-help').exists()).toBe(true);
      expect(wrapper.text()).toContain('Use arrow keys to navigate');
    });

    it('has proper alt text for current photo', () => {
      const wrapper = mount(PhotoCarousel, {
        props: {
          photos: mockPhotos,
          currentIndex: 1,
          altTextPrefix: 'Sculpture',
        },
      });

      const img = wrapper.find('img');
      expect(img.attributes('alt')).toBe('Sculpture 2 of 3');
    });
  });

  describe('Fullscreen', () => {
    it('emits fullscreen event when photo is clicked', async () => {
      const wrapper = mount(PhotoCarousel, {
        props: {
          photos: mockPhotos,
        },
      });

      const photoContainer = wrapper.find('[role="img"]');
      await photoContainer.trigger('click');

      expect(wrapper.emitted('fullscreen')).toBeTruthy();
      expect(wrapper.emitted('fullscreen')?.[0]).toEqual([mockPhotos[0]]);
    });
  });

  describe('Dot Indicators', () => {
    it('shows dot indicators for multiple photos', () => {
      const wrapper = mount(PhotoCarousel, {
        props: {
          photos: mockPhotos,
        },
      });

      const dots = wrapper
        .findAll('button')
        .filter(btn => btn.attributes('aria-label')?.includes('Go to photo'));
      expect(dots).toHaveLength(3);
    });

    it('highlights current photo dot', () => {
      const wrapper = mount(PhotoCarousel, {
        props: {
          photos: mockPhotos,
          currentIndex: 1,
        },
      });

      const dots = wrapper
        .findAll('button')
        .filter(btn => btn.attributes('aria-label')?.includes('Go to photo'));

      expect(dots[1]?.attributes('aria-current')).toBe('true');
      expect(dots[0]?.attributes('aria-current')).toBe('false');
    });
  });

  describe('Keyboard Navigation', () => {
    it('navigates to next photo on ArrowRight', async () => {
      const wrapper = mount(PhotoCarousel, {
        props: {
          photos: mockPhotos,
          currentIndex: 0,
        },
      });

      const carousel = wrapper.find('[role="img"]');
      expect(carousel.exists()).toBe(true);

      await carousel.trigger('keydown', { key: 'ArrowRight' });

      expect(wrapper.emitted('update:currentIndex')).toBeTruthy();
      expect(wrapper.emitted('update:currentIndex')?.[0]).toEqual([1]);
    });

    it('navigates to previous photo on ArrowLeft', async () => {
      const wrapper = mount(PhotoCarousel, {
        props: {
          photos: mockPhotos,
          currentIndex: 1,
        },
      });

      const carousel = wrapper.find('[role="img"]');
      await carousel.trigger('keydown', { key: 'ArrowLeft' });

      expect(wrapper.emitted('update:currentIndex')).toBeTruthy();
      expect(wrapper.emitted('update:currentIndex')?.[0]).toEqual([0]);
    });

    it('jumps to first photo on Home key', async () => {
      const wrapper = mount(PhotoCarousel, {
        props: {
          photos: mockPhotos,
          currentIndex: 2,
        },
      });

      const carousel = wrapper.find('[role="img"]');
      await carousel.trigger('keydown', { key: 'Home' });

      expect(wrapper.emitted('update:currentIndex')?.[0]).toEqual([0]);
    });

    it('jumps to last photo on End key', async () => {
      const wrapper = mount(PhotoCarousel, {
        props: {
          photos: mockPhotos,
          currentIndex: 0,
        },
      });

      const carousel = wrapper.find('[role="img"]');
      await carousel.trigger('keydown', { key: 'End' });

      expect(wrapper.emitted('update:currentIndex')?.[0]).toEqual([2]);
    });

    it('opens fullscreen on Enter key', async () => {
      const wrapper = mount(PhotoCarousel, {
        props: {
          photos: mockPhotos,
          currentIndex: 0,
        },
      });

      const carousel = wrapper.find('[role="img"]');
      await carousel.trigger('keydown', { key: 'Enter' });

      expect(wrapper.emitted('fullscreen')).toBeTruthy();
      expect(wrapper.emitted('fullscreen')?.[0]).toEqual([mockPhotos[0]]);
    });
  });

  describe('License Display', () => {
    it('shows CC0 license by default', () => {
      const wrapper = mount(PhotoCarousel, {
        props: {
          photos: mockPhotos,
        },
      });

      expect(wrapper.text()).toContain('CC0');
    });

    it('hides license when showLicenseInfo is false', () => {
      const wrapper = mount(PhotoCarousel, {
        props: {
          photos: mockPhotos,
          showLicenseInfo: false,
        },
      });

      expect(wrapper.text()).not.toContain('CC0');
    });
  });
});
