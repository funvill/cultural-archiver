import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import Toasts from '../../src/components/Toasts.vue';
import { useToastsStore } from '../../src/stores/toasts';

describe('Toasts.vue', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  test('renders toast items from store and removes them', async () => {
    // Mount the component with the same Pinia instance used by the test
    const wrapper = mount(Toasts, { global: { plugins: [pinia] } });
    const store = useToastsStore();

    // Initially empty
    expect(wrapper.findAll('[role="alert"]').length).toBe(0);

    // Push a toast with a short timeout so it doesn't linger
    const id = store.pushToast({ type: 'success', message: 'Test toast', timeoutMs: 100 });
    await wrapper.vm.$nextTick();

    // Should render
    const alerts = wrapper.findAll('[role="alert"]');
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(wrapper.text()).toContain('Test toast');

    // Remove programmatically
    store.removeToast(id);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).not.toContain('Test toast');
  });
});
