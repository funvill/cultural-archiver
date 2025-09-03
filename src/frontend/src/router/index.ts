import { createRouter, createWebHistory } from 'vue-router'
import type { Component } from 'vue'
import { useAuthStore } from '../stores/auth'

// Lazy load components for better performance
const HomeView = (): Promise<Component> => import('../views/HomeView.vue')
const MapView = (): Promise<Component> => import('../views/MapView.vue')
const SubmitView = (): Promise<Component> => import('../views/SubmitView.vue')
const ArtworkDetailView = (): Promise<Component> => import('../views/ArtworkDetailView.vue')
const ProfileView = (): Promise<Component> => import('../views/ProfileView.vue')
const ReviewView = (): Promise<Component> => import('../views/ReviewView.vue')
const VerifyView = (): Promise<Component> => import('../views/VerifyView.vue')

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Map',
      component: MapView,
      meta: {
        title: 'Cultural Archiver - Discover Public Art'
      }
    },
    {
      path: '/home',
      name: 'Home',
      component: HomeView,
      meta: {
        title: 'Cultural Archiver - About'
      }
    },
    {
      path: '/submit',
      name: 'Submit',
      component: SubmitView,
      meta: {
        title: 'Submit Artwork - Cultural Archiver'
      }
    },
    {
      path: '/artwork/:id',
      name: 'ArtworkDetail',
      component: ArtworkDetailView,
      props: true,
      meta: {
        title: 'Artwork Details - Cultural Archiver'
      }
    },
    {
      path: '/profile',
      name: 'Profile',
      component: ProfileView,
      meta: {
        title: 'My Submissions - Cultural Archiver',
        requiresAuth: true
      }
    },
    {
      path: '/verify',
      name: 'Verify',
      component: VerifyView,
      meta: {
        title: 'Email Verification - Cultural Archiver'
      }
    },
    {
      path: '/review',
      name: 'Review',
      component: ReviewView,
      meta: {
        title: 'Review Queue - Cultural Archiver',
        requiresReviewer: true
      }
    },
    {
      path: '/help',
      name: 'Help',
      component: HomeView, // Temporarily use HomeView for help
      meta: {
        title: 'Help - Cultural Archiver'
      }
    },
    // Redirect old paths for compatibility
    {
      path: '/home',
      redirect: '/'
    }
  ]
})

// Set page titles and handle authentication/reviewer permissions
router.beforeEach(async (to, _from, next) => {
  // Set page title
  if (to.meta.title) {
    document.title = to.meta.title as string
  }
  
  // Get auth store - ensure it's initialized
  const authStore = useAuthStore()
  
  // Wait for auth initialization if needed
  if (!authStore.user && !authStore.isLoading) {
    try {
      await authStore.initializeAuth()
    } catch (error) {
      console.error('Failed to initialize auth in router guard:', error)
    }
  }
  
  // Check if route requires authentication
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    // Redirect to home with query parameter indicating login needed
    next({
      path: '/',
      query: { 
        login: 'required',
        redirect: to.fullPath
      }
    })
    return
  }
  
  // Check if route requires reviewer permissions
  if (to.meta.requiresReviewer && !authStore.isReviewer) {
    // Redirect to home page for non-reviewers
    next({
      path: '/',
      query: { 
        error: 'reviewer_required'
      }
    })
    return
  }
  
  // Allow navigation
  next()
})

export default router