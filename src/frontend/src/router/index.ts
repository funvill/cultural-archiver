import { createRouter, createWebHistory } from 'vue-router';
import type { Component } from 'vue';
import { useAuthStore } from '../stores/auth';

// Lazy load components for better performance
const HomeView = (): Promise<Component> => import('../views/HomeView.vue');
const HelpView = (): Promise<Component> => import('../views/HelpView.vue');
const StatusView = (): Promise<Component> => import('../views/StatusView.vue');
const MapView = (): Promise<Component> => import('../views/MapView.vue');
const SubmitView = (): Promise<Component> => import('../views/SubmitView.vue');
const ArtworkDetailView = (): Promise<Component> => import('../views/ArtworkDetailView.vue');
const ArtworkIndexView = (): Promise<Component> => import('../views/ArtworkIndexView.vue');
const ArtistIndexView = (): Promise<Component> => import('../views/ArtistIndexView.vue');
const ProfileView = (): Promise<Component> => import('../views/ProfileView.vue');
const ReviewView = (): Promise<Component> => import('../views/ReviewView.vue');
const AdminView = (): Promise<Component> => import('../views/AdminView.vue');
const VerifyView = (): Promise<Component> => import('../views/VerifyView.vue');
const SearchView = (): Promise<Component> => import('../views/SearchView.vue');
const FastPhotoUploadView = (): Promise<Component> => import('../views/FastPhotoUploadView.vue');

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
      path: '/add',
      name: 'FastPhotoUpload',
      component: FastPhotoUploadView,
      meta: {
        title: 'Add Artwork - Cultural Archiver',
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
      path: '/artworks',
      name: 'ArtworkIndex',
      component: ArtworkIndexView,
      meta: {
        title: 'Artworks - Cultural Archiver',
      },
    },
    {
      path: '/artists',
      name: 'ArtistIndex',
      component: ArtistIndexView,
      meta: {
        title: 'Artists - Cultural Archiver',
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
      path: '/artwork/new',
      name: 'NewArtwork',
      component: (): Promise<Component> => import('../views/NewArtworkView.vue'),
      meta: {
        title: 'New Artwork - Cultural Archiver',
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
      path: '/artist/:id',
      name: 'ArtistDetail',
      component: (): Promise<Component> => import('../views/ArtistDetailView.vue'),
      props: true,
      meta: {
        title: 'Artist Profile - Cultural Archiver',
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
      path: '/terms',
      name: 'Terms',
      component: (): Promise<Component> => import('../views/TermsView.vue'),
      meta: {
        title: 'Terms of Service - Cultural Archiver',
      },
    },
    {
      path: '/privacy',
      name: 'Privacy',
      component: (): Promise<Component> => import('../views/PrivacyView.vue'),
      meta: {
        title: 'Privacy Policy - Cultural Archiver',
      },
    },
    {
      path: '/review',
      name: 'Review',
      component: ReviewView,
      meta: {
        title: 'Review Queue - Cultural Archiver',
        requiresModerator: true,
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
    {
      path: '/status',
      name: 'Status',
      component: StatusView,
      meta: {
        title: 'System Status - Cultural Archiver',
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
    requiresModerator: to.meta.requiresModerator,
    isAuthenticated: authStore.isAuthenticated,
    canReview: authStore.canReview,
    isModerator: authStore.isModerator,
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

  // Check if route requires moderator permissions
  if (to.meta.requiresModerator && !authStore.canReview) {
    console.log('Moderator access required for this route');
    next({
      path: '/',
      query: {
        error: 'moderator_required',
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
