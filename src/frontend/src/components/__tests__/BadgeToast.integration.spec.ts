import { describe, test, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import Toasts from '../Toasts.vue';
import BadgeToast from '../BadgeToast.vue';
import { useToasts } from '../../composables/useToasts';
import { nextTick } from 'vue';

describe('Badge toast integration', () => {
  test('pushing a badge via useToasts renders BadgeToast', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(Toasts, {
      global: {
        plugins: [pinia],
      },
    });

    const { badge } = useToasts();

    // Push badge with timeout 0 so it doesn't auto-dismiss during the test
    badge({ badge_id: 'test-b1', title: 'Test Badge', description: 'Integration test', icon_emoji: '🏅' }, 0);

    await nextTick();

    expect(wrapper.findComponent(BadgeToast).exists()).toBe(true);
  });
});
