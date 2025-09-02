import { reactive } from 'vue'

export interface ModalConfig {
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  showCancel?: boolean
  variant?: 'primary' | 'danger' | 'warning'
  preventEscapeClose?: boolean
  preventBackdropClose?: boolean
  focusOnOpen?: 'confirm' | 'cancel' | 'close'
}

export interface PromptConfig {
  title?: string
  message?: string
  inputLabel?: string
  placeholder?: string
  defaultValue?: string
  confirmText?: string
  cancelText?: string
  variant?: 'primary' | 'danger' | 'warning'
  required?: boolean
  multiline?: boolean
  maxLength?: number
  validator?: (value: string) => string | null
}

export interface ModalState {
  isOpen: boolean
  config: ModalConfig
  resolve?: (result: boolean) => void
}

export interface PromptState {
  isOpen: boolean
  config: PromptConfig
  resolve?: (result: string | null) => void
}

export function useModal(): {
  modalState: ModalState
  promptState: PromptState
  showConfirmModal: (config?: ModalConfig) => Promise<boolean>
  showPrompt: (config?: PromptConfig) => Promise<string | null>
  showAlert: (message: string, title?: string, variant?: 'primary' | 'danger' | 'warning') => Promise<boolean>
  showError: (message: string, title?: string) => Promise<boolean>
  showWarning: (message: string, title?: string) => Promise<boolean>
  showDeleteConfirm: (itemName?: string) => Promise<boolean>
  handleConfirm: () => void
  handleCancel: () => void
  handlePromptConfirm: (value: string) => void
  handlePromptCancel: () => void
  closeModal: () => void
  closePrompt: () => void
  updateModalOpen: (isOpen: boolean) => void
  updatePromptOpen: (isOpen: boolean) => void
} {
  const modalState = reactive<ModalState>({
    isOpen: false,
    config: {}
  })

  const promptState = reactive<PromptState>({
    isOpen: false,
    config: {}
  })

  // Show a confirmation modal
  function showConfirmModal(config: ModalConfig = {}): Promise<boolean> {
    return new Promise((resolve) => {
      modalState.isOpen = true
      modalState.config = {
        title: 'Confirm Action',
        confirmText: 'OK',
        cancelText: 'Cancel',
        showCancel: true,
        variant: 'primary',
        ...config
      }
      modalState.resolve = resolve
    })
  }

  // Show a prompt modal
  function showPrompt(config: PromptConfig = {}): Promise<string | null> {
    return new Promise((resolve) => {
      promptState.isOpen = true
      promptState.config = {
        title: 'Input Required',
        confirmText: 'OK',
        cancelText: 'Cancel',
        variant: 'primary',
        ...config
      }
      promptState.resolve = resolve
    })
  }

  // Show an alert modal (no cancel button)
  function showAlert(message: string, title = 'Notice', variant: 'primary' | 'danger' | 'warning' = 'primary'): Promise<boolean> {
    return showConfirmModal({
      title,
      message,
      showCancel: false,
      variant,
      confirmText: 'OK'
    })
  }

  // Show an error modal
  function showError(message: string, title = 'Error'): Promise<boolean> {
    return showAlert(message, title, 'danger')
  }

  // Show a warning modal
  function showWarning(message: string, title = 'Warning'): Promise<boolean> {
    return showAlert(message, title, 'warning')
  }

  // Show a deletion confirmation modal
  function showDeleteConfirm(itemName?: string): Promise<boolean> {
    return showConfirmModal({
      title: 'Delete Confirmation',
      message: itemName 
        ? `Are you sure you want to delete "${itemName}"? This action cannot be undone.`
        : 'Are you sure you want to delete this item? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
      focusOnOpen: 'cancel' // Focus cancel button for destructive actions
    })
  }

  // Handle modal confirm
  function handleConfirm(): void {
    const { resolve } = modalState
    modalState.isOpen = false
    resolve?.(true)
  }

  // Handle modal cancel/close
  function handleCancel(): void {
    const { resolve } = modalState
    modalState.isOpen = false
    resolve?.(false)
  }

  // Handle prompt confirm
  function handlePromptConfirm(value: string): void {
    const { resolve } = promptState
    promptState.isOpen = false
    resolve?.(value)
  }

  // Handle prompt cancel/close
  function handlePromptCancel(): void {
    const { resolve } = promptState
    promptState.isOpen = false
    resolve?.(null)
  }

  // Close modal programmatically
  function closeModal(): void {
    handleCancel()
  }

  // Close prompt programmatically
  function closePrompt(): void {
    handlePromptCancel()
  }

  // Update modal open state
  function updateModalOpen(isOpen: boolean): void {
    modalState.isOpen = isOpen
    if (!isOpen) {
      handleCancel()
    }
  }

  // Update prompt open state
  function updatePromptOpen(isOpen: boolean): void {
    promptState.isOpen = isOpen
    if (!isOpen) {
      handlePromptCancel()
    }
  }

  return {
    modalState,
    promptState,
    showConfirmModal,
    showPrompt,
    showAlert,
    showError,
    showWarning,
    showDeleteConfirm,
    handleConfirm,
    handleCancel,
    handlePromptConfirm,
    handlePromptCancel,
    closeModal,
    closePrompt,
    updateModalOpen,
    updatePromptOpen
  }
}

// Global modal instance for use throughout the app
export const globalModal = useModal()
