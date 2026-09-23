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
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDownloaded, setIsDownloaded] = useState(false)
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
              disabled={isDownloading}
              aria-busy={isDownloading}
              onClick={() => {
                if (isDownloading) return
                setIsDownloading(true)
                void (async () => {
                  try {
                    const outcome = await downloadJsonFile(
                      'jolito-recovery.json',
                      recovery.raw!,
                    )
                    if (outcome === 'error') {
                      setDownloadError(true)
                    } else if (outcome === 'completed') {
                      setDownloadError(false)
                      setIsDownloaded(true)
                    }
                  } finally {
                    setIsDownloading(false)
                  }
                })()
              }}
            >
              {isDownloaded ? 'Saved data downloaded ✓' : 'Download saved data'}
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
          <p className="storage-save-error" role="alert">
            Unable to download saved data. Please try again.
          </p>
        )}
      </section>
    </main>
  )
}
