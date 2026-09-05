import { type FormEvent, useEffect, useRef, useState } from 'react'
import type { AuthUser, FeedbackService } from '../../application/ports'
import type { View } from '../../navigation'

function FeedbackModalInner({
  onClose,
  user,
  feedbackService,
  currentView,
}: {
  onClose: () => void
  user: AuthUser | null
  feedbackService: FeedbackService
  currentView: View
}) {
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!isSuccess) {
      textareaRef.current?.focus()
    }
  }, [isSuccess])

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = message.trim()
    if (!trimmed || isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      const result = await feedbackService.submitFeedback(
        {
          message: trimmed,
          context: {
            view: currentView,
            version: '0.1.0',
            userAgent:
              typeof navigator !== 'undefined' ? navigator.userAgent : null,
            language:
              typeof navigator !== 'undefined' ? navigator.language : null,
            viewport:
              typeof window !== 'undefined'
                ? `${window.innerWidth}x${window.innerHeight}`
                : null,
            screen:
              typeof window !== 'undefined' && window.screen
                ? `${window.screen.width}x${window.screen.height}`
                : null,
            devicePixelRatio:
              typeof window !== 'undefined' ? window.devicePixelRatio : null,
            url: typeof window !== 'undefined' ? window.location.href : null,
            online: typeof navigator !== 'undefined' ? navigator.onLine : null,
          },
        },
        user,
      )

      if (result.success) {
        setIsSuccess(true)
      } else {
        setError(result.error ?? 'Failed to send feedback. Please try again.')
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Network error sending feedback.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="modal-backdrop feedback-modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="modal-content feedback-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-copy">
            <h2 id="feedback-modal-title">
              {isSuccess ? '¡Muchas gracias!' : 'Share feedback'}
            </h2>
            <p className="modal-subtitle">
              {isSuccess
                ? 'Your note has been received.'
                : user
                  ? `Sending as ${user.email}`
                  : 'Your note helps us improve Jolito.'}
            </p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close feedback dialog"
          >
            ✕
          </button>
        </div>

        {isSuccess ? (
          <div className="feedback-success-state">
            <p className="feedback-success-message">
              Thank you for helping make Jolito better! We read every note.
            </p>
            <div className="feedback-modal-actions">
              <button
                type="button"
                className="primary-button"
                onClick={onClose}
                autoFocus
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form
            className="feedback-form"
            onSubmit={(e) => {
              void handleSubmit(e)
            }}
          >
            <p className="feedback-encouragement">
              Have an idea or spotted a bug? We’d love to hear from you!
            </p>

            <div className="feedback-field-group">
              <label htmlFor="feedback-message-input" className="sr-only">
                Your feedback
              </label>
              <textarea
                ref={textareaRef}
                id="feedback-message-input"
                className="feedback-textarea"
                rows={5}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value)
                  setError(null)
                }}
                placeholder="What’s on your mind?"
              />
            </div>

            {error && (
              <div className="feedback-error-banner" role="alert">
                {error}
              </div>
            )}

            <div className="feedback-modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={!message.trim() || isSubmitting}
              >
                {isSubmitting ? 'Sending…' : 'Send feedback'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export function FeedbackModal({
  isOpen,
  onClose,
  user,
  feedbackService,
  currentView,
}: {
  isOpen: boolean
  onClose: () => void
  user: AuthUser | null
  feedbackService: FeedbackService
  currentView: View
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

  if (!isOpen) return null

  return (
    <FeedbackModalInner
      onClose={onClose}
      user={user}
      feedbackService={feedbackService}
      currentView={currentView}
    />
  )
}
