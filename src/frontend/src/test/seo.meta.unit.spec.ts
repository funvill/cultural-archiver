import { describe, it, expect, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';

// Mock @vueuse/head's useHead to intercept calls from useRouteMeta
vi.mock('@vueuse/head', () => ({
  useHead: vi.fn(),
}));

import { useHead } from '@vueuse/head';
import { useRouteMeta } from '@/lib/meta';

describe('SEO unit tests', () => {
  it('calls useHead with expected title and description', () => {
  // Ensure mock is clean
  (useHead as any).mockClear();
    const TestComp = defineComponent({
      setup() {
        useRouteMeta({
          title: 'Test Title',
          description: 'Test description for unit test',
          canonical: 'https://publicartregistry.com/test',
        } as any);
        return () => null;
      },
    });

    mount(TestComp);

  expect((useHead as any).mock.calls.length).toBeGreaterThan(0);
  const firstArg = (useHead as any).mock.calls[0][0];
  expect(firstArg.title).toBe('Test Title');
  const meta = firstArg.meta as Array<any>;
  const desc = meta.find((m: any) => m.name === 'description');
  expect(desc).toBeDefined();
  expect(desc.content).toContain('Test description for unit test');
  });
});
