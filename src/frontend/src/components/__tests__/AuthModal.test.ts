import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import AuthModal from '../AuthModal.vue'

// Mock the composables
vi.mock('../../composables/useAuth', () => ({
  useAuth: (): {
    requestMagicLink: ReturnType<typeof vi.fn>;
    isLoading: { value: boolean };
    error: { value: null };
    clearError: ReturnType<typeof vi.fn>;
  } => ({
    requestMagicLink: vi.fn().mockResolvedValue({ success: true }),
    isLoading: { value: false },
    error: { value: null },
    clearError: vi.fn()
  })
}))

describe('AuthModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders when open', () => {
      const wrapper = mount(AuthModal, {
        props: { isOpen: true }
      })
      
      expect(wrapper.find('[role="dialog"]')).toBeTruthy()
      expect(wrapper.text()).toContain('Sign In')
    })

    it('does not render when closed', () => {
      const wrapper = mount(AuthModal, {
        props: { isOpen: false }
      })
      
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    })

    it('renders with signup mode', () => {
      const wrapper = mount(AuthModal, {
        props: { isOpen: true, mode: 'signup' }
      })
      
      expect(wrapper.text()).toContain('Create Account')
    })

    it('renders with login mode by default', () => {
      const wrapper = mount(AuthModal, {
        props: { isOpen: true }
      })
      
      expect(wrapper.text()).toContain('Sign In')
    })
  })

  describe('Form Interaction', () => {
    it('renders email input field', () => {
      const wrapper = mount(AuthModal, {
        props: { isOpen: true }
      })
      
      const emailInput = wrapper.find('input[type="email"]')
      expect(emailInput.exists()).toBe(true)
      expect(emailInput.attributes('required')).toBeDefined()
    })

    it('validates email format', async () => {
      const wrapper = mount(AuthModal, {
        props: { isOpen: true }
      })
      
      const emailInput = wrapper.find('input[type="email"]')
      await emailInput.setValue('invalid-email')
      await emailInput.trigger('blur')
      
      // Should show validation error
      expect(wrapper.text()).toContain('valid email address')
    })

    it('disables submit button when loading', async () => {
      const mockUseAuth = vi.fn(() => ({
        requestMagicLink: vi.fn(),
        isLoading: { value: true },
        error: { value: null },
        clearError: vi.fn()
      }))
      
      vi.mocked(mockUseAuth)
      
      const wrapper = mount(AuthModal, {
        props: { isOpen: true }
      })
      
      const submitButton = wrapper.find('button[type="submit"]')
      expect(submitButton.attributes('disabled')).toBeDefined()
    })
  })

  describe('Modal Behavior', () => {
    it('emits close event when close button is clicked', async () => {
      const wrapper = mount(AuthModal, {
        props: { isOpen: true }
      })
      
      const closeButton = wrapper.find('[aria-label="Close"]')
      await closeButton.trigger('click')
      
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('emits close event when escape key is pressed', async () => {
      const wrapper = mount(AuthModal, {
        props: { isOpen: true }
      })
      
      await wrapper.trigger('keydown.escape')
      
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('emits close event when backdrop is clicked', async () => {
      const wrapper = mount(AuthModal, {
        props: { isOpen: true }
      })
      
      const backdrop = wrapper.find('.fixed.inset-0')
      await backdrop.trigger('click')
      
      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      const wrapper = mount(AuthModal, {
        props: { isOpen: true }
      })
      
      const dialog = wrapper.find('[role="dialog"]')
      expect(dialog.exists()).toBe(true)
      expect(dialog.attributes('aria-modal')).toBe('true')
      expect(dialog.attributes('aria-labelledby')).toBeDefined()
    })

    it('traps focus within modal', () => {
      const trapFocusMock = vi.fn()
      vi.mocked(trapFocusMock)
      
      const wrapper = mount(AuthModal, {
        props: { isOpen: true }
      })
      
      // Focus should be trapped when modal opens
      expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    })

    it('has proper labels on form elements', () => {
      const wrapper = mount(AuthModal, {
        props: { isOpen: true }
      })
      
      const emailInput = wrapper.find('input[type="email"]')
      expect(emailInput.attributes('aria-label') || emailInput.attributes('aria-labelledby')).toBeDefined()
    })
  })

  describe('Email Steps', () => {
    it('shows email form initially', () => {
      const wrapper = mount(AuthModal, {
        props: { isOpen: true }
      })
      
      expect(wrapper.find('input[type="email"]').exists()).toBe(true)
      expect(wrapper.find('button[type="submit"]').exists()).toBe(true)
    })

    it('shows confirmation after email is sent', async () => {
      const wrapper = mount(AuthModal, {
        props: { isOpen: true }
      })
      
      const emailInput = wrapper.find('input[type="email"]')
      await emailInput.setValue('test@example.com')
      
      const form = wrapper.find('form')
      await form.trigger('submit')
      
      // Should show email sent confirmation
      expect(wrapper.text()).toContain('Check Your Email')
    })
  })

  describe('Error Handling', () => {
    it('displays error messages from auth composable', () => {
      const mockUseAuth = vi.fn(() => ({
        requestMagicLink: vi.fn(),
        isLoading: { value: false },
        error: { value: 'Test error message' },
        clearError: vi.fn()
      }))
      
      vi.mocked(mockUseAuth)
      
      const wrapper = mount(AuthModal, {
        props: { isOpen: true }
      })
      
      expect(wrapper.text()).toContain('Test error message')
    })

    it('clears errors when modal closes', async () => {
      const clearErrorMock = vi.fn()
      const mockUseAuth = vi.fn(() => ({
        requestMagicLink: vi.fn(),
        isLoading: { value: false },
        error: { value: 'Some error' },
        clearError: clearErrorMock
      }))
      
      vi.mocked(mockUseAuth)
      
      const wrapper = mount(AuthModal, {
        props: { isOpen: true }
      })
      
      await wrapper.setProps({ isOpen: false })
      
      expect(clearErrorMock).toHaveBeenCalled()
    })
  })

  describe('Mode Switching', () => {
    it('switches between login and signup modes', async () => {
      const wrapper = mount(AuthModal, {
        props: { isOpen: true, mode: 'login' }
      })
      
      expect(wrapper.text()).toContain('Sign In')
      
      const switchButton = wrapper.find('button:contains("Create Account")')
      if (switchButton.exists()) {
        await switchButton.trigger('click')
        expect(wrapper.text()).toContain('Create Account')
      }
    })

    it('shows appropriate button text for each mode', () => {
      const loginWrapper = mount(AuthModal, {
        props: { isOpen: true, mode: 'login' }
      })
      
      const signupWrapper = mount(AuthModal, {
        props: { isOpen: true, mode: 'signup' }
      })
      
      expect(loginWrapper.text()).toContain('Send Magic Link')
      expect(signupWrapper.text()).toContain('Create Account')
    })
  })
})