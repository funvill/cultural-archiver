/**
 * AuditLogViewer Component Tests
 *
 * Tests for the audit log viewing interface including
 * filtering, pagination, and log details functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import AuditLogViewer from '../AuditLogViewer.vue'
import { adminService } from '../../services/admin'

// Mock the admin service
vi.mock('../../services/admin', () => ({
  adminService: {
    getAuditLogs: vi.fn(),
  },
}))

describe('AuditLogViewer', () => {
  let wrapper: any

  const mockAuditLogs = {
    logs: [
      {
        id: 'audit-1',
        type: 'moderation' as const,
        actor_uuid: 'moderator-1',
        actor_email: 'moderator@example.com',
        action: 'approved',
        target: 'submission-1',
        details: { decision: 'approved', reason: 'Good quality artwork' },
        metadata: { ip: '192.168.1.100', userAgent: 'Mozilla/5.0' },
        created_at: '2025-01-03T10:00:00Z',
      },
      {
        id: 'audit-2',
        type: 'admin' as const,
        actor_uuid: 'admin-1',
        actor_email: 'admin@example.com',
        action: 'grant_permission',
        target: 'user-1',
        details: { permission: 'moderator', reason: 'Experienced contributor' },
        metadata: { ip: '192.168.1.200', userAgent: 'Mozilla/5.0' },
        created_at: '2025-01-03T11:00:00Z',
      },
    ],
    total: 2,
    page: 1,
    limit: 25,
    has_more: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adminService.getAuditLogs).mockResolvedValue(mockAuditLogs)
  })

  const createWrapper = () => {
    return mount(AuditLogViewer, {
      global: {
        stubs: {
          teleport: true,
        },
      },
    })
  }

  describe('Component Initialization', () => {
    it('should render audit log viewer interface', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      expect(wrapper.find('h2').text()).toBe('Audit Logs')
      expect(wrapper.text()).toContain('View and filter moderation decisions')
    })

    it('should load audit logs on mount', async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(adminService.getAuditLogs).toHaveBeenCalled()
    })
  })

  describe('Filtering Interface', () => {
    beforeEach(async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should render all filter controls', () => {
      expect(wrapper.find('#type-filter').exists()).toBe(true)
      expect(wrapper.find('#decision-filter').exists()).toBe(true)
      expect(wrapper.find('#action-filter').exists()).toBe(true)
      expect(wrapper.find('#actor-filter').exists()).toBe(true)
      expect(wrapper.find('#start-date').exists()).toBe(true)
      expect(wrapper.find('#end-date').exists()).toBe(true)
    })

    it('should filter by log type', async () => {
      const typeFilter = wrapper.find('#type-filter')
      await typeFilter.setValue('admin')

      expect(adminService.getAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'admin'
        })
      )
    })

    it('should filter by decision for moderation logs', async () => {
      const decisionFilter = wrapper.find('#decision-filter')
      await decisionFilter.setValue('approved')

      expect(adminService.getAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          decision: 'approved'
        })
      )
    })

    it('should filter by action type for admin logs', async () => {
      const actionFilter = wrapper.find('#action-filter')
      await actionFilter.setValue('grant_permission')

      expect(adminService.getAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          action_type: 'grant_permission'
        })
      )
    })

    it('should filter by actor UUID', async () => {
      const actorFilter = wrapper.find('#actor-filter')
      await actorFilter.setValue('admin-1')
      
      // Wait for debounced filter
      await new Promise(resolve => setTimeout(resolve, 600))

      expect(adminService.getAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: 'admin-1'
        })
      )
    })

    it('should filter by date range', async () => {
      const startDate = wrapper.find('#start-date')
      const endDate = wrapper.find('#end-date')
      
      await startDate.setValue('2025-01-01T00:00')
      await endDate.setValue('2025-01-03T23:59')

      expect(adminService.getAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: expect.stringContaining('2025-01-01'),
          endDate: expect.stringContaining('2025-01-03')
        })
      )
    })

    it('should reset all filters', async () => {
      // Set some filters first
      await wrapper.find('#type-filter').setValue('admin')
      await wrapper.find('#actor-filter').setValue('admin-1')

      const resetButton = wrapper.findAll('button').filter((btn: any) => 
        btn.text() === 'Reset Filters'
      )[0]
      await resetButton.trigger('click')

      expect(wrapper.vm.filters.type).toBe(undefined)
      expect(wrapper.vm.filters.actor).toBe('')
      expect(wrapper.vm.currentPage).toBe(1)
    })
  })

  describe('Audit Logs Display', () => {
    beforeEach(async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should display audit logs in table format', () => {
      expect(wrapper.find('table').exists()).toBe(true)
      expect(wrapper.text()).toContain('moderator@example.com')
      expect(wrapper.text()).toContain('admin@example.com')
      expect(wrapper.text()).toContain('approved')
      expect(wrapper.text()).toContain('grant_permission')
    })

    it('should format dates correctly', () => {
      // Check if dates are displayed in a readable format
      const tableCells = wrapper.findAll('td')
      const hasFormattedDate = tableCells.some((cell: any) => 
        cell.text().includes('2025') && cell.text().includes(':')
      )
      expect(hasFormattedDate).toBe(true)
    })

    it('should show appropriate badges for log types', () => {
      const badges = wrapper.findAll('.inline-flex.items-center')
      expect(badges.length).toBeGreaterThan(0)
    })

    it('should display action colors correctly', () => {
      // Check if action badges have appropriate styling
      const actionBadges = wrapper.findAll('span').filter((span: any) => 
        span.text() === 'approved' || span.text() === 'grant_permission'
      )
      expect(actionBadges.length).toBeGreaterThan(0)
    })
  })

  describe('Log Details Modal', () => {
    beforeEach(async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should open details modal when view details is clicked', async () => {
      const viewDetailsButton = wrapper.findAll('button').filter((btn: any) => 
        btn.text() === 'View Details'
      )[0]
      
      await viewDetailsButton.trigger('click')

      expect(wrapper.find('.fixed.inset-0').exists()).toBe(true)
      expect(wrapper.text()).toContain('Audit Log Details')
    })

    it('should display detailed log information in modal', async () => {
      const viewDetailsButton = wrapper.findAll('button').filter((btn: any) => 
        btn.text() === 'View Details'
      )[0]
      
      await viewDetailsButton.trigger('click')

      expect(wrapper.text()).toContain('audit-1')
      expect(wrapper.text()).toContain('moderator@example.com')
      expect(wrapper.text()).toContain('approved')
    })

    it('should close modal when close button is clicked', async () => {
      // Open modal
      const viewDetailsButton = wrapper.findAll('button').filter((btn: any) => 
        btn.text() === 'View Details'
      )[0]
      await viewDetailsButton.trigger('click')

      // Close modal
      const closeButton = wrapper.findAll('button').filter((btn: any) => 
        btn.find('svg').exists() // Close X button
      )[0]
      await closeButton.trigger('click')

      expect(wrapper.vm.selectedLog).toBe(null)
    })

    it('should display JSON details and metadata', async () => {
      const viewDetailsButton = wrapper.findAll('button').filter((btn: any) => 
        btn.text() === 'View Details'
      )[0]
      
      await viewDetailsButton.trigger('click')

      // Check for JSON formatting in pre elements
      const preElements = wrapper.findAll('pre')
      expect(preElements.length).toBeGreaterThan(0)
    })
  })

  describe('Pagination', () => {
    beforeEach(async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should display pagination controls', () => {
      expect(wrapper.text()).toContain('Previous')
      expect(wrapper.text()).toContain('Next')
      expect(wrapper.text()).toContain('Page 1')
    })

    it('should disable previous button on first page', () => {
      const previousButton = wrapper.findAll('button').filter((btn: any) => 
        btn.text() === 'Previous'
      )[0]
      
      expect(previousButton.attributes('disabled')).toBeDefined()
    })

    it('should show total entries count', () => {
      expect(wrapper.text()).toContain('Showing 2 of 2 entries')
    })

    it('should navigate to next page when available', async () => {
      // Mock response with more pages
      const multiPageResponse = {
        ...mockAuditLogs,
        total: 100,
        has_more: true,
      }
      vi.mocked(adminService.getAuditLogs).mockResolvedValue(multiPageResponse)

      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))

      const nextButton = wrapper.findAll('button').filter((btn: any) => 
        btn.text() === 'Next'
      )[0]
      
      await nextButton.trigger('click')

      expect(wrapper.vm.currentPage).toBe(2)
    })
  })

  describe('Loading States', () => {
    it('should show loading indicator', async () => {
      vi.mocked(adminService.getAuditLogs).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockAuditLogs), 100))
      )

      wrapper = createWrapper()
      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('Loading audit logs')
    })
  })

  describe('Error Handling', () => {
    it('should display error when loading logs fails', async () => {
      const mockError = new Error('Failed to load audit logs')
      vi.mocked(adminService.getAuditLogs).mockRejectedValue(mockError)

      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(wrapper.text()).toContain('Error loading audit logs')
      expect(wrapper.text()).toContain('Failed to load audit logs')
    })
  })

  describe('Empty States', () => {
    it('should show empty state when no logs found', async () => {
      vi.mocked(adminService.getAuditLogs).mockResolvedValue({
        logs: [],
        total: 0,
        page: 1,
        limit: 25,
        has_more: false,
      })

      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(wrapper.text()).toContain('No audit logs found')
    })
  })

  describe('Responsive Design', () => {
    beforeEach(async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should have responsive table container', () => {
      expect(wrapper.find('.overflow-x-auto').exists()).toBe(true)
    })

    it('should have responsive grid for filters', () => {
      const gridContainer = wrapper.find('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4')
      expect(gridContainer.exists()).toBe(true)
    })
  })

  describe('Filter Visibility Logic', () => {
    beforeEach(async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should show decision filter for moderation logs', async () => {
      await wrapper.find('#type-filter').setValue('moderation')
      
      expect(wrapper.find('#decision-filter').isVisible()).toBe(true)
    })

    it('should show action filter for admin logs', async () => {
      await wrapper.find('#type-filter').setValue('admin')
      
      expect(wrapper.find('#action-filter').isVisible()).toBe(true)
    })

    it('should show both filters when no type is selected', () => {
      expect(wrapper.find('#decision-filter').isVisible()).toBe(true)
      expect(wrapper.find('#action-filter').isVisible()).toBe(true)
    })
  })

  describe('Total Count Display', () => {
    beforeEach(async () => {
      wrapper = createWrapper()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should display total entries count in filter section', () => {
      expect(wrapper.text()).toContain('2 total entries')
    })

    it('should update count when filters change', async () => {
      const filteredResponse = {
        ...mockAuditLogs,
        logs: [mockAuditLogs.logs[0]],
        total: 1,
      }
      vi.mocked(adminService.getAuditLogs).mockResolvedValue(filteredResponse)

      await wrapper.find('#type-filter').setValue('moderation')
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(wrapper.text()).toContain('1 total entries')
    })
  })
});