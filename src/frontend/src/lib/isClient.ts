// Small runtime helpers to detect client/browser environment
export const isClient = typeof window !== 'undefined' && typeof document !== 'undefined';

export function canUseLocalStorage(): boolean {
  try {
    return isClient && typeof window.localStorage !== 'undefined';
  } catch (e) {
    return false;
  }
}

export function canUseBroadcastChannel(): boolean {
  try {
    return isClient && 'BroadcastChannel' in globalThis;
  } catch (e) {
    return false;
  }
}
