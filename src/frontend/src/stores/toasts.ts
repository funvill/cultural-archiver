import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface BadgePayload {
  badge_id: string;
  badge_key?: string;
  title?: string;
  description?: string;
  icon_emoji?: string;
  award_reason?: string;
}

export type ToastPayload = { kind: 'badge'; badge: BadgePayload } | null;

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  timeoutMs?: number | undefined;
  // Discriminated payload for structured toast types (currently only 'badge')
  payload?: ToastPayload;
}

export const useToastsStore = defineStore('toasts', () => {
  const toasts = ref<ToastItem[]>([]);

  function pushToast(toast: { type: ToastType; message: string; timeoutMs?: number | undefined; payload?: ToastPayload }): string {
    const id = Math.random().toString(36).slice(2, 9);
    const item: ToastItem = { id, type: toast.type, message: toast.message, timeoutMs: toast.timeoutMs, payload: toast.payload ?? null } as ToastItem;
    toasts.value.push(item);

    const ms = toast.timeoutMs ?? 4000;
    if (ms > 0) {
      setTimeout(() => removeToast(id), ms);
    }
    return id;
  }

  function removeToast(id: string): void {
    const idx = toasts.value.findIndex(t => t.id === id);
    if (idx !== -1) toasts.value.splice(idx, 1);
  }

  function clear(): void {
    toasts.value = [];
  }

  return { toasts, pushToast, removeToast, clear };
});
