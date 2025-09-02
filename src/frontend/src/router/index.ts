import { createRouter, createWebHistory } from 'vue-router'
import type { Component } from 'vue'

// Lazy load components for better performance
const HomeView = (): Promise<Component> => import('../views/HomeView.vue')
const MapView = (): Promise<Component> => import('../views/MapView.vue')
const SubmitView = (): Promise<Component> => import('../views/SubmitView.vue')
const ArtworkDetailView = (): Promise<Component> => import('../views/ArtworkDetailView.vue')
const ProfileView = (): Promise<Component> => import('../views/ProfileView.vue')
const ReviewView = (): Promise<Component> => import('../views/ReviewView.vue')

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
        title: 'My Submissions - Cultural Archiver'
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

// Set page titles and handle reviewer permissions
router.beforeEach((to, _from, next) => {
  // Set page title
  if (to.meta.title) {
    document.title = to.meta.title as string
  }
  
  // TODO: Add reviewer permission check when auth is implemented
  // For now, allow all routes
  next()
})

export default router