import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';

// Mock the head manager so tests don't rely on a running server or DOM timing
vi.mock('@vueuse/head', () => ({ useHead: vi.fn() }));
import { useHead } from '@vueuse/head';

import HomeView from '@/frontend/src/views/HomeView.vue';
import MapView from '@/frontend/src/views/MapView.vue';
import ArtworkDetailView from '@/frontend/src/views/ArtworkDetailView.vue';
import { createArtworkSchema } from '@/lib/meta';

describe('SEO unit tests (no server)', () => {
  it('home view calls useHead with expected metadata', () => {
    (useHead as any).mockClear();
    // Mount a minimal wrapper that renders HomeView setup
    const wrapper = mount(HomeView as any, { global: { stubs: ['router-link'] } });
    expect((useHead as any).mock.calls.length).toBeGreaterThan(0);
    const first = (useHead as any).mock.calls[0][0];
    expect(first.title).toContain('Public Art Registry');
    const meta = first.meta as Array<any>;
    const desc = meta.find((m: any) => m.name === 'description');
    expect(desc).toBeDefined();
    expect(desc.content).toContain('crowdsourced');
    wrapper.unmount();
  });

  it('map view calls useHead with expected metadata', () => {
    (useHead as any).mockClear();
    const wrapper = mount(MapView as any, { global: { stubs: ['MapComponent', 'router-link'] } });
    expect((useHead as any).mock.calls.length).toBeGreaterThan(0);
    const first = (useHead as any).mock.calls[0][0];
    expect(first.title).toContain('Interactive Public Art Map');
    wrapper.unmount();
  });

  it('artwork schema helper produces VisualArtwork JSON-LD', () => {
    const schema = createArtworkSchema({
      id: 'test-123',
      title: 'Test Artwork',
      artistName: 'Jane Doe',
      artistUrl: 'https://publicartregistry.com/artist/jane',
      images: ['https://r2.example.com/img1.jpg'],
      lat: 49.28,
      lon: -123.12,
      city: 'Vancouver',
      tags: ['mural', 'public art'],
      description: 'A test mural',
    });

    expect(schema['@type']).toBe('VisualArtwork');
    expect(schema.url).toContain('/artwork/test-123');
    expect(schema.creator).toBeDefined();
    expect((schema.creator as any).name).toBe('Jane Doe');
  });
});
