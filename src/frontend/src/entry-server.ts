import { createSSRApp } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { createPinia } from 'pinia';
import { createHead } from '@vueuse/head';

import App from './App.vue';
import routes from './router';

export async function createAppFactory(url: string) {
  const app = createSSRApp(App as any);
  const pinia = createPinia();
  app.use(pinia);

  const router = createRouter({
    history: createMemoryHistory(),
    routes: (routes as any).options?.routes || (routes as any),
  });
  app.use(router);

  const head = createHead();
  app.use(head as any);

  await router.push(url);
  await router.isReady();

  return { app, router, head } as const;
}
