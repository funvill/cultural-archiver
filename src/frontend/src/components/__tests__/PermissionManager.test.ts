/**
 * PermissionManager Component Tests
 *
 * Tests for the permission management interface including
 * user search, permission granting/revoking, and form validation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PermissionManager from '../PermissionManager.vue'
import { adminService } from '../../services/admin'

// Mock the admin service
vi.mock('../../services/admin', () => ({
  adminService: {
    getUserPermissions: vi.fn(),
    grantPermission: vi.fn(),
    revokePermission: vi.fn(),
  },
}))

describe('PermissionManager', () => {
  let wrapper: any

  const mockPermissions = {
    users: [
      {
        user_uuid: 'user-1',
        email: 'user1@example.com',
        permissions: [
          {
            permission: 'moderator' as const,
            granted_at: '2025-01-03T10:00:00Z',
            granted_by: 'admin-1',
            notes: 'Initial moderator',
          },
        ],
      },
      {
        user_uuid: 'user-2',
        email: 'user2@example.com',
        permissions: [
          {
            permission: 'admin' as const,
            granted_at: '2025-01-03T11:00:00Z',
            granted_by: 'admin-1',
            notes: 'Senior admin',
          },
        ],
      },
    ],
    total: 2,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adminService.getUserPermissions).mockResolvedValue(mockPermissions)
  })

  const createWrapper = () => {
    return mount(PermissionManager, {
      global: {
        stubs: {
          teleport: true,
        },
      },
    })
  }

  describe('Component Initialization', () => {
    it('should render permission manager interface', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      expect(wrapper.find('h2').text()).toBe('User Permissions')
      expect(wrapper.find('[data-testid="search"]').exists() || 
             wrapper.find('input[placeholder*="Search"]').exists()).toBe(true)
    })

    it('should load permissions on mount', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(adminService.getUserPermissions).toHaveBeenCalled()
    })
  })

  describe('Permission Listing', () => {
    beforeEach(async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should display user permissions list', () => {
      expect(wrapper.text()).toContain('user1@example.com')
      expect(wrapper.text()).toContain('user2@example.com')
      expect(wrapper.text()).toContain('moderator')
      expect(wrapper.text()).toContain('admin')
    })

    it('should show permission details and notes', () => {
      expect(wrapper.text()).toContain('Initial moderator')
      expect(wrapper.text()).toContain('Senior admin')
    })

    it('should format dates correctly', () => {
      // Check if dates are displayed in a readable format
      const dateElements = wrapper.findAll('.text-xs.text-gray-500')
      expect(dateElements.length).toBeGreaterThan(0)
    })
  })

  describe('Search and Filtering', () => {
    beforeEach(async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should filter by search query', async () => {
      const searchInput = wrapper.find('input[placeholder*="Search"]')
      await searchInput.setValue('user1@example.com')
      
      // Wait for debounced search
      await new Promise(resolve => setTimeout(resolve, 600))

      expect(adminService.getUserPermissions).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'user1@example.com'
        })
      )
    })

    it('should filter by permission type', async () => {
      const permissionFilter = wrapper.find('select[id="permission-filter"]')
      await permissionFilter.setValue('admin')

      expect(adminService.getUserPermissions).toHaveBeenCalledWith(
        expect.objectContaining({
          permission: 'admin'
        })
      )
    })

    it('should reset filters when reset button is clicked', async () => {
      // Set some filters first
      const searchInput = wrapper.find('input[placeholder*="Search"]')
      await searchInput.setValue('test')
      
      const buttons = wrapper.findAll('button')
      const resetButton = buttons.find(btn => btn.text().includes('Reset'))
      
      if (!resetButton) {
        throw new Error('Reset button not found')
      }
      await resetButton.trigger('click')

      expect(wrapper.vm.searchQuery).toBe('')
      expect(wrapper.vm.permissionFilter).toBe('')
    })
  })

  describe('Grant Permission Dialog', () => {
    beforeEach(async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should open grant permission dialog', async () => {
      const buttons = wrapper.findAll('button')
      const grantButton = buttons.find(btn => btn.text().includes('Grant Permission'))
      
      if (!grantButton) {
        throw new Error('Grant Permission button not found')
      }
      
      await grantButton.trigger('click')

      expect(wrapper.find('.fixed.inset-0').exists()).toBe(true)
      expect(wrapper.text()).toContain('Grant Permission')
    })

    it('should validate required fields in grant form', async () => {
      // Open dialog
      const buttons = wrapper.findAll('button')
      const grantButton = buttons.find(btn => btn.text().includes('Grant Permission'))
      
      if (!grantButton) {
        throw new Error('Grant Permission button not found')
      }
      await grantButton.trigger('click')

      // Try to submit without filling required fields
      const form = wrapper.find('form')
      await form.trigger('submit.prevent')

      // Form should not submit due to browser validation
      expect(adminService.grantPermission).not.toHaveBeenCalled()
    })

    it('should grant permission with valid data', async () => {
      vi.mocked(adminService.grantPermission).mockResolvedValue({
        success: true,
        message: 'Permission granted',
      })

      // Open dialog
      const buttons = wrapper.findAll('button')
      const grantButton = buttons.find(btn => btn.text().includes('Grant Permission'))
      
      if (!grantButton) {
        throw new Error('Grant Permission button not found')
      }
      await grantButton.trigger('click')

      // Fill form
      const userUuidInput = wrapper.find('#grant-user-uuid')
      const permissionSelect = wrapper.find('#grant-permission')
      const reasonTextarea = wrapper.find('#grant-reason')

      await userUuidInput.setValue('550e8400-e29b-41d4-a716-446655440000')
      await permissionSelect.setValue('moderator')
      await reasonTextarea.setValue('Test reason')

      // Submit form
      const form = wrapper.find('form')
      await form.trigger('submit.prevent')
      await wrapper.vm.$nextTick()

      expect(adminService.grantPermission).toHaveBeenCalledWith({
        userUuid: '550e8400-e29b-41d4-a716-446655440000',
        permission: 'moderator',
        reason: 'Test reason',
      })
    })

    it('should close dialog on cancel', async () => {
      // Open dialog
      const buttons = wrapper.findAll('button')
      const grantButton = buttons.find(btn => btn.text().includes('Grant Permission'))
      
      if (!grantButton) {
        throw new Error('Grant Permission button not found')
      }
      await grantButton.trigger('click')

      // Click cancel
      const cancelButton = buttons.find(btn => btn.text() === 'Cancel')
      
      if (!cancelButton) {
        throw new Error('Cancel button not found')
      }
      await cancelButton.trigger('click')

      expect(wrapper.vm.showGrantDialog).toBe(false)
    })
  })

  describe('Revoke Permission Dialog', () => {
    beforeEach(async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should open revoke permission dialog', async () => {
      const revokeButton = wrapper.find('button').filter((btn: any) => 
        btn.text() === 'Revoke'
      )[0]
      
      await revokeButton.trigger('click')

      expect(wrapper.find('.fixed.inset-0').exists()).toBe(true)
      expect(wrapper.text()).toContain('Revoke Permission')
    })

    it('should show user details in revoke dialog', async () => {
      const revokeButton = wrapper.find('button').filter((btn: any) => 
        btn.text() === 'Revoke'
      )[0]
      
      await revokeButton.trigger('click')

      expect(wrapper.text()).toContain('user1@example.com')
      expect(wrapper.text()).toContain('user-1')
    })

    it('should revoke permission with valid data', async () => {
      vi.mocked(adminService.revokePermission).mockResolvedValue({
        success: true,
        message: 'Permission revoked',
      })

      // Click revoke button for first user
      const revokeButton = wrapper.find('button').filter((btn: any) => 
        btn.text() === 'Revoke'
      )[0]
      await revokeButton.trigger('click')

      // Select permission to revoke
      const permissionSelect = wrapper.find('#revoke-permission')
      await permissionSelect.setValue('moderator')

      // Add reason
      const reasonTextarea = wrapper.find('#revoke-reason')
      await reasonTextarea.setValue('No longer needed')

      // Submit form
      const form = wrapper.find('form')
      await form.trigger('submit.prevent')
      await wrapper.vm.$nextTick()

      expect(adminService.revokePermission).toHaveBeenCalledWith({
        userUuid: 'user-1',
        permission: 'moderator',
        reason: 'No longer needed',
      })
    })
  })

  describe('Error Handling', () => {
    it('should display error when loading permissions fails', async () => {
      const mockError = new Error('Failed to load permissions')
      vi.mocked(adminService.getUserPermissions).mockRejectedValue(mockError)

      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(wrapper.text()).toContain('Error loading permissions')
      expect(wrapper.text()).toContain('Failed to load permissions')
    })

    it('should handle grant permission errors', async () => {
      const mockError = new Error('Permission grant failed')
      vi.mocked(adminService.grantPermission).mockRejectedValue(mockError)

      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))

      // Open grant dialog and submit
      const grantButton = wrapper.find('button').filter((btn: any) => 
        btn.text().includes('Grant Permission')
      )[0]
      await grantButton.trigger('click')

      // Fill and submit form
      await wrapper.find('#grant-user-uuid').setValue('test-uuid')
      await wrapper.find('#grant-permission').setValue('moderator')
      
      const form = wrapper.find('form')
      await form.trigger('submit.prevent')
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.error).toBe('Permission grant failed')
    })
  })

  describe('Loading States', () => {
    it('should show loading indicator when loading permissions', async () => {
      vi.mocked(adminService.getUserPermissions).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockPermissions), 100))
      )

      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('Loading permissions')
    })

    it('should disable submit button while processing', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))

      // Open grant dialog
      const grantButton = wrapper.find('button').filter((btn: any) => 
        btn.text().includes('Grant Permission')
      )[0]
      await grantButton.trigger('click')

      // Set loading state manually for testing
      wrapper.vm.isSubmitting = true
      await wrapper.vm.$nextTick()

      const submitButton = wrapper.find('button[type="submit"]')
      expect(submitButton.attributes('disabled')).toBeDefined()
      expect(submitButton.text()).toContain('Granting')
    })
  })

  describe('Empty States', () => {
    it('should show empty state when no users found', async () => {
      vi.mocked(adminService.getUserPermissions).mockResolvedValue({
        users: [],
        total: 0,
      })

      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(wrapper.text()).toContain('No users found')
    })
  })
});