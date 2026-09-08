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
      screen.getByText(/permanently delete your cloud backup/i),
    ).toBeInTheDocument()

    // Cancel hides confirmation
    const cancelBtn = screen.getByRole('button', { name: /cancel/i })
    fireEvent.click(cancelBtn)
    expect(
      screen.queryByText(/permanently delete your cloud backup/i),
    ).toBeNull()

    // Re-open confirmation and confirm
    fireEvent.click(
      screen.getByRole('button', {
        name: /delete cloud account & data/i,
      }),
    )

    const confirmBtn = screen.getByRole('button', {
      name: /yes, delete cloud data/i,
    })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(deleteRemoteDeckSpy).not.toHaveBeenCalled()
      expect(deleteAccountSpy).toHaveBeenCalled()
      expect(
        screen.getByText(/cloud account and backup data deleted/i),
      ).toBeInTheDocument()
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
})
