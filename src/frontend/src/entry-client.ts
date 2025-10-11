import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { createHead } from '@vueuse/head';
import './style.css';

const app = createApp(App as any);
app.use(createPinia());
app.use(router);
const head = createHead();
app.use(head as any);

// Try to apply a saved user theme first (from localStorage).
let applied = false;
try {
  const saved = localStorage.getItem('user-theme');
  if (saved) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { applyThemeByName } = require('./theme/theme');
    applyThemeByName(saved);
    applied = true;
  }
} catch (e) {
  // ignore on SSR or restricted environments
}

if (!applied) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { applyTheme, defaultMaterialTheme } = require('./theme/theme');
  applyTheme(defaultMaterialTheme);
}

app.mount('#app');
