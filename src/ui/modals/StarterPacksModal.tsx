import { useEffect, useMemo, useRef, useState } from 'react'
import { filterOutStarterCards } from '../../application/starter-cards'
import type { StudyCard } from '../../domain/card'
import { normalizeCardKey } from '../../domain/duplicate'
import { starterPacks, type StarterPack } from '../../domain/starter-decks'

interface StarterPacksModalProps {
  isOpen: boolean
  onClose: () => void
  cards: StudyCard[]
  onAddPack: (pack: StarterPack) => void
}

function StarterPacksModalInner({
  onClose,
  cards,
  onAddPack,
}: {
  onClose: () => void
  cards: StudyCard[]
  onAddPack: (pack: StarterPack) => void
}) {
  const modalRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousFocusRef.current = (document.activeElement as HTMLElement) || null
    closeBtnRef.current?.focus()

    return () => {
      previousFocusRef.current?.focus()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      if (e.key === 'Tab') {
        const container = modalRef.current
        if (!container) return

        const focusable = container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (!first || !last) return

        if (e.shiftKey) {
          if (
            document.activeElement === first ||
            !container.contains(document.activeElement)
          ) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (
            document.activeElement === last ||
            !container.contains(document.activeElement)
          ) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const existingKeys = useMemo(() => {
    const set = new Set<string>()
    const permanentCards = filterOutStarterCards(cards)
    for (const card of permanentCards) {
      set.add(normalizeCardKey(card.prompt, card.direction))
    }
    return set
  }, [cards])

  const [addingPackId, setAddingPackId] = useState<string | null>(null)

  const handleAdd = (pack: StarterPack) => {
    setAddingPackId(pack.id)
    onAddPack(pack)
    // Clear adding state after short moment
    setTimeout(() => {
      setAddingPackId(null)
    }, 400)
  }

  return (
    <div
      className="modal-backdrop starter-packs-modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="modal-content starter-packs-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="starter-packs-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-copy">
            <h2 id="starter-packs-modal-title">Curated starter packs</h2>
            <p className="modal-subtitle">
              Expand your deck with authentic Mexican street phrases and the 200
              most common Spanish verbs. Existing cards and review schedules are
              strictly preserved.
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <div className="starter-packs-list" role="list">
          {starterPacks.map((pack) => {
            const packCards = pack.createCards(0)
            const existingCount = packCards.filter((c) =>
              existingKeys.has(normalizeCardKey(c.prompt, c.direction)),
            ).length
            const remainingCount = packCards.length - existingCount
            const isAllAdded = remainingCount === 0

            return (
              <div
                key={pack.id}
                className={`starter-pack-card ${isAllAdded ? 'is-added' : ''}`}
                role="listitem"
              >
                <div className="starter-pack-head">
                  <div className="starter-pack-badge-row">
                    <span className="starter-pack-badge">{pack.badge}</span>
                    <span className="starter-pack-meta">
                      {pack.noteCount} words/phrases · {pack.cardCount} cards
                    </span>
                  </div>
                  <h3 className="starter-pack-title">{pack.title}</h3>
                  <p className="starter-pack-subtitle">{pack.subtitle}</p>
                </div>

                <p className="starter-pack-desc">{pack.description}</p>

                <div className="starter-pack-actions">
                  {existingCount > 0 && !isAllAdded && (
                    <span className="starter-pack-conflict-info">
                      {existingCount} already in your deck
                    </span>
                  )}
                  {isAllAdded ? (
                    <button
                      type="button"
                      className="secondary-button starter-pack-btn is-complete"
                      disabled
                      aria-label={`${pack.title} is already added to your deck`}
                    >
                      ✓ In your deck
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="primary-button starter-pack-btn"
                      disabled={addingPackId === pack.id}
                      onClick={() => handleAdd(pack)}
                      aria-label={
                        existingCount > 0
                          ? `Add remaining ${remainingCount} cards from ${pack.title}`
                          : `Add ${pack.title} (${pack.cardCount} cards)`
                      }
                    >
                      {addingPackId === pack.id
                        ? 'Adding…'
                        : existingCount > 0
                          ? `Add remaining (+${remainingCount})`
                          : `Add pack (+${pack.cardCount})`}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function StarterPacksModal(props: StarterPacksModalProps) {
  if (!props.isOpen) return null
  return <StarterPacksModalInner {...props} />
}
