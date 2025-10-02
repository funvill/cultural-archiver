import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './style.css';
import { applyTheme, defaultMaterialTheme, applyThemeByName } from './theme/theme';

// Create app
const app = createApp(App);

// Install plugins
app.use(createPinia());
app.use(router);

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
