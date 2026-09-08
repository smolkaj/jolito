import { LegalContent } from '../../content/LegalContent'
import { ShieldIcon } from '../icons'
import { useDialogFocus } from '../useDialogFocus'

export interface PrivacyModalProps {
  isOpen: boolean
  onClose: () => void
  onOpenFeedback?: () => void
}

export function PrivacyModal({
  isOpen,
  onClose,
  onOpenFeedback,
}: PrivacyModalProps) {
  const dialogRef = useDialogFocus(isOpen, onClose)

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-content privacy-modal"
        ref={dialogRef}
        tabIndex={-1}
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
          <LegalContent
            onOpenFeedback={() => {
              onClose()
              onOpenFeedback?.()
            }}
          />
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
