import { useToastsStore } from '../stores/toasts';
import type { BadgePayload } from '../stores/toasts';

export function useToasts(): {
  push: (message: string, type?: 'success' | 'error' | 'info' | 'warning', timeoutMs?: number) => string;
  success: (message: string, timeoutMs?: number) => string;
  error: (message: string, timeoutMs?: number) => string;
  info: (message: string, timeoutMs?: number) => string;
  warning: (message: string, timeoutMs?: number) => string;
  // badge: push a rich badge toast with structured payload
  badge: (badgePayload: BadgePayload, timeoutMs?: number) => string;
  remove: (id: string) => void;
  clear: () => void;
} {
  const store = useToastsStore();

  function push(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', timeoutMs?: number): string {
    return store.pushToast({ type, message, timeoutMs });
  }

  function success(message: string, timeoutMs?: number): string {
    return push(message, 'success', timeoutMs);
  }

  function error(message: string, timeoutMs?: number): string {
    return push(message, 'error', timeoutMs);
  }

  function info(message: string, timeoutMs?: number): string {
    return push(message, 'info', timeoutMs);
  }

  function warning(message: string, timeoutMs?: number): string {
    return push(message, 'warning', timeoutMs);
  }

  function badge(badgePayload: BadgePayload, timeoutMs?: number): string {
    const message = badgePayload?.title || 'You earned a badge!';
    return store.pushToast({ type: 'info', message, timeoutMs, payload: { kind: 'badge', badge: badgePayload } });
  }

  return {
    push,
    success,
    error,
    info,
    warning,
    badge,
    remove: store.removeToast,
    clear: store.clear,
  } as const;
}
