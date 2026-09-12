import { useEffect, useRef, useState } from 'react'
import {
  createDeckBackup,
  type RestoreMode,
} from '../../application/deck-backup'
import { downloadJsonFile } from '../../infrastructure/browser/download'
import { applyAnkiImport } from '../../application/anki-import'
import { parseAnkiDeck, type ParseAnkiResult } from '../../domain/anki-import'
import type { StudyCard } from '../../domain/card'

export interface DeckBackupModalProps {
  isOpen: boolean
  saveError?: string | null
  onClose: () => void
  cards: StudyCard[]
  deletedCardIds: string[]
  onUpdateCards: (
    newCards: StudyCard[],
    syncToCloud?: boolean,
    newDeletedCardIds?: string[],
  ) => boolean | void
  clock: { now(): number }
}

function DeckBackupModalInner({
  saveError,
  onClose,
  cards,
  deletedCardIds,
  onUpdateCards,
  clock,
}: Omit<DeckBackupModalProps, 'isOpen'>) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const [mode, setMode] = useState<RestoreMode>('replace')
  const [backupStatus, setBackupStatus] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
    details?: string[] | undefined
    saveFailed?: boolean
  } | null>(null)
  const [selectedImportData, setSelectedImportData] = useState<Extract<
    ParseAnkiResult,
    { success: true }
  > | null>(null)
  const [isParsingImport, setIsParsingImport] = useState(false)
  const importReadState = useRef({ generation: 0 })
  const [isExported, setIsExported] = useState(false)
  const exportedTimerRef = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const backupStatusRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (backupStatus?.type !== 'error') return
    backupStatusRef.current?.scrollIntoView({
      block: 'center',
      behavior: 'instant',
    })
  }, [backupStatus])

  useEffect(() => {
    const importState = importReadState.current
    return () => {
      importState.generation++
      if (exportedTimerRef.current !== null) {
        window.clearTimeout(exportedTimerRef.current)
      }
    }
  }, [])

  const handleExport = () => {
    const backup = createDeckBackup(cards, clock)
    downloadJsonFile(backup.filename, backup.json)
    setIsExported(true)
    if (exportedTimerRef.current !== null) {
      window.clearTimeout(exportedTimerRef.current)
    }
    exportedTimerRef.current = window.setTimeout(() => {
      setIsExported(false)
      exportedTimerRef.current = null
    }, 2500)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const generation = ++importReadState.current.generation
    setSelectedImportData(null)
    setIsParsingImport(true)
    setBackupStatus(null)

    try {
      const buffer = await file.arrayBuffer()
      if (generation !== importReadState.current.generation) return
      const bytes = new Uint8Array(buffer)
      const isZip = bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b

      let packageParser:
        | ((
            buf: Uint8Array | ArrayBuffer,
            now: number,
          ) => Promise<ParseAnkiResult>)
        | undefined
      if (isZip) {
        const { parseAnkiPackage } =
          await import('../../infrastructure/browser/anki-package')
        packageParser = parseAnkiPackage
      }

      const parsed = await parseAnkiDeck(
        buffer,
        file.name,
        clock.now(),
        packageParser,
      )
      if (generation !== importReadState.current.generation) return
      setIsParsingImport(false)
      if (parsed.success) {
        setSelectedImportData(parsed)
        const deckInfo = parsed.deckName ? ` from “${parsed.deckName}”` : ''
        const statsInfo = parsed.stats
          ? ` (${parsed.stats.newCount} new, ${parsed.stats.reviewCount} review)`
          : ''
        setBackupStatus({
          type: 'info',
          message: `Found ${parsed.count} cards${deckInfo}${statsInfo} ready to import.`,
        })
      } else {
        setSelectedImportData(null)
        setBackupStatus({
          type: 'error',
          message: parsed.error,
          details: parsed.details,
        })
      }
    } catch (err) {
      if (generation !== importReadState.current.generation) return
      setIsParsingImport(false)
      setSelectedImportData(null)
      setBackupStatus({
        type: 'error',
        message: `Failed to read file: ${err instanceof Error ? err.message : 'Unknown error'}`,
      })
    }
  }

  const handleRestore = () => {
    if (!selectedImportData) return
    // Commit the validated preview synchronously against the latest rendered deck.
    // A second asynchronous parse would capture stale cards during background sync.
    const result = applyAnkiImport(
      cards,
      selectedImportData,
      mode,
      deletedCardIds,
    )
    if (result.success) {
      if (onUpdateCards(result.cards) === false) {
        setBackupStatus({
          saveFailed: true,
          type: 'error',
          message:
            'Your cards couldn’t be saved. Free up device storage, then try importing again.',
        })
        return
      }
      const deckInfo = result.deckName ? ` from “${result.deckName}”` : ''
      setBackupStatus({
        type: 'success',
        message: `Imported ${result.addedCount} ${result.addedCount === 1 ? 'card' : 'cards'}${deckInfo}.${result.skippedCount ? ` Skipped ${result.skippedCount} ${result.skippedCount === 1 ? 'duplicate' : 'duplicates'}.` : ''}`,
      })
      setSelectedImportData(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } else {
      setBackupStatus({
        type: 'error',
        message: result.error,
        details: result.details,
      })
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-content backup-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-copy">
            <h2 id="backup-modal-title">Deck import & offline backup</h2>
            <p className="modal-subtitle">
              Import your Anki decks (*.apkg, *.txt, *.csv, *.tsv) or export
              offline JSON backups.
            </p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {backupStatus && (
          <div
            ref={backupStatusRef}
            className={`status-banner status-${backupStatus.type}`}
            role={backupStatus.type === 'error' ? 'alert' : 'status'}
          >
            <p>
              {backupStatus.saveFailed
                ? (saveError ?? backupStatus.message)
                : backupStatus.message}
            </p>
            {backupStatus.details && (
              <ul className="status-details">
                {backupStatus.details.map((detail, idx) => (
                  <li key={idx}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="backup-sections">
          <div className="backup-section export-section">
            <div className="backup-section-header">
              <h3>Export deck</h3>
              <p>
                Save all cards, schedules, notes, and study history to a JSON
                file.
              </p>
            </div>
            <button
              type="button"
              className={`primary-button export-button ${isExported ? 'is-exported' : ''}`}
              onClick={handleExport}
            >
              {isExported ? (
                <span className="export-button-exported">
                  <span className="export-button-check" aria-hidden="true">
                    ✓
                  </span>
                  <span className="export-button-text">Exported backup</span>
                </span>
              ) : (
                <>
                  Export backup (JSON) <span aria-hidden="true">↓</span>
                </>
              )}
            </button>
            <div className="sr-only" role="status" aria-live="polite">
              {isExported ? `Deck exported: ${cards.length} cards saved.` : ''}
            </div>
          </div>

          <div className="backup-section import-section">
            <div className="backup-section-header">
              <h3>Import Anki deck or backup</h3>
              <p>
                Load cards from an Anki package (.apkg), text export (.txt,
                .tsv, .csv), or Jolito backup (.json).
              </p>
            </div>

            <div
              className="import-mode-selector"
              role="radiogroup"
              aria-label="Import mode"
            >
              <label
                className={`mode-option ${mode === 'replace' ? 'is-selected' : ''}`}
              >
                <input
                  type="radio"
                  name="deckRestoreMode"
                  value="replace"
                  checked={mode === 'replace'}
                  onChange={() => setMode('replace')}
                />
                <span className="mode-label">
                  <strong>Restore</strong>
                  <small>Replace current deck</small>
                </span>
              </label>
              <label
                className={`mode-option ${mode === 'merge' ? 'is-selected' : ''}`}
              >
                <input
                  type="radio"
                  name="deckRestoreMode"
                  value="merge"
                  checked={mode === 'merge'}
                  onChange={() => setMode('merge')}
                />
                <span className="mode-label">
                  <strong>Merge</strong>
                  <small>Combine with current</small>
                </span>
              </label>
            </div>

            <div className="file-input-wrapper">
              <label
                htmlFor="deck-backup-file-input"
                className="file-input-label"
              >
                Choose Anki deck or backup file
              </label>
              <input
                id="deck-backup-file-input"
                ref={fileInputRef}
                type="file"
                accept=".apkg,.colpkg,.txt,.tsv,.csv,.json,application/json"
                className="backup-file-input"
                onChange={(e) => {
                  void handleFileChange(e)
                }}
                aria-label="Choose Anki deck or backup file"
              />
            </div>

            {selectedImportData && (
              <button
                type="button"
                className="secondary-button restore-confirm-button"
                disabled={isParsingImport}
                onClick={() => {
                  void handleRestore()
                }}
              >
                {mode === 'replace'
                  ? selectedImportData.deckName
                    ? `Import "${selectedImportData.deckName}" (Replace)`
                    : 'Import deck (Replace current)'
                  : selectedImportData.deckName
                    ? `Merge "${selectedImportData.deckName}" with library`
                    : 'Merge deck with library'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function DeckBackupModal(props: DeckBackupModalProps) {
  if (!props.isOpen) return null
  return <DeckBackupModalInner {...props} />
}
