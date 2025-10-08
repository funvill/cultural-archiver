import { setActivePinia, createPinia } from 'pinia';
import { useToastsStore } from '../../src/stores/toasts';

describe('toasts store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test('pushToast adds an item and returns id', () => {
    const s = useToastsStore();
    expect(s.toasts.length).toBe(0);
    const id = s.pushToast({ type: 'success', message: 'ok', timeoutMs: 0 });
    expect(typeof id).toBe('string');
    expect(s.toasts.length).toBe(1);
    expect(s.toasts[0].id).toBe(id);
    expect(s.toasts[0].message).toBe('ok');
  });

  test('removeToast removes item', () => {
    const s = useToastsStore();
    const id = s.pushToast({ type: 'info', message: 'hello', timeoutMs: 0 });
    expect(s.toasts.find(t => t.id === id)).toBeTruthy();
    s.removeToast(id);
    expect(s.toasts.find(t => t.id === id)).toBeUndefined();
  });

  test('clear empties the list', () => {
    const s = useToastsStore();
    s.pushToast({ type: 'warning', message: '1', timeoutMs: 0 });
    s.pushToast({ type: 'error', message: '2', timeoutMs: 0 });
    expect(s.toasts.length).toBe(2);
    s.clear();
    expect(s.toasts.length).toBe(0);
  });
});
