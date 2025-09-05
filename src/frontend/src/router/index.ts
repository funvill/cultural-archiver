import { createRouter, createWebHistory } from 'vue-router';
import type { Component } from 'vue';
import { useAuthStore } from '../stores/auth';

// Lazy load components for better performance
const HomeView = (): Promise<Component> => import('../views/HomeView.vue');
const HelpView = (): Promise<Component> => import('../views/HelpView.vue');
const MapView = (): Promise<Component> => import('../views/MapView.vue');
const SubmitView = (): Promise<Component> => import('../views/SubmitView.vue');
const ArtworkDetailView = (): Promise<Component> => import('../views/ArtworkDetailView.vue');
const ProfileView = (): Promise<Component> => import('../views/ProfileView.vue');
const ReviewView = (): Promise<Component> => import('../views/ReviewView.vue');
const AdminView = (): Promise<Component> => import('../views/AdminView.vue');
const VerifyView = (): Promise<Component> => import('../views/VerifyView.vue');
const SearchView = (): Promise<Component> => import('../views/SearchView.vue');

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Map',
      component: MapView,
      meta: {
        title: 'Cultural Archiver - Discover Public Art',
      },
    },
    {
      path: '/home',
      name: 'Home',
      component: HomeView,
      meta: {
        title: 'Cultural Archiver - About',
      },
    },
    {
      path: '/submit',
      name: 'Submit',
      component: SubmitView,
      meta: {
        title: 'Submit Artwork - Cultural Archiver',
      },
    },
    {
      path: '/search/:query?',
      name: 'Search',
      component: SearchView,
      props: true,
      meta: {
        title: 'Search Artworks - Cultural Archiver',
      },
    },
    {
      path: '/artwork/:id',
      name: 'ArtworkDetail',
      component: ArtworkDetailView,
      props: true,
      meta: {
        title: 'Artwork Details - Cultural Archiver',
      },
    },
    {
      path: '/profile',
      name: 'Profile',
      component: ProfileView,
      meta: {
        title: 'My Submissions - Cultural Archiver',
      },
    },
    {
      path: '/verify',
      name: 'Verify',
      component: VerifyView,
      meta: {
        title: 'Email Verification - Cultural Archiver',
      },
    },
    {
      path: '/review',
      name: 'Review',
      component: ReviewView,
      meta: {
        title: 'Review Queue - Cultural Archiver',
        requiresReviewer: true,
      },
    },
    {
      path: '/admin',
      name: 'Admin',
      component: AdminView,
      meta: {
        title: 'Admin Dashboard - Cultural Archiver',
        requiresAdmin: true,
      },
    },
    {
      path: '/help',
      name: 'Help',
      component: HelpView,
      meta: {
        title: 'Help - Cultural Archiver',
      },
    },
    // Redirect old paths for compatibility
    {
      path: '/home',
      redirect: '/',
    },
  ],
});

// Set page titles and handle authentication/reviewer permissions
router.beforeEach(async (to, _from, next) => {
  // Set page title
  if (to.meta.title) {
    document.title = to.meta.title as string;
  }

  // Get auth store - ensure it's initialized
  const authStore = useAuthStore();

  // Wait for auth initialization if needed
  if (!authStore.user && !authStore.isLoading) {
    try {
      await authStore.initializeAuth();
    } catch (error) {
      console.error('Failed to initialize auth in router guard:', error);
    }
  }

  // Wait for loading to complete
  while (authStore.isLoading) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log('[ROUTER DEBUG] Route guard check:', {
    route: to.path,
    requiresReviewer: to.meta.requiresReviewer,
    isAuthenticated: authStore.isAuthenticated,
    isReviewer: authStore.isReviewer,
    isAdmin: authStore.isAdmin,
    hasUser: !!authStore.user,
    permissions: authStore.permissions,
    loading: authStore.isLoading,
  });

  // Check if route requires authentication
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    // Redirect to home with query parameter indicating login needed
    next({
      path: '/',
      query: {
        login: 'required',
        redirect: to.fullPath,
      },
    });
    return;
  }

  // Check if route requires reviewer permissions
  if (to.meta.requiresReviewer && !authStore.isReviewer) {
    console.log('Reviewer access required for this route');
    // Redirect to home page for non-reviewers
    next({
      path: '/',
      query: {
        error: 'reviewer_required',
      },
    });
    return;
  }

  // Check if route requires admin permissions
  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    // Redirect to home page for non-admins
    next({
      path: '/',
      query: {
        error: 'admin_required',
      },
    });
    return;
  }

  // Allow navigation
  next();
});

export default router;
