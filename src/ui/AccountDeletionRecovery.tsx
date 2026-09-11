import type { AccountDeletion } from '../application/ports'

export function AccountDeletionRecovery({
  deletion,
  canRetryCloud,
  busy,
  error,
  onRetryCloud,
  onRetryCleanup,
  onKeep,
}: {
  deletion: AccountDeletion
  canRetryCloud: boolean
  busy: boolean
  error: string | null
  onRetryCloud: () => void
  onRetryCleanup: () => void
  onKeep: () => void
}) {
  const confirmed = deletion.phase === 'confirmed'
  return (
    <main className="app-shell storage-recovery">
      <section aria-labelledby="deletion-recovery-title">
        <h1 id="deletion-recovery-title">Finish account deletion</h1>
        <p>
          {confirmed
            ? 'Your cloud account was deleted, but its copy on this device couldn’t be removed. Free up device storage, then try again.'
            : 'Account deletion hasn’t finished on this device. Your local deck has been kept.'}
        </p>
        <p>
          {confirmed
            ? 'Practice and sync are paused until the saved copy is removed.'
            : 'If another tab is deleting the account, let it finish. Otherwise, retry cloud deletion for the same account or keep the local deck.'}
        </p>
        {error && <p role="alert">{error}</p>}
        <div className="storage-recovery-actions">
          {confirmed ? (
            <button
              className="secondary-button"
              disabled={busy}
              onClick={onRetryCleanup}
            >
              Try again
            </button>
          ) : (
            <>
              {canRetryCloud && (
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={onRetryCloud}
                >
                  Retry cloud deletion
                </button>
              )}
              <button
                className="secondary-button"
                disabled={busy}
                onClick={onKeep}
              >
                Keep local deck
              </button>
            </>
          )}
          <button
            className="text-button"
            disabled={busy}
            onClick={() => window.location.reload()}
          >
            Reload Jolito
          </button>
        </div>
      </section>
    </main>
  )
}
