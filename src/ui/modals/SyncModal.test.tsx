import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MockAuthService } from '../../test/services'
import { SyncModal } from './SyncModal'

describe('SyncModal Account Deletion and Legal', () => {
  it('renders account deletion trigger when signed in and confirms deletion', async () => {
    const auth = new MockAuthService()
    auth.user = { id: 'user-del-1', email: 'delete-me@example.com' }
    const onSync = vi.fn().mockResolvedValue({ success: true })
    const deleteAccountSpy = vi.spyOn(auth, 'deleteAccount')

    render(
      <SyncModal
        onDeleteAccount={() => auth.deleteAccount()}
        user={auth.user}
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={onSync}
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
      expect(deleteAccountSpy).toHaveBeenCalled()
      expect(
        screen.getByText(/cloud account and backup data deleted/i),
      ).toBeInTheDocument()
    })
  })

  it('triggers onDownloadBackup before deletion when backup checkbox is checked', async () => {
    const auth = new MockAuthService()
    auth.user = { id: 'user-del-2', email: 'backup-del@example.com' }
    const onSync = vi.fn().mockResolvedValue({ success: true })
    const onDownloadBackup = vi.fn()

    render(
      <SyncModal
        onDeleteAccount={() => auth.deleteAccount()}
        user={auth.user}
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={onSync}
        onDownloadBackup={onDownloadBackup}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: /delete cloud account & data/i,
      }),
    )

    const checkbox = screen.getByRole('checkbox', {
      name: /(?:save|download) an offline backup/i,
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

  it('halts deletion and shows info banner when backup is canceled', async () => {
    const downloadModule = await import('../../infrastructure/browser/download')
    const downloadSpy = vi
      .spyOn(downloadModule, 'downloadJsonFile')
      .mockResolvedValueOnce('canceled')

    const auth = new MockAuthService()
    auth.user = { id: 'user-del-cancel', email: 'cancel@example.com' }
    const onDeleteAccount = vi.fn()

    render(
      <SyncModal
        onDeleteAccount={onDeleteAccount}
        user={auth.user}
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={vi.fn()}
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
    fireEvent.click(
      screen.getByRole('button', {
        name: /yes, delete cloud data/i,
      }),
    )

    await waitFor(() => {
      expect(
        screen.getByText(
          'Account deletion cancelled because backup was not saved.',
        ),
      ).toBeInTheDocument()
    })
    expect(onDeleteAccount).not.toHaveBeenCalled()
    downloadSpy.mockRestore()
  })

  it('halts deletion and shows alert banner when backup fails with error', async () => {
    const downloadModule = await import('../../infrastructure/browser/download')
    const downloadSpy = vi
      .spyOn(downloadModule, 'downloadJsonFile')
      .mockResolvedValueOnce('error')

    const auth = new MockAuthService()
    auth.user = { id: 'user-del-err', email: 'err@example.com' }
    const onDeleteAccount = vi.fn()

    render(
      <SyncModal
        onDeleteAccount={onDeleteAccount}
        user={auth.user}
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={vi.fn()}
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
    fireEvent.click(
      screen.getByRole('button', {
        name: /yes, delete cloud data/i,
      }),
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Account deletion stopped because backup could not be saved.',
      )
    })
    expect(onDeleteAccount).not.toHaveBeenCalled()
    downloadSpy.mockRestore()
  })

  it('bypasses backup download if user unchecks the backup checkbox', async () => {
    const auth = new MockAuthService()
    auth.user = { id: 'user-del-3', email: 'no-backup@example.com' }
    const onSync = vi.fn().mockResolvedValue({ success: true })
    const onDownloadBackup = vi.fn()

    render(
      <SyncModal
        onDeleteAccount={() => auth.deleteAccount()}
        user={auth.user}
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={onSync}
        onDownloadBackup={onDownloadBackup}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: /delete cloud account & data/i,
      }),
    )

    const checkbox = screen.getByRole('checkbox', {
      name: /(?:save|download) an offline backup/i,
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
    const onSync = vi.fn().mockResolvedValue({ success: true })
    const deleteAccountSpy = vi.spyOn(auth, 'deleteAccount')

    render(
      <SyncModal
        onDeleteAccount={() => auth.deleteAccount()}
        user={auth.user}
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={onSync}
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
    const onSync = vi.fn().mockResolvedValue({ success: true })
    auth.user = { id: 'user-fail-del', email: 'fail-del@example.com' }

    vi.spyOn(auth, 'deleteAccount').mockResolvedValue({
      success: false,
      error: 'Cloud account deletion failed on server.',
    })

    render(
      <SyncModal
        onDeleteAccount={() => auth.deleteAccount()}
        user={auth.user}
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={onSync}
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

  it('invokes onOpenPrivacy callback when clicking Privacy link', () => {
    const auth = new MockAuthService()
    const onSync = vi.fn().mockResolvedValue({ success: true })
    const onOpenPrivacy = vi.fn()
    const onClose = vi.fn()

    render(
      <SyncModal
        onDeleteAccount={() => auth.deleteAccount()}
        user={auth.user}
        isOpen={true}
        onClose={onClose}
        cards={[]}
        auth={auth}
        onSync={onSync}
        onOpenPrivacy={onOpenPrivacy}
      />,
    )

    const privacyBtn = screen.getByRole('button', { name: /^privacy$/i })
    fireEvent.click(privacyBtn)

    expect(onClose).toHaveBeenCalled()
    expect(onOpenPrivacy).toHaveBeenCalled()
  })

  it('invokes onOpenFeedback callback when clicking Feedback link', () => {
    const auth = new MockAuthService()
    const onSync = vi.fn().mockResolvedValue({ success: true })
    const onOpenFeedback = vi.fn()
    const onClose = vi.fn()

    render(
      <SyncModal
        onDeleteAccount={() => auth.deleteAccount()}
        user={auth.user}
        isOpen={true}
        onClose={onClose}
        cards={[]}
        auth={auth}
        onSync={onSync}
        onOpenFeedback={onOpenFeedback}
      />,
    )

    const feedbackBtn = screen.getByRole('button', { name: /^feedback$/i })
    fireEvent.click(feedbackBtn)

    expect(onClose).toHaveBeenCalled()
    expect(onOpenFeedback).toHaveBeenCalled()
  })

  it('renders Acknowledgements link pointing to /acknowledgements in a new tab', () => {
    const auth = new MockAuthService()
    const onSync = vi.fn().mockResolvedValue({ success: true })

    render(
      <SyncModal
        onDeleteAccount={() => auth.deleteAccount()}
        user={auth.user}
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={onSync}
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
    const onSync = vi.fn().mockResolvedValue({ success: true })

    render(
      <SyncModal
        onDeleteAccount={() => auth.deleteAccount()}
        user={auth.user}
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={onSync}
      />,
    )

    const privacyBtn = screen.getByRole('button', { name: /^privacy$/i })
    const feedbackBtn = screen.getByRole('button', { name: /^feedback$/i })
    const ackLink = screen.getByRole('link', { name: /acknowledgements/i })

    // All legal links must share the dedicated link class
    expect(privacyBtn).toHaveClass('sync-privacy-link')
    expect(feedbackBtn).toHaveClass('sync-privacy-link')
    expect(ackLink).toHaveClass('sync-privacy-link')

    // Neither element should carry .modal-link-btn, which introduces weight: 600 divergence
    expect(privacyBtn).not.toHaveClass('modal-link-btn')
    expect(feedbackBtn).not.toHaveClass('modal-link-btn')
    expect(ackLink).not.toHaveClass('modal-link-btn')
  })
})

describe('SyncModal First-Class OTP Code Entry', () => {
  it('immediately reveals 6-digit code input upon sending magic link without clicking paste link', async () => {
    const auth = new MockAuthService()
    const onSync = vi.fn().mockResolvedValue({ success: true })

    render(
      <SyncModal
        onDeleteAccount={() => auth.deleteAccount()}
        user={auth.user}
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={onSync}
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
    const onSync = vi.fn().mockResolvedValue({ success: true })
    const verifySpy = vi.spyOn(auth, 'verifyOtp')

    const { rerender } = render(
      <SyncModal
        onDeleteAccount={() => auth.deleteAccount()}
        user={auth.user}
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={onSync}
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
    rerender(
      <SyncModal
        onDeleteAccount={() => auth.deleteAccount()}
        user={auth.user}
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={onSync}
      />,
    )
    expect(screen.getByText('otp-user@example.com')).toBeVisible()
  })

  it('allows changing email back to the email input form', async () => {
    const auth = new MockAuthService()
    const onSync = vi.fn().mockResolvedValue({ success: true })

    render(
      <SyncModal
        onDeleteAccount={() => auth.deleteAccount()}
        user={auth.user}
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={onSync}
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
    const onSync = vi.fn().mockResolvedValue({ success: true })

    render(
      <SyncModal
        onDeleteAccount={() => auth.deleteAccount()}
        user={auth.user}
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={onSync}
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
    expect(tokenInput).toHaveAttribute('name', 'one-time-code')
    expect(tokenInput).toHaveAttribute('autocomplete', 'one-time-code')

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

  it('normalizes domain-bound code (@joli.to #123456) when clicking paste from clipboard', async () => {
    const auth = new MockAuthService()
    const onSync = vi.fn().mockResolvedValue({ success: true })
    const readTextSpy = vi.fn().mockResolvedValue('@joli.to #839201')
    Object.defineProperty(navigator, 'clipboard', {
      value: { readText: readTextSpy },
      configurable: true,
      writable: true,
    })

    render(
      <SyncModal
        onDeleteAccount={() => auth.deleteAccount()}
        user={auth.user}
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={onSync}
      />,
    )

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'domain-paster@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send sign-in link/i }))

    const tokenInput = await screen.findByLabelText(
      /6-digit code or sign-in link/i,
    )
    const pasteBtn = screen.getByRole('button', {
      name: /paste from clipboard/i,
    })

    fireEvent.click(pasteBtn)

    await waitFor(() => {
      expect(tokenInput).toHaveValue('839201')
    })
    expect(tokenInput).toHaveClass('otp-code-input')
  })

  it('normalizes domain-bound code during native paste event and allows successful sign-in', async () => {
    const auth = new MockAuthService()
    const onSync = vi.fn().mockResolvedValue({ success: true })

    render(
      <SyncModal
        onDeleteAccount={() => auth.deleteAccount()}
        user={auth.user}
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={onSync}
      />,
    )

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'native-paster@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send sign-in link/i }))

    const tokenInput = await screen.findByLabelText(
      /6-digit code or sign-in link/i,
    )

    // Simulate native clipboard paste
    fireEvent.paste(tokenInput, {
      clipboardData: {
        getData: (format: string) =>
          format === 'text' ? '@joli.to #839201' : '',
      },
    })

    expect(tokenInput).toHaveValue('839201')
    expect(tokenInput).toHaveClass('otp-code-input')

    // Submit form and verify sign-in completes
    fireEvent.click(screen.getByRole('button', { name: /sign in & sync/i }))

    await waitFor(() => {
      expect(auth.user?.email).toBe('native-paster@example.com')
    })
  })

  it('normalizes domain-bound code during direct input change', async () => {
    const auth = new MockAuthService()
    const onSync = vi.fn().mockResolvedValue({ success: true })

    render(
      <SyncModal
        onDeleteAccount={() => auth.deleteAccount()}
        user={auth.user}
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={onSync}
      />,
    )

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'direct-input@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send sign-in link/i }))

    const tokenInput = await screen.findByLabelText(
      /6-digit code or sign-in link/i,
    )

    fireEvent.change(tokenInput, {
      target: { value: '@joli.to # 482-910' },
    })

    expect(tokenInput).toHaveValue('482910')
    expect(tokenInput).toHaveClass('otp-code-input')
  })
})

it('keeps sign-out storage failure actionable and reports success only after retry', async () => {
  const auth = new MockAuthService()
  auth.user = { id: 'A', email: 'a@example.com' }
  const signOut = vi
    .spyOn(auth, 'signOut')
    .mockRejectedValueOnce(new DOMException('Access denied', 'SecurityError'))
  render(
    <SyncModal
      onDeleteAccount={() => auth.deleteAccount()}
      user={auth.user}
      isOpen={true}
      onClose={vi.fn()}
      cards={[]}
      auth={auth}
      onSync={vi.fn().mockResolvedValue({ success: true })}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
  await screen.findByText(/session could not be removed/i)
  expect(auth.user?.id).toBe('A')
  fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
  await waitFor(() => expect(auth.user).toBeNull())
  expect(signOut).toHaveBeenCalledTimes(2)
})

describe('sync update recovery', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('offers Update & Reload action on http without closing the active session, and clears it after a successful retry', async () => {
    vi.stubGlobal('location', { protocol: 'http:' })
    const auth = new MockAuthService()
    auth.user = { id: 'upgrade', email: 'upgrade@example.com' }
    const close = vi.fn()
    const sync = vi
      .fn()
      .mockResolvedValueOnce({
        success: false,
        error: 'Update Jolito to sync.',
        syncHelp: true,
      })
      .mockResolvedValueOnce({ success: true })
    render(
      <SyncModal
        user={auth.user}
        onDeleteAccount={() => auth.deleteAccount()}
        isOpen
        onClose={close}
        cards={[]}
        auth={auth}
        onSync={sync}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /sync now/i }))
    const updateBtn = await screen.findByRole('button', {
      name: 'Update & Reload',
    })
    expect(updateBtn).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'How to update' })).toBeNull()
    expect(close).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /sync now/i }))
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Update & Reload' }),
      ).toBeNull(),
    )
    expect(close).not.toHaveBeenCalled()
  })

  it('renders How to update link and omits Update & Reload button on capacitor runtime', async () => {
    vi.stubGlobal('location', { protocol: 'capacitor:' })
    const auth = new MockAuthService()
    auth.user = { id: 'upgrade', email: 'upgrade@example.com' }
    const sync = vi.fn().mockResolvedValue({
      success: false,
      error: 'Update Jolito to sync.',
      syncHelp: true,
    })
    render(
      <SyncModal
        user={auth.user}
        onDeleteAccount={() => auth.deleteAccount()}
        isOpen
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={sync}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /sync now/i }))
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'Update & Reload' })).toBeNull()
    const helpLink = screen.getByRole('link', { name: 'How to update' })
    expect(helpLink).toBeInTheDocument()
    expect(helpLink).toHaveAttribute('href', 'https://joli.to/update')
    expect(helpLink).toHaveAttribute('target', '_blank')
    expect(helpLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('omits update action on generic or transient sync errors', async () => {
    const auth = new MockAuthService()
    auth.user = { id: 'network-user', email: 'user@example.com' }
    const sync = vi.fn().mockResolvedValue({
      success: false,
      error: 'Network connection timed out. Please try again.',
    })
    render(
      <SyncModal
        user={auth.user}
        onDeleteAccount={() => auth.deleteAccount()}
        isOpen
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={sync}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /sync now/i }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'Network connection timed out. Please try again.',
    )
    expect(screen.queryByRole('button', { name: 'Update & Reload' })).toBeNull()
  })
})

describe('SyncModal iOS Keyboard and Autofocus Avoidance', () => {
  const originalNavigator = window.navigator

  afterEach(() => {
    Object.defineProperty(window, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    })
  })

  it('disables autofocus on iOS for email input to prevent software keyboard occlusion', () => {
    Object.defineProperty(window, 'navigator', {
      value: {
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      },
      configurable: true,
      writable: true,
    })

    const auth = new MockAuthService()
    render(
      <SyncModal
        user={null}
        onDeleteAccount={() => auth.deleteAccount()}
        isOpen
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={vi.fn()}
      />,
    )

    const emailInput = screen.getByLabelText(/email address/i)
    // In React 19, boolean autoFocus false does not set autofocus attribute in DOM
    expect(emailInput.getAttribute('autofocus')).toBeNull()
    expect(document.activeElement).not.toBe(emailInput)
  })

  it('disables autofocus on iOS for OTP input after magic link is sent', async () => {
    Object.defineProperty(window, 'navigator', {
      value: {
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      },
      configurable: true,
      writable: true,
    })

    const auth = new MockAuthService()
    render(
      <SyncModal
        user={null}
        onDeleteAccount={() => auth.deleteAccount()}
        isOpen
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={vi.fn()}
      />,
    )

    const emailInput = screen.getByLabelText(/email address/i)
    fireEvent.change(emailInput, { target: { value: 'learner@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send sign-in link/i }))

    const otpInput = await screen.findByLabelText(
      /6-digit code or sign-in link/i,
    )
    expect(otpInput.getAttribute('autofocus')).toBeNull()
    expect(document.activeElement).not.toBe(otpInput)
  })

  it('enables autofocus on desktop environments with fine pointer', () => {
    const auth = new MockAuthService()
    render(
      <SyncModal
        user={null}
        onDeleteAccount={() => auth.deleteAccount()}
        isOpen
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={vi.fn()}
      />,
    )

    const emailInput = screen.getByLabelText(/email address/i)
    expect(document.activeElement).toBe(emailInput)
  })

  it('does not autofocus delete confirmation input on iOS', () => {
    vi.useFakeTimers()
    Object.defineProperty(window, 'navigator', {
      value: {
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      },
      configurable: true,
      writable: true,
    })

    const auth = new MockAuthService()
    auth.user = { id: 'user-del-ios', email: 'delete-me@example.com' }
    render(
      <SyncModal
        user={auth.user}
        onDeleteAccount={() => auth.deleteAccount()}
        isOpen
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={vi.fn()}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: /delete cloud account & data/i }),
    )

    const deleteInput = screen.getByPlaceholderText('DELETE')
    vi.advanceTimersByTime(50)
    expect(document.activeElement).not.toBe(deleteInput)
    vi.useRealTimers()
  })
})

describe('SyncModal Live Sync Status Contract', () => {
  const user = { id: 'usr-1', email: 'learner@example.com' }
  const createMockAuth = () => {
    const auth = new MockAuthService()
    auth.user = user
    return auth
  }

  it('renders "Syncing…" status and active spinning cloud sticker when syncStatus is syncing', () => {
    const auth = createMockAuth()
    const { container } = render(
      <SyncModal
        user={user}
        onDeleteAccount={vi.fn()}
        isOpen
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={vi.fn()}
        syncStatus="syncing"
        isOnline
      />,
    )

    expect(screen.getByText('Signed in')).toBeInTheDocument()
    const statusText = container.querySelector('.sync-status-text')
    expect(statusText).toHaveTextContent('Syncing…')
    expect(statusText).toHaveClass('is-syncing')

    const sticker = container.querySelector('.cloud-check-sticker')
    expect(sticker).toHaveClass('status-syncing')
    expect(
      container.querySelector('.sticker-spinner.is-spinning'),
    ).not.toBeNull()
    const syncBtn = screen.getByRole('button', { name: /syncing…/i })
    expect(syncBtn).toBeDisabled()
  })

  it('renders "Synced" status and checkmark sticker when syncStatus is synced', () => {
    const auth = createMockAuth()
    const { container } = render(
      <SyncModal
        user={user}
        onDeleteAccount={vi.fn()}
        isOpen
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={vi.fn()}
        syncStatus="synced"
        isOnline
      />,
    )

    expect(screen.getByText('Signed in')).toBeInTheDocument()
    const statusText = container.querySelector('.sync-status-text')
    expect(statusText).toHaveTextContent('Synced')
    expect(statusText).toHaveClass('is-synced')

    const sticker = container.querySelector('.cloud-check-sticker')
    expect(sticker).toHaveClass('status-synced')
    expect(container.querySelector('.sticker-spinner')).toBeNull()
  })

  it('renders "Sync issue" status and error sticker when syncStatus is error', () => {
    const auth = createMockAuth()
    const { container } = render(
      <SyncModal
        user={user}
        onDeleteAccount={vi.fn()}
        isOpen
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={vi.fn()}
        syncStatus="error"
        isOnline
      />,
    )

    const statusText = container.querySelector('.sync-status-text')
    expect(statusText).toHaveTextContent('Sync issue')
    expect(statusText).toHaveClass('is-error')

    const sticker = container.querySelector('.cloud-check-sticker')
    expect(sticker).toHaveClass('status-error')
  })

  it('renders "Offline" status and disables sync button when isOnline is false', () => {
    const auth = createMockAuth()
    const { container } = render(
      <SyncModal
        user={user}
        onDeleteAccount={vi.fn()}
        isOpen
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={vi.fn()}
        syncStatus="idle"
        isOnline={false}
      />,
    )

    const statusText = container.querySelector('.sync-status-text')
    expect(statusText).toHaveTextContent('Offline')
    expect(statusText).toHaveClass('is-offline')

    const sticker = container.querySelector('.cloud-check-sticker')
    expect(sticker).toHaveClass('status-offline')

    const syncBtn = screen.getByRole('button', { name: /sync now/i })
    expect(syncBtn).toBeDisabled()
  })

  it('re-enables "Sync now" button when background sync finishes without showing transient feedback', () => {
    const auth = createMockAuth()
    const { rerender } = render(
      <SyncModal
        user={user}
        onDeleteAccount={vi.fn()}
        isOpen
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={vi.fn()}
        syncStatus="syncing"
        isOnline
      />,
    )

    expect(screen.getByRole('button', { name: /syncing…/i })).toBeDisabled()

    rerender(
      <SyncModal
        user={user}
        onDeleteAccount={vi.fn()}
        isOpen
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={vi.fn()}
        syncStatus="synced"
        isOnline
      />,
    )

    expect(screen.queryByText('Synced!')).toBeNull()
    const syncNowBtn = screen.getByRole('button', { name: /sync now/i })
    expect(syncNowBtn).toBeEnabled()
  })

  it('triggers transient "Synced!" only on explicit user click of Sync now', async () => {
    const auth = createMockAuth()
    const onSync = vi.fn().mockResolvedValue({ success: true })
    render(
      <SyncModal
        user={user}
        onDeleteAccount={vi.fn()}
        isOpen
        onClose={vi.fn()}
        cards={[]}
        auth={auth}
        onSync={onSync}
        syncStatus="synced"
        isOnline
      />,
    )

    const syncBtn = screen.getByRole('button', { name: /sync now/i })
    fireEvent.click(syncBtn)
    await screen.findByText('Synced!')
    expect(onSync).toHaveBeenCalledTimes(1)
  })
})
