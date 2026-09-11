import { useState } from 'react'
import type { CardLoadResult } from '../application/ports'
import { downloadJsonFile } from '../infrastructure/browser/download'

export function StorageRecovery({
  recovery,
  onRetry,
}: {
  recovery: Extract<CardLoadResult, { status: 'recovery' }>
  onRetry: () => void
}) {
  const [downloadError, setDownloadError] = useState(false)
  return (
    <main className="app-shell storage-recovery">
      <section aria-labelledby="storage-recovery-title">
        <h1 id="storage-recovery-title">Let’s protect your saved deck</h1>
        <p>{recovery.message}</p>
        <p>
          Your saved data hasn’t been replaced. Practice and sync are paused
          until your deck can be opened.
        </p>
        <div className="storage-recovery-actions">
          {recovery.raw !== null && (
            <button
              className="primary-button"
              onClick={() => {
                try {
                  downloadJsonFile('jolito-recovery.json', recovery.raw!)
                  setDownloadError(false)
                } catch {
                  setDownloadError(true)
                }
              }}
            >
              Download saved data
            </button>
          )}
          <button className="secondary-button" onClick={onRetry}>
            Try again
          </button>
          <button
            className="text-button"
            onClick={() => window.location.reload()}
          >
            Reload Jolito
          </button>
          <a className="text-button" href="mailto:a@joli.to">
            Get help
          </a>
        </div>
        {downloadError && (
          <p role="alert">
            The download couldn’t start. Allow downloads in your browser, then
            try again.
          </p>
        )}
      </section>
    </main>
  )
}
