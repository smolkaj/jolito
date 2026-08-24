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
import {
  createDeckBackup,
  restoreDeckFromBackup,
  type RestoreMode,
} from './application/deck-backup'
import { syncDeckWithCloud } from './application/deck-sync'
import type {
  AppServices,
  AuthService,
  AuthUser,
  SyncService,
} from './application/ports'
import { starterCards } from './application/starter-cards'
import { compareAnswer, type DiffSegment } from './domain/answer'
import {
  grades,
  intervalLabel,
  isDue,
  scheduleReview,
  shouldRequeueInSession,
  type Grade,
  type StudyCard,
} from './domain/card'
import type { AutocompleteSuggestion, LexiconEntry } from './domain/lexicon'
import { parseDeckBackup } from './domain/deck-backup'
import type { SyncStatus } from './domain/sync'
import { downloadJsonFile } from './infrastructure/browser/download'
import { createBrowserServices } from './infrastructure/browser/services'
import { checkOrRequestStoragePersistence } from './infrastructure/browser/storage-persistence'
import { type View, hashForView, viewFromHash } from './navigation'

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

function MexicoFlag({ className }: { className?: string }) {
  return (
    <svg
      className={`flag-icon flag-mx ${className ?? ''}`}
      viewBox="0 0 18 12"
      width="16"
      height="11"
      aria-hidden="true"
    >
      <rect width="6" height="12" fill="#006847" />
      <rect x="6" width="6" height="12" fill="#ffffff" />
      <rect x="12" width="6" height="12" fill="#ce1126" />
      <circle cx="9" cy="6" r="1.8" fill="#bfa054" />
      <circle cx="9" cy="6" r="1.1" fill="#4a2e12" />
      <circle cx="9" cy="5.4" r="0.5" fill="#006847" />
    </svg>
  )
}

function UsFlag({ className }: { className?: string }) {
  return (
    <svg
      className={`flag-icon flag-us ${className ?? ''}`}
      viewBox="0 0 18 12"
      width="16"
      height="11"
      aria-hidden="true"
    >
      <rect width="18" height="12" fill="#bf0a30" />
      <rect y="1.8" width="18" height="1.8" fill="#ffffff" />
      <rect y="5.4" width="18" height="1.8" fill="#ffffff" />
      <rect y="9" width="18" height="1.8" fill="#ffffff" />
      <rect width="8" height="6" fill="#002868" />
      <circle cx="2.5" cy="2" r="0.55" fill="#ffffff" />
      <circle cx="5.5" cy="2" r="0.55" fill="#ffffff" />
      <circle cx="4" cy="4" r="0.55" fill="#ffffff" />
    </svg>
  )
}

function Brand({ onClick }: { onClick?: () => void }) {
  const content = (
    <>
      <img src={logoUrl} alt="" aria-hidden="true" />
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

function AudioButton({
  label,
  onClick,
  prompt = false,
}: {
  label: string
  onClick: () => void
  prompt?: boolean
}) {
  return (
    <button
      className="audio-button"
      type="button"
      aria-label={label}
      title={label}
      data-prompt-audio={prompt || undefined}
      onClick={onClick}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M5 9v6h4l5 4V5L9 9H5Zm11.5-.5a5 5 0 0 1 0 7M18.8 6a8.2 8.2 0 0 1 0 12" />
      </svg>
    </button>
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
function SyncModal({
  isOpen,
  onClose,
  cards,
  onUpdateCards,
  auth,
  sync,
  clock,
}: {
  isOpen: boolean
  onClose: () => void
  cards: StudyCard[]
  onUpdateCards: (newCards: StudyCard[]) => void
  auth: AuthService
  sync: SyncService
  clock: { now(): number }
}) {
  // Auth & Cloud Sync state
  const [user, setUser] = useState<AuthUser | null>(null)
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [isOtpSent, setIsOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [syncStatusMsg, setSyncStatusMsg] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
  } | null>(null)

  // Backup & Restore state
  const [mode, setMode] = useState<RestoreMode>('replace')
  const [backupStatus, setBackupStatus] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
    details?: string[] | undefined
  } | null>(null)
  const [selectedFileText, setSelectedFileText] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isBackendConfigured = auth.isConfigured ? auth.isConfigured() : true

  useEffect(() => {
    return auth.onAuthStateChange((currentUser) => {
      setUser(currentUser)
    })
  }, [auth])

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

  // Auth handlers
  const handleSendLink = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setSyncStatusMsg(null)
    const res = await auth.sendMagicLink(email.trim())
    setLoading(false)
    if (res.success) {
      setIsOtpSent(true)
      setSyncStatusMsg({
        type: 'info',
        message: 'Sign-in code sent to your email. Enter it below to sync.',
      })
    } else {
      setSyncStatusMsg({
        type: 'error',
        message: res.error || 'Failed to send sign-in link.',
      })
    }
  }

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault()
    if (!token.trim()) return
    setLoading(true)
    setSyncStatusMsg(null)
    const res = await auth.verifyOtp(email.trim(), token.trim())
    if (res.success) {
      const loggedUser = await auth.getUser()
      if (loggedUser) {
        setSyncStatusMsg({
          type: 'info',
          message: 'Signed in! Syncing deck with cloud...',
        })
        const syncRes = await syncDeckWithCloud({
          localCards: cards,
          user: loggedUser,
          syncService: sync,
          onCardsUpdated: onUpdateCards,
        })
        setLoading(false)
        if (syncRes.success) {
          setSyncStatusMsg({
            type: 'success',
            message: `Deck synchronized (${cards.length} cards up to date).`,
          })
        } else {
          setSyncStatusMsg({
            type: 'error',
            message: syncRes.error || 'Sync completed with errors.',
          })
        }
      } else {
        setLoading(false)
      }
    } else {
      setLoading(false)
      setSyncStatusMsg({
        type: 'error',
        message: res.error || 'Invalid code.',
      })
    }
  }

  const handleSyncNow = async () => {
    if (!user) return
    setLoading(true)
    setSyncStatusMsg(null)
    const res = await syncDeckWithCloud({
      localCards: cards,
      user,
      syncService: sync,
      onCardsUpdated: onUpdateCards,
    })
    setLoading(false)
    if (res.success) {
      setSyncStatusMsg({
        type: 'success',
        message: `Deck successfully synchronized with cloud.`,
      })
    } else {
      setSyncStatusMsg({
        type: 'error',
        message: res.error || 'Failed to sync with cloud.',
      })
    }
  }

  const handleSignOut = async () => {
    await auth.signOut()
    setIsOtpSent(false)
    setToken('')
    setSyncStatusMsg({
      type: 'info',
      message: 'Signed out. Cards remain safely stored on this device.',
    })
  }

  // Backup / Export / Restore handlers
  const handleExport = () => {
    const backup = createDeckBackup(cards, clock)
    downloadJsonFile(backup.filename, backup.json)
    setBackupStatus({
      type: 'success',
      message: `Deck exported: ${cards.length} cards saved to ${backup.filename}.`,
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result
      if (typeof text !== 'string') return
      const parsed = parseDeckBackup(text)
      if (parsed.success) {
        setSelectedFileText(text)
        setBackupStatus({
          type: 'info',
          message: `Found ${parsed.count} cards ready to import.`,
        })
      } else {
        setSelectedFileText(null)
        setBackupStatus({
          type: 'error',
          message: parsed.error,
          details: parsed.details,
        })
      }
    }
    reader.readAsText(file)
  }

  const handleRestore = () => {
    if (!selectedFileText) return
    const result = restoreDeckFromBackup(cards, selectedFileText, mode)
    if (result.success) {
      onUpdateCards(result.cards)
      setBackupStatus({
        type: 'success',
        message: `Successfully imported ${result.importedCount} cards (${result.count} total cards in library).`,
      })
      setSelectedFileText(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      // If signed in, sync newly imported cards to cloud
      if (user) {
        void syncDeckWithCloud({
          localCards: result.cards,
          user,
          syncService: sync,
          onCardsUpdated: onUpdateCards,
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
        className="modal-content sync-modal data-safety-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-copy">
            <h2 id="sync-modal-title">Cloud sync & deck backup</h2>
            <p className="modal-subtitle">
              Replicate your cards across devices or export offline JSON
              backups.
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

        <div className="deck-stats-bar">
          <div className="stat-pill">
            <strong>{cards.length}</strong> cards in collection
          </div>
        </div>

        <div className="modal-sections-stack">
          {/* Section 1: Multi-Device Cloud Sync */}
          <section className="safety-section cloud-sync-section">
            <div className="section-title-row">
              <span className="section-icon" aria-hidden="true">
                ☁️
              </span>
              <div>
                <h3>Multi-device cloud sync</h3>
                <p className="section-caption">
                  Automatic background synchronization for your phones, tablets,
                  and laptops.
                </p>
              </div>
            </div>

            {syncStatusMsg && (
              <div
                className={`status-banner status-${syncStatusMsg.type}`}
                role={syncStatusMsg.type === 'error' ? 'alert' : 'status'}
              >
                <p>{syncStatusMsg.message}</p>
              </div>
            )}

            {!isBackendConfigured ? (
              <div className="sync-notice-card">
                <span className="notice-icon" aria-hidden="true">
                  🛡️
                </span>
                <h4>Cloud sync is disabled in this preview</h4>
                <p>
                  Multi-device cloud synchronization is disabled in this preview
                  deployment. Your flashcards, audio, and spaced-repetition
                  schedules remain 100% functional and safely stored on this
                  device.
                </p>
              </div>
            ) : user ? (
              <div className="sync-account-pane">
                <div className="account-info-card">
                  <div className="account-avatar" aria-hidden="true">
                    ☁️
                  </div>
                  <div className="account-details">
                    <span className="account-badge">Signed in</span>
                    <p className="account-email">{user.email}</p>
                  </div>
                </div>

                <div className="sync-actions-row">
                  <button
                    type="button"
                    className="primary-button sync-now-button"
                    onClick={() => {
                      void handleSyncNow()
                    }}
                    disabled={loading}
                  >
                    {loading ? 'Syncing…' : 'Sync now ⟳'}
                  </button>
                  <button
                    type="button"
                    className="text-button sign-out-button"
                    onClick={() => {
                      void handleSignOut()
                    }}
                    disabled={loading}
                  >
                    Sign out
                  </button>
                </div>
              </div>
            ) : (
              <div className="sync-auth-pane">
                {!isOtpSent ? (
                  <form
                    onSubmit={(e) => {
                      void handleSendLink(e)
                    }}
                    className="sync-auth-form"
                  >
                    <p className="sync-explanation">
                      Enter your email to receive a passwordless sign-in code.
                    </p>
                    <div className="field-group">
                      <label htmlFor="sync-email">Email address</label>
                      <input
                        id="sync-email"
                        type="email"
                        required
                        placeholder="learner@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <button
                      type="submit"
                      className="primary-button"
                      disabled={loading}
                    >
                      {loading ? 'Sending code…' : 'Send sign-in code →'}
                    </button>
                  </form>
                ) : (
                  <form
                    onSubmit={(e) => {
                      void handleVerifyOtp(e)
                    }}
                    className="sync-auth-form"
                  >
                    <p className="sync-explanation">
                      Enter the verification code sent to{' '}
                      <strong>{email}</strong>:
                    </p>
                    <div className="field-group">
                      <label htmlFor="sync-otp">Verification code</label>
                      <input
                        id="sync-otp"
                        type="text"
                        required
                        autoFocus
                        placeholder="e.g. 123456"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                      />
                    </div>
                    <div className="sync-auth-buttons">
                      <button
                        type="submit"
                        className="primary-button"
                        disabled={loading}
                      >
                        {loading ? 'Verifying…' : 'Verify & sync →'}
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setIsOtpSent(false)}
                      >
                        Use different email
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </section>

          {/* Section 2: Offline File Backup & Restore (JSON) */}
          <section className="safety-section backup-export-section">
            <div className="section-title-row">
              <span className="section-icon" aria-hidden="true">
                💾
              </span>
              <div>
                <h3>Offline backup & export (JSON)</h3>
                <p className="section-caption">
                  Export or restore your cards and schedules to portable JSON
                  files.
                </p>
              </div>
            </div>

            <div className="backup-sections">
              <div className="backup-subcard export-subcard">
                <h4>Export deck</h4>
                <p>
                  Save all cards, schedules, notes, and study history to a JSON
                  file.
                </p>
                <button
                  type="button"
                  className="primary-button export-button"
                  onClick={handleExport}
                >
                  Export backup (JSON) <span aria-hidden="true">↓</span>
                </button>
              </div>

              <div className="backup-subcard import-subcard">
                <h4>Restore or merge file</h4>
                <p>
                  Load cards and schedules from a previously exported Jolito
                  JSON file.
                </p>

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
                      name="restoreMode"
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
                      name="restoreMode"
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
                    htmlFor="backup-file-input"
                    className="file-input-label"
                  >
                    Choose backup JSON file
                  </label>
                  <input
                    id="backup-file-input"
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    className="backup-file-input"
                    onChange={handleFileChange}
                    aria-label="Choose backup JSON file"
                  />
                </div>

                {selectedFileText && (
                  <button
                    type="button"
                    className="secondary-button restore-confirm-button"
                    onClick={handleRestore}
                  >
                    {mode === 'replace' ? 'Restore backup' : 'Merge backup'}
                  </button>
                )}
              </div>
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
          </section>
        </div>
      </div>
    </div>
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
  let stateClass = 'is-local'
  let label = 'Local only · Tap to sync'
  let ariaLabel = 'Local deck only. Tap to sync with cloud'

  if (!isOnline) {
    stateClass = 'is-offline'
    label = 'Offline · Saved locally'
    ariaLabel = 'Offline. Changes saved locally'
  } else if (authUser) {
    if (syncStatus === 'syncing') {
      stateClass = 'is-syncing'
      label = 'Syncing…'
      ariaLabel = 'Synchronizing deck with cloud'
    } else if (syncStatus === 'error') {
      stateClass = 'is-offline'
      label = 'Sync issue · Tap to retry'
      ariaLabel = 'Sync issue. Tap to view status and retry'
    } else {
      stateClass = 'is-synced'
      label = 'Cloud synced ✓'
      ariaLabel = 'Cloud synced with account'
    }
  }

  return (
    <button
      type="button"
      className={`connection-pill ${stateClass}`}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <i className="pill-dot" aria-hidden="true" />
      <span>{label}</span>
    </button>
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
    total: number
  }>(() => {
    if (typeof window === 'undefined') {
      return { view: 'welcome', queue: [], total: 0 }
    }
    const hash = window.location.hash
    if (hash === '') {
      window.history.replaceState({ view: 'welcome' }, '', '#/')
    }
    const requested = viewFromHash(hash)
    if (requested === 'review') {
      const now = services.clock.now()
      const due = initialCards
        .filter((card) => isDue(card, now))
        .sort((left, right) => left.schedule.dueAt - right.schedule.dueAt)
        .map(({ id }) => id)
      if (due.length === 0) {
        return { view: 'complete', queue: [], total: 0 }
      }
      return { view: 'review', queue: due, total: due.length }
    }
    return { view: requested, queue: [], total: 0 }
  }, [initialCards, services.clock])

  const [cards, setCards] = useState<StudyCard[]>(initialCards)
  const [view, setView] = useState<View>(initialResolved.view)
  const [queue, setQueue] = useState<string[]>(initialResolved.queue)
  const [sessionTotal, setSessionTotal] = useState(initialResolved.total)
  const [reviewedCount, setReviewedCount] = useState(0)
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [bidirectional, setBidirectional] = useState(true)
  const [spanishInput, setSpanishInput] = useState('')
  const [englishInput, setEnglishInput] = useState('')
  const [contextInput, setContextInput] = useState('')
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([])
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const [didYouMean, setDidYouMean] = useState<LexiconEntry | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSyncOpen, setIsSyncOpen] = useState(false)
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
  const responseInput = useRef<HTMLInputElement>(null)
  const sampleTimerRef = useRef<number | null>(null)
  const currentCard = cards.find(({ id }) => id === queue[0])
  const dueCount = cards.filter((card) => isDue(card, referenceTime)).length

  const onUpdateCards = useCallback(
    (newCards: StudyCard[]) => {
      setCards(newCards)
      services.cards.save(newCards)
      const now = services.clock.now()
      setReferenceTime(now)
      setQueue((currentQueue) => {
        if (view !== 'review') return currentQueue
        const due = newCards
          .filter((card) => isDue(card, now))
          .sort((left, right) => left.schedule.dueAt - right.schedule.dueAt)
          .map(({ id }) => id)
        return due
      })
      if (authUser) {
        setSyncStatus('syncing')
        void services.sync.syncDeck(newCards, authUser).then((res) => {
          if (res.success) setSyncStatus('synced')
          else setSyncStatus('error')
        })
      }
    },
    [authUser, services.cards, services.clock, services.sync, view],
  )

  useEffect(() => {
    return services.auth.onAuthStateChange((user) => {
      setAuthUser(user)
      if (user) {
        void syncDeckWithCloud({
          localCards: cards,
          user,
          syncService: services.sync,
          onCardsUpdated: onUpdateCards,
        }).then((res) => {
          if (res.success) setSyncStatus('synced')
        })
      }
    })
  }, [cards, onUpdateCards, services.auth, services.sync])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onOnline = () => {
      setIsOnline(true)
      if (authUser) {
        setSyncStatus('syncing')
        void services.sync.syncDeck(cards, authUser).then((res) => {
          if (res.success) setSyncStatus('synced')
          else setSyncStatus('error')
        })
      }
    }
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [authUser, cards, services.sync])

  useEffect(() => {
    void checkOrRequestStoragePersistence()
  }, [])

  const navigateTo = useCallback((nextView: View, replace = false) => {
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

  useEffect(() => {
    const onPopState = () => {
      const nextView = viewFromHash(window.location.hash)
      setView(nextView)
      if (nextView === 'welcome') {
        setAnswer('')
        setRevealed(false)
      } else if (nextView === 'review') {
        setQueue((currentQueue) => {
          if (currentQueue.length > 0) return currentQueue
          const now = services.clock.now()
          return cards
            .filter((card) => isDue(card, now))
            .sort((left, right) => left.schedule.dueAt - right.schedule.dueAt)
            .map(({ id }) => id)
        })
        setSessionTotal((currentTotal) => {
          if (currentTotal > 0) return currentTotal
          const now = services.clock.now()
          return cards.filter((card) => isDue(card, now)).length
        })
      }
    }
    window.addEventListener('popstate', onPopState)
    window.addEventListener('hashchange', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('hashchange', onPopState)
    }
  }, [cards, services.clock])

  const playAudio = useCallback(
    (text: string, locale: string) => {
      const played = services.speaker.speak(text, locale)
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
        playAudio('aguacate', 'es-MX')
      } else {
        playAudio('avocado', 'en-US')
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

  useEffect(() => {
    return () => {
      if (sampleTimerRef.current !== null) {
        window.clearTimeout(sampleTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    services.cards.save(cards)
  }, [cards, services.cards])

  useEffect(() => {
    if (view !== 'review' || !currentCard) return
    responseInput.current?.focus()
    services.speaker.speak(currentCard.prompt, localeForPrompt(currentCard))
  }, [currentCard, services.speaker, view])

  const grade = useCallback(
    (gradeValue: Grade) => {
      if (!currentCard) return
      services.sounds.play(gradeValue)
      const reviewed = scheduleReview(
        currentCard,
        gradeValue,
        services.clock.now(),
      )
      setCards((current) =>
        current.map((card) => (card.id === reviewed.id ? reviewed : card)),
      )
      const requeue = shouldRequeueInSession(reviewed.schedule)
      const nextQueue = requeue
        ? [...queue.slice(1), currentCard.id]
        : queue.slice(1)

      setQueue(nextQueue)
      setReviewedCount((count) => count + 1)
      setAnswer('')
      setRevealed(false)
      if (nextQueue.length === 0) {
        services.sounds.play('complete')
        navigateTo('complete')
      }
    },
    [currentCard, navigateTo, queue, services.clock, services.sounds],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (view !== 'review' || !currentCard) return

      if (
        (event.code === 'Space' || event.key === ' ') &&
        (document.activeElement !== responseInput.current ||
          event.ctrlKey ||
          event.metaKey)
      ) {
        event.preventDefault()
        if (revealed) {
          playAudio(currentCard.answer, localeForAnswer(currentCard))
        } else {
          playAudio(currentCard.prompt, localeForPrompt(currentCard))
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
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [currentCard, grade, playAudio, revealed, view])

  function goHome() {
    setReferenceTime(services.clock.now())
    navigateTo('welcome')
    setQueue([])
    setAnswer('')
    setRevealed(false)
  }

  function beginReview(cardIds?: string[]) {
    const now = services.clock.now()
    const nextQueue =
      cardIds ??
      cards
        .filter((card) => isDue(card, now))
        .sort((left, right) => left.schedule.dueAt - right.schedule.dueAt)
        .map(({ id }) => id)
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
    playAudio(currentCard.answer, localeForAnswer(currentCard))
  }

  const applySuggestion = useCallback((entry: LexiconEntry) => {
    setSpanishInput(entry.spanish)
    setEnglishInput(entry.english)
    if (entry.context) {
      setContextInput(entry.context)
    }
    setSuggestions([])
    setShowSuggestions(false)
    setDidYouMean(null)
    setActiveSuggestionIndex(-1)
  }, [])

  const onSpanishChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const val = event.target.value
      setSpanishInput(val)
      if (val.trim().length >= 2) {
        const matches = services.assistant.suggest(val, 'es', 5)
        setSuggestions(matches)
        setShowSuggestions(matches.length > 0)
        if (matches.length === 0) {
          const typo = services.assistant.didYouMean(val, 'es')
          setDidYouMean(typo)
        } else {
          setDidYouMean(null)
        }
      } else {
        setSuggestions([])
        setShowSuggestions(false)
        setDidYouMean(null)
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
        const matches = services.assistant.suggest(val, 'en', 5)
        if (matches.length > 0) {
          setSuggestions(matches)
          setShowSuggestions(true)
        }
      }
    },
    [services.assistant, spanishInput],
  )

  const onSpanishKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (!showSuggestions || suggestions.length === 0) return

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
        setShowSuggestions(false)
        setActiveSuggestionIndex(-1)
      }
    },
    [activeSuggestionIndex, applySuggestion, showSuggestions, suggestions],
  )

  function createCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const field = (name: string): string => {
      const value = form.get(name)
      return typeof value === 'string' ? value : ''
    }
    const created = createCards(
      {
        spanish: field('spanish'),
        english: field('english'),
        context: field('context'),
        bidirectional: form.get('bidirectional') === 'on',
        reversePrompt: field('reversePrompt'),
        reverseAnswer: field('reverseAnswer'),
      },
      { clock: services.clock, ids: services.ids },
    )
    if (created.length === 0) return

    setCards((current) => [...created, ...current])
    setSpanishInput('')
    setEnglishInput('')
    setContextInput('')
    setSuggestions([])
    setDidYouMean(null)
    setShowSuggestions(false)
    beginReview(created.map(({ id }) => id))
  }

  if (view === 'welcome')
    return (
      <>
        <main className="app-shell welcome-page">
          <nav className="topbar" aria-label="Main navigation">
            <Brand />
            <div className="nav-actions">
              <ConnectionPill
                authUser={authUser}
                syncStatus={syncStatus}
                isOnline={isOnline}
                onClick={() => setIsSyncOpen(true)}
              />
            </div>
          </nav>
          <section className="welcome-hero">
            <div className="hero-copy">
              <h1>
                Make the words <br />
                you meet <em>stick.</em>
              </h1>
              <p className="lede">
                Create beautiful, spoken flashcards.
                <br />
                Practice them at your rhythm.
              </p>
              <div className="hero-actions">
                <button
                  className="primary-button"
                  onClick={() => navigateTo('create')}
                >
                  Create a card <span aria-hidden="true">→</span>
                </button>
                <button
                  className="secondary-button"
                  onClick={() => beginReview()}
                >
                  Practice {dueCount} due
                </button>
              </div>
            </div>
            <div className="hero-visual">
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
                    {samplePlaying && activeSampleSide === 'english'
                      ? 'Playing…'
                      : 'Tap to hear'}
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
                    {samplePlaying && activeSampleSide === 'spanish'
                      ? 'Playing…'
                      : 'Tap to hear'}
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
          </section>
        </main>
        <SyncModal
          isOpen={isSyncOpen}
          onClose={() => setIsSyncOpen(false)}
          cards={cards}
          onUpdateCards={onUpdateCards}
          auth={services.auth}
          sync={services.sync}
          clock={services.clock}
        />
      </>
    )

  if (view === 'create')
    return (
      <>
        <main className="app-shell create-page">
          <nav className="topbar" aria-label="Card creation navigation">
            <Brand onClick={goHome} />
            <div className="nav-actions">
              <button className="text-button" onClick={() => beginReview()}>
                Review {dueCount}
              </button>
              <ConnectionPill
                authUser={authUser}
                syncStatus={syncStatus}
                isOnline={isOnline}
                onClick={() => setIsSyncOpen(true)}
              />
            </div>
          </nav>
          <section className="create-layout">
            <header>
              <h1>New flashcard</h1>
            </header>
            <form className="create-form" onSubmit={createCard}>
              <div className="field-group field-group-relative">
                <label htmlFor="spanish">
                  <MexicoFlag /> Mexican Spanish
                </label>
                <textarea
                  id="spanish"
                  name="spanish"
                  role="combobox"
                  rows={2}
                  autoFocus
                  required
                  value={spanishInput}
                  onChange={onSpanishChange}
                  onKeyDown={onSpanishKeyDown}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true)
                  }}
                  placeholder="Palabra o frase en español (e.g. ahorita, qué padre)"
                  aria-autocomplete="list"
                  aria-controls="spanish-suggestions"
                  aria-expanded={showSuggestions && suggestions.length > 0}
                  aria-activedescendant={
                    activeSuggestionIndex >= 0
                      ? `suggestion-${activeSuggestionIndex}`
                      : undefined
                  }
                />
                {didYouMean && (
                  <div className="typo-suggestion" role="status">
                    <span className="typo-label">Did you mean</span>
                    <button
                      type="button"
                      className="typo-chip"
                      onClick={() => applySuggestion(didYouMean)}
                    >
                      <strong>{didYouMean.spanish}</strong>
                      <span className="typo-translation">
                        {' '}
                        ({didYouMean.english})
                      </span>
                      <span className="typo-arrow" aria-hidden="true">
                        {' '}
                        ↵
                      </span>
                    </button>
                  </div>
                )}
                {showSuggestions && suggestions.length > 0 && (
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
                          applySuggestion(item)
                        }}
                      >
                        <div className="suggestion-head">
                          <span className="suggestion-spanish">
                            {item.spanish}
                          </span>
                          {item.tag && (
                            <span className={`suggestion-tag tag-${item.tag}`}>
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
                  value={englishInput}
                  onChange={onEnglishChange}
                  placeholder="English translation"
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
                    <label>
                      <UsFlag /> Reverse Prompt
                      <input
                        name="reversePrompt"
                        placeholder="Optional (defaults to English)"
                      />
                    </label>
                    <label>
                      <MexicoFlag /> Reverse Answer
                      <input
                        name="reverseAnswer"
                        placeholder="Optional (defaults to Mexican Spanish)"
                      />
                    </label>
                  </div>
                </details>
              )}
              <div className="field-group">
                <label htmlFor="context">Additional Context</label>
                <textarea
                  id="context"
                  name="context"
                  rows={2}
                  value={contextInput}
                  onChange={(e) => setContextInput(e.target.value)}
                  placeholder="Optional context, regional nuance, or memory hook"
                />
              </div>
              <button className="primary-button save-button" type="submit">
                Save card <span aria-hidden="true">→</span>
              </button>
            </form>
          </section>
        </main>
        <SyncModal
          isOpen={isSyncOpen}
          onClose={() => setIsSyncOpen(false)}
          cards={cards}
          onUpdateCards={onUpdateCards}
          auth={services.auth}
          sync={services.sync}
          clock={services.clock}
        />
      </>
    )

  if (view === 'complete' || (view === 'review' && !currentCard))
    return (
      <>
        <main className="app-shell complete-page">
          <nav className="topbar" aria-label="Session navigation">
            <Brand onClick={goHome} />
            <div className="nav-actions">
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
                onClick={() => setIsSyncOpen(true)}
              />
            </div>
          </nav>
          <section className="complete-card">
            <div className="complete-mascot-frame" aria-hidden="true">
              <img src={celebrateUrl} alt="" className="complete-mascot-img" />
            </div>
            <p className="eyebrow">SESSION COMPLETE</p>
            <h1>{reviewedCount > 0 ? '¡Hecho!' : 'You’re caught up.'}</h1>
            <p>
              {reviewedCount > 0
                ? `${reviewedCount} ${reviewedCount === 1 ? 'card' : 'cards'} practiced. Your next reviews are scheduled.`
                : 'Nothing is due right now. Add something from your day in CDMX?'}
            </p>
            <div className="complete-actions">
              <button
                className="primary-button"
                onClick={() => navigateTo('create')}
              >
                Create a card <span aria-hidden="true">→</span>
              </button>
              <button className="secondary-button" onClick={goHome}>
                Back home
              </button>
            </div>
          </section>
        </main>
        <SyncModal
          isOpen={isSyncOpen}
          onClose={() => setIsSyncOpen(false)}
          cards={cards}
          onUpdateCards={onUpdateCards}
          auth={services.auth}
          sync={services.sync}
          clock={services.clock}
        />
      </>
    )

  if (!currentCard) return null

  const total = Math.max(sessionTotal, queue.length, 1)
  const completedInSession = Math.max(0, sessionTotal - queue.length)
  const progress = total
    ? ((completedInSession + (revealed ? 0.7 : 0.2)) / total) * 100
    : 0

  return (
    <>
      <main className="app-shell review-page">
        <nav className="topbar" aria-label="Review navigation">
          <Brand onClick={goHome} />
          <div className="review-progress" aria-label="Session progress">
            <span>
              {completedInSession + 1} <i>/ {total}</i>
            </span>
            <div>
              <b style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
          </div>
          <div className="nav-actions">
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
              onClick={() => setIsSyncOpen(true)}
            />
          </div>
        </nav>
        <section className={`study-card ${revealed ? 'is-revealed' : ''}`}>
          <div className="study-prompt-wrap">
            <h1 className="study-prompt">{currentCard.prompt}</h1>
            <AudioButton
              prompt
              label="Play prompt audio"
              onClick={() =>
                playAudio(currentCard.prompt, localeForPrompt(currentCard))
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
          <p className="keyboard-hint">
            <kbd>Enter</kbd> reveal · <kbd>1–4</kbd> rate · <kbd>⌃ Space</kbd>{' '}
            replay audio
          </p>
        </section>
      </main>
      <SyncModal
        isOpen={isSyncOpen}
        onClose={() => setIsSyncOpen(false)}
        cards={cards}
        onUpdateCards={onUpdateCards}
        auth={services.auth}
        sync={services.sync}
        clock={services.clock}
      />
    </>
  )
}
