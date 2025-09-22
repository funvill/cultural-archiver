import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { useNotificationsStore } from '../../stores/notifications';
import type { NotificationResponse } from '../../../../shared/types';

// Minimal mock notification entries
const mockNotifications: NotificationResponse[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Unread One',
    message: 'First unread',
    type: 'system',
    metadata: null,
    created_at: new Date().toISOString(),
    is_dismissed: false,
    user_token: 'user-1',
    type_key: null,
    related_id: null,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    title: 'Read One',
    message: 'Already read',
    type: 'system',
    metadata: null,
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    is_dismissed: true,
    user_token: 'user-1',
    type_key: null,
    related_id: null,
  },
];

import NotificationPanel from '../NotificationPanel.vue';

describe('NotificationPanel', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  it('calls store.markAllRead when header button is clicked', async () => {
    // Use the real Pinia store and populate it with test data, then spy on markAllRead
  const store = useNotificationsStore();
  // replace internal arrays/values via $patch (function overload) so typings are preserved
  store.$patch(state => {
    state.notifications = mockNotifications;
    state.unreadCount = 1;
  });
  const spy = vi.spyOn(store, 'markAllRead').mockResolvedValue({ success: true });

  const wrapper = mount(NotificationPanel, { global: { plugins: [pinia] } });

  // Wait for reactivity to propagate
  await nextTick();

  // Debug output to help diagnose test rendering
  // eslint-disable-next-line no-console
  console.log('NotificationPanel HTML:\n', wrapper.html());

  // Header button should exist (since unreadCount > 0)
  const headerButton = wrapper.find('button[aria-label="Mark all notifications as read"]');
  expect(headerButton.exists()).toBe(true);

  await headerButton.trigger('click');

  expect(spy).toHaveBeenCalled();
  });
});
