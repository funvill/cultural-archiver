import { mount } from '@vue/test-utils';
import ArtistLookup from '../ArtistLookup.vue';
import { describe, it, expect, beforeEach, vi } from 'vitest';

type Artist = { id: string; name: string; description_short?: string };

describe('ArtistLookup.vue', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders initial selected artists', () => {
    const wrapper = mount(ArtistLookup, { props: { modelValue: [{ id: 'a1', name: 'Artist 1' }] } });
    expect(wrapper.text()).toContain('Artist 1');
  });

  it('fetches and displays results after debounce', async () => {
    const fakeResults: Artist[] = [
      { id: 'a2', name: 'Search Result' },
    ];

    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(fakeResults) }));
    vi.stubGlobal('fetch', fetchMock as any);

    const wrapper = mount(ArtistLookup);
    const input = wrapper.find('input');
    await input.setValue('sea');

    // wait longer than debounce (300ms)
    await new Promise((r) => setTimeout(r, 350));
    await wrapper.vm.$nextTick();

    expect(fetchMock).toHaveBeenCalled();
    expect(wrapper.html()).toContain('Search Result');
  });

  it('selects an artist and emits update:modelValue', async () => {
    const fakeResults: Artist[] = [
      { id: 'a3', name: 'To Select' },
    ];

    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(fakeResults) }));
    vi.stubGlobal('fetch', fetchMock as any);

    const wrapper = mount(ArtistLookup);
    const input = wrapper.find('input');
    await input.setValue('sel');
    await new Promise((r) => setTimeout(r, 350));
    await wrapper.vm.$nextTick();

    const item = wrapper.find('ul li');
    await item.trigger('mousedown');

    // emitted update
    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toBeTruthy();
    const val = emitted![0][0];
    expect(Array.isArray(val) && val[0].name === 'To Select').toBe(true);
  });

  it('removes a selected artist when remove button clicked', async () => {
    const wrapper = mount(ArtistLookup, { props: { modelValue: [{ id: 'a1', name: 'Artist 1' }] } });
    const btn = wrapper.find('button[aria-label="Remove artist"]');
    await btn.trigger('click');

    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toBeTruthy();
    const val = emitted![0][0];
    expect(Array.isArray(val) && val.length === 0).toBe(true);
  });
});
