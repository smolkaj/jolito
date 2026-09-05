import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import celebrateUrl from '../assets/jolito-celebrate.png'
import logoUrl from '../assets/jolito-welcome.png'
import sampleAguacateUrl from '../assets/sample-aguacate.png'
import { createCards } from './application/create-cards'
import { importAnkiDeck } from './application/anki-import'
import { createDeckBackup, type RestoreMode } from './application/deck-backup'
import { syncDeckWithCloud } from './application/deck-sync'
import type { AppServices, AuthUser, SyncService } from './application/ports'
import {
  filterOutStarterCards,
  starterCards,
} from './application/starter-cards'
import { compareAnswer, type DiffSegment } from './domain/answer'
import {
  burySiblingCards,
  getCardsStudiedToday,
  grades,
  intervalLabel,
  isDue,
  orderCardsForReview,
  scheduleReview,
  shouldRequeueInSession,
  updateStudyCard,
  deleteStudyCard,
  DEFAULT_STUDY_BATCH_SIZE,
  type Grade,
  type StudyCard,
  type UpdateCardParams,
} from './domain/card'
import {
  filterDeckCards,
  getDeckStats,
  type DeckFilterState,
  type DeckSortOrder,
} from './application/deck-management'
import { findDuplicateNoteCards, getDuplicateGroups } from './domain/duplicate'
import type { AutocompleteSuggestion, LexiconEntry } from './domain/lexicon'
import { parseAnkiDeck } from './domain/anki-import'
import { reconcileStudyCards, type SyncStatus } from './domain/sync'
import { isIOS, isStandalone } from './infrastructure/browser/environment'
import { downloadJsonFile } from './infrastructure/browser/download'
import { createBrowserServices } from './infrastructure/browser/services'
import { checkOrRequestStoragePersistence } from './infrastructure/browser/storage-persistence'
import {
  type View,
  hashForView,
  titleForView,
  viewFromHash,
} from './navigation'
import {
  CloudCheckIcon,
  CloudOffIcon,
  JolitoMark,
  MexicoFlag,
  SyncAlertIcon,
  SyncSpinnerIcon,
  UsFlag,
  UserIcon,
} from './ui/icons'
import { AudioButton } from './ui/AudioButton'
import { EditCardModal } from './ui/modals/EditCardModal'
import { SyncModal } from './ui/modals/SyncModal'
import { FeedbackModal } from './ui/modals/FeedbackModal'
import { handleFocusSelect } from './ui/utils'

const gradeLabels: Record<Grade, string> = {
  again: 'Again',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
}

const localeForPrompt = (card: StudyCard) =>
  card.direction === 'es-en' ? 'es-MX' : 'en-US'

const localeForAnswer = (card: StudyCard) =>
  card.direction === 'es-en' ? 'en-US' : 'es-MX'

function Brand({ onClick }: { onClick?: () => void }) {
  const content = (
    <>
      <JolitoMark className="brand-mark" />
      <span>Jolito</span>
    </>
  )

  return onClick ? (
    <button
      className="brand"
      type="button"
      onClick={onClick}
      aria-label="Jolito home"
    >
      {content}
    </button>
  ) : (
    <div className="brand">{content}</div>
  )
}

function renderDiffSegments(segments: DiffSegment[]) {
  return segments.map((seg, i) => {
    const isSpaceOnly = /^ +$/.test(seg.value)
    return (
      <span
        className={`diff-seg diff-seg-${seg.status}${
          isSpaceOnly ? ' diff-seg-space' : ''
        }`}
        key={i}
      >
        {isSpaceOnly && seg.status === 'extra' ? '␣' : seg.value}
      </span>
    )
  })
}

function AnswerComparison({
  typed,
  expected,
  onPlayAudio,
}: {
  typed: string
  expected: string
  onPlayAudio: () => void
}) {
  const comparison = compareAnswer(typed, expected)
  const hasTyped = typed.trim().length > 0

  if (comparison.isExact) {
    return (
      <div className="diff-exact-card" aria-label="Answer comparison">
        <p className="diff-text diff-match">{expected}</p>
        <AudioButton label="Play answer audio" onClick={onPlayAudio} />
      </div>
    )
  }

  return (
    <div className="diff-card" aria-label="Answer comparison">
      <div className="diff-rows">
        {hasTyped && (
          <div className="diff-row">
            <span className="diff-label">You wrote</span>
            <p className="diff-text">
              {renderDiffSegments(comparison.typedSegments)}
            </p>
          </div>
        )}

        <div className="diff-row expected-row">
          <span className="diff-label">Expected</span>
          <div className="diff-row-main">
            <p className="diff-text">
              {renderDiffSegments(comparison.expectedSegments)}
            </p>
            <AudioButton label="Play answer audio" onClick={onPlayAudio} />
          </div>
        </div>
      </div>
    </div>
  )
}
interface PendingCardParams {
  spanish: string
  english: string
  context: string
  bidirectional: boolean
  reversePrompt: string
  reverseAnswer: string
}

function getCardScheduleBadge(
  card: StudyCard,
  now: number,
): {
  label: string
  type: 'due' | 'new' | 'learning' | 'review'
} {
  if (isDue(card, now)) {
    return { label: 'Due now', type: 'due' }
  }
  const state = card.schedule.state
  if (state === 'new') {
    return { label: 'Unstudied', type: 'new' }
  }
  if (state === 'learning' || state === 'relearning') {
    return { label: 'Learning', type: 'learning' }
  }
  const msUntilDue = card.schedule.dueAt - now
  const daysUntilDue = Math.max(
    1,
    Math.round(msUntilDue / (24 * 60 * 60 * 1000)),
  )
  return { label: `Due in ${daysUntilDue}d`, type: 'review' }
}

function DeleteCardsModal({
  isOpen,
  cards,
  onClose,
  onConfirm,
}: {
  isOpen: boolean
  cards: StudyCard[] | null
  onClose: () => void
  onConfirm: (cards: StudyCard[]) => void
}) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !cards || cards.length === 0) return null

  const isSingle = cards.length === 1
  const singleCard = cards[0]!

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-content delete-card-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-card-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-copy">
            <h2 id="delete-card-modal-title">
              {isSingle
                ? 'Delete flashcard?'
                : `Delete ${cards.length} flashcards?`}
            </h2>
            <p className="modal-subtitle">
              {isSingle
                ? 'This card will be removed from your deck and scheduled reviews.'
                : 'These cards will be permanently removed from your deck and scheduled reviews.'}
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

        {isSingle ? (
          <div className="delete-card-preview-card">
            <p className="delete-card-prompt">
              <strong>Prompt:</strong> {singleCard.prompt}
            </p>
            <p className="delete-card-answer">
              <strong>Answer:</strong> {singleCard.answer}
            </p>
            {singleCard.context && (
              <p className="delete-card-context">
                <strong>Context:</strong> {singleCard.context}
              </p>
            )}
          </div>
        ) : (
          <div className="delete-cards-preview-list">
            <p className="delete-cards-count-label">
              Selected cards to delete ({cards.length}):
            </p>
            <ul className="delete-cards-summary-list">
              {cards.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <strong>{c.prompt}</strong> → {c.answer}
                </li>
              ))}
              {cards.length > 5 && (
                <li className="delete-cards-more">
                  …and {cards.length - 5} more cards
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="delete-modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="danger-button"
            onClick={() => onConfirm(cards)}
          >
            {isSingle ? 'Delete card' : `Delete ${cards.length} cards`}
          </button>
        </div>
      </div>
    </div>
  )
}

function DeckBackupModalInner({
  onClose,
  cards,
  deletedCardIds = [],
  onUpdateCards,
  clock,
  user,
  sync,
}: {
  onClose: () => void
  cards: StudyCard[]
  deletedCardIds?: string[]
  onUpdateCards: (
    newCards: StudyCard[],
    syncToCloud?: boolean,
    newDeletedCardIds?: string[],
  ) => void
  clock: { now(): number }
  user: AuthUser | null
  sync: SyncService
}) {
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
  } | null>(null)
  const [selectedImportData, setSelectedImportData] = useState<{
    fileData: ArrayBuffer | string
    filename: string
    count: number
    deckName?: string | undefined
    stats?:
      | { newCount: number; reviewCount: number; learningCount: number }
      | undefined
  } | null>(null)
  const [isParsingImport, setIsParsingImport] = useState(false)
  const [isExported, setIsExported] = useState(false)
  const exportedTimerRef = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
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
    setIsParsingImport(true)
    setBackupStatus(null)

    try {
      const buffer = await file.arrayBuffer()
      const parsed = await parseAnkiDeck(buffer, file.name, clock.now())
      setIsParsingImport(false)
      if (parsed.success) {
        setSelectedImportData({
          fileData: buffer,
          filename: file.name,
          count: parsed.count,
          deckName: parsed.deckName,
          stats: parsed.stats,
        })
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
      setIsParsingImport(false)
      setSelectedImportData(null)
      setBackupStatus({
        type: 'error',
        message: `Failed to read file: ${err instanceof Error ? err.message : 'Unknown error'}`,
      })
    }
  }

  const handleRestore = async () => {
    if (!selectedImportData) return
    const result = await importAnkiDeck(
      cards,
      selectedImportData.fileData,
      mode,
      clock,
      selectedImportData.filename,
    )
    if (result.success) {
      onUpdateCards(result.cards)
      const deckInfo = result.deckName ? ` from “${result.deckName}”` : ''
      setBackupStatus({
        type: 'success',
        message: `Successfully imported ${result.importedCount} cards${deckInfo} (${result.count} total cards in library).`,
      })
      setSelectedImportData(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      if (user) {
        void syncDeckWithCloud({
          localCards: result.cards,
          localDeletedIds: deletedCardIds,
          user,
          syncService: sync,
          onCardsUpdated: (newCards, newDeletedIds) =>
            onUpdateCards(newCards, false, newDeletedIds),
        })
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
            className={`status-banner status-${backupStatus.type}`}
            role={backupStatus.type === 'error' ? 'alert' : 'status'}
          >
            <p>{backupStatus.message}</p>
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

function DeckBackupModal(props: {
  isOpen: boolean
  onClose: () => void
  cards: StudyCard[]
  deletedCardIds?: string[]
  onUpdateCards: (
    newCards: StudyCard[],
    syncToCloud?: boolean,
    newDeletedCardIds?: string[],
  ) => void
  clock: { now(): number }
  user: AuthUser | null
  sync: SyncService
}) {
  if (!props.isOpen) return null
  return <DeckBackupModalInner {...props} />
}

interface DemoDeckModalProps {
  isOpen: boolean
  onClose: () => void
  onSignIn: () => void
}

function DemoDeckModal({ isOpen, onClose, onSignIn }: DemoDeckModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="modal-backdrop demo-deck-modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="modal-content demo-deck-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-deck-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-copy">
            <h2 id="demo-deck-modal-title">Demo deck</h2>
            <p className="modal-subtitle">
              You’re exploring 4 example flashcards. Sign in anytime to build,
              edit, and sync your personal deck.
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
        <div className="demo-deck-modal-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              onClose()
              onSignIn()
            }}
          >
            Sign in to build your deck <span aria-hidden="true">→</span>
          </button>
          <button type="button" className="secondary-button" onClick={onClose}>
            Explore demo deck
          </button>
        </div>
      </div>
    </div>
  )
}

function AppFooter({ onOpenFeedback }: { onOpenFeedback: () => void }) {
  return (
    <footer className="app-footer" aria-label="Site footer">
      <div className="app-footer-inner" data-nosnippet>
        <button
          type="button"
          className="footer-link-button"
          onClick={onOpenFeedback}
        >
          Feedback
        </button>
      </div>
    </footer>
  )
}

interface ConnectionPillProps {
  authUser: AuthUser | null
  syncStatus: SyncStatus
  isOnline: boolean
  onClick: () => void
}

function ConnectionPill({
  authUser,
  syncStatus,
  isOnline,
  onClick,
}: ConnectionPillProps) {
  let stateClass = 'is-signed-out'
  let label = 'Sign in'
  let ariaLabel = 'Not signed in. Tap to sign in and sync your deck.'
  let icon = <UserIcon />

  if (!isOnline) {
    stateClass = 'is-offline'
    label = 'Offline'
    ariaLabel = authUser
      ? 'Offline. Card changes are saved to this device.'
      : 'Offline demo. Connect to internet and sign in to build your deck.'
    icon = <CloudOffIcon />
  } else if (authUser) {
    if (syncStatus === 'syncing') {
      stateClass = 'is-syncing'
      label = 'Syncing…'
      ariaLabel = 'Synchronizing deck with cloud…'
      icon = <SyncSpinnerIcon />
    } else if (syncStatus === 'error') {
      stateClass = 'is-error'
      label = 'Sync issue'
      ariaLabel = 'Sync issue. Tap to view status and retry.'
      icon = <SyncAlertIcon />
    } else {
      stateClass = 'is-synced'
      label = 'Synced'
      ariaLabel = 'Deck synced with cloud. Tap to manage sync.'
      icon = <CloudCheckIcon />
    }
  }

  return (
    <button
      type="button"
      className={`connection-pill ${stateClass}`}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <span className="pill-icon" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  )
}

function RedirectAuthNotice({
  message,
  onDismiss,
  onCopySessionLink,
}: {
  message: string | null
  onDismiss: () => void
  onCopySessionLink?: () => Promise<boolean> | boolean
}) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  if (!message) return null

  const handleCopy = async () => {
    if (onCopySessionLink) {
      const res = await onCopySessionLink()
      if (res) {
        setCopied(true)
        if (timerRef.current) {
          clearTimeout(timerRef.current)
        }
        timerRef.current = setTimeout(() => {
          setCopied(false)
          timerRef.current = null
        }, 2500)
      }
    }
  }

  return (
    <aside className="redirect-auth-banner" role="status" aria-live="polite">
      <p className="banner-text">{message}</p>
      <div className="banner-actions">
        {onCopySessionLink && (
          <button
            type="button"
            className={`banner-action-btn ${copied ? 'is-copied' : ''}`}
            onClick={() => {
              void handleCopy()
            }}
          >
            {copied ? (
              <>
                <svg
                  viewBox="0 0 16 16"
                  width="13"
                  height="13"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"
                  />
                </svg>
                <span>Copied ✓</span>
              </>
            ) : (
              <>
                <svg
                  viewBox="0 0 16 16"
                  width="13"
                  height="13"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"
                  />
                  <path
                    fill="currentColor"
                    d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"
                  />
                </svg>
                <span>Copy sign-in link</span>
              </>
            )}
          </button>
        )}
        <button
          type="button"
          className="banner-dismiss-btn"
          onClick={onDismiss}
          aria-label="Dismiss message"
        >
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path
              fill="currentColor"
              d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"
            />
          </svg>
        </button>
      </div>
    </aside>
  )
}

export function App({
  services: customServices,
}: {
  services?: AppServices
} = {}) {
  const services = useMemo(
    () => customServices ?? createBrowserServices(),
    [customServices],
  )
  const initialCards = useMemo(
    () => services.cards.load(starterCards),
    [services.cards],
  )
  const initialResolved = useMemo<{
    view: View
    queue: string[]
  }>(() => {
    if (typeof window === 'undefined') {
      return { view: 'welcome', queue: [] }
    }
    const hash = window.location.hash
    if (hash === '') {
      window.history.replaceState({ view: 'welcome' }, '', '#/')
    }
    const requested = viewFromHash(hash)
    if (requested === 'review') {
      const now = services.clock.now()
      const due = orderCardsForReview(
        initialCards,
        now,
        DEFAULT_STUDY_BATCH_SIZE,
      ).map(({ id }) => id)
      if (due.length === 0) {
        return { view: 'complete', queue: [] }
      }
      return { view: 'review', queue: due }
    }
    return { view: requested, queue: [] }
  }, [initialCards, services.clock])

  const [cards, setCards] = useState<StudyCard[]>(initialCards)
  const [view, setView] = useState<View>(initialResolved.view)
  const [isDemoDeckDismissed, setIsDemoDeckDismissed] = useState(false)

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = titleForView(view)
    }
  }, [view])

  const navigateTo = useCallback((nextView: View, replace = false) => {
    setIsDemoDeckDismissed(false)
    setView(nextView)
    if (typeof window === 'undefined') return
    const targetHash = hashForView(nextView)
    if (window.location.hash !== targetHash) {
      if (replace) {
        window.history.replaceState({ view: nextView }, '', targetHash)
      } else {
        window.history.pushState({ view: nextView }, '', targetHash)
      }
    }
  }, [])

  const [queue, setQueue] = useState<string[]>(initialResolved.queue)
  const [sessionTotal, setSessionTotal] = useState<number>(
    () => initialResolved.queue.length,
  )
  const [reviewedCount, setReviewedCount] = useState(0)
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [bidirectional, setBidirectional] = useState(true)
  const [spanishInput, setSpanishInput] = useState('')
  const [englishInput, setEnglishInput] = useState('')
  const [contextInput, setContextInput] = useState('')
  const [reversePromptInput, setReversePromptInput] = useState('')
  const [reverseAnswerInput, setReverseAnswerInput] = useState('')
  const [savedToast, setSavedToast] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([])
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const [isSyncOpen, setIsSyncOpen] = useState(false)
  const [isBackupOpen, setIsBackupOpen] = useState(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
  const [redirectAuthBanner, setRedirectAuthBanner] = useState<string | null>(
    () => {
      if (services.auth.consumeRedirectAuth?.()) {
        if (!isStandalone() && isIOS()) {
          return 'Signed in! Using the Home Screen app?'
        }
      }
      return null
    },
  )

  const [pendingCard, setPendingCard] = useState<PendingCardParams | null>(null)
  const [editingCard, setEditingCard] = useState<StudyCard | null>(null)
  const [deletingCards, setDeletingCards] = useState<StudyCard[] | null>(null)
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [deckSearchQuery, setDeckSearchQuery] = useState('')
  const [deckFilterState, setDeckFilterState] = useState<DeckFilterState>('all')
  const [deckSortOrder, setDeckSortOrder] =
    useState<DeckSortOrder>('created-desc')
  const [deletedCardIds, setDeletedCardIds] = useState<string[]>(() =>
    services.cards.getDeletedCardIds(),
  )

  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const [audioUnavailable, setAudioUnavailable] = useState(
    () => !services.speaker.supported(),
  )

  const [referenceTime, setReferenceTime] = useState(() => services.clock.now())
  const [activeSampleSide, setActiveSampleSide] = useState<
    'spanish' | 'english'
  >('spanish')
  const [samplePlaying, setSamplePlaying] = useState(false)
  const [activeCreateSide, setActiveCreateSide] = useState<
    'spanish' | 'english'
  >('spanish')
  const [createPlaying, setCreatePlaying] = useState(false)
  const [playingSamplerPhrase, setPlayingSamplerPhrase] = useState<
    string | null
  >(null)
  const responseInput = useRef<HTMLInputElement>(null)
  const spanishInputRef = useRef<HTMLTextAreaElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const sampleTimerRef = useRef<number | null>(null)
  const samplerTimerRef = useRef<number | null>(null)
  const createAudioTimerRef = useRef<number | null>(null)
  const savedToastTimerRef = useRef<number | null>(null)
  const suggestionsBlurTimerRef = useRef<number | null>(null)
  const isScrollingRef = useRef(false)
  const scrollResetTimerRef = useRef<number | null>(null)
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null)
  const isDraggingRef = useRef(false)
  const currentCard = cards.find(({ id }) => id === queue[0])
  const dueCount = cards.filter((card) => isDue(card, referenceTime)).length

  const cardsRef = useRef(cards)
  const viewRef = useRef(view)
  const authUserRef = useRef(authUser)
  const pendingCardRef = useRef(pendingCard)
  const deletedCardIdsRef = useRef<Set<string>>(new Set(deletedCardIds))
  const queueRef = useRef(queue)

  useEffect(() => {
    cardsRef.current = cards
    viewRef.current = view
    authUserRef.current = authUser
    pendingCardRef.current = pendingCard
    deletedCardIdsRef.current = new Set(deletedCardIds)
    queueRef.current = queue
  })

  // Eagerly prefetch entire collection in background, prioritizing due review cards first
  useEffect(() => {
    if (cards.length === 0 || typeof services.speaker.prefetch !== 'function') {
      return
    }

    const now = services.clock.now()
    const dueCards = orderCardsForReview(cards, now)
    const dueIds = new Set(dueCards.map((c) => c.id))
    const nonDueCards = cards.filter((c) => !dueIds.has(c.id))
    const allOrderedCards = [...dueCards, ...nonDueCards]

    const items: Array<{
      text: string
      locale: string
      cardSeed?: string
    }> = []

    for (const card of allOrderedCards) {
      if (card.prompt.trim()) {
        items.push({
          text: card.prompt,
          locale: localeForPrompt(card),
          cardSeed: card.id,
        })
      }
      if (card.answer.trim()) {
        items.push({
          text: card.answer,
          locale: localeForAnswer(card),
          cardSeed: card.id,
        })
      }
    }

    if (items.length > 0) {
      void services.speaker.prefetch(items)
    }
  }, [cards, services.clock, services.speaker])

  const onUpdateCards = useCallback(
    (
      newCards: StudyCard[],
      syncToCloud = true,
      newDeletedCardIds?: string[],
    ) => {
      if (newDeletedCardIds !== undefined) {
        deletedCardIdsRef.current = new Set(newDeletedCardIds)
      }
      for (const card of newCards) {
        deletedCardIdsRef.current.delete(card.id)
      }
      const deletedIdsArray = Array.from(deletedCardIdsRef.current)

      cardsRef.current = newCards
      setCards(newCards)
      setDeletedCardIds(deletedIdsArray)
      services.cards.save(newCards, deletedIdsArray)
      const now = services.clock.now()
      setReferenceTime(now)
      setQueue((currentQueue) => {
        if (currentQueue.length > 0) {
          const cardIdSet = new Set(newCards.map((c) => c.id))
          const nextQueue = currentQueue.filter((id) => cardIdSet.has(id))
          const removedCount = currentQueue.length - nextQueue.length
          if (removedCount > 0) {
            setSessionTotal((prev) =>
              Math.max(nextQueue.length, prev - removedCount),
            )
          }
          if (viewRef.current === 'review' && nextQueue.length === 0) {
            navigateTo('complete')
          }
          return nextQueue
        }
        return currentQueue
      })
      if (syncToCloud && authUserRef.current) {
        setSyncStatus('syncing')
        void services.sync
          .syncDeck(newCards, authUserRef.current, deletedIdsArray)
          .then((res) => {
            if (res.success) setSyncStatus('synced')
            else setSyncStatus('error')
          })
      }
    },
    [navigateTo, services.cards, services.clock, services.sync],
  )

  const handleSaveEdit = useCallback(
    (card: StudyCard, updates: UpdateCardParams) => {
      const now = services.clock.now()
      const updated = updateStudyCard(card, updates, now)
      const newCards = cardsRef.current.map((c) =>
        c.id === card.id ? updated : c,
      )
      onUpdateCards(newCards)
      setEditingCard(null)
    },
    [onUpdateCards, services.clock],
  )

  const handleConfirmDelete = useCallback(
    (cardsToDelete: StudyCard[]) => {
      const idsToDelete = new Set(cardsToDelete.map((c) => c.id))
      let updatedCards = cardsRef.current
      for (const id of idsToDelete) {
        updatedCards = deleteStudyCard(updatedCards, id)
      }
      for (const id of idsToDelete) {
        deletedCardIdsRef.current.add(id)
      }
      const updatedDeletedIds = Array.from(deletedCardIdsRef.current)
      onUpdateCards(updatedCards, true, updatedDeletedIds)
      setSelectedCardIds((prev) => {
        const next = new Set(prev)
        for (const id of idsToDelete) {
          next.delete(id)
        }
        return next
      })
      setDeletingCards(null)
    },
    [onUpdateCards],
  )

  const deckStats = useMemo(
    () => getDeckStats(cards, referenceTime),
    [cards, referenceTime],
  )

  const studiedTodayCount = useMemo(
    () => getCardsStudiedToday(cards, referenceTime),
    [cards, referenceTime],
  )

  const remainingDueCount = useMemo(
    () => orderCardsForReview(cards, referenceTime).length,
    [cards, referenceTime],
  )

  const filteredDeckCards = useMemo(
    () =>
      filterDeckCards(cards, {
        query: deckSearchQuery,
        stateFilter: deckFilterState,
        sortOrder: deckSortOrder,
        now: referenceTime,
      }),
    [cards, deckFilterState, deckSearchQuery, deckSortOrder, referenceTime],
  )

  const duplicateCardIds = useMemo(
    () =>
      new Set(
        Array.from(getDuplicateGroups(cards).values()).flatMap((group) =>
          group.map((c) => c.id),
        ),
      ),
    [cards],
  )

  const saveCardFromParams = useCallback(
    (params: {
      spanish: string
      english: string
      context: string
      bidirectional: boolean
      reversePrompt: string
      reverseAnswer: string
    }) => {
      const created = createCards(params, {
        clock: services.clock,
        ids: services.ids,
      })
      if (created.length === 0) return

      const userCards = filterOutStarterCards(cardsRef.current)
      onUpdateCards([...created, ...userCards])
      const savedSpanish = params.spanish.trim()
      setSavedToast(savedSpanish)
      if (savedToastTimerRef.current !== null) {
        window.clearTimeout(savedToastTimerRef.current)
      }
      savedToastTimerRef.current = window.setTimeout(() => {
        setSavedToast(null)
        savedToastTimerRef.current = null
      }, 3000)

      setSpanishInput('')
      setEnglishInput('')
      setContextInput('')
      setReversePromptInput('')
      setReverseAnswerInput('')
      setSuggestions([])
      setActiveSuggestionIndex(-1)
      setPendingCard(null)
      pendingCardRef.current = null
      spanishInputRef.current?.focus()
    },
    [onUpdateCards, services.clock, services.ids],
  )

  const handleCopySessionLink = useCallback(async () => {
    const link = services.auth.getSessionLink?.()
    if (!link || typeof navigator === 'undefined' || !navigator.clipboard) {
      return false
    }
    try {
      await navigator.clipboard.writeText(link)
      return true
    } catch {
      return false
    }
  }, [services.auth])

  useEffect(() => {
    return services.auth.onAuthStateChange((user) => {
      const prevUser = authUserRef.current
      authUserRef.current = user
      setAuthUser(user)
      if (user) {
        let userCards = filterOutStarterCards(cardsRef.current)
        if (pendingCardRef.current) {
          const pending = pendingCardRef.current
          const created = createCards(pending, {
            clock: services.clock,
            ids: services.ids,
          })
          if (created.length > 0) {
            userCards = [...created, ...userCards]
            const savedSpanish = pending.spanish.trim()
            setSavedToast(savedSpanish)
            if (savedToastTimerRef.current !== null) {
              window.clearTimeout(savedToastTimerRef.current)
            }
            savedToastTimerRef.current = window.setTimeout(() => {
              setSavedToast(null)
              savedToastTimerRef.current = null
            }, 3000)
          }

          setSpanishInput('')
          setEnglishInput('')
          setContextInput('')
          setReversePromptInput('')
          setReverseAnswerInput('')
          setSuggestions([])
          setActiveSuggestionIndex(-1)
          setPendingCard(null)
          pendingCardRef.current = null
          setIsSyncOpen(false)

          const deletedIds = Array.from(deletedCardIdsRef.current)
          onUpdateCards(userCards, false, deletedIds)
        }

        const deletedIds = Array.from(deletedCardIdsRef.current)
        void syncDeckWithCloud({
          localCards: userCards,
          localDeletedIds: deletedIds,
          user,
          syncService: services.sync,
          onCardsUpdated: (newCards, newDeletedIds) =>
            onUpdateCards(newCards, false, newDeletedIds),
        }).then((res) => {
          if (res.success) setSyncStatus('synced')
          else setSyncStatus('error')
        })
      } else if (prevUser !== null) {
        // Explicit transition from signed in to signed out:
        // Clear local user deck and restore clean starter demo deck
        setCards(starterCards)
        setDeletedCardIds([])
        deletedCardIdsRef.current = new Set()
        setSyncStatus('idle')
        setSelectedCardIds(new Set())
        setEditingCard(null)
        setDeletingCards(null)
        setAnswer('')
        setRevealed(false)
        const now = services.clock.now()
        setReferenceTime(now)
        setQueue(() => {
          const due = starterCards
            .filter((c) => isDue(c, now))
            .sort((left, right) => left.schedule.dueAt - right.schedule.dueAt)
            .map(({ id }) => id)
          return due
        })
        setSessionTotal(() => starterCards.filter((c) => isDue(c, now)).length)
        setReviewedCount(0)
        setIsDemoDeckDismissed(false)
      }
    })
  }, [
    onUpdateCards,
    services.auth,
    services.clock,
    services.ids,
    services.sync,
  ])

  const isSyncingRef = useRef(false)
  const syncDebounceTimerRef = useRef<number | null>(null)

  const performSync = useCallback(async () => {
    if (isSyncingRef.current || !authUserRef.current) return
    isSyncingRef.current = true
    setSyncStatus('syncing')
    try {
      const userCards = filterOutStarterCards(cardsRef.current)
      const deletedIds = Array.from(deletedCardIdsRef.current)
      const res = await services.sync.syncDeck(
        userCards,
        authUserRef.current,
        deletedIds,
      )
      if (res.success && res.cards) {
        // Reconcile server response against current in-flight local deck to prevent overwriting intermediate edits or reviews
        const reconciled = reconcileStudyCards(
          cardsRef.current,
          res.cards,
          Array.from(deletedCardIdsRef.current),
          res.deletedCardIds ?? [],
        )
        onUpdateCards(reconciled.cards, false, reconciled.deletedCardIds)
        setSyncStatus('synced')
      } else if (!res.success) {
        setSyncStatus('error')
      }
    } catch {
      setSyncStatus('error')
    } finally {
      isSyncingRef.current = false
    }
  }, [onUpdateCards, services.sync])

  const flushSync = useCallback(() => {
    if (syncDebounceTimerRef.current !== null) {
      window.clearTimeout(syncDebounceTimerRef.current)
      syncDebounceTimerRef.current = null
    }
    void performSync()
  }, [performSync])

  const scheduleDebouncedSync = useCallback(() => {
    if (!authUserRef.current) return
    if (syncDebounceTimerRef.current !== null) {
      window.clearTimeout(syncDebounceTimerRef.current)
    }
    syncDebounceTimerRef.current = window.setTimeout(() => {
      syncDebounceTimerRef.current = null
      void performSync()
    }, 1500)
  }, [performSync])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onOnline = () => {
      setIsOnline(true)
      flushSync()
    }
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [flushSync])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSync()
      } else if (document.visibilityState === 'visible') {
        flushSync()
      }
    }

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        flushSync()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('pagehide', flushSync)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('pagehide', flushSync)
      if (syncDebounceTimerRef.current !== null) {
        window.clearTimeout(syncDebounceTimerRef.current)
      }
    }
  }, [flushSync])

  useEffect(() => {
    void checkOrRequestStoragePersistence()
  }, [])

  useEffect(() => {
    const onPopState = () => {
      setIsDemoDeckDismissed(false)
      const nextView = viewFromHash(window.location.hash)
      setView(nextView)
      if (nextView === 'welcome') {
        setAnswer('')
        setRevealed(false)
      } else if (nextView === 'review') {
        if (queueRef.current.length === 0) {
          const now = services.clock.now()
          const newQueue = orderCardsForReview(
            cardsRef.current,
            now,
            DEFAULT_STUDY_BATCH_SIZE,
          ).map(({ id }) => id)
          setSessionTotal(newQueue.length)
          setQueue(newQueue)
        }
      }
    }
    window.addEventListener('popstate', onPopState)
    window.addEventListener('hashchange', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('hashchange', onPopState)
    }
  }, [services.clock])

  const playAudio = useCallback(
    (text: string, locale: string, cardSeed?: string) => {
      const played = services.speaker.speak(
        text,
        locale,
        cardSeed ? { cardSeed } : undefined,
      )
      setAudioUnavailable(!played)
    },
    [services.speaker],
  )

  const playSampleAudio = useCallback(
    (side: 'spanish' | 'english') => {
      if (sampleTimerRef.current !== null) {
        window.clearTimeout(sampleTimerRef.current)
      }
      setSamplePlaying(true)
      if (side === 'spanish') {
        playAudio('aguacate', 'es-MX', 'sample-aguacate')
      } else {
        playAudio('avocado', 'en-US', 'sample-aguacate')
      }
      sampleTimerRef.current = window.setTimeout(() => {
        setSamplePlaying(false)
        sampleTimerRef.current = null
      }, 1200)
    },
    [playAudio],
  )

  const onSampleCardClick = useCallback(
    (side: 'spanish' | 'english') => {
      if (activeSampleSide !== side) {
        setActiveSampleSide(side)
      }
      playSampleAudio(side)
    },
    [activeSampleSide, playSampleAudio],
  )

  const handlePlaySampler = useCallback(
    (phrase: string) => {
      setPlayingSamplerPhrase(phrase)
      playAudio(phrase, 'es-MX')
      if (samplerTimerRef.current !== null) {
        window.clearTimeout(samplerTimerRef.current)
      }
      samplerTimerRef.current = window.setTimeout(() => {
        setPlayingSamplerPhrase(null)
        samplerTimerRef.current = null
      }, 1200)
    },
    [playAudio],
  )

  const onCreateCardClick = useCallback(
    (side: 'spanish' | 'english') => {
      if (activeCreateSide !== side) {
        setActiveCreateSide(side)
      }
      const textToPlay =
        side === 'spanish'
          ? spanishInput.trim() || 'Palabra o frase'
          : englishInput.trim() || 'English translation'
      const locale = side === 'spanish' ? 'es-MX' : 'en-US'
      setCreatePlaying(true)
      playAudio(textToPlay, locale)
      if (createAudioTimerRef.current !== null) {
        window.clearTimeout(createAudioTimerRef.current)
      }
      createAudioTimerRef.current = window.setTimeout(() => {
        setCreatePlaying(false)
        createAudioTimerRef.current = null
      }, 1200)
    },
    [activeCreateSide, englishInput, playAudio, spanishInput],
  )

  useEffect(() => {
    return () => {
      if (sampleTimerRef.current !== null) {
        window.clearTimeout(sampleTimerRef.current)
      }
      if (samplerTimerRef.current !== null) {
        window.clearTimeout(samplerTimerRef.current)
      }
      if (createAudioTimerRef.current !== null) {
        window.clearTimeout(createAudioTimerRef.current)
      }
      if (savedToastTimerRef.current !== null) {
        window.clearTimeout(savedToastTimerRef.current)
      }
      if (suggestionsBlurTimerRef.current !== null) {
        window.clearTimeout(suggestionsBlurTimerRef.current)
      }
      if (scrollResetTimerRef.current !== null) {
        window.clearTimeout(scrollResetTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    services.cards.save(cards, deletedCardIds)
  }, [cards, deletedCardIds, services.cards])

  const currentCardId = currentCard?.id
  const currentPrompt = currentCard?.prompt
  const currentPromptLocale = currentCard ? localeForPrompt(currentCard) : ''

  useEffect(() => {
    if (view !== 'review' || !currentCardId || !currentPrompt) return
    responseInput.current?.focus()
    services.speaker.speak(currentPrompt, currentPromptLocale, {
      cardSeed: currentCardId,
    })
  }, [
    currentCardId,
    currentPrompt,
    currentPromptLocale,
    services.speaker,
    view,
  ])

  useEffect(() => {
    if (view === 'review' && editingCard === null && !revealed) {
      responseInput.current?.focus()
    }
  }, [editingCard, revealed, view])

  const grade = useCallback(
    (gradeValue: Grade) => {
      if (!currentCard) return
      const now = services.clock.now()
      services.sounds.play(gradeValue)
      services.haptics?.trigger(gradeValue)
      const reviewed = scheduleReview(currentCard, gradeValue, now)
      const { updatedCards, buriedCardIds } = burySiblingCards(
        cardsRef.current,
        currentCard,
        now,
      )
      const nextCards = updatedCards.map((card) =>
        card.id === reviewed.id ? reviewed : card,
      )
      cardsRef.current = nextCards
      setCards(nextCards)
      const requeue = shouldRequeueInSession(reviewed.schedule)
      const buriedSet = new Set(buriedCardIds)
      const nextQueue = queue.slice(1).filter((id) => !buriedSet.has(id))

      if (requeue) {
        nextQueue.push(currentCard.id)
      }
      if (buriedCardIds.length > 0) {
        setSessionTotal((prev) =>
          Math.max(nextQueue.length, prev - buriedCardIds.length),
        )
      }

      setQueue(nextQueue)
      setReviewedCount((count) => count + 1)
      setAnswer('')
      setRevealed(false)
      if (nextQueue.length === 0) {
        services.sounds.play('complete')
        services.haptics?.trigger('complete')
        flushSync()
        navigateTo('complete')
      } else {
        scheduleDebouncedSync()
      }
    },
    [
      currentCard,
      flushSync,
      navigateTo,
      queue,
      scheduleDebouncedSync,
      services.clock,
      services.haptics,
      services.sounds,
    ],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        view !== 'review' ||
        !currentCard ||
        editingCard !== null ||
        deletingCards !== null ||
        isSyncOpen ||
        isBackupOpen ||
        isFeedbackOpen
      )
        return

      const isInputActive =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'

      if (
        (event.code === 'Space' || event.key === ' ') &&
        (document.activeElement !== responseInput.current ||
          event.ctrlKey ||
          event.metaKey)
      ) {
        event.preventDefault()
        if (revealed) {
          playAudio(
            currentCard.answer,
            localeForAnswer(currentCard),
            currentCard.id,
          )
        } else {
          playAudio(
            currentCard.prompt,
            localeForPrompt(currentCard),
            currentCard.id,
          )
        }
      }

      if (revealed && ['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault()
        const gradeMap: Record<string, Grade> = {
          '1': 'again',
          '2': 'hard',
          '3': 'good',
          '4': 'easy',
        }
        const gradeValue = gradeMap[event.key]
        if (gradeValue) grade(gradeValue)
      }

      if (
        (event.key === 'e' || event.key === 'E') &&
        (!isInputActive || event.ctrlKey || event.metaKey)
      ) {
        event.preventDefault()
        setEditingCard(currentCard)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    currentCard,
    deletingCards,
    editingCard,
    grade,
    isSyncOpen,
    isBackupOpen,
    isFeedbackOpen,
    playAudio,
    revealed,
    view,
  ])

  function goHome() {
    setReferenceTime(services.clock.now())
    navigateTo('welcome')
    setAnswer('')
    setRevealed(false)
  }

  function handlePractice() {
    if (queue.length > 0) {
      navigateTo('review')
    } else {
      beginReview()
    }
  }

  function beginReview(cardIds?: string[]) {
    const now = services.clock.now()
    const nextQueue =
      cardIds ??
      orderCardsForReview(cards, now, DEFAULT_STUDY_BATCH_SIZE).map(
        ({ id }) => id,
      )
    setQueue(nextQueue)
    setSessionTotal(nextQueue.length)
    setReviewedCount(0)
    setReferenceTime(now)
    setAnswer('')
    setRevealed(false)
    navigateTo(nextQueue.length > 0 ? 'review' : 'complete')
  }

  function reveal(event: FormEvent) {
    event.preventDefault()
    if (revealed || !currentCard) return
    setRevealed(true)
    services.sounds.play('reveal')
    services.haptics?.trigger('selection')
    playAudio(currentCard.answer, localeForAnswer(currentCard), currentCard.id)
  }

  const dismissSuggestions = useCallback(() => {
    if (suggestionsBlurTimerRef.current !== null) {
      window.clearTimeout(suggestionsBlurTimerRef.current)
      suggestionsBlurTimerRef.current = null
    }
    isScrollingRef.current = false
    isDraggingRef.current = false
    pointerDownPosRef.current = null
    setSuggestions([])
    setActiveSuggestionIndex(-1)
  }, [])

  useEffect(() => {
    if (suggestions.length === 0) return

    const onScroll = () => {
      if (suggestionsBlurTimerRef.current !== null) {
        window.clearTimeout(suggestionsBlurTimerRef.current)
        suggestionsBlurTimerRef.current = null
      }
      isScrollingRef.current = true
      if (scrollResetTimerRef.current !== null) {
        window.clearTimeout(scrollResetTimerRef.current)
      }
      scrollResetTimerRef.current = window.setTimeout(() => {
        isScrollingRef.current = false
        scrollResetTimerRef.current = null
      }, 300)
    }

    const handlePointerDown = (event: PointerEvent) => {
      pointerDownPosRef.current = { x: event.clientX, y: event.clientY }
      isDraggingRef.current = false
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!pointerDownPosRef.current) return
      const dx = event.clientX - pointerDownPosRef.current.x
      const dy = event.clientY - pointerDownPosRef.current.y
      if (Math.hypot(dx, dy) > 8) {
        isDraggingRef.current = true
        if (suggestionsBlurTimerRef.current !== null) {
          window.clearTimeout(suggestionsBlurTimerRef.current)
          suggestionsBlurTimerRef.current = null
        }
      }
    }

    const handlePointerCancel = () => {
      pointerDownPosRef.current = null
      isDraggingRef.current = false
    }

    const handlePointerUp = (event: PointerEvent) => {
      const wasDragging = isDraggingRef.current
      pointerDownPosRef.current = null
      isDraggingRef.current = false

      if (wasDragging || isScrollingRef.current) {
        return
      }

      const target = event.target
      if (
        target instanceof Node &&
        (suggestionsRef.current?.contains(target) ||
          spanishInputRef.current?.contains(target))
      ) {
        return
      }
      dismissSuggestions()
    }

    const handleClick = (event: MouseEvent) => {
      if (isScrollingRef.current) return
      const target = event.target
      if (
        target instanceof Node &&
        (suggestionsRef.current?.contains(target) ||
          spanishInputRef.current?.contains(target))
      ) {
        return
      }
      dismissSuggestions()
    }

    window.addEventListener('scroll', onScroll, {
      capture: true,
      passive: true,
    })
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
    document.addEventListener('pointercancel', handlePointerCancel)
    document.addEventListener('click', handleClick)
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true })
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
      document.removeEventListener('pointercancel', handlePointerCancel)
      document.removeEventListener('click', handleClick)
    }
  }, [suggestions.length, dismissSuggestions])

  const applySuggestion = useCallback((entry: LexiconEntry) => {
    if (suggestionsBlurTimerRef.current !== null) {
      window.clearTimeout(suggestionsBlurTimerRef.current)
      suggestionsBlurTimerRef.current = null
    }
    setSpanishInput(entry.spanish)
    setEnglishInput(entry.english)
    setSuggestions([])
    setActiveSuggestionIndex(-1)
  }, [])

  const onSpanishChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      if (suggestionsBlurTimerRef.current !== null) {
        window.clearTimeout(suggestionsBlurTimerRef.current)
        suggestionsBlurTimerRef.current = null
      }
      const val = event.target.value
      setSpanishInput(val)
      if (val.trim().length >= 2) {
        setSuggestions(services.assistant.suggest(val, 'es', 5))
      } else {
        setSuggestions([])
      }
      setActiveSuggestionIndex(-1)
    },
    [services.assistant],
  )

  const onEnglishChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const val = event.target.value
      setEnglishInput(val)
      if (val.trim().length >= 2 && !spanishInput.trim()) {
        setSuggestions(services.assistant.suggest(val, 'en', 5))
      } else if (!spanishInput.trim()) {
        setSuggestions([])
      }
    },
    [services.assistant, spanishInput],
  )

  const onSpanishBlur = useCallback(
    (event: React.FocusEvent<HTMLTextAreaElement>) => {
      const related = event.relatedTarget
      if (related && suggestionsRef.current?.contains(related)) {
        return
      }
      // If the blur was caused by scrolling or a touch scroll gesture,
      // preserve suggestions so the user can browse them freely on iOS.
      if (isScrollingRef.current || isDraggingRef.current) {
        return
      }
      // Defer suggestion dismissal so synchronous blur/focus transitions
      // (such as iOS Safari keyboard accessory arrows jumping to adjacent fields)
      // are not aborted by mid-event DOM unmounting.
      if (suggestionsBlurTimerRef.current !== null) {
        window.clearTimeout(suggestionsBlurTimerRef.current)
      }
      suggestionsBlurTimerRef.current = window.setTimeout(() => {
        if (isScrollingRef.current || isDraggingRef.current) {
          suggestionsBlurTimerRef.current = null
          return
        }
        dismissSuggestions()
        suggestionsBlurTimerRef.current = null
      }, 150)
    },
    [dismissSuggestions],
  )

  const onSpanishKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (suggestions.length === 0) return

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveSuggestionIndex((prev) => (prev + 1) % suggestions.length)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveSuggestionIndex((prev) =>
          prev <= 0 ? suggestions.length - 1 : prev - 1,
        )
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        if (activeSuggestionIndex >= 0 && suggestions[activeSuggestionIndex]) {
          event.preventDefault()
          applySuggestion(suggestions[activeSuggestionIndex])
        }
      } else if (event.key === 'Escape') {
        dismissSuggestions()
      }
    },
    [activeSuggestionIndex, applySuggestion, dismissSuggestions, suggestions],
  )

  const openSyncModal = useCallback(() => {
    setSuggestions([])
    setIsSyncOpen(true)
  }, [])

  const closeSyncModal = useCallback(() => {
    setIsSyncOpen(false)
    setPendingCard(null)
    pendingCardRef.current = null
  }, [])

  const openFeedbackModal = useCallback(() => {
    setSuggestions([])
    setIsFeedbackOpen(true)
  }, [])

  const closeFeedbackModal = useCallback(() => {
    setIsFeedbackOpen(false)
  }, [])

  const handleSavePendingLocally = useCallback(() => {
    if (pendingCardRef.current) {
      saveCardFromParams(pendingCardRef.current)
      pendingCardRef.current = null
      setPendingCard(null)
    }
    setIsSyncOpen(false)
  }, [saveCardFromParams])

  function createCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const field = (name: string): string => {
      const value = form.get(name)
      return typeof value === 'string' ? value : ''
    }
    const spanish = field('spanish').trim()
    const english = field('english').trim()
    if (!spanish || !english) return

    const cardParams = {
      spanish: field('spanish'),
      english: field('english'),
      context: field('context'),
      bidirectional: form.get('bidirectional') === 'on',
      reversePrompt: field('reversePrompt'),
      reverseAnswer: field('reverseAnswer'),
    }

    if (!authUserRef.current) {
      setPendingCard(cardParams)
      pendingCardRef.current = cardParams
      setIsSyncOpen(true)
      return
    }

    saveCardFromParams(cardParams)
  }

  if (view === 'welcome') {
    return (
      <>
        <main className="app-shell welcome-page">
          <nav className="topbar" aria-label="Main navigation">
            <Brand />
            <div className="nav-actions" data-nosnippet>
              <button
                className="text-button"
                onClick={() => navigateTo('deck')}
              >
                Manage deck
              </button>
              <ConnectionPill
                authUser={authUser}
                syncStatus={syncStatus}
                isOnline={isOnline}
                onClick={() => openSyncModal()}
              />
            </div>
          </nav>
          <RedirectAuthNotice
            message={redirectAuthBanner}
            onDismiss={() => setRedirectAuthBanner(null)}
            onCopySessionLink={handleCopySessionLink}
          />
          <section className="welcome-hero">
            <div className="welcome-hero-main">
              <div className="hero-copy">
                <img
                  src={logoUrl}
                  alt=""
                  aria-hidden="true"
                  className="welcome-mascot-img"
                />
                <h1>
                  Make the words <br />
                  you meet <em>stick.</em>
                </h1>
                <p className="lede">
                  Create beautiful, spoken flashcards.
                  <br />
                  Practice them at your rhythm.
                </p>
                <div className="hero-actions" data-nosnippet>
                  <button
                    className="primary-button"
                    onClick={() => navigateTo('create')}
                  >
                    Create a card <span aria-hidden="true">→</span>
                  </button>
                  <button className="secondary-button" onClick={handlePractice}>
                    Practice
                  </button>
                </div>
              </div>
              <div className="hero-visual" data-nosnippet>
                {/* English Card (concise meaning) */}
                <button
                  type="button"
                  className={`sample-card sample-card-en ${activeSampleSide === 'english' ? 'is-foreground' : 'is-background'} ${samplePlaying && activeSampleSide === 'english' ? 'is-playing' : ''}`}
                  onClick={() => onSampleCardClick('english')}
                  aria-label={
                    activeSampleSide === 'english'
                      ? 'Play pronunciation for English card: avocado'
                      : 'Show English card: avocado'
                  }
                >
                  <div className="sample-card-header">
                    <span className="sample-badge">
                      <UsFlag /> ENGLISH
                    </span>
                    <span className="sample-listen-hint" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M5 9v6h4l5 4V5L9 9H5Zm11.5-.5a5 5 0 0 1 0 7M18.8 6a8.2 8.2 0 0 1 0 12" />
                      </svg>
                    </span>
                  </div>
                  <div className="sample-card-body">
                    <div className="sample-illustration" aria-hidden="true">
                      <img
                        src={sampleAguacateUrl}
                        alt=""
                        className="sample-art-image"
                      />
                    </div>
                    <p className="sample-phrase">avocado</p>
                  </div>
                </button>
                {/* Mexican Spanish Card */}
                <button
                  type="button"
                  className={`sample-card sample-card-es ${activeSampleSide === 'spanish' ? 'is-foreground' : 'is-background'} ${samplePlaying && activeSampleSide === 'spanish' ? 'is-playing' : ''}`}
                  onClick={() => onSampleCardClick('spanish')}
                  aria-label={
                    activeSampleSide === 'spanish'
                      ? 'Play pronunciation for Mexican Spanish card: aguacate'
                      : 'Show Mexican Spanish card: aguacate'
                  }
                >
                  <div className="sample-card-header">
                    <span className="sample-badge">
                      <MexicoFlag /> MEXICAN SPANISH
                    </span>
                    <span className="sample-listen-hint" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M5 9v6h4l5 4V5L9 9H5Zm11.5-.5a5 5 0 0 1 0 7M18.8 6a8.2 8.2 0 0 1 0 12" />
                      </svg>
                    </span>
                  </div>
                  <div className="sample-card-body">
                    <div className="sample-illustration" aria-hidden="true">
                      <img
                        src={sampleAguacateUrl}
                        alt=""
                        className="sample-art-image"
                      />
                    </div>
                    <p className="sample-phrase">aguacate</p>
                  </div>
                </button>
              </div>
            </div>
            <button
              type="button"
              className="hero-scroll-cue"
              onClick={() => {
                document
                  .getElementById('why-jolito')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }}
              aria-label="Scroll down to explore Why Jolito"
            >
              <span className="scroll-cue-text">Why Jolito?</span>
              <span className="scroll-cue-arrow" aria-hidden="true">
                ↓
              </span>
            </button>
          </section>
          <section
            className="welcome-why"
            id="why-jolito"
            aria-labelledby="why-jolito-title"
          >
            <div className="why-inner">
              <div className="why-header">
                <p className="eyebrow why-eyebrow">THE JOLITO WAY</p>
                <h2 id="why-jolito-title">Why another flashcard app?</h2>
                <p className="why-subtitle">
                  Most apps force you to tap through multiple-choice word banks
                  or configure complex desktop templates. Jolito bridges the
                  gap: the proven power of spaced repetition paired with
                  effortless card authoring, ear-first Mexican Spanish audio,
                  and an active keyboard flow.
                </p>
              </div>

              <div className="why-grid">
                <article className="why-card why-card-recall">
                  <div className="why-card-badge">
                    <span className="why-badge-number why-badge-recall">1</span>
                    <span className="why-badge-label">Active recall</span>
                  </div>
                  <h3>Type before you flip</h3>
                  <p>
                    Produce language from memory instead of passively guessing
                    multiple-choice options. Instant visual diffs highlight
                    spelling nuances while you retain full grading authority.
                  </p>
                  <div
                    className="bento-visual bento-visual-recall"
                    aria-hidden="true"
                  >
                    <div className="mini-card-shell">
                      <div className="mini-card-header">
                        <span className="mini-card-tag">PROMPT</span>
                        <span className="mini-card-phrase">¿Qué onda?</span>
                      </div>
                      <div className="mini-card-input-box">
                        <span className="mini-typed-correct">what</span>
                        <span className="mini-typed-space">&nbsp;</span>
                        <span className="mini-typed-diff">’s up?</span>
                        <span className="mini-cursor"></span>
                      </div>
                      <div className="mini-card-footer">
                        <span className="mini-pill-highlight">
                          Typo diff visual feedback
                        </span>
                        <span className="mini-pill-authority">Self-graded</span>
                      </div>
                    </div>
                  </div>
                </article>

                <article className="why-card why-card-srs">
                  <div className="why-card-badge">
                    <span className="why-badge-number why-badge-srs">2</span>
                    <span className="why-badge-label">Memory retention</span>
                  </div>
                  <h3>Spaced repetition that sticks</h3>
                  <p>
                    Cards return right when you are on the verge of forgetting
                    them. Built on proven SRS scheduling so daily practice takes
                    only a few focused minutes.
                  </p>
                  <div
                    className="bento-visual bento-visual-srs"
                    aria-hidden="true"
                  >
                    <div className="srs-cadence-track">
                      <div className="srs-cadence-node">
                        <span className="srs-node-pill">10m</span>
                        <span className="srs-node-sub">Learn</span>
                      </div>
                      <div className="srs-cadence-line"></div>
                      <div className="srs-cadence-node">
                        <span className="srs-node-pill">1d</span>
                        <span className="srs-node-sub">Recall</span>
                      </div>
                      <div className="srs-cadence-line"></div>
                      <div className="srs-cadence-node">
                        <span className="srs-node-pill">4d</span>
                        <span className="srs-node-sub">Lock-in</span>
                      </div>
                      <div className="srs-cadence-line"></div>
                      <div className="srs-cadence-node is-mastered">
                        <span className="srs-node-pill">2w+</span>
                        <span className="srs-node-sub">Fluent</span>
                      </div>
                    </div>
                    <div className="srs-cadence-note">
                      <span className="srs-note-icon">⚡</span>
                      <span>Calculated spacing prevents deck overload</span>
                    </div>
                  </div>
                </article>

                <article className="why-card why-card-audio">
                  <div className="why-card-badge">
                    <span className="why-badge-number why-badge-audio">3</span>
                    <span className="why-badge-label">Ear-first audio</span>
                  </div>
                  <h3>Spoken Mexican Spanish</h3>
                  <p>
                    Listen to natural Mexico City pronunciation with everyday
                    contextual nuances. Tap any phrase to hear the authentic
                    CDMX cadence:
                  </p>
                  <div className="bento-visual bento-visual-audio">
                    <div
                      className="audio-sampler-group"
                      role="group"
                      aria-label="Interactive Mexican Spanish audio samples"
                    >
                      {[
                        { es: '¡Órale!', en: 'Right on / wow' },
                        { es: '¿Qué onda?', en: "What's up?" },
                        { es: 'No manches', en: 'No way!' },
                      ].map((item) => (
                        <button
                          key={item.es}
                          type="button"
                          className={`sampler-pill ${playingSamplerPhrase === item.es ? 'is-playing' : ''}`}
                          onClick={() => handlePlaySampler(item.es)}
                          aria-label={`Listen to Mexican Spanish pronunciation for ${item.es}: ${item.en}`}
                        >
                          <span
                            className="sampler-speaker-icon"
                            aria-hidden="true"
                          >
                            <svg viewBox="0 0 24 24" width="14" height="14">
                              <path
                                d="M5 9v6h4l5 4V5L9 9H5Zm11.5-.5a5 5 0 0 1 0 7M18.8 6a8.2 8.2 0 0 1 0 12"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                          <span className="sampler-text-es">{item.es}</span>
                          <span className="sampler-text-en">{item.en}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </article>
              </div>

              <div className="why-highlights-bar" data-nosnippet>
                <div className="why-highlight-item">
                  <span className="why-highlight-check" aria-hidden="true">
                    ✓
                  </span>
                  <span>100% local-first & offline</span>
                </div>
                <div className="why-highlight-item">
                  <span className="why-highlight-check" aria-hidden="true">
                    ✓
                  </span>
                  <span>Anki (.apkg) import in seconds</span>
                </div>
                <div className="why-highlight-item">
                  <span className="why-highlight-check" aria-hidden="true">
                    ✓
                  </span>
                  <span>Zero ads, zero subscriptions</span>
                </div>
              </div>
            </div>
          </section>
          <AppFooter onOpenFeedback={openFeedbackModal} />
        </main>
        <SyncModal
          isOpen={isSyncOpen}
          onClose={closeSyncModal}
          cards={cards}
          deletedCardIds={deletedCardIds}
          onUpdateCards={onUpdateCards}
          auth={services.auth}
          sync={services.sync}
          onSaveLocally={pendingCard ? handleSavePendingLocally : undefined}
          pendingCardPrompt={
            pendingCard ? pendingCard.spanish.trim() : undefined
          }
        />
        <EditCardModal
          isOpen={editingCard !== null}
          card={editingCard}
          cards={cards}
          onClose={() => setEditingCard(null)}
          onSave={handleSaveEdit}
          onPlayAudio={playAudio}
        />
        <DeleteCardsModal
          isOpen={deletingCards !== null}
          cards={deletingCards}
          onClose={() => setDeletingCards(null)}
          onConfirm={handleConfirmDelete}
        />
        <FeedbackModal
          isOpen={isFeedbackOpen}
          onClose={closeFeedbackModal}
          user={authUser}
          feedbackService={services.feedback}
          currentView={view}
        />
      </>
    )
  }

  if (view === 'create') {
    const spanishTrimmed = spanishInput.trim()
    const englishTrimmed = englishInput.trim()
    const spanishPhraseSizeClass =
      spanishTrimmed.length > 100
        ? 'is-long'
        : spanishTrimmed.length > 50
          ? 'is-medium'
          : ''
    const englishPhraseSizeClass =
      englishTrimmed.length > 100
        ? 'is-long'
        : englishTrimmed.length > 50
          ? 'is-medium'
          : ''

    const duplicateMatches = findDuplicateNoteCards(cards, {
      spanish: spanishInput,
      english: englishInput,
      bidirectional,
    })

    const duplicateCard =
      duplicateMatches.spanishDuplicates[0] ||
      duplicateMatches.englishDuplicates[0] ||
      null

    return (
      <>
        <main className="app-shell create-page">
          <nav className="topbar" aria-label="Card creation navigation">
            <Brand onClick={goHome} />
            <div className="nav-actions" data-nosnippet>
              <button
                className="text-button"
                onClick={() => navigateTo('deck')}
              >
                Manage deck
              </button>
              {(queue.length > 0 || dueCount > 0) && (
                <button className="text-button" onClick={handlePractice}>
                  Practice
                </button>
              )}
              <ConnectionPill
                authUser={authUser}
                syncStatus={syncStatus}
                isOnline={isOnline}
                onClick={() => openSyncModal()}
              />
            </div>
          </nav>
          <RedirectAuthNotice
            message={redirectAuthBanner}
            onDismiss={() => setRedirectAuthBanner(null)}
            onCopySessionLink={handleCopySessionLink}
          />
          <section className="create-layout">
            <div className="create-sidebar">
              <header>
                <h1>New flashcard</h1>
                <p className="lede">
                  Build spoken bilingual cards with Mexican Spanish nuances.
                </p>
              </header>
              <div className="create-visual">
                {/* English Preview Card */}
                <button
                  type="button"
                  className={`sample-card sample-card-en ${
                    activeCreateSide === 'english'
                      ? 'is-foreground'
                      : 'is-background'
                  } ${
                    createPlaying && activeCreateSide === 'english'
                      ? 'is-playing'
                      : ''
                  }`}
                  onClick={() => onCreateCardClick('english')}
                  aria-label={
                    activeCreateSide === 'english'
                      ? `Play pronunciation: ${englishTrimmed || 'translation'}`
                      : `Show translation${englishTrimmed ? `: ${englishTrimmed}` : ''}`
                  }
                >
                  <div className="sample-card-header">
                    <span className="sample-badge">
                      <UsFlag /> ENGLISH
                    </span>
                    <span className="sample-listen-hint" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M5 9v6h4l5 4V5L9 9H5Zm11.5-.5a5 5 0 0 1 0 7M18.8 6a8.2 8.2 0 0 1 0 12" />
                      </svg>
                    </span>
                  </div>
                  <div className="sample-card-body">
                    <p
                      className={`sample-phrase ${!englishTrimmed ? 'is-placeholder' : ''} ${englishPhraseSizeClass}`.trim()}
                    >
                      {englishTrimmed || 'English translation…'}
                    </p>
                    {contextInput.trim() && (
                      <p className="create-card-context-preview">
                        {contextInput}
                      </p>
                    )}
                  </div>
                </button>
                {/* Mexican Spanish Preview Card */}
                <button
                  type="button"
                  className={`sample-card sample-card-es ${
                    activeCreateSide === 'spanish'
                      ? 'is-foreground'
                      : 'is-background'
                  } ${
                    createPlaying && activeCreateSide === 'spanish'
                      ? 'is-playing'
                      : ''
                  }`}
                  onClick={() => onCreateCardClick('spanish')}
                  aria-label={
                    activeCreateSide === 'spanish'
                      ? `Play pronunciation: ${spanishTrimmed || 'phrase'}`
                      : `Show phrase${spanishTrimmed ? `: ${spanishTrimmed}` : ''}`
                  }
                >
                  <div className="sample-card-header">
                    <span className="sample-badge">
                      <MexicoFlag /> MEXICAN SPANISH
                    </span>
                    <span className="sample-listen-hint" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M5 9v6h4l5 4V5L9 9H5Zm11.5-.5a5 5 0 0 1 0 7M18.8 6a8.2 8.2 0 0 1 0 12" />
                      </svg>
                    </span>
                  </div>
                  <div className="sample-card-body">
                    <p
                      className={`sample-phrase ${!spanishTrimmed ? 'is-placeholder' : ''} ${spanishPhraseSizeClass}`.trim()}
                    >
                      {spanishTrimmed || 'Palabra o frase…'}
                    </p>
                    {contextInput.trim() && (
                      <p className="create-card-context-preview">
                        {contextInput}
                      </p>
                    )}
                  </div>
                </button>
              </div>
            </div>
            <form className="create-form" onSubmit={createCard}>
              <div className="field-group field-group-relative">
                <label htmlFor="spanish">
                  <MexicoFlag /> Mexican Spanish
                </label>
                <textarea
                  ref={spanishInputRef}
                  id="spanish"
                  name="spanish"
                  role="combobox"
                  rows={2}
                  autoFocus
                  required
                  autoCapitalize="none"
                  enterKeyHint="next"
                  value={spanishInput}
                  onChange={onSpanishChange}
                  onKeyDown={onSpanishKeyDown}
                  onBlur={onSpanishBlur}
                  onFocus={(e) => {
                    if (suggestionsBlurTimerRef.current !== null) {
                      window.clearTimeout(suggestionsBlurTimerRef.current)
                      suggestionsBlurTimerRef.current = null
                    }
                    handleFocusSelect(e)
                  }}
                  placeholder="Palabra o frase en español (e.g. ahorita, qué padre)"
                  aria-autocomplete="list"
                  aria-controls="spanish-suggestions"
                  aria-expanded={suggestions.length > 0}
                  aria-activedescendant={
                    activeSuggestionIndex >= 0
                      ? `suggestion-${activeSuggestionIndex}`
                      : undefined
                  }
                />
                {suggestions.length > 0 && (
                  <div className="suggestions-container" ref={suggestionsRef}>
                    <div className="suggestions-header">
                      <span className="suggestions-header-label">
                        Suggestions
                      </span>
                      <button
                        type="button"
                        className="suggestions-dismiss-button"
                        tabIndex={-1}
                        onMouseDown={(e) => {
                          e.preventDefault()
                        }}
                        onClick={dismissSuggestions}
                        aria-label="Dismiss suggestions"
                      >
                        Dismiss <span aria-hidden="true">✕</span>
                      </button>
                    </div>
                    <ul
                      className="suggestions-listbox"
                      role="listbox"
                      id="spanish-suggestions"
                      aria-label="Mexican Spanish suggestions"
                    >
                      {suggestions.map((item, index) => (
                        <li
                          key={item.spanish}
                          id={`suggestion-${index}`}
                          role="option"
                          aria-selected={activeSuggestionIndex === index}
                          className={`suggestion-item ${activeSuggestionIndex === index ? 'is-active' : ''}`}
                          onMouseDown={(e) => {
                            e.preventDefault()
                          }}
                          onClick={() => {
                            applySuggestion(item)
                          }}
                        >
                          <div className="suggestion-head">
                            <span className="suggestion-spanish">
                              {item.spanish}
                            </span>
                            {item.matchType === 'lemma' && item.matchedForm && (
                              <span className="suggestion-lemma-badge">
                                from <em>{item.matchedForm}</em>
                              </span>
                            )}
                            {item.matchType === 'fuzzy' && (
                              <span className="suggestion-fuzzy-badge">
                                typo match
                              </span>
                            )}
                            {item.tag && (
                              <span
                                className={`suggestion-tag tag-${item.tag}`}
                              >
                                {item.tag}
                              </span>
                            )}
                          </div>
                          <span className="suggestion-english">
                            {item.english}
                          </span>
                          {item.context && (
                            <span className="suggestion-context">
                              {item.context}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="field-group">
                <label htmlFor="english">
                  <UsFlag /> English
                </label>
                <textarea
                  id="english"
                  name="english"
                  rows={2}
                  required
                  autoCapitalize="none"
                  enterKeyHint="next"
                  value={englishInput}
                  onChange={onEnglishChange}
                  onFocus={handleFocusSelect}
                  placeholder="English translation"
                />
              </div>
              {duplicateCard && (
                <div
                  className="create-duplicate-notice"
                  role="status"
                  aria-live="polite"
                >
                  <div className="create-duplicate-info">
                    <span className="create-duplicate-badge">Card exists</span>
                    <span
                      className="create-duplicate-text"
                      title={`${duplicateCard.prompt} → ${duplicateCard.answer}`}
                    >
                      <strong>{duplicateCard.prompt}</strong> →{' '}
                      {duplicateCard.answer}
                      <span className="create-duplicate-schedule">
                        {' '}
                        (
                        {
                          getCardScheduleBadge(duplicateCard, referenceTime)
                            .label
                        }
                        )
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="text-button create-duplicate-action"
                    onClick={() => setEditingCard(duplicateCard)}
                  >
                    Edit existing card
                  </button>
                </div>
              )}
              <div className="field-group">
                <label htmlFor="context">Additional Context</label>
                <textarea
                  id="context"
                  name="context"
                  rows={2}
                  autoCapitalize="none"
                  enterKeyHint="done"
                  value={contextInput}
                  onChange={(e) => setContextInput(e.target.value)}
                  onFocus={handleFocusSelect}
                  placeholder="Optional context, regional nuance, or memory hook"
                />
              </div>
              <label className="toggle-row">
                <input
                  name="bidirectional"
                  type="checkbox"
                  checked={bidirectional}
                  onChange={(event) => setBidirectional(event.target.checked)}
                />
                <span className="toggle" aria-hidden="true" />
                <span>Practice both directions</span>
              </label>
              {bidirectional && (
                <details className="form-details">
                  <summary>Customize reverse card</summary>
                  <div className="compact-fields">
                    <div className="compact-field">
                      <label htmlFor="reverse-prompt">
                        <UsFlag /> Reverse Prompt
                      </label>
                      <input
                        id="reverse-prompt"
                        name="reversePrompt"
                        autoCapitalize="none"
                        enterKeyHint="next"
                        value={reversePromptInput}
                        onChange={(e) => setReversePromptInput(e.target.value)}
                        onFocus={handleFocusSelect}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="compact-field">
                      <label htmlFor="reverse-answer">
                        <MexicoFlag /> Reverse Answer
                      </label>
                      <input
                        id="reverse-answer"
                        name="reverseAnswer"
                        autoCapitalize="none"
                        enterKeyHint="done"
                        value={reverseAnswerInput}
                        onChange={(e) => setReverseAnswerInput(e.target.value)}
                        onFocus={handleFocusSelect}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                </details>
              )}
              <button
                className={`primary-button save-button ${savedToast ? 'is-saved' : ''}`}
                type="submit"
                aria-label={authUser ? 'Save card' : 'Sign in to save card'}
              >
                {savedToast ? (
                  <span className="save-button-saved" aria-hidden="true">
                    <span className="save-button-check">✓</span>
                    <span className="save-button-text">
                      Saved “{savedToast}”
                    </span>
                  </span>
                ) : (
                  <span>{authUser ? 'Save card' : 'Sign in to save'}</span>
                )}
              </button>
              <div className="sr-only" role="status" aria-live="polite">
                {savedToast ? `Saved “${savedToast}”` : ''}
              </div>
            </form>
          </section>
          <AppFooter onOpenFeedback={openFeedbackModal} />
        </main>
        <SyncModal
          isOpen={isSyncOpen}
          onClose={closeSyncModal}
          cards={cards}
          deletedCardIds={deletedCardIds}
          onUpdateCards={onUpdateCards}
          auth={services.auth}
          sync={services.sync}
          onSaveLocally={pendingCard ? handleSavePendingLocally : undefined}
          pendingCardPrompt={
            pendingCard ? pendingCard.spanish.trim() : undefined
          }
        />
        <EditCardModal
          isOpen={editingCard !== null}
          card={editingCard}
          cards={cards}
          onClose={() => setEditingCard(null)}
          onSave={handleSaveEdit}
          onPlayAudio={playAudio}
        />
        <DeleteCardsModal
          isOpen={deletingCards !== null}
          cards={deletingCards}
          onClose={() => setDeletingCards(null)}
          onConfirm={handleConfirmDelete}
        />
        <FeedbackModal
          isOpen={isFeedbackOpen}
          onClose={closeFeedbackModal}
          user={authUser}
          feedbackService={services.feedback}
          currentView={view}
        />
      </>
    )
  }

  if (view === 'deck') {
    const isAllSelected =
      filteredDeckCards.length > 0 &&
      filteredDeckCards.every((c) => selectedCardIds.has(c.id))
    const isSomeSelected = filteredDeckCards.some((c) =>
      selectedCardIds.has(c.id),
    )

    const handleRowKeyDown = (
      e: ReactKeyboardEvent<HTMLElement>,
      card: StudyCard,
    ) => {
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedCardIds((prev) => {
          const next = new Set(prev)
          if (next.has(card.id)) next.delete(card.id)
          else next.add(card.id)
          return next
        })
      } else if (e.key === 'Enter') {
        e.preventDefault()
        setEditingCard(card)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        const nextRow = e.currentTarget.nextElementSibling as HTMLElement | null
        if (nextRow && typeof nextRow.focus === 'function') nextRow.focus()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prevRow = e.currentTarget
          .previousElementSibling as HTMLElement | null
        if (prevRow && typeof prevRow.focus === 'function') prevRow.focus()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        if (selectedCardIds.has(card.id) && selectedCardIds.size > 1) {
          setDeletingCards(cards.filter((c) => selectedCardIds.has(c.id)))
        } else {
          setDeletingCards([card])
        }
      }
    }

    return (
      <>
        <main className="app-shell deck-page">
          <nav className="topbar" aria-label="Deck navigation">
            <Brand onClick={goHome} />
            <div className="nav-actions" data-nosnippet>
              {cards.length > 0 && (
                <button
                  className="text-button"
                  onClick={() => navigateTo('create')}
                >
                  + New card
                </button>
              )}
              {(queue.length > 0 || dueCount > 0) && (
                <button className="text-button" onClick={handlePractice}>
                  Practice
                </button>
              )}
              <ConnectionPill
                authUser={authUser}
                syncStatus={syncStatus}
                isOnline={isOnline}
                onClick={() => openSyncModal()}
              />
            </div>
          </nav>
          <RedirectAuthNotice
            message={redirectAuthBanner}
            onDismiss={() => setRedirectAuthBanner(null)}
            onCopySessionLink={handleCopySessionLink}
          />
          <section className="deck-layout">
            <header className="deck-header-row">
              <h1>Manage deck</h1>
              <div className="deck-header-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setIsBackupOpen(true)}
                >
                  Backup & Import
                </button>
              </div>
            </header>

            <div className="deck-toolbar">
              <div className="deck-search-wrap">
                <span className="deck-search-icon" aria-hidden="true">
                  🔍
                </span>
                <input
                  type="search"
                  className="deck-search-input"
                  placeholder="Search cards by Spanish, English, or notes…"
                  value={deckSearchQuery}
                  onChange={(e) => setDeckSearchQuery(e.target.value)}
                  onFocus={handleFocusSelect}
                  aria-label="Search cards in deck"
                  autoCapitalize="none"
                />
              </div>

              <div className="deck-toolbar-controls">
                <div
                  className="deck-filter-pills"
                  role="radiogroup"
                  aria-label="Filter cards by state"
                >
                  <button
                    type="button"
                    className={`deck-filter-pill ${deckFilterState === 'all' ? 'is-active' : ''}`}
                    onClick={() => setDeckFilterState('all')}
                    aria-pressed={deckFilterState === 'all'}
                    title="All cards in your deck"
                  >
                    All ({deckStats.total})
                  </button>
                  <button
                    type="button"
                    className={`deck-filter-pill ${deckFilterState === 'due' ? 'is-active' : ''}`}
                    onClick={() => setDeckFilterState('due')}
                    aria-pressed={deckFilterState === 'due'}
                    title="Cards ready to practice right now (unstudied cards + due reviews)"
                  >
                    Due now ({deckStats.due})
                  </button>
                  <button
                    type="button"
                    className={`deck-filter-pill ${deckFilterState === 'new' ? 'is-active' : ''}`}
                    onClick={() => setDeckFilterState('new')}
                    aria-pressed={deckFilterState === 'new'}
                    title="Cards you haven't practiced yet"
                  >
                    Unstudied ({deckStats.newCount})
                  </button>
                  <button
                    type="button"
                    className={`deck-filter-pill ${deckFilterState === 'learning' ? 'is-active' : ''}`}
                    onClick={() => setDeckFilterState('learning')}
                    aria-pressed={deckFilterState === 'learning'}
                    title="Cards you are currently acquiring in short repetition steps"
                  >
                    Learning ({deckStats.learningCount})
                  </button>
                  <button
                    type="button"
                    className={`deck-filter-pill ${deckFilterState === 'review' ? 'is-active' : ''}`}
                    onClick={() => setDeckFilterState('review')}
                    aria-pressed={deckFilterState === 'review'}
                    title="Graduated cards scheduled for long-term memory retention (1+ days)"
                  >
                    Mastered ({deckStats.reviewCount})
                  </button>
                  {((deckStats.duplicatesCount ?? 0) > 0 ||
                    deckFilterState === 'duplicates') && (
                    <button
                      type="button"
                      className={`deck-filter-pill ${deckFilterState === 'duplicates' ? 'is-active' : ''}`}
                      onClick={() => setDeckFilterState('duplicates')}
                      aria-pressed={deckFilterState === 'duplicates'}
                      title="Cards sharing the same prompt in the same direction"
                    >
                      Duplicates ({deckStats.duplicatesCount ?? 0})
                    </button>
                  )}
                </div>

                {selectedCardIds.size > 0 ? (
                  <div
                    className="deck-batch-actions"
                    aria-label="Batch card actions"
                  >
                    <button
                      type="button"
                      className="danger-button batch-delete-btn"
                      onClick={() =>
                        setDeletingCards(
                          cards.filter((c) => selectedCardIds.has(c.id)),
                        )
                      }
                    >
                      🗑️ Delete selected ({selectedCardIds.size})
                    </button>
                    <button
                      type="button"
                      className="secondary-button deck-clear-selection-btn"
                      onClick={() => setSelectedCardIds(new Set())}
                    >
                      Clear selection
                    </button>
                  </div>
                ) : (
                  cards.length > 0 && (
                    <div className="deck-sort-wrap">
                      <label
                        htmlFor="deck-sort-select"
                        className="deck-sort-label"
                      >
                        Sort
                      </label>
                      <select
                        id="deck-sort-select"
                        className="deck-sort-select"
                        value={deckSortOrder}
                        onChange={(e) =>
                          setDeckSortOrder(e.target.value as DeckSortOrder)
                        }
                        aria-label="Sort cards"
                      >
                        <option value="created-desc">Newest first</option>
                        <option value="created-asc">Oldest first</option>
                        <option value="alpha-asc">Alphabetical (A–Z)</option>
                        <option value="alpha-desc">Alphabetical (Z–A)</option>
                      </select>
                    </div>
                  )
                )}
              </div>
            </div>

            {filteredDeckCards.length === 0 ? (
              <div className="deck-empty-state">
                <h3>No cards found</h3>
                <p>
                  {deckSearchQuery.trim()
                    ? `No cards match “${deckSearchQuery.trim()}”. Try a different search term or clear the filter.`
                    : cards.length === 0
                      ? 'Your deck is currently empty. Create a card or import an Anki deck to start practicing.'
                      : `No cards in the “${{ all: 'all', due: 'due now', new: 'unstudied', learning: 'learning', review: 'mastered', duplicates: 'duplicates' }[deckFilterState]}” category right now.`}
                </p>
                {cards.length === 0 ? (
                  <div className="deck-empty-actions">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => navigateTo('create')}
                    >
                      Create a card →
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setIsBackupOpen(true)}
                    >
                      Import Anki / Backup
                    </button>
                  </div>
                ) : deckSearchQuery.trim() ||
                  deckFilterState !== 'all' ||
                  deckSortOrder !== 'created-desc' ? (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setDeckSearchQuery('')
                      setDeckFilterState('all')
                      setDeckSortOrder('created-desc')
                    }}
                  >
                    Clear search & filters
                  </button>
                ) : null}
              </div>
            ) : (
              <div
                className="deck-cards-list is-compact"
                role="table"
                aria-label="Deck cards"
              >
                <div className="deck-list-table-header" role="row">
                  <div className="col-select" role="columnheader">
                    <input
                      type="checkbox"
                      className="deck-select-checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el)
                          el.indeterminate = isSomeSelected && !isAllSelected
                      }}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCardIds(
                            new Set(filteredDeckCards.map((c) => c.id)),
                          )
                        } else {
                          setSelectedCardIds(new Set())
                        }
                      }}
                      aria-label={
                        isAllSelected
                          ? 'Deselect all cards'
                          : 'Select all cards'
                      }
                    />
                  </div>
                  <div className="col-dir" role="columnheader">
                    Direction
                  </div>
                  <div
                    className="col-phrase col-prompt"
                    role="columnheader"
                    aria-sort={
                      deckSortOrder === 'alpha-asc'
                        ? 'ascending'
                        : deckSortOrder === 'alpha-desc'
                          ? 'descending'
                          : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="deck-sort-header-btn"
                      onClick={() => {
                        setDeckSortOrder((current) => {
                          if (current === 'alpha-asc') return 'alpha-desc'
                          if (current === 'alpha-desc') return 'created-desc'
                          return 'alpha-asc'
                        })
                      }}
                      aria-label="Sort by prompt"
                    >
                      <span>Prompt</span>
                      {deckSortOrder === 'alpha-asc' && (
                        <span className="deck-sort-icon" aria-hidden="true">
                          ↑
                        </span>
                      )}
                      {deckSortOrder === 'alpha-desc' && (
                        <span className="deck-sort-icon" aria-hidden="true">
                          ↓
                        </span>
                      )}
                    </button>
                  </div>
                  <div className="col-phrase col-answer" role="columnheader">
                    Answer
                  </div>
                  <div className="col-status" role="columnheader">
                    Status
                  </div>
                </div>

                {filteredDeckCards.map((card) => {
                  const scheduleBadge = getCardScheduleBadge(
                    card,
                    referenceTime,
                  )
                  const isEsToEn = card.direction === 'es-en'

                  return (
                    <div
                      key={card.id}
                      className={`deck-card-row ${selectedCardIds.has(card.id) ? 'is-selected' : ''}`}
                      role="row"
                      tabIndex={0}
                      aria-selected={selectedCardIds.has(card.id)}
                      aria-label={`Card: ${card.prompt}, answer: ${card.answer}. Click or press Enter to edit, Space to select.`}
                      title="Click or press Enter to edit card"
                      onClick={() => setEditingCard(card)}
                      onKeyDown={(e) => handleRowKeyDown(e, card)}
                    >
                      <div
                        className="col-select"
                        role="cell"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="deck-select-checkbox"
                          checked={selectedCardIds.has(card.id)}
                          onChange={(e) => {
                            e.stopPropagation()
                            setSelectedCardIds((prev) => {
                              const next = new Set(prev)
                              if (next.has(card.id)) next.delete(card.id)
                              else next.add(card.id)
                              return next
                            })
                          }}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select card ${card.prompt}`}
                        />
                      </div>
                      <div className="col-dir" role="cell">
                        <span
                          className="deck-direction-badge"
                          title={
                            isEsToEn
                              ? 'Mexican Spanish Prompt → English Answer'
                              : 'English Prompt → Mexican Spanish Answer'
                          }
                        >
                          {isEsToEn ? <MexicoFlag /> : <UsFlag />}
                          <span>{isEsToEn ? 'ES → EN' : 'EN → ES'}</span>
                        </span>
                      </div>
                      <div className="col-phrase col-prompt" role="cell">
                        <span className="deck-phrase-text">{card.prompt}</span>
                        {duplicateCardIds.has(card.id) && (
                          <span
                            className="deck-card-duplicate-pill"
                            title="Duplicate prompt in deck"
                            aria-label="Duplicate card"
                          >
                            Duplicate
                          </span>
                        )}
                      </div>
                      <div className="col-phrase col-answer" role="cell">
                        <span className="deck-answer-text">{card.answer}</span>
                      </div>

                      <div className="col-status" role="cell">
                        <span
                          className={`deck-stat-chip is-${scheduleBadge.type} is-mini`}
                        >
                          {scheduleBadge.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
          <AppFooter onOpenFeedback={openFeedbackModal} />
        </main>
        <DeckBackupModal
          isOpen={isBackupOpen}
          onClose={() => setIsBackupOpen(false)}
          cards={cards}
          deletedCardIds={deletedCardIds}
          onUpdateCards={onUpdateCards}
          clock={services.clock}
          user={authUser}
          sync={services.sync}
        />

        <SyncModal
          isOpen={isSyncOpen}
          onClose={closeSyncModal}
          cards={cards}
          deletedCardIds={deletedCardIds}
          onUpdateCards={onUpdateCards}
          auth={services.auth}
          sync={services.sync}
          onSaveLocally={pendingCard ? handleSavePendingLocally : undefined}
          pendingCardPrompt={
            pendingCard ? pendingCard.spanish.trim() : undefined
          }
        />
        <EditCardModal
          isOpen={editingCard !== null}
          card={editingCard}
          cards={cards}
          onClose={() => setEditingCard(null)}
          onSave={handleSaveEdit}
          onPlayAudio={playAudio}
        />
        <DeleteCardsModal
          isOpen={deletingCards !== null}
          cards={deletingCards}
          onClose={() => setDeletingCards(null)}
          onConfirm={handleConfirmDelete}
        />
        <DemoDeckModal
          isOpen={!authUser && !isDemoDeckDismissed}
          onClose={() => setIsDemoDeckDismissed(true)}
          onSignIn={() => openSyncModal()}
        />
        <FeedbackModal
          isOpen={isFeedbackOpen}
          onClose={closeFeedbackModal}
          user={authUser}
          feedbackService={services.feedback}
          currentView={view}
        />
      </>
    )
  }

  if (view === 'complete' || (view === 'review' && !currentCard))
    return (
      <>
        <main className="app-shell complete-page">
          <nav className="topbar" aria-label="Session navigation">
            <Brand onClick={goHome} />
            <div className="nav-actions" data-nosnippet>
              <button
                className="text-button"
                onClick={() => navigateTo('deck')}
              >
                Manage deck
              </button>
              <button
                className="text-button"
                onClick={() => navigateTo('create')}
              >
                + New card
              </button>
              <ConnectionPill
                authUser={authUser}
                syncStatus={syncStatus}
                isOnline={isOnline}
                onClick={() => openSyncModal()}
              />
            </div>
          </nav>
          <RedirectAuthNotice
            message={redirectAuthBanner}
            onDismiss={() => setRedirectAuthBanner(null)}
            onCopySessionLink={handleCopySessionLink}
          />
          <section className="complete-card">
            <div className="complete-mascot-frame" aria-hidden="true">
              <img src={celebrateUrl} alt="" className="complete-mascot-img" />
            </div>
            <p className="eyebrow">
              {authUser ? 'SESSION COMPLETE' : 'DEMO SESSION COMPLETE'}
            </p>
            <h1>{reviewedCount > 0 ? '¡Hecho!' : 'You’re caught up.'}</h1>
            {authUser ? (
              <div className="complete-copy">
                <p>
                  {reviewedCount > 0
                    ? `${reviewedCount} ${reviewedCount === 1 ? 'card' : 'cards'} practiced. Your next reviews are scheduled.`
                    : 'Nothing is due right now. Add something from your day in CDMX?'}
                </p>
                {studiedTodayCount > 0 && (
                  <p className="complete-subtext">
                    {studiedTodayCount}{' '}
                    {studiedTodayCount === 1 ? 'card' : 'cards'} practiced today
                    across your devices.
                  </p>
                )}
              </div>
            ) : (
              <div className="complete-copy">
                <p>
                  {reviewedCount > 0
                    ? `${reviewedCount} ${reviewedCount === 1 ? 'card' : 'cards'} practiced.`
                    : 'You’re exploring demo cards.'}
                </p>
                <p className="complete-subtext">
                  <button
                    type="button"
                    className="complete-link-button"
                    onClick={() => openSyncModal()}
                  >
                    Sign in
                  </button>{' '}
                  to create and sync your personal deck.
                </p>
              </div>
            )}
            <div className="complete-actions">
              {remainingDueCount > 0 ? (
                <>
                  <button
                    className="primary-button"
                    onClick={() => beginReview()}
                  >
                    Practice next{' '}
                    {Math.min(remainingDueCount, DEFAULT_STUDY_BATCH_SIZE)}{' '}
                    <span aria-hidden="true">→</span>
                  </button>
                  <button className="secondary-button" onClick={goHome}>
                    Back home
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="primary-button"
                    onClick={() => navigateTo('create')}
                  >
                    Create a card <span aria-hidden="true">→</span>
                  </button>
                  <button className="secondary-button" onClick={goHome}>
                    Back home
                  </button>
                </>
              )}
            </div>
          </section>
          <AppFooter onOpenFeedback={openFeedbackModal} />
        </main>
        <SyncModal
          isOpen={isSyncOpen}
          onClose={closeSyncModal}
          cards={cards}
          deletedCardIds={deletedCardIds}
          onUpdateCards={onUpdateCards}
          auth={services.auth}
          sync={services.sync}
          onSaveLocally={pendingCard ? handleSavePendingLocally : undefined}
          pendingCardPrompt={
            pendingCard ? pendingCard.spanish.trim() : undefined
          }
        />
        <EditCardModal
          isOpen={editingCard !== null}
          card={editingCard}
          cards={cards}
          onClose={() => setEditingCard(null)}
          onSave={handleSaveEdit}
          onPlayAudio={playAudio}
        />
        <DeleteCardsModal
          isOpen={deletingCards !== null}
          cards={deletingCards}
          onClose={() => setDeletingCards(null)}
          onConfirm={handleConfirmDelete}
        />
        <FeedbackModal
          isOpen={isFeedbackOpen}
          onClose={closeFeedbackModal}
          user={authUser}
          feedbackService={services.feedback}
          currentView={view}
        />
      </>
    )

  if (!currentCard) return null

  const effectiveTotal = Math.max(sessionTotal, queue.length)
  const completedInSession = Math.max(0, effectiveTotal - queue.length)
  const progressPercentage =
    effectiveTotal > 0
      ? Math.min(100, Math.round((completedInSession / effectiveTotal) * 100))
      : 0

  return (
    <>
      <main className="app-shell review-page">
        <nav className="topbar" aria-label="Review navigation">
          <Brand onClick={goHome} />
          <div className="nav-actions" data-nosnippet>
            <button className="text-button" onClick={() => navigateTo('deck')}>
              Manage deck
            </button>
            <button
              className="text-button"
              onClick={() => navigateTo('create')}
            >
              + New card
            </button>
            <ConnectionPill
              authUser={authUser}
              syncStatus={syncStatus}
              isOnline={isOnline}
              onClick={() => openSyncModal()}
            />
          </div>
        </nav>
        <RedirectAuthNotice
          message={redirectAuthBanner}
          onDismiss={() => setRedirectAuthBanner(null)}
          onCopySessionLink={handleCopySessionLink}
        />
        <div
          className="review-progress-track"
          role="progressbar"
          aria-label="Session progress"
          aria-valuenow={progressPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={`${queue.length} ${queue.length === 1 ? 'card' : 'cards'} remaining`}
        >
          <div
            className="review-progress-bar"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <section className={`study-card ${revealed ? 'is-revealed' : ''}`}>
          <div className="study-prompt-wrap">
            <h1
              className={`study-prompt ${currentCard.prompt.trim().length > 100 ? 'is-long' : currentCard.prompt.trim().length > 50 ? 'is-medium' : ''}`.trim()}
            >
              {currentCard.prompt}
            </h1>
            <AudioButton
              prompt
              label="Play prompt audio"
              onClick={() =>
                playAudio(
                  currentCard.prompt,
                  localeForPrompt(currentCard),
                  currentCard.id,
                )
              }
            />
          </div>
          <div className="prompt-meta">
            <p className="eyebrow direction-eyebrow">
              {currentCard.direction === 'es-en' ? (
                <>
                  <MexicoFlag /> MEXICAN SPANISH → <UsFlag /> ENGLISH
                </>
              ) : (
                <>
                  <UsFlag /> ENGLISH → <MexicoFlag /> MEXICAN SPANISH
                </>
              )}
            </p>
          </div>
          {audioUnavailable && (
            <p className="audio-unavailable" role="status">
              Audio isn’t available in this browser. You can keep reviewing.
            </p>
          )}
          {!revealed ? (
            <form className="answer-form" onSubmit={reveal}>
              <label className="sr-only" htmlFor="answer">
                Your answer
              </label>
              <input
                ref={responseInput}
                id="answer"
                className="answer-input"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="Type your answer…"
                autoComplete="off"
                autoCapitalize="none"
              />
              <button className="reveal-button" type="submit">
                Reveal answer <kbd>Enter</kbd>
              </button>
            </form>
          ) : (
            <div className="reveal-panel">
              <div className="reveal-content">
                <div className="reveal-main">
                  <AnswerComparison
                    typed={answer}
                    expected={currentCard.answer}
                    onPlayAudio={() =>
                      playAudio(
                        currentCard.answer,
                        localeForAnswer(currentCard),
                        currentCard.id,
                      )
                    }
                  />
                  {currentCard.context && (
                    <div className="reveal-context-block">
                      <span className="context-label">Additional Context</span>
                      <p className="context-text">{currentCard.context}</p>
                    </div>
                  )}
                </div>
              </div>
              <fieldset className="grade-fieldset">
                <legend className="sr-only">How did that feel?</legend>
                <div className="grade-buttons">
                  {grades.map((gradeValue, index) => (
                    <button
                      type="button"
                      className={`grade-${gradeValue}`}
                      data-grade={index + 1}
                      onClick={() => grade(gradeValue)}
                      key={gradeValue}
                    >
                      <kbd>{index + 1}</kbd>
                      <strong>{gradeLabels[gradeValue]}</strong>
                      <small>{intervalLabel(currentCard, gradeValue)}</small>
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          <div className="study-card-quick-actions">
            <button
              type="button"
              className="study-quick-btn edit-btn"
              aria-label={`Edit card: ${currentCard.prompt}`}
              onClick={() => setEditingCard(currentCard)}
            >
              ✏️ Edit card
            </button>
            <button
              type="button"
              className="study-quick-btn delete-btn"
              aria-label={`Delete card: ${currentCard.prompt}`}
              onClick={() => setDeletingCards([currentCard])}
            >
              🗑️ Delete card
            </button>
          </div>

          <p className="keyboard-hint">
            {!revealed ? (
              <>
                <kbd>Enter</kbd> reveal · <kbd>⌃ E</kbd> edit ·{' '}
                <kbd>⌃ Space</kbd> replay audio
              </>
            ) : (
              <>
                <kbd>1–4</kbd> rate · <kbd>e</kbd> edit · <kbd>Space</kbd>{' '}
                replay audio
              </>
            )}
          </p>
        </section>
      </main>
      <SyncModal
        isOpen={isSyncOpen}
        onClose={closeSyncModal}
        cards={cards}
        deletedCardIds={deletedCardIds}
        onUpdateCards={onUpdateCards}
        auth={services.auth}
        sync={services.sync}
        onSaveLocally={pendingCard ? handleSavePendingLocally : undefined}
        pendingCardPrompt={pendingCard ? pendingCard.spanish.trim() : undefined}
      />
      <EditCardModal
        isOpen={editingCard !== null}
        card={editingCard}
        cards={cards}
        onClose={() => setEditingCard(null)}
        onSave={handleSaveEdit}
        onPlayAudio={playAudio}
      />
      <DeleteCardsModal
        isOpen={deletingCards !== null}
        cards={deletingCards}
        onClose={() => setDeletingCards(null)}
        onConfirm={handleConfirmDelete}
      />
      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={closeFeedbackModal}
        user={authUser}
        feedbackService={services.feedback}
        currentView={view}
      />
    </>
  )
}
