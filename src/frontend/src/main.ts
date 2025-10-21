import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createHead } from '@vueuse/head';
import { clerkPlugin } from '@clerk/vue';
import App from './App.vue';
import router from './router';
import './style.css';
import { applyTheme, defaultMaterialTheme, applyThemeByName } from './theme/theme';

// Create app
const app = createApp(App);

// Install plugins
app.use(createPinia());
app.use(router);
// Head manager for dynamic meta tags
const head = createHead();
app.use(head);

// Configure Clerk
const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
console.log('[MAIN DEBUG] Clerk configuration', {
  hasClerkKey: !!clerkPublishableKey,
  keyLength: clerkPublishableKey?.length || 0,
  environment: import.meta.env.MODE,
  allEnvKeys: Object.keys(import.meta.env).filter(key => key.includes('CLERK'))
});

if (clerkPublishableKey) {
  console.log('[MAIN DEBUG] Installing Clerk plugin');
  app.use(clerkPlugin, {
    publishableKey: clerkPublishableKey,
  });
  console.log('[MAIN DEBUG] Clerk plugin installed successfully');
} else {
  console.error('[MAIN DEBUG] No Clerk publishable key found - authentication will not work');
}

// Try to apply a saved user theme first (from localStorage). This avoids a
// brief flash of the default theme when a user has previously selected one.
let applied = false;
try {
	const saved = localStorage.getItem('user-theme');
	if (saved) {
		applyThemeByName(saved);
		applied = true;
	}
} catch (e) {
	// ignore on SSR or restricted environments
}

// Fall back to the default Material theme if nothing was applied above
if (!applied) {
	applyTheme(defaultMaterialTheme);
}

// Mount app
app.mount('#app');
