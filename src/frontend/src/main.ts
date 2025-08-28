import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import './style.css';

// Import views
import HomeView from './views/HomeView.vue';

// Router configuration
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: HomeView,
    },
    // Additional routes will be added here
  ],
});

// Create app
const app = createApp(App);

// Install plugins
app.use(createPinia());
app.use(router);

// Mount app
app.mount('#app');
