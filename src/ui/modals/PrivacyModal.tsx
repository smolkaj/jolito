import { useEffect } from 'react'
import { ShieldIcon } from '../icons'

export interface PrivacyModalProps {
  isOpen: boolean
  onClose: () => void
}

export function PrivacyModal({ isOpen, onClose }: PrivacyModalProps) {
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
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-content privacy-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-copy">
            <div className="privacy-title-row">
              <span className="privacy-shield-badge" aria-hidden="true">
                <ShieldIcon size={18} />
              </span>
              <h2 id="privacy-modal-title">Privacy Policy</h2>
            </div>
            <p className="modal-subtitle">
              Local-first by design. Zero tracking, zero ads.
            </p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close privacy policy"
          >
            ✕
          </button>
        </div>

        <div className="privacy-modal-body">
          <section className="privacy-section">
            <h3>1. Local-first by default</h3>
            <p>
              Your flashcards, review history, learning intervals, and audio
              cache remain entirely on your device (stored safely in IndexedDB
              and Web Storage). Jolito never sends your practice activity to any
              server unless you explicitly enable optional Cloud Sync.
            </p>
          </section>

          <section className="privacy-section">
            <h3>2. Optional Cloud Sync</h3>
            <p>
              If you choose to sync flashcards across devices, you provide an
              email address to receive a secure passwordless sign-in link. Your
              deck is synchronized to a private PostgreSQL database protected by
              Row Level Security (RLS) policies. Only your authenticated user ID
              can access or modify your cloud deck.
            </p>
          </section>

          <section className="privacy-section">
            <h3>3. Complete Data & Account Deletion</h3>
            <p>
              In accordance with Apple App Store Review Guideline 5.1.1(v) and
              privacy regulations, you can permanently delete your cloud account
              and all backed-up deck data at any time directly within the app
              from the Cloud Sync menu.
            </p>
          </section>

          <section className="privacy-section">
            <h3>4. Speech & Pronunciation Audio</h3>
            <p>
              Mexican Spanish audio pronunciations use on-device speech
              synthesis or edge text-to-speech. Jolito does not record your
              microphone, analyze your voice, or store any biometric data.
            </p>
          </section>

          <section className="privacy-section">
            <h3>5. Zero Third-Party Tracking</h3>
            <p>
              Jolito contains no third-party tracking scripts, no commercial
              analytics SDKs, no advertising identifiers (IDFA), and no data
              brokers. We never sell, rent, or monetize personal data.
            </p>
          </section>

          <section className="privacy-section">
            <h3>6. Open Source & Contact</h3>
            <p>
              Jolito is open-source under the Apache-2.0 license. For questions
              or privacy requests, contact Steffen Smolka at{' '}
              <a
                href="mailto:steffen.smolka@gmail.com"
                className="privacy-contact-link"
              >
                steffen.smolka@gmail.com
              </a>{' '}
              or submit feedback directly within the app.
            </p>
          </section>
        </div>

        <div className="privacy-modal-footer">
          <button
            type="button"
            className="primary-button privacy-done-btn"
            onClick={onClose}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
