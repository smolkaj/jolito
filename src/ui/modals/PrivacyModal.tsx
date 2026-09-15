import { useEffect } from 'react'
import { ShieldIcon } from '../icons'
import { PRIVACY_SECTIONS } from '../../domain/privacy-content'

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
          {PRIVACY_SECTIONS.map((section) => (
            <section key={section.number} className="privacy-section">
              <h3>
                {section.number}. {section.title}
              </h3>
              {section.paragraphs.map((p, pIdx) => (
                <p key={pIdx}>
                  {p.map((segment, sIdx) => {
                    if (segment.type === 'text') return segment.text
                    if (segment.type === 'strong') {
                      return <strong key={sIdx}>{segment.text}</strong>
                    }
                    if (segment.type === 'link') {
                      return (
                        <a
                          key={sIdx}
                          href={segment.href}
                          target={segment.external ? '_blank' : undefined}
                          rel={
                            segment.external ? 'noopener noreferrer' : undefined
                          }
                          className="privacy-contact-link"
                        >
                          {segment.text}
                        </a>
                      )
                    }
                    return null
                  })}
                </p>
              ))}
            </section>
          ))}
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
