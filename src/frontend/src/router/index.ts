import { createRouter, createWebHistory } from 'vue-router';
import type { Component } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useAnalytics } from '../composables/useAnalytics';

// Lazy load components for better performance
const HomeView = (): Promise<Component> => import('../views/HomeView.vue');
const HelpView = (): Promise<Component> => import('../views/HelpView.vue');
const StatusView = (): Promise<Component> => import('../views/StatusView.vue');
const MapView = (): Promise<Component> => import('../views/MapView.vue');
const ArtworkDetailView = (): Promise<Component> => import('../views/ArtworkDetailView.vue');
const ArtworkEditView = (): Promise<Component> => import('../views/ArtworkEditView.vue');
const ArtworkIndexView = (): Promise<Component> => import('../views/ArtworkIndexView.vue');
const ArtistIndexView = (): Promise<Component> => import('../views/ArtistIndexView.vue');
const ProfileView = (): Promise<Component> => import('../views/ProfileView.vue');
const ProfileNotificationsView = (): Promise<Component> =>
  import('../views/ProfileNotificationsView.vue');
const ReviewView = (): Promise<Component> => import('../views/ReviewView.vue');
const ModeratorFeedbackView = (): Promise<Component> =>
  import('../views/ModeratorFeedbackView.vue');
const AdminView = (): Promise<Component> => import('../views/AdminView.vue');
const VerifyView = (): Promise<Component> => import('../views/VerifyView.vue');
const SearchView = (): Promise<Component> => import('../views/SearchView.vue');
const SearchResultsView = (): Promise<Component> => import('../views/SearchResultsView.vue');
const FastPhotoUploadView = (): Promise<Component> => import('../views/FastPhotoUploadView.vue');
const LogbookSubmissionView = (): Promise<Component> =>
  import('../views/LogbookSubmissionView.vue');
const PublicProfileView = (): Promise<Component> => import('../views/PublicProfileView.vue');
const ListView = (): Promise<Component> => import('../views/ListView.vue');
const PageListView = (): Promise<Component> => import('../views/PageListView.vue');
const PageDetailView = (): Promise<Component> => import('../views/PageDetailView.vue');
const NotFoundView = (): Promise<Component> => import('../views/NotFoundView.vue');

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Map',
      component: MapView,
      meta: {
        title: 'Public Art Registry - Discover Public Art',
      },
    },
    {
      path: '/home',
      name: 'Home',
      component: HomeView,
      meta: {
        title: 'Public Art Registry - About',
      },
    },
    {
      path: '/add',
      name: 'FastPhotoUpload',
      component: FastPhotoUploadView,
      meta: {
        title: 'Add Artwork - Public Art Registry',
      },
    },
    // /submit route removed: use /add for new artwork fast-photo submissions
    {
      path: '/artworks',
      name: 'ArtworkIndex',
      component: ArtworkIndexView,
      meta: {
        title: 'Artworks - Public Art Registry',
      },
    },
    {
      path: '/artists',
      name: 'ArtistIndex',
      component: ArtistIndexView,
      meta: {
        title: 'Artists - Public Art Registry',
      },
    },
    {
      path: '/search/:query?',
      name: 'Search',
      component: SearchView,
      props: true,
      meta: {
        title: 'Search Artworks - Public Art Registry',
      },
    },
    {
      path: '/search/results',
      name: 'SearchResults',
      component: SearchResultsView,
      meta: {
        title: 'Search Results - Public Art Registry',
      },
    },
    {
      path: '/artwork/new',
      name: 'NewArtwork',
      component: (): Promise<Component> => import('../views/NewArtworkView.vue'),
      meta: {
        title: 'New Artwork - Public Art Registry',
      },
    },
    {
      path: '/artwork/:id',
      name: 'ArtworkDetail',
      component: ArtworkDetailView,
      props: true,
      meta: {
        title: 'Artwork Details - Public Art Registry',
      },
    },
    {
      path: '/artwork/:id/edit',
      name: 'ArtworkEdit',
      component: ArtworkEditView,
      props: true,
      meta: {
        title: 'Edit Artwork - Public Art Registry',
        requiresAuth: true,
      },
    },
    {
      path: '/logbook/:artworkId',
      name: 'LogbookSubmission',
      component: LogbookSubmissionView,
      props: true,
      meta: {
        title: 'Log a Visit - Public Art Registry',
      },
    },
    {
      path: '/lists/:id',
      name: 'ListView',
      component: ListView,
      props: true,
      meta: {
        title: 'List - Public Art Registry',
      },
    },
    {
      path: '/artist/:id',
      name: 'ArtistDetail',
      component: (): Promise<Component> => import('../views/ArtistDetailView.vue'),
      props: true,
      meta: {
        title: 'Artist Profile - Public Art Registry',
      },
    },
    {
      path: '/profile',
      name: 'Profile',
      component: ProfileView,
      meta: {
        title: 'My Submissions - Public Art Registry',
      },
    },
    {
      path: '/profile/notifications',
      name: 'ProfileNotifications',
      component: ProfileNotificationsView,
      meta: {
        title: 'Notifications - Public Art Registry',
      },
    },
    {
      path: '/users/:uuid',
      name: 'PublicProfile',
      component: PublicProfileView,
      meta: {
        title: 'User Profile - Public Art Registry',
      },
    },
    {
      path: '/verify',
      name: 'Verify',
      component: VerifyView,
      meta: {
        title: 'Email Verification - Public Art Registry',
      },
    },
    {
      path: '/terms',
      redirect: '/pages/terms-of-service',
    },
    {
      path: '/privacy',
      redirect: '/pages/privacy-policy',
    },
    {
      path: '/docs/terms-of-service',
      redirect: '/pages/terms-of-service',
    },
    {
      path: '/docs/privacy-policy',
      redirect: '/pages/privacy-policy',
    },
    {
      path: '/review',
      name: 'Review',
      component: ReviewView,
      meta: {
        title: 'Review Queue - Public Art Registry',
        requiresModerator: true,
      },
    },
    {
      path: '/moderation/feedback',
      name: 'ModeratorFeedback',
      component: ModeratorFeedbackView,
      meta: {
        title: 'Feedback Moderation - Public Art Registry',
        requiresModerator: true,
      },
    },
    {
      path: '/admin',
      name: 'Admin',
      component: AdminView,
      meta: {
        title: 'Admin Dashboard - Public Art Registry',
        requiresAdmin: true,
      },
    },
    {
      path: '/help',
      name: 'Help',
      component: HelpView,
      meta: {
        title: 'Help - Public Art Registry',
      },
    },
    {
      path: '/status',
      name: 'Status',
      component: StatusView,
      meta: {
        title: 'System Status - Public Art Registry',
      },
    },
    {
      path: '/pages',
      name: 'PageList',
      component: PageListView,
      meta: {
        title: 'Pages - Public Art Registry',
      },
    },
    {
      path: '/pages/:slug',
      name: 'PageDetail',
      component: PageDetailView,
      meta: {
        title: 'Page - Public Art Registry',
      },
    },
    // Redirect old paths for compatibility
    {
      path: '/home',
      redirect: '/',
    },
    // Catch-all 404 route - MUST be last
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      component: NotFoundView,
      meta: {
        title: '404 - Page Not Found - Public Art Registry',
      },
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

// Track page views with Google Analytics
router.afterEach((to) => {
  const analytics = useAnalytics();
  
  // Track page view
  const pageTitle = (to.meta.title as string) || document.title;
  analytics.trackPageView(to.fullPath, pageTitle);
  
  // Update document title
  if (to.meta.title) {
    document.title = to.meta.title as string;
  }
});

export default router;
