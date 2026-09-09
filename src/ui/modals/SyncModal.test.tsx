import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MockAuthService, MockSyncService } from '../../test/services'
import { SyncModal } from './SyncModal'

describe('SyncModal Account Deletion and Legal', () => {
  it('renders account deletion trigger when signed in and confirms deletion', async () => {
    const auth = new MockAuthService()
    auth.user = { id: 'user-del-1', email: 'delete-me@example.com' }
    const sync = new MockSyncService()
    const deleteRemoteDeckSpy = vi.spyOn(sync, 'deleteRemoteDeck')
    const deleteAccountSpy = vi.spyOn(auth, 'deleteAccount')

    render(
      <SyncModal
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        onUpdateCards={vi.fn()}
        auth={auth}
        sync={sync}
      />,
    )

    // User is signed in
    expect(screen.getByText('delete-me@example.com')).toBeInTheDocument()

    // Trigger account deletion
    const deleteTrigger = screen.getByRole('button', {
      name: /delete cloud account & data/i,
    })
    expect(deleteTrigger).toBeInTheDocument()

    // Click trigger to show confirmation
    fireEvent.click(deleteTrigger)

    expect(
      screen.getByText(/permanently deletes your account and backups/i),
    ).toBeInTheDocument()

    const confirmBtn = screen.getByRole('button', {
      name: /yes, delete cloud data/i,
    })
    expect(confirmBtn).toBeDisabled()

    // Cancel hides confirmation
    const cancelBtn = screen.getByRole('button', { name: /cancel/i })
    fireEvent.click(cancelBtn)
    expect(
      screen.queryByText(/permanently deletes your account and backups/i),
    ).toBeNull()

    // Re-open confirmation
    fireEvent.click(
      screen.getByRole('button', {
        name: /delete cloud account & data/i,
      }),
    )

    const confirmInput = screen.getByPlaceholderText('DELETE')
    expect(confirmInput).toBeInTheDocument()

    const newConfirmBtn = screen.getByRole('button', {
      name: /yes, delete cloud data/i,
    })
    expect(newConfirmBtn).toBeDisabled()

    // Incorrect text keeps button disabled
    fireEvent.change(confirmInput, { target: { value: 'del' } })
    expect(newConfirmBtn).toBeDisabled()

    // Typing DELETE enables confirm button
    fireEvent.change(confirmInput, { target: { value: 'DELETE' } })
    expect(newConfirmBtn).toBeEnabled()

    fireEvent.click(newConfirmBtn)

    await waitFor(() => {
      expect(deleteRemoteDeckSpy).toHaveBeenCalledWith({
        id: 'user-del-1',
        email: 'delete-me@example.com',
      })
      expect(deleteAccountSpy).toHaveBeenCalled()
      expect(
        screen.getByText(/cloud account and backup data deleted/i),
      ).toBeInTheDocument()
    })
  })

  it('triggers onDownloadBackup before deletion when backup checkbox is checked', async () => {
    const auth = new MockAuthService()
    auth.user = { id: 'user-del-2', email: 'backup-del@example.com' }
    const sync = new MockSyncService()
    const onDownloadBackup = vi.fn()

    render(
      <SyncModal
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        onUpdateCards={vi.fn()}
        auth={auth}
        sync={sync}
        onDownloadBackup={onDownloadBackup}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: /delete cloud account & data/i,
      }),
    )

    const checkbox = screen.getByRole('checkbox', {
      name: /download an offline backup/i,
    })
    expect(checkbox).toBeChecked()

    fireEvent.change(screen.getByPlaceholderText('DELETE'), {
      target: { value: 'DELETE' },
    })
    fireEvent.click(
      screen.getByRole('button', {
        name: /yes, delete cloud data/i,
      }),
    )

    await waitFor(() => {
      expect(onDownloadBackup).toHaveBeenCalledWith([])
    })
  })

  it('bypasses backup download if user unchecks the backup checkbox', async () => {
    const auth = new MockAuthService()
    auth.user = { id: 'user-del-3', email: 'no-backup@example.com' }
    const sync = new MockSyncService()
    const onDownloadBackup = vi.fn()

    render(
      <SyncModal
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        onUpdateCards={vi.fn()}
        auth={auth}
        sync={sync}
        onDownloadBackup={onDownloadBackup}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: /delete cloud account & data/i,
      }),
    )

    const checkbox = screen.getByRole('checkbox', {
      name: /download an offline backup/i,
    })
    fireEvent.click(checkbox)
    expect(checkbox).not.toBeChecked()

    fireEvent.change(screen.getByPlaceholderText('DELETE'), {
      target: { value: 'DELETE' },
    })
    fireEvent.click(
      screen.getByRole('button', {
        name: /yes, delete cloud data/i,
      }),
    )

    await waitFor(() => {
      expect(onDownloadBackup).not.toHaveBeenCalled()
    })
  })

  it('submits deletion via form submit (Enter key) when DELETE is typed', async () => {
    const auth = new MockAuthService()
    auth.user = { id: 'user-del-enter', email: 'enter@example.com' }
    const sync = new MockSyncService()
    const deleteAccountSpy = vi.spyOn(auth, 'deleteAccount')

    render(
      <SyncModal
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        onUpdateCards={vi.fn()}
        auth={auth}
        sync={sync}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: /delete cloud account & data/i,
      }),
    )

    const input = screen.getByPlaceholderText('DELETE')
    fireEvent.change(input, { target: { value: 'DELETE' } })

    const form = input.closest('form')!
    expect(form).toBeInTheDocument()
    fireEvent.submit(form)

    await waitFor(() => {
      expect(deleteAccountSpy).toHaveBeenCalled()
    })
  })

  it('displays error banner if deleteAccount returns failure', async () => {
    const auth = new MockAuthService()
    const sync = new MockSyncService()
    auth.user = { id: 'user-fail-del', email: 'fail-del@example.com' }

    vi.spyOn(auth, 'deleteAccount').mockResolvedValue({
      success: false,
      error: 'Cloud account deletion failed on server.',
    })

    render(
      <SyncModal
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        onUpdateCards={vi.fn()}
        auth={auth}
        sync={sync}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: /delete cloud account & data/i,
      }),
    )

    fireEvent.change(screen.getByPlaceholderText('DELETE'), {
      target: { value: 'DELETE' },
    })

    const confirmBtn = screen.getByRole('button', {
      name: /yes, delete cloud data/i,
    })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(
        screen.getByText(/cloud account deletion failed on server/i),
      ).toBeInTheDocument()
    })
  })

  it('invokes onOpenPrivacy callback when clicking Privacy Policy link', () => {
    const auth = new MockAuthService()
    const sync = new MockSyncService()
    const onOpenPrivacy = vi.fn()
    const onClose = vi.fn()

    render(
      <SyncModal
        isOpen={true}
        onClose={onClose}
        cards={[]}
        onUpdateCards={vi.fn()}
        auth={auth}
        sync={sync}
        onOpenPrivacy={onOpenPrivacy}
      />,
    )

    const privacyBtn = screen.getByRole('button', { name: /privacy policy/i })
    fireEvent.click(privacyBtn)

    expect(onClose).toHaveBeenCalled()
    expect(onOpenPrivacy).toHaveBeenCalled()
  })

  it('renders Acknowledgements link pointing to /acknowledgements in a new tab', () => {
    const auth = new MockAuthService()
    const sync = new MockSyncService()

    render(
      <SyncModal
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        onUpdateCards={vi.fn()}
        auth={auth}
        sync={sync}
      />,
    )

    const ackLink = screen.getByRole('link', { name: /acknowledgements/i })
    expect(ackLink).toBeInTheDocument()
    expect(ackLink).toHaveAttribute('href', '/acknowledgements')
    expect(ackLink).toHaveAttribute('target', '_blank')
    expect(ackLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('applies uniform legal link styling without competing button utility classes', () => {
    const auth = new MockAuthService()
    const sync = new MockSyncService()

    render(
      <SyncModal
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        onUpdateCards={vi.fn()}
        auth={auth}
        sync={sync}
      />,
    )

    const privacyBtn = screen.getByRole('button', { name: /privacy policy/i })
    const ackLink = screen.getByRole('link', { name: /acknowledgements/i })

    // Both legal links must share the dedicated link class
    expect(privacyBtn).toHaveClass('sync-privacy-link')
    expect(ackLink).toHaveClass('sync-privacy-link')

    // Neither element should carry .modal-link-btn, which introduces weight: 600 divergence
    expect(privacyBtn).not.toHaveClass('modal-link-btn')
    expect(ackLink).not.toHaveClass('modal-link-btn')
  })
})

describe('SyncModal First-Class OTP Code Entry', () => {
  it('immediately reveals 6-digit code input upon sending magic link without clicking paste link', async () => {
    const auth = new MockAuthService()
    const sync = new MockSyncService()

    render(
      <SyncModal
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        onUpdateCards={vi.fn()}
        auth={auth}
        sync={sync}
      />,
    )

    const emailInput = screen.getByLabelText(/email address/i)
    fireEvent.change(emailInput, { target: { value: 'learner@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send sign-in link/i }))

    await waitFor(() => {
      expect(
        screen.getByLabelText(/6-digit code or sign-in link/i),
      ).toBeInTheDocument()
    })

    const tokenInput = screen.getByLabelText(/6-digit code or sign-in link/i)
    expect(tokenInput).toHaveAttribute(
      'placeholder',
      'e.g. 123456 or paste link',
    )
    expect(
      screen.getByRole('button', { name: /sign in & sync/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /resend link/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /change email/i }),
    ).toBeInTheDocument()
  })

  it('signs in when 6-digit OTP code is entered and submitted', async () => {
    const auth = new MockAuthService()
    const sync = new MockSyncService()
    const verifySpy = vi.spyOn(auth, 'verifyOtp')

    render(
      <SyncModal
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        onUpdateCards={vi.fn()}
        auth={auth}
        sync={sync}
      />,
    )

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'otp-user@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send sign-in link/i }))

    await waitFor(() => {
      expect(
        screen.getByLabelText(/6-digit code or sign-in link/i),
      ).toBeInTheDocument()
    })

    const tokenInput = screen.getByLabelText(/6-digit code or sign-in link/i)
    fireEvent.change(tokenInput, { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in & sync/i }))

    await waitFor(() => {
      expect(verifySpy).toHaveBeenCalledWith('otp-user@example.com', '123456')
    })
  })

  it('allows changing email back to the email input form', async () => {
    const auth = new MockAuthService()
    const sync = new MockSyncService()

    render(
      <SyncModal
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        onUpdateCards={vi.fn()}
        auth={auth}
        sync={sync}
      />,
    )

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'wrong@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send sign-in link/i }))

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /change email/i }),
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /change email/i }))

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/6-digit code/i)).toBeNull()
  })

  it('dynamically styles numeric OTP tokens and switches inputMode adaptively', async () => {
    const auth = new MockAuthService()
    const sync = new MockSyncService()

    render(
      <SyncModal
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        onUpdateCards={vi.fn()}
        auth={auth}
        sync={sync}
      />,
    )

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'learner@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send sign-in link/i }))

    await waitFor(() => {
      expect(
        screen.getByLabelText(/6-digit code or sign-in link/i),
      ).toBeInTheDocument()
    })

    const tokenInput = screen.getByLabelText(/6-digit code or sign-in link/i)
    expect(tokenInput).not.toHaveClass('otp-code-input')
    expect(tokenInput).toHaveAttribute('inputmode', 'numeric')

    // Entering digits triggers otp-code-input styling
    fireEvent.change(tokenInput, { target: { value: '123456' } })
    expect(tokenInput).toHaveClass('otp-code-input')
    expect(tokenInput).toHaveAttribute('inputmode', 'numeric')

    // Entering URL removes otp-code-input and switches inputMode to text
    fireEvent.change(tokenInput, {
      target: { value: 'https://joli.to/#token=abc' },
    })
    expect(tokenInput).not.toHaveClass('otp-code-input')
    expect(tokenInput).toHaveAttribute('inputmode', 'text')
  })
})
