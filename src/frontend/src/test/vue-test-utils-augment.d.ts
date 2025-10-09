import { VueWrapper } from '@vue/test-utils';

declare module '@vue/test-utils' {
  // Allow string keys when accessing props in tests without needing to cast repeatedly.
  interface VueWrapper<T = any> {
    props(key?: string): any;
  }
}
