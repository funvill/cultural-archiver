// Provide lightweight typings for Vue SFC compile-time macros used in <script setup>
// This avoids needing // @ts-ignore in individual components and keeps editor/typecheck noise down.
declare global {
  // defineProps returns the typed props object when used in <script setup>
  // Example: const props = withDefaults(defineProps<MyProps>(), { ... })
  function defineProps<Props = unknown>(): Props;

  // defineEmits returns an emit function typed to the given event signature or string array
  // Overloads: either a typed emitter function or an array of event names
  function defineEmits<T extends Record<string, (...args: unknown[]) => void>>(emits?: T): (...args: unknown[]) => void;
  function defineEmits(emits?: string[]): (event: string, ...args: unknown[]) => void;

  // defineExpose allows exposing functions/refs from <script setup>
  function defineExpose<T = Record<string, unknown>>(exposed?: T): void;
}

export {};
