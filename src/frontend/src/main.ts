import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './style.css';

// Create app
const app = createApp(App);

// Install plugins
app.use(createPinia());
app.use(router);

// Mount app
app.mount('#app');
