import { useEffect } from 'react'
import { ModalSheet } from './ModalSheet'

export interface DemoDeckModalProps {
  isOpen: boolean
  onClose: () => void
  onSignIn: () => void
}

export function DemoDeckModal({
  isOpen,
  onClose,
  onSignIn,
}: DemoDeckModalProps) {
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
    <ModalSheet
      isOpen={isOpen}
      onClose={onClose}
      backdropClassName="demo-deck-modal-backdrop"
      className="demo-deck-modal"
      ariaLabelledBy="demo-deck-modal-title"
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
    </ModalSheet>
  )
}
