import { type FormEvent, useEffect, useRef, useState } from 'react'
import { syncDeckWithCloud } from '../../application/deck-sync'
import type {
  AuthService,
  AuthUser,
  SyncService,
} from '../../application/ports'
import type { StudyCard } from '../../domain/card'
import { isIOS, isStandalone } from '../../infrastructure/browser/environment'
import {
  ClipboardIcon,
  CloudCheckSticker,
  ShieldIcon,
  SyncSpinnerIcon,
} from '../icons'

export interface SyncModalProps {
  isOpen: boolean
  onClose: () => void
  cards: StudyCard[]
  deletedCardIds?: string[]
  onUpdateCards: (
    newCards: StudyCard[],
    syncToCloud?: boolean,
    newDeletedCardIds?: string[],
  ) => void
  auth: AuthService
  sync: SyncService
  onSaveLocally?: (() => void) | undefined
  pendingCardPrompt?: string | undefined
}

export function SyncModal({
  isOpen,
  onClose,
  cards,
  deletedCardIds = [],
  onUpdateCards,
  auth,
  sync,
  onSaveLocally,
  pendingCardPrompt,
}: SyncModalProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [isOtpSent, setIsOtpSent] = useState(false)
  const [showPasteLink, setShowPasteLink] = useState(
    () => isStandalone() && isIOS(),
  )
  const [transientFeedback, setTransientFeedback] = useState<
    'synced' | 'resent' | 'pasted' | null
  >(null)
  const [loadingAction, setLoadingAction] = useState<
    'send' | 'verify' | 'sync' | 'signout' | null
  >(null)
  const [statusMsg, setStatusMsg] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
  } | null>(null)

  const feedbackTimerRef = useRef<number | null>(null)
  const pasteInputRef = useRef<HTMLInputElement | null>(null)

  const loading = loadingAction !== null
  const isBackendConfigured = auth.isConfigured ? auth.isConfigured() : true
  const isSynced = transientFeedback === 'synced'
  const isLinkResent = transientFeedback === 'resent'
  const isPasted = transientFeedback === 'pasted'

  const triggerTransientFeedback = (
    feedback: 'synced' | 'resent' | 'pasted',
    durationMs = 2500,
  ) => {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current)
    }
    setTransientFeedback(feedback)
    feedbackTimerRef.current = window.setTimeout(() => {
      setTransientFeedback(null)
      feedbackTimerRef.current = null
    }, durationMs)
  }

  const clearTransientFeedback = () => {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = null
    }
    setTransientFeedback(null)
  }

  useEffect(() => {
    return () => clearTransientFeedback()
  }, [])

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

  const handleSendLink = async (isResend = false, e?: FormEvent) => {
    e?.preventDefault()
    if (!email.trim()) return
    setLoadingAction('send')
    setStatusMsg(null)
    const res = await auth.sendMagicLink(email.trim())
    setLoadingAction(null)
    if (res.success) {
      setIsOtpSent(true)
      if (isResend) {
        triggerTransientFeedback('resent', 2500)
      }
    } else {
      setStatusMsg({
        type: 'error',
        message: res.error || 'Failed to send sign-in link.',
      })
    }
  }

  const handlePasteClipboard = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      try {
        const text = await navigator.clipboard.readText()
        if (text) {
          setToken(text.trim())
          triggerTransientFeedback('pasted', 1500)
        }
      } catch {
        // clipboard access not permitted
      }
    }
  }

  const handleVerifyOtp = async (e?: FormEvent) => {
    e?.preventDefault()
    const cleanToken = token.trim()
    if (!cleanToken) return
    setLoadingAction('verify')
    setStatusMsg(null)
    const res = await auth.verifyOtp(email.trim(), cleanToken)
    setLoadingAction(null)
    if (res.success) {
      setStatusMsg({
        type: 'success',
        message: 'Signed in! Deck synchronized with cloud.',
      })
    } else {
      setStatusMsg({
        type: 'error',
        message: res.error || 'Invalid sign-in link.',
      })
    }
  }

  const handleSyncNow = async () => {
    if (!user) return
    setLoadingAction('sync')
    setStatusMsg(null)
    const res = await syncDeckWithCloud({
      localCards: cards,
      localDeletedIds: deletedCardIds,
      user,
      syncService: sync,
      onCardsUpdated: (newCards, newDeletedIds) =>
        onUpdateCards(newCards, false, newDeletedIds),
    })
    setLoadingAction(null)
    if (res.success) {
      triggerTransientFeedback('synced', 2500)
    } else {
      setStatusMsg({
        type: 'error',
        message: res.error || 'Failed to sync with cloud.',
      })
    }
  }

  const handleSignOut = async () => {
    clearTransientFeedback()
    setLoadingAction('signout')
    await auth.signOut()
    setLoadingAction(null)
    setIsOtpSent(false)
    setToken('')
    setStatusMsg(null)
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-content sync-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-copy">
            <h2 id="sync-modal-title">
              {pendingCardPrompt
                ? 'Save your card & start your deck'
                : 'Cloud sync'}
            </h2>
            <p className="modal-subtitle">
              {pendingCardPrompt
                ? `Save “${pendingCardPrompt}” to your personal deck and sync your cards across devices.`
                : 'Sync your deck across all your devices.'}
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

        {statusMsg && (
          <div
            className={`status-banner status-${statusMsg.type}`}
            role={statusMsg.type === 'error' ? 'alert' : 'status'}
          >
            <p>{statusMsg.message}</p>
          </div>
        )}

        {!isBackendConfigured && !user ? (
          <div className="sync-notice-card">
            <span className="notice-icon" aria-hidden="true">
              <ShieldIcon size={22} />
            </span>
            <h4>Cloud sync is disabled in this preview</h4>
            <p>Flashcards and progress remain safely stored on this device.</p>
            {onSaveLocally && (
              <button
                type="button"
                className="primary-button"
                onClick={onSaveLocally}
              >
                Save card to this device →
              </button>
            )}
          </div>
        ) : user ? (
          <div className="sync-account-pane">
            <div className="sync-account-hero">
              <div className="sync-cloud-sticker-wrap" aria-hidden="true">
                <CloudCheckSticker size={58} />
              </div>
              <div className="sync-account-details">
                <span className="account-badge">Signed in</span>
                <p className="account-email">{user.email}</p>
              </div>
            </div>

            <div className="sync-actions-row">
              <button
                type="button"
                className={`primary-button sync-now-button ${isSynced ? 'is-synced' : ''}`}
                onClick={() => {
                  void handleSyncNow()
                }}
                disabled={loading}
              >
                {isSynced ? (
                  <span className="sync-button-synced">
                    <span className="sync-button-check" aria-hidden="true">
                      ✓
                    </span>
                    <span className="sync-button-text">Synced!</span>
                  </span>
                ) : (
                  <>
                    <SyncSpinnerIcon
                      size={15}
                      className={loadingAction === 'sync' ? 'is-spinning' : ''}
                    />
                    <span>
                      {loadingAction === 'sync' ? 'Syncing…' : 'Sync now'}
                    </span>
                  </>
                )}
              </button>
              <button
                type="button"
                className="secondary-button sign-out-button"
                onClick={() => {
                  void handleSignOut()
                }}
                disabled={loading}
              >
                {loadingAction === 'signout' ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </div>
        ) : !isOtpSent ? (
          <form
            onSubmit={(e) => {
              void handleSendLink(false, e)
            }}
            className="sync-auth-form"
          >
            <div className="field-group">
              <label htmlFor="sync-email">Email address</label>
              <input
                id="sync-email"
                type="email"
                required
                autoFocus
                placeholder="learner@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="primary-button"
              disabled={loading || !email.trim()}
            >
              {loadingAction === 'send'
                ? 'Sending link…'
                : pendingCardPrompt
                  ? 'Save card & send link →'
                  : 'Send sign-in link →'}
            </button>
          </form>
        ) : !showPasteLink ? (
          <div className="sync-sent-pane">
            <p className="sync-explanation">
              {pendingCardPrompt ? (
                <>
                  Click the sign-in link sent to <strong>{email.trim()}</strong>
                  . Your card “{pendingCardPrompt}” will be saved to your deck
                  automatically.
                </>
              ) : (
                <>
                  Click the sign-in link sent to <strong>{email.trim()}</strong>{' '}
                  to connect your account.
                </>
              )}
            </p>
            <div className="sync-sent-actions">
              <button
                type="button"
                className={`secondary-button resend-link-button ${isLinkResent ? 'is-sent' : ''}`}
                disabled={loading}
                onClick={() => {
                  void handleSendLink(true)
                }}
              >
                {isLinkResent ? (
                  <span className="resend-button-sent">
                    <span className="resend-button-check" aria-hidden="true">
                      ✓
                    </span>
                    <span className="resend-button-text">Link sent!</span>
                  </span>
                ) : (
                  <span>
                    {loadingAction === 'send' ? 'Resending…' : 'Resend link'}
                  </span>
                )}
              </button>
              <div className="sync-sent-sub-actions">
                <button
                  type="button"
                  className="modal-link-btn"
                  onClick={() => {
                    setIsOtpSent(false)
                    setShowPasteLink(isStandalone() && isIOS())
                    setToken('')
                    setStatusMsg(null)
                  }}
                >
                  Change email
                </button>
                <span className="sync-sub-action-dot" aria-hidden="true">
                  ·
                </span>
                <button
                  type="button"
                  className="modal-link-btn"
                  onClick={() => {
                    setShowPasteLink(true)
                    setTimeout(() => pasteInputRef.current?.focus(), 0)
                  }}
                >
                  Paste link manually
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              void handleVerifyOtp(e)
            }}
            className="sync-auth-form"
          >
            {isStandalone() && isIOS() ? (
              <p className="sync-explanation">
                Open the email in Safari, tap <strong>Copy sign-in link</strong>{' '}
                on the top banner, then paste it here:
              </p>
            ) : (
              <p className="sync-explanation">
                Paste the sign-in link or 6-digit code sent to{' '}
                <strong>{email.trim()}</strong>:
              </p>
            )}
            <div className="field-group">
              <label htmlFor="sync-otp">Sign-in link or code</label>
              <div className="link-input-wrap">
                <input
                  ref={pasteInputRef}
                  id="sync-otp"
                  type="text"
                  required
                  autoFocus
                  placeholder="Paste link or code"
                  autoComplete="one-time-code"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="link-input"
                />
                {typeof navigator !== 'undefined' &&
                  typeof navigator.clipboard?.readText === 'function' && (
                    <button
                      type="button"
                      className={`paste-input-btn ${isPasted ? 'is-pasted' : ''}`}
                      onClick={() => {
                        void handlePasteClipboard()
                      }}
                      title="Paste from clipboard"
                      aria-label="Paste from clipboard"
                    >
                      {isPasted ? (
                        <>
                          <span aria-hidden="true">✓</span>
                          <span>Pasted</span>
                        </>
                      ) : (
                        <>
                          <ClipboardIcon size={12} />
                          <span>Paste</span>
                        </>
                      )}
                    </button>
                  )}
              </div>
            </div>
            <div className="sync-sent-actions">
              <button
                type="submit"
                className="primary-button"
                disabled={loading || !token.trim()}
              >
                {loadingAction === 'verify'
                  ? 'Signing in…'
                  : pendingCardPrompt
                    ? 'Sign in & save card →'
                    : 'Sign in & sync →'}
              </button>
              <div className="sync-sent-sub-actions">
                <button
                  type="button"
                  className={`modal-link-btn resend-text-button ${isLinkResent ? 'is-sent' : ''}`}
                  disabled={loading}
                  onClick={() => {
                    void handleSendLink(true)
                  }}
                >
                  {isLinkResent
                    ? 'Link sent! ✓'
                    : loadingAction === 'send'
                      ? 'Resending…'
                      : 'Resend link'}
                </button>
                <span className="sync-sub-action-dot" aria-hidden="true">
                  ·
                </span>
                <button
                  type="button"
                  className="modal-link-btn"
                  onClick={() => {
                    setIsOtpSent(false)
                    setShowPasteLink(isStandalone() && isIOS())
                    setToken('')
                    setStatusMsg(null)
                  }}
                >
                  Change email
                </button>
              </div>
            </div>
          </form>
        )}
        <div className="sr-only" role="status" aria-live="polite">
          {isSynced ? 'Deck successfully synchronized with cloud.' : ''}
          {isLinkResent ? `Sign-in link sent to ${email.trim()}.` : ''}
          {isPasted ? 'Pasted link from clipboard.' : ''}
        </div>
      </div>
    </div>
  )
}
