import {
  type ChangeEvent,
  type FocusEvent,
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
import type {
  AppServices,
  AuthService,
  AuthUser,
  SyncService,
} from './application/ports'
import {
  filterOutStarterCards,
  starterCards,
} from './application/starter-cards'
import { compareAnswer, type DiffSegment } from './domain/answer'
import {
  grades,
  intervalLabel,
  isDue,
  scheduleReview,
  shouldRequeueInSession,
  updateStudyCard,
  deleteStudyCard,
  type Grade,
  type StudyCard,
  type UpdateCardParams,
} from './domain/card'
import {
  filterDeckCards,
  getDeckStats,
  type DeckFilterState,
} from './application/deck-management'
import type { AutocompleteSuggestion, LexiconEntry } from './domain/lexicon'
import { parseAnkiDeck } from './domain/anki-import'
import type { SyncStatus } from './domain/sync'
import { downloadJsonFile } from './infrastructure/browser/download'
import { createBrowserServices } from './infrastructure/browser/services'
import { checkOrRequestStoragePersistence } from './infrastructure/browser/storage-persistence'
import {
  type View,
  hashForView,
  titleForView,
  viewFromHash,
} from './navigation'

function handleFocusSelect(
  event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
) {
  const target = event.currentTarget
  target.select()
  setTimeout(() => {
    target.select()
  }, 0)
}

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

export function JolitoMark({
  className = '',
  size = 34,
  ariaHidden = true,
}: {
  className?: string
  size?: number
  ariaHidden?: boolean
}) {
  return (
    <svg
      className={`jolito-mark ${className}`.trim()}
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden={ariaHidden}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g className="jolito-gills jolito-gills-left">
        <rect
          className="jolito-gill gill-tl"
          x="3"
          y="6.5"
          width="11"
          height="4.5"
          rx="2.25"
        />
        <rect
          className="jolito-gill gill-ml"
          x="1"
          y="13.75"
          width="12"
          height="4.5"
          rx="2.25"
        />
        <rect
          className="jolito-gill gill-bl"
          x="3"
          y="21"
          width="11"
          height="4.5"
          rx="2.25"
        />
      </g>
      <g className="jolito-gills jolito-gills-right">
        <rect
          className="jolito-gill gill-tr"
          x="18"
          y="6.5"
          width="11"
          height="4.5"
          rx="2.25"
        />
        <rect
          className="jolito-gill gill-mr"
          x="19"
          y="13.75"
          width="12"
          height="4.5"
          rx="2.25"
        />
        <rect
          className="jolito-gill gill-br"
          x="18"
          y="21"
          width="11"
          height="4.5"
          rx="2.25"
        />
      </g>
      <g className="jolito-core">
        <circle className="jolito-core-outer" cx="16" cy="16" r="6" />
        <circle className="jolito-core-mid" cx="16" cy="16" r="4.2" />
        <circle className="jolito-core-inner" cx="16" cy="16" r="2.2" />
      </g>
    </svg>
  )
}

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
interface PendingCardParams {
  spanish: string
  english: string
  context: string
  bidirectional: boolean
  reversePrompt: string
  reverseAnswer: string
}

function SaveCardAuthModal({
  isOpen,
  onClose,
  auth,
  onSaveLocally,
}: {
  isOpen: boolean
  onClose: () => void
  auth: AuthService
  onSaveLocally?: () => void
}) {
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [isOtpSent, setIsOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
  } | null>(null)

  const isBackendConfigured = auth.isConfigured ? auth.isConfigured() : true

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

  const handleSendLink = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setStatusMsg(null)
    const res = await auth.sendMagicLink(email.trim())
    setLoading(false)
    if (res.success) {
      setIsOtpSent(true)
      setStatusMsg(null)
    } else {
      setStatusMsg({
        type: 'error',
        message: res.error || 'Failed to send sign-in link.',
      })
    }
  }

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault()
    if (!token.trim()) return
    setLoading(true)
    setStatusMsg(null)
    const res = await auth.verifyOtp(email.trim(), token.trim())
    setLoading(false)
    if (res.success) {
      setStatusMsg({
        type: 'success',
        message: 'Signed in! Saving card…',
      })
    } else {
      setStatusMsg({
        type: 'error',
        message: res.error || 'Invalid verification code.',
      })
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-content save-card-auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-card-auth-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="modal-close save-card-close-btn"
          onClick={onClose}
          aria-label="Close dialog"
        >
          ✕
        </button>

        <div className="save-card-hero-header">
          <h2 id="save-card-auth-title">Save your flashcard</h2>
          <p className="save-card-subtitle">
            Free cloud sync across all your devices.
          </p>
        </div>

        {statusMsg && (
          <div
            className={`status-banner status-${statusMsg.type}`}
            role={statusMsg.type === 'error' ? 'alert' : 'status'}
          >
            <p>{statusMsg.message}</p>
          </div>
        )}

        {!isBackendConfigured ? (
          <div className="save-card-action-container">
            {onSaveLocally && (
              <button
                type="button"
                className="primary-button save-card-main-cta"
                onClick={onSaveLocally}
              >
                Save card to this device →
              </button>
            )}
            <p className="save-card-micro-hint">
              Cloud sync disabled in preview · Saved safely in this browser
            </p>
          </div>
        ) : !isOtpSent ? (
          <form
            onSubmit={(e) => {
              void handleSendLink(e)
            }}
            className="save-card-auth-form"
          >
            <div className="save-card-field">
              <label htmlFor="save-card-email" className="visually-hidden">
                Email address
              </label>
              <input
                id="save-card-email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                autoComplete="email"
                className="save-card-email-input"
              />
            </div>
            <button
              type="submit"
              className="primary-button save-card-main-cta"
              disabled={loading || !email.trim()}
            >
              {loading ? 'Sending link…' : 'Continue with email →'}
            </button>
            <p className="save-card-micro-hint">
              100% free · No password needed
            </p>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              void handleVerifyOtp(e)
            }}
            className="save-card-auth-form"
          >
            <p className="save-card-otp-notice">
              Enter the 6-digit code sent to <strong>{email.trim()}</strong>
            </p>
            <div className="save-card-field">
              <label htmlFor="save-card-otp" className="visually-hidden">
                Verification code
              </label>
              <input
                id="save-card-otp"
                type="text"
                required
                autoFocus
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="123456"
                autoComplete="one-time-code"
                className="save-card-otp-input"
              />
            </div>
            <button
              type="submit"
              className="primary-button save-card-main-cta"
              disabled={loading || !token.trim()}
            >
              {loading ? 'Saving…' : 'Verify & save card ✓'}
            </button>
            <button
              type="button"
              className="text-button change-email-btn"
              onClick={() => {
                setIsOtpSent(false)
                setToken('')
                setStatusMsg(null)
              }}
            >
              ← Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  )
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
    return { label: 'New', type: 'new' }
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

function EditCardModalInner({
  card,
  onClose,
  onSave,
  onPlayAudio,
}: {
  card: StudyCard
  onClose: () => void
  onSave: (card: StudyCard, updates: UpdateCardParams) => void
  onPlayAudio: (text: string, locale: string) => void
}) {
  const [prompt, setPrompt] = useState(card.prompt)
  const [answer, setAnswer] = useState(card.answer)
  const [context, setContext] = useState(card.context ?? '')
  const [resetProgress, setResetProgress] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEsToEn = card.direction === 'es-en'
  const promptLocale = isEsToEn ? 'es-MX' : 'en-US'
  const answerLocale = isEsToEn ? 'en-US' : 'es-MX'

  const isAlreadyNew =
    card.schedule.state === 'new' && card.schedule.reviews === 0

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmedPrompt = prompt.trim()
    const trimmedAnswer = answer.trim()
    if (!trimmedPrompt) {
      setError('Prompt cannot be empty.')
      return
    }
    if (!trimmedAnswer) {
      setError('Answer cannot be empty.')
      return
    }
    setError(null)
    onSave(card, {
      prompt: trimmedPrompt,
      answer: trimmedAnswer,
      context: context.trim(),
      resetProgress: isAlreadyNew ? false : resetProgress,
    })
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-content edit-card-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-card-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-copy">
            <h2 id="edit-card-modal-title">Edit flashcard</h2>
            <p className="modal-subtitle">
              Modify prompt, answer, or memory notes.
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

        {error && (
          <div className="status-banner status-error" role="alert">
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="edit-card-form">
          <div className="field-group">
            <div className="field-label-row">
              <label htmlFor="edit-prompt">
                {isEsToEn ? <MexicoFlag /> : <UsFlag />}{' '}
                {isEsToEn ? 'Mexican Spanish (Prompt)' : 'English (Prompt)'}
              </label>
              {prompt.trim() && (
                <AudioButton
                  label="Play prompt preview"
                  onClick={() => onPlayAudio(prompt.trim(), promptLocale)}
                />
              )}
            </div>
            <textarea
              id="edit-prompt"
              rows={2}
              required
              autoFocus
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onFocus={handleFocusSelect}
              placeholder="Prompt text"
            />
          </div>

          <div className="field-group">
            <div className="field-label-row">
              <label htmlFor="edit-answer">
                {isEsToEn ? <UsFlag /> : <MexicoFlag />}{' '}
                {isEsToEn ? 'English (Answer)' : 'Mexican Spanish (Answer)'}
              </label>
              {answer.trim() && (
                <AudioButton
                  label="Play answer preview"
                  onClick={() => onPlayAudio(answer.trim(), answerLocale)}
                />
              )}
            </div>
            <textarea
              id="edit-answer"
              rows={2}
              required
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onFocus={handleFocusSelect}
              placeholder="Answer text"
            />
          </div>

          <div className="field-group">
            <label htmlFor="edit-context">Additional Context</label>
            <textarea
              id="edit-context"
              rows={2}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              onFocus={handleFocusSelect}
              placeholder="Optional context, usage notes, or nuance"
            />
          </div>

          <label
            className={`toggle-row edit-card-toggle-row ${isAlreadyNew ? 'disabled' : ''}`}
          >
            <input
              id="edit-reset-progress"
              name="resetProgress"
              type="checkbox"
              checked={resetProgress && !isAlreadyNew}
              disabled={isAlreadyNew}
              onChange={(e) => setResetProgress(e.target.checked)}
            />
            <span className="toggle" aria-hidden="true" />
            <div className="toggle-label-group">
              <span className="toggle-title">Reset learning progress</span>
              <span className="toggle-description">
                {isAlreadyNew
                  ? 'Card is already brand new (0 reviews)'
                  : 'Treat as a new card and restart review history'}
              </span>
            </div>
          </label>

          <div className="edit-modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="primary-button">
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditCardModal({
  isOpen,
  card,
  onClose,
  onSave,
  onPlayAudio,
}: {
  isOpen: boolean
  card: StudyCard | null
  onClose: () => void
  onSave: (card: StudyCard, updates: UpdateCardParams) => void
  onPlayAudio: (text: string, locale: string) => void
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

  if (!isOpen || !card) return null

  return (
    <EditCardModalInner
      key={card.id}
      card={card}
      onClose={onClose}
      onSave={onSave}
      onPlayAudio={onPlayAudio}
    />
  )
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
  onUpdateCards,
  clock,
  user,
  sync,
}: {
  onClose: () => void
  cards: StudyCard[]
  onUpdateCards: (newCards: StudyCard[]) => void
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = () => {
    const backup = createDeckBackup(cards, clock)
    downloadJsonFile(backup.filename, backup.json)
    setBackupStatus({
      type: 'success',
      message: `Deck exported: ${cards.length} cards saved to ${backup.filename}.`,
    })
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
              className="primary-button export-button"
              onClick={handleExport}
            >
              Export backup (JSON) <span aria-hidden="true">↓</span>
            </button>
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
  onUpdateCards: (newCards: StudyCard[]) => void
  clock: { now(): number }
  user: AuthUser | null
  sync: SyncService
}) {
  if (!props.isOpen) return null
  return <DeckBackupModalInner {...props} />
}

function SyncModal({
  isOpen,
  onClose,
  cards,
  onUpdateCards,
  auth,
  sync,
}: {
  isOpen: boolean
  onClose: () => void
  cards: StudyCard[]
  onUpdateCards: (newCards: StudyCard[]) => void
  auth: AuthService
  sync: SyncService
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
        message:
          'Sign-in link sent! Click the link in your email to sign in automatically, or enter your code below.',
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
    setLoading(false)
    if (res.success) {
      setSyncStatusMsg({
        type: 'success',
        message: 'Signed in! Deck synchronized with cloud.',
      })
    } else {
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
            <h2 id="sync-modal-title">Cloud sync</h2>
            <p className="modal-subtitle">
              Replicate your cards and progress across devices automatically.
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

        <div className="modal-sections-stack">
          {/* Section: Multi-Device Cloud Sync */}
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
                      Enter your email to receive a passwordless sign-in link.
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
                      {loading ? 'Sending link…' : 'Send sign-in link →'}
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
                      Click the confirmation link sent to{' '}
                      <strong>{email}</strong> to sign in automatically, or
                      enter your code:
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
      const due = initialCards
        .filter((card) => isDue(card, now))
        .sort((left, right) => left.schedule.dueAt - right.schedule.dueAt)
        .map(({ id }) => id)
      if (due.length === 0) {
        return { view: 'complete', queue: [] }
      }
      return { view: 'review', queue: due }
    }
    return { view: requested, queue: [] }
  }, [initialCards, services.clock])

  const [cards, setCards] = useState<StudyCard[]>(initialCards)
  const [view, setView] = useState<View>(initialResolved.view)

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = titleForView(view)
    }
  }, [view])

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
  const [didYouMean, setDidYouMean] = useState<LexiconEntry | null>(null)
  const [isSyncOpen, setIsSyncOpen] = useState(false)
  const [isBackupOpen, setIsBackupOpen] = useState(false)
  const [isSaveCardAuthOpen, setIsSaveCardAuthOpen] = useState(false)

  const [pendingCard, setPendingCard] = useState<PendingCardParams | null>(null)
  const [editingCard, setEditingCard] = useState<StudyCard | null>(null)
  const [deletingCards, setDeletingCards] = useState<StudyCard[] | null>(null)
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [deckSearchQuery, setDeckSearchQuery] = useState('')
  const [deckFilterState, setDeckFilterState] = useState<DeckFilterState>('all')

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
  const responseInput = useRef<HTMLInputElement>(null)
  const spanishInputRef = useRef<HTMLTextAreaElement>(null)
  const sampleTimerRef = useRef<number | null>(null)
  const createAudioTimerRef = useRef<number | null>(null)
  const savedToastTimerRef = useRef<number | null>(null)
  const currentCard = cards.find(({ id }) => id === queue[0])
  const dueCount = cards.filter((card) => isDue(card, referenceTime)).length

  const cardsRef = useRef(cards)
  const viewRef = useRef(view)
  const authUserRef = useRef(authUser)
  const pendingCardRef = useRef(pendingCard)

  useEffect(() => {
    cardsRef.current = cards
    viewRef.current = view
    authUserRef.current = authUser
    pendingCardRef.current = pendingCard
  })

  const onUpdateCards = useCallback(
    (newCards: StudyCard[], syncToCloud = true) => {
      setCards(newCards)
      services.cards.save(newCards)
      const now = services.clock.now()
      setReferenceTime(now)
      setQueue((currentQueue) => {
        if (viewRef.current !== 'review') return currentQueue
        const due = newCards
          .filter((card) => isDue(card, now))
          .sort((left, right) => left.schedule.dueAt - right.schedule.dueAt)
          .map(({ id }) => id)
        return due
      })
      if (syncToCloud && authUserRef.current) {
        setSyncStatus('syncing')
        void services.sync
          .syncDeck(newCards, authUserRef.current)
          .then((res) => {
            if (res.success) setSyncStatus('synced')
            else setSyncStatus('error')
          })
      }
    },
    [services.cards, services.clock, services.sync],
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
      onUpdateCards(updatedCards)
      setQueue((prevQueue) => {
        const nextQueue = prevQueue.filter((id) => !idsToDelete.has(id))
        const deletedCount = prevQueue.length - nextQueue.length
        if (deletedCount > 0) {
          setSessionTotal((prev) =>
            Math.max(nextQueue.length, prev - deletedCount),
          )
        }
        if (viewRef.current === 'review' && nextQueue.length === 0) {
          navigateTo('complete')
        }
        return nextQueue
      })
      setSelectedCardIds((prev) => {
        const next = new Set(prev)
        for (const id of idsToDelete) {
          next.delete(id)
        }
        return next
      })
      setDeletingCards(null)
    },
    [navigateTo, onUpdateCards],
  )

  const deckStats = useMemo(
    () => getDeckStats(cards, referenceTime),
    [cards, referenceTime],
  )

  const filteredDeckCards = useMemo(
    () =>
      filterDeckCards(cards, {
        query: deckSearchQuery,
        stateFilter: deckFilterState,
        now: referenceTime,
      }),
    [cards, deckFilterState, deckSearchQuery, referenceTime],
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
      setDidYouMean(null)
      setActiveSuggestionIndex(-1)
      setPendingCard(null)
      pendingCardRef.current = null
      spanishInputRef.current?.focus()
    },
    [onUpdateCards, services.clock, services.ids],
  )

  useEffect(() => {
    return services.auth.onAuthStateChange((user) => {
      authUserRef.current = user
      setAuthUser(user)
      if (user) {
        if (pendingCardRef.current) {
          const pending = pendingCardRef.current
          saveCardFromParams(pending)
          setIsSaveCardAuthOpen(false)
        } else {
          const userCards = filterOutStarterCards(cardsRef.current)
          void syncDeckWithCloud({
            localCards: userCards,
            user,
            syncService: services.sync,
            onCardsUpdated: (newCards) => onUpdateCards(newCards, false),
          }).then((res) => {
            if (res.success) setSyncStatus('synced')
          })
        }
      }
    })
  }, [onUpdateCards, saveCardFromParams, services.auth, services.sync])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onOnline = () => {
      setIsOnline(true)
      if (authUserRef.current) {
        setSyncStatus('syncing')
        const userCards = filterOutStarterCards(cardsRef.current)
        void services.sync
          .syncDeck(userCards, authUserRef.current)
          .then((res) => {
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
  }, [services.sync])

  useEffect(() => {
    void checkOrRequestStoragePersistence()
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
          const newQueue = cardsRef.current
            .filter((card) => isDue(card, now))
            .sort((left, right) => left.schedule.dueAt - right.schedule.dueAt)
            .map(({ id }) => id)
          setSessionTotal(newQueue.length)
          return newQueue
        })
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
      if (createAudioTimerRef.current !== null) {
        window.clearTimeout(createAudioTimerRef.current)
      }
      if (savedToastTimerRef.current !== null) {
        window.clearTimeout(savedToastTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    services.cards.save(cards)
  }, [cards, services.cards])

  const currentCardId = currentCard?.id
  const currentPrompt = currentCard?.prompt
  const currentPromptLocale = currentCard ? localeForPrompt(currentCard) : ''

  useEffect(() => {
    if (view !== 'review' || !currentCardId || !currentPrompt) return
    responseInput.current?.focus()
    services.speaker.speak(currentPrompt, currentPromptLocale)
  }, [
    currentCardId,
    currentPrompt,
    currentPromptLocale,
    services.speaker,
    view,
  ])

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
      if (
        view !== 'review' ||
        !currentCard ||
        editingCard !== null ||
        deletingCards !== null ||
        isSyncOpen
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

      if (
        (event.key === 'e' || event.key === 'E') &&
        !isInputActive &&
        !event.ctrlKey &&
        !event.metaKey
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
    playAudio,
    revealed,
    view,
  ])

  function goHome() {
    setReferenceTime(services.clock.now())
    navigateTo('welcome')
    setQueue([])
    setSessionTotal(0)
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
        setDidYouMean(
          matches.length === 0
            ? services.assistant.didYouMean(val, 'es')
            : null,
        )
      } else {
        setSuggestions([])
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
        setSuggestions(services.assistant.suggest(val, 'en', 5))
      } else if (!spanishInput.trim()) {
        setSuggestions([])
      }
    },
    [services.assistant, spanishInput],
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
        setSuggestions([])
        setActiveSuggestionIndex(-1)
      }
    },
    [activeSuggestionIndex, applySuggestion, suggestions],
  )

  const openSyncModal = useCallback(() => {
    setSuggestions([])
    setIsSyncOpen(true)
  }, [])

  const closeSyncModal = useCallback(() => {
    setIsSyncOpen(false)
  }, [])

  const closeSaveCardAuthModal = useCallback(() => {
    setIsSaveCardAuthOpen(false)
    setPendingCard(null)
    pendingCardRef.current = null
  }, [])

  const handleSavePendingLocally = useCallback(() => {
    if (pendingCardRef.current) {
      saveCardFromParams(pendingCardRef.current)
    }
    setIsSaveCardAuthOpen(false)
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
      setIsSaveCardAuthOpen(true)
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
            <div className="nav-actions">
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
          <section className="welcome-hero">
            <div className="hero-copy">
              <img
                src={logoUrl}
                alt=""
                aria-hidden="true"
                className="welcome-mascot-img"
                style={{ transform: 'scaleX(-1)' }}
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
                  Practice
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
          onClose={closeSyncModal}
          cards={cards}
          onUpdateCards={onUpdateCards}
          auth={services.auth}
          sync={services.sync}
        />
        <EditCardModal
          isOpen={editingCard !== null}
          card={editingCard}
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
      </>
    )
  }

  if (view === 'create')
    return (
      <>
        <main className="app-shell create-page">
          <nav className="topbar" aria-label="Card creation navigation">
            <Brand onClick={goHome} />
            <div className="nav-actions">
              <button
                className="text-button"
                onClick={() => navigateTo('deck')}
              >
                Manage deck
              </button>
              {dueCount > 0 && (
                <button className="text-button" onClick={() => beginReview()}>
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
                      ? `Play pronunciation: ${englishInput.trim() || 'translation'}`
                      : `Show translation${englishInput.trim() ? `: ${englishInput.trim()}` : ''}`
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
                      {createPlaying && activeCreateSide === 'english'
                        ? 'Playing…'
                        : 'Tap to hear'}
                    </span>
                  </div>
                  <div className="sample-card-body">
                    <p
                      className={`sample-phrase ${!englishInput.trim() ? 'is-placeholder' : ''}`}
                    >
                      {englishInput.trim() || 'English translation…'}
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
                      ? `Play pronunciation: ${spanishInput.trim() || 'phrase'}`
                      : `Show phrase${spanishInput.trim() ? `: ${spanishInput.trim()}` : ''}`
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
                      {createPlaying && activeCreateSide === 'spanish'
                        ? 'Playing…'
                        : 'Tap to hear'}
                    </span>
                  </div>
                  <div className="sample-card-body">
                    <p
                      className={`sample-phrase ${!spanishInput.trim() ? 'is-placeholder' : ''}`}
                    >
                      {spanishInput.trim() || 'Palabra o frase…'}
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
                  value={spanishInput}
                  onChange={onSpanishChange}
                  onKeyDown={onSpanishKeyDown}
                  onFocus={handleFocusSelect}
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
                {suggestions.length > 0 && (
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
                  onFocus={handleFocusSelect}
                  placeholder="English translation"
                />
              </div>
              <div className="field-group">
                <label htmlFor="context">Additional Context</label>
                <textarea
                  id="context"
                  name="context"
                  rows={2}
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
                aria-label="Save card"
              >
                {savedToast ? (
                  <span className="save-button-saved" aria-hidden="true">
                    <span className="save-button-check">✓</span>
                    <span className="save-button-text">
                      Saved “{savedToast}”
                    </span>
                  </span>
                ) : (
                  <span>Save card</span>
                )}
              </button>
              <div className="sr-only" role="status" aria-live="polite">
                {savedToast ? `Saved “${savedToast}”` : ''}
              </div>
            </form>
          </section>
        </main>
        <SyncModal
          isOpen={isSyncOpen}
          onClose={closeSyncModal}
          cards={cards}
          onUpdateCards={onUpdateCards}
          auth={services.auth}
          sync={services.sync}
        />
        <SaveCardAuthModal
          isOpen={isSaveCardAuthOpen}
          onClose={closeSaveCardAuthModal}
          auth={services.auth}
          onSaveLocally={handleSavePendingLocally}
        />
        <EditCardModal
          isOpen={editingCard !== null}
          card={editingCard}
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
      </>
    )

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
            <div className="nav-actions">
              {cards.length > 0 && (
                <button
                  className="text-button"
                  onClick={() => navigateTo('create')}
                >
                  + New card
                </button>
              )}
              {dueCount > 0 && (
                <button className="text-button" onClick={() => beginReview()}>
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
                  >
                    All ({deckStats.total})
                  </button>
                  <button
                    type="button"
                    className={`deck-filter-pill ${deckFilterState === 'due' ? 'is-active' : ''}`}
                    onClick={() => setDeckFilterState('due')}
                    aria-pressed={deckFilterState === 'due'}
                  >
                    Due ({deckStats.due})
                  </button>
                  <button
                    type="button"
                    className={`deck-filter-pill ${deckFilterState === 'new' ? 'is-active' : ''}`}
                    onClick={() => setDeckFilterState('new')}
                    aria-pressed={deckFilterState === 'new'}
                  >
                    New ({deckStats.newCount})
                  </button>
                  <button
                    type="button"
                    className={`deck-filter-pill ${deckFilterState === 'learning' ? 'is-active' : ''}`}
                    onClick={() => setDeckFilterState('learning')}
                    aria-pressed={deckFilterState === 'learning'}
                  >
                    Learning ({deckStats.learningCount})
                  </button>
                  <button
                    type="button"
                    className={`deck-filter-pill ${deckFilterState === 'review' ? 'is-active' : ''}`}
                    onClick={() => setDeckFilterState('review')}
                    aria-pressed={deckFilterState === 'review'}
                  >
                    Review ({deckStats.reviewCount})
                  </button>
                </div>

                {selectedCardIds.size > 0 && (
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
                      : `No cards in the “${deckFilterState}” category right now.`}
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
                ) : deckSearchQuery.trim() || deckFilterState !== 'all' ? (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setDeckSearchQuery('')
                      setDeckFilterState('all')
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
                  <div className="col-phrase col-prompt" role="columnheader">
                    Prompt
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
        </main>
        <DeckBackupModal
          isOpen={isBackupOpen}
          onClose={() => setIsBackupOpen(false)}
          cards={cards}
          onUpdateCards={onUpdateCards}
          clock={services.clock}
          user={authUser}
          sync={services.sync}
        />

        <SyncModal
          isOpen={isSyncOpen}
          onClose={closeSyncModal}
          cards={cards}
          onUpdateCards={onUpdateCards}
          auth={services.auth}
          sync={services.sync}
        />
        <EditCardModal
          isOpen={editingCard !== null}
          card={editingCard}
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
      </>
    )
  }

  if (view === 'complete' || (view === 'review' && !currentCard))
    return (
      <>
        <main className="app-shell complete-page">
          <nav className="topbar" aria-label="Session navigation">
            <Brand onClick={goHome} />
            <div className="nav-actions">
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
              <button
                className="secondary-button"
                onClick={() => navigateTo('deck')}
              >
                Manage deck
              </button>
              <button className="text-button" onClick={goHome}>
                Back home
              </button>
            </div>
          </section>
        </main>
        <SyncModal
          isOpen={isSyncOpen}
          onClose={closeSyncModal}
          cards={cards}
          onUpdateCards={onUpdateCards}
          auth={services.auth}
          sync={services.sync}
        />
        <EditCardModal
          isOpen={editingCard !== null}
          card={editingCard}
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
          <div className="nav-actions">
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
            <kbd>Enter</kbd> reveal · <kbd>1–4</kbd> rate · <kbd>e</kbd> edit ·{' '}
            <kbd>⌃ Space</kbd> replay audio
          </p>
        </section>
      </main>
      <SyncModal
        isOpen={isSyncOpen}
        onClose={closeSyncModal}
        cards={cards}
        onUpdateCards={onUpdateCards}
        auth={services.auth}
        sync={services.sync}
      />
      <EditCardModal
        isOpen={editingCard !== null}
        card={editingCard}
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
    </>
  )
}
