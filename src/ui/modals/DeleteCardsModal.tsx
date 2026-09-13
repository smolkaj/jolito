import { useEffect, useRef, useState } from 'react'
import type { StudyCard } from '../../domain/card'

export interface DeleteCardsModalProps {
  isOpen: boolean
  cards: StudyCard[] | null
  onClose: () => void
  onConfirm: (cards: StudyCard[]) => void
  saveError: string | null
}

export function DeleteCardsModal({
  isOpen,
  cards,
  onClose,
  onConfirm,
  saveError,
}: DeleteCardsModalProps) {
  const [submitAttempt, setSubmitAttempt] = useState(0)
  const errorRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (!isOpen || !saveError) return
    errorRef.current?.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, [isOpen, saveError, submitAttempt])

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

        {saveError && (
          <p ref={errorRef} role="alert">
            {saveError}
          </p>
        )}

        <div className="delete-modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="danger-button"
            onClick={() => {
              setSubmitAttempt((attempt) => attempt + 1)
              onConfirm(cards)
            }}
          >
            {isSingle ? 'Delete card' : `Delete ${cards.length} cards`}
          </button>
        </div>
      </div>
    </div>
  )
}
