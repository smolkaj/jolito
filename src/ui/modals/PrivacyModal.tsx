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
            <h3>1. The Demo vs. Your Account</h3>
            <p>
              You can try the starter demo deck without an account. To create
              cards, import decks, and save progress, you sign in with your
              email. Once signed in, Jolito works offline on your device and
              syncs changes to the cloud when connected.
            </p>
          </section>

          <section className="privacy-section">
            <h3>2. What We Collect</h3>
            <p>
              <strong>Email:</strong> Used for passwordless sign-in and to
              notify Jolito’s maintainer when you join. Never sold or used for
              marketing.
            </p>
            <p>
              <strong>Your Decks & Progress:</strong> Synced to your private
              cloud database so your cards and reviews are backed up across
              devices.
            </p>
            <p>
              <strong>Optional Feedback:</strong> If you send in-app feedback,
              we receive your message and email to follow up.
            </p>
          </section>

          <section className="privacy-section">
            <h3>3. Data Export & Account Deletion</h3>
            <p>
              You can export your complete deck to a JSON file anytime under{' '}
              <strong>Manage deck → Backup & export</strong>.
            </p>
            <p>
              To permanently delete your cloud data, tap{' '}
              <strong>Cloud sync → Delete cloud account & data</strong> in the
              app. We immediately and permanently delete your user record, cloud
              decks, feedback, and signup notification records from our servers.
              Emails already delivered to the maintainer’s inbox are not removed
              automatically.
            </p>
          </section>

          <section className="privacy-section">
            <h3>4. Open Source & Contact</h3>
            <p>
              Jolito is{' '}
              <a
                href="https://github.com/smolkaj/jolito"
                target="_blank"
                rel="noopener noreferrer"
                className="privacy-contact-link"
              >
                open-source
              </a>{' '}
              (Apache-2.0), created by{' '}
              <a
                href="https://smolka.st"
                target="_blank"
                rel="noopener noreferrer"
                className="privacy-contact-link"
              >
                Steffen Smolka
              </a>
              . You can reach me at{' '}
              <a href="mailto:a@joli.to" className="privacy-contact-link">
                a@joli.to
              </a>
              .
            </p>
            <p>
              See our{' '}
              <a
                href="/acknowledgements"
                target="_blank"
                rel="noopener noreferrer"
                className="privacy-contact-link"
              >
                acknowledgements
              </a>{' '}
              for the open-source projects and creators that power Jolito.
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
