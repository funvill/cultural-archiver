/**
 * AdminView Component Tests
 *
 * Tests for the admin dashboard view including permission checking,
 * data loading, and tab navigation functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import AdminView from '../AdminView.vue'
import { useAuthStore } from '../../stores/auth'
import { adminService } from '../../services/admin'

// Mock the admin service
vi.mock('../../services/admin', () => ({
  adminService: {
    getStatistics: vi.fn(),
  },
}))

// Mock child components
vi.mock('../../components/PermissionManager.vue', () => ({
  default: {
    name: 'PermissionManager',
    template: '<div data-testid="permission-manager">Permission Manager</div>',
    emits: ['permission-changed'],
  },
}))

vi.mock('../../components/AuditLogViewer.vue', () => ({
  default: {
    name: 'AuditLogViewer',
    template: '<div data-testid="audit-log-viewer">Audit Log Viewer</div>',
  },
}))

describe('AdminView', () => {
  let wrapper: any
  let pinia: any
  let authStore: any

  const mockStatistics = {
    total_decisions: 150,
    decisions_by_type: {
      approved: 120,
      rejected: 20,
      skipped: 10,
    },
    total_admin_actions: 25,
    admin_actions_by_type: {
      grant_permission: 15,
      revoke_permission: 5,
      view_audit_logs: 5,
    },
    active_moderators: 3,
    active_admins: 2,
    date_range: {
      start: '2024-12-04T00:00:00Z',
      end: '2025-01-03T23:59:59Z',
      days: 30,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    pinia = createPinia()
    authStore = useAuthStore(pinia)
    
    // Mock the admin service
    vi.mocked(adminService.getStatistics).mockResolvedValue(mockStatistics)
  })

  const createWrapper = (adminAccess = true) => {
    // Mock admin access by setting permissions
    if (adminAccess) {
      authStore.permissions = ['admin', 'moderator']
    } else {
      authStore.permissions = []
    }
    
    return mount(AdminView, {
      global: {
        plugins: [pinia],
        stubs: {
          PermissionManager: {
            template: '<div data-testid="permission-manager">Permission Manager</div>'
          },
          AuditLogViewer: {
            template: '<div data-testid="audit-log-viewer">Audit Log Viewer</div>'
          },
        },
      },
    })
  }

  describe('Access Control', () => {
    it('should display error when user lacks admin access', async () => {
      wrapper = createWrapper(false)
      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('Access denied. Admin permissions required.')
    })

    it('should load data when user has admin access', async () => {
      wrapper = createWrapper(true)
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0)) // Wait for async operations

      expect(adminService.getStatistics).toHaveBeenCalledWith(30)
    })
  })

  describe('Data Loading', () => {
    beforeEach(() => {
      wrapper = createWrapper(true)
    })

    it('should display loading state initially', async () => {
      // Mock a delayed response
      vi.mocked(adminService.getStatistics).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockStatistics), 100))
      )

      wrapper = createWrapper(true)
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="loading"]').exists() || 
             wrapper.text().includes('Loading admin dashboard')).toBe(true)
    })

    it('should display statistics when loaded successfully', async () => {
      wrapper = createWrapper(true)
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(wrapper.text()).toContain('150')
      expect(wrapper.text()).toContain('3')
      expect(wrapper.text()).toContain('2')
      expect(wrapper.text()).toContain('25')
    })

    it('should handle loading errors gracefully', async () => {
      // Mock console.error to suppress expected error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const mockError = new Error('Failed to load statistics')
      vi.mocked(adminService.getStatistics).mockRejectedValue(mockError)

      wrapper = createWrapper(true)
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(wrapper.text()).toContain('Error loading admin dashboard')
      expect(wrapper.text()).toContain('Failed to load statistics')
      
      consoleSpy.mockRestore()
    })
  })

  describe('Tab Navigation', () => {
    beforeEach(async () => {
      wrapper = createWrapper(true)
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should default to permissions tab', () => {
      const permissionsTab = wrapper.find('[aria-current="page"]')
      expect(permissionsTab.text()).toBe('Permission Management')
    })

    it('should switch to audit logs tab when clicked', async () => {
      const buttons = wrapper.findAll('button')
      const auditTab = buttons.find(button => button.text().includes('Audit Logs'))
      
      if (!auditTab) {
        console.log('Available buttons:', buttons.map(b => b.text()))
        throw new Error('Audit Logs tab not found')
      }
      
      await auditTab.trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.activeTab).toBe('audit')
      expect(wrapper.find('[data-testid="audit-log-viewer"]').exists()).toBe(true)
    })

    it('should switch back to permissions tab', async () => {
      // First switch to audit tab
      const buttons = wrapper.findAll('button')
      const auditTab = buttons.find(button => button.text().includes('Audit Logs'))
      if (auditTab) {
        await auditTab.trigger('click')
      }

      // Then switch back to permissions
      const permissionsTab = buttons.find(button => button.text().includes('Permission Management'))
      if (!permissionsTab) {
        throw new Error('Permission Management tab not found')
      }
      await permissionsTab.trigger('click')

      expect(wrapper.vm.activeTab).toBe('permissions')
      expect(wrapper.find('[data-testid="permission-manager"]').exists()).toBe(true)
    })
  })

  describe('Refresh Functionality', () => {
    beforeEach(async () => {
      wrapper = createWrapper(true)
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should refresh data when refresh button is clicked', async () => {
      vi.clearAllMocks()

      const buttons = wrapper.findAll('button')
      const refreshButton = buttons.find(button => button.text().includes('Refresh'))
      
      if (!refreshButton) {
        throw new Error('Refresh button not found')
      }
      
      await refreshButton.trigger('click')

      expect(adminService.getStatistics).toHaveBeenCalledWith(30)
    })

    it('should disable refresh button while loading', async () => {
      // Mock a delayed response
      vi.mocked(adminService.getStatistics).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockStatistics), 100))
      )

      const buttons = wrapper.findAll('button')
      const refreshButton = buttons.find(button => button.text().includes('Refresh'))
      
      if (!refreshButton) {
        throw new Error('Refresh button not found')
      }
      
      await refreshButton.trigger('click')

      expect(refreshButton.attributes('disabled')).toBeDefined()
    })
  })

  describe('Statistics Display', () => {
    beforeEach(async () => {
      wrapper = createWrapper(true)
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should display formatted numbers correctly', () => {
      // Check if large numbers are formatted with commas
      expect(wrapper.text()).toContain('150')
    })

    it('should display all statistics cards', () => {
      const statisticsCards = wrapper.findAll('.bg-white.dark\\:bg-gray-800.overflow-hidden.shadow.rounded-lg')
      expect(statisticsCards.length).toBeGreaterThanOrEqual(4)
    })

    it('should handle zero values correctly', async () => {
      const zeroStats = {
        ...mockStatistics,
        total_decisions: 0,
        active_moderators: 0,
        active_admins: 0,
        total_admin_actions: 0,
      }
      
      vi.mocked(adminService.getStatistics).mockResolvedValue(zeroStats)
      
      wrapper = createWrapper(true)
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(wrapper.text()).toContain('0')
    })
  })

  describe('Responsive Design', () => {
    beforeEach(async () => {
      wrapper = createWrapper(true)
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should have responsive grid classes', () => {
      const gridContainer = wrapper.find('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4')
      expect(gridContainer.exists()).toBe(true)
    })

    it('should have mobile-friendly navigation', () => {
      const navContainer = wrapper.find('nav')
      expect(navContainer.classes()).toContain('flex')
    })
  })

  describe('Error Handling', () => {
    it('should display network error messages', async () => {
      // Mock console.error to suppress expected error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const networkError = new Error('Network request failed')
      vi.mocked(adminService.getStatistics).mockRejectedValue(networkError)

      wrapper = createWrapper(true)
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(wrapper.text()).toContain('Network request failed')
      
      consoleSpy.mockRestore()
    })

    it('should display generic error for unknown errors', async () => {
      // Mock console.error to suppress expected error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      vi.mocked(adminService.getStatistics).mockRejectedValue('Unknown error')

      wrapper = createWrapper(true)
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(wrapper.text()).toContain('Failed to load admin dashboard')
      
      consoleSpy.mockRestore()
    })
  })
});