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
  const inspectBackBtnRef = useRef<HTMLButtonElement>(null)
  const lastInspectedPackIdRef = useRef<string | null>(null)

  const [inspectingPackId, setInspectingPackId] = useState<string | null>(null)
  const [inspectSearch, setInspectSearch] = useState('')
  const [addingPackId, setAddingPackId] = useState<string | null>(null)

  useEffect(() => {
    previousFocusRef.current = (document.activeElement as HTMLElement) || null
    closeBtnRef.current?.focus()

    return () => {
      previousFocusRef.current?.focus()
    }
  }, [])

  useEffect(() => {
    if (inspectingPackId) {
      inspectBackBtnRef.current?.focus()
    } else if (lastInspectedPackIdRef.current) {
      const packCard = modalRef.current?.querySelector(
        `[data-pack-id="${lastInspectedPackIdRef.current}"]`,
      )
      const inspectBtn = packCard?.querySelector<HTMLButtonElement>(
        '.starter-pack-inspect-btn',
      )
      inspectBtn?.focus()
      lastInspectedPackIdRef.current = null
    }
  }, [inspectingPackId])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inspectingPackId !== null) {
          setInspectingPackId(null)
          setInspectSearch('')
          return
        }
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
  }, [onClose, inspectingPackId])

  const existingKeys = useMemo(() => {
    const set = new Set<string>()
    const permanentCards = filterOutStarterCards(cards)
    for (const card of permanentCards) {
      set.add(normalizeCardKey(card.prompt, card.direction))
    }
    return set
  }, [cards])

  const handleAdd = (pack: StarterPack) => {
    setAddingPackId(pack.id)
    onAddPack(pack)
    // Clear adding state after short moment
    setTimeout(() => {
      setAddingPackId(null)
    }, 400)
  }

  const inspectingPack = useMemo(
    () => starterPacks.find((p) => p.id === inspectingPackId),
    [inspectingPackId],
  )

  const filteredInspectNotes = useMemo(() => {
    if (!inspectingPack) return []
    const q = inspectSearch.trim().toLowerCase()
    if (!q) return inspectingPack.notes
    return inspectingPack.notes.filter(
      (n) =>
        n.spanish.toLowerCase().includes(q) ||
        n.english.toLowerCase().includes(q) ||
        n.context.toLowerCase().includes(q),
    )
  }, [inspectingPack, inspectSearch])

  return (
    <div
      className="modal-backdrop starter-packs-modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        className={`modal-content starter-packs-modal ${inspectingPack ? 'is-inspecting' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="starter-packs-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {inspectingPack ? (
          /* Inspecting specific pack drill-down */
          <>
            <div className="modal-header starter-pack-inspect-header">
              <div className="starter-pack-inspect-nav">
                <button
                  ref={inspectBackBtnRef}
                  type="button"
                  className="secondary-button starter-pack-back-btn"
                  onClick={() => {
                    setInspectingPackId(null)
                    setInspectSearch('')
                  }}
                  aria-label="Back to all starter packs"
                >
                  ← All packs
                </button>
                <div className="starter-pack-inspect-title-wrap">
                  <span
                    className={`starter-pack-theme-tag theme-${inspectingPack.themeColor}`}
                  >
                    {inspectingPack.badge}
                  </span>
                  <h2 id="starter-packs-modal-title">{inspectingPack.title}</h2>
                </div>
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

            {(() => {
              const packCards = inspectingPack.createCards(0)
              const existingCount = packCards.filter((c) =>
                existingKeys.has(normalizeCardKey(c.prompt, c.direction)),
              ).length
              const remainingCount = packCards.length - existingCount
              const isAllAdded = remainingCount === 0

              return (
                <div className="starter-pack-inspect-toolbar">
                  <div className="starter-pack-inspect-summary">
                    <p className="starter-pack-inspect-status">
                      {isAllAdded
                        ? `All ${inspectingPack.cardCount} cards are in your deck`
                        : existingCount > 0
                          ? `${existingCount} of ${inspectingPack.cardCount} cards in your deck (${remainingCount} ${remainingCount === 1 ? 'card' : 'cards'} to add)`
                          : `All ${inspectingPack.cardCount} cards are new`}
                    </p>
                  </div>
                  <div className="starter-pack-inspect-actions">
                    {isAllAdded ? (
                      <button
                        type="button"
                        className="secondary-button starter-pack-btn is-complete"
                        disabled
                        aria-label={`${inspectingPack.title} is already added to your deck`}
                      >
                        ✓ In your deck
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="primary-button starter-pack-btn"
                        disabled={addingPackId === inspectingPack.id}
                        onClick={() => handleAdd(inspectingPack)}
                        aria-label={
                          existingCount > 0
                            ? `Add remaining ${remainingCount} ${remainingCount === 1 ? 'card' : 'cards'} from ${inspectingPack.title}`
                            : `Add ${inspectingPack.title} (${inspectingPack.cardCount} cards)`
                        }
                      >
                        {addingPackId === inspectingPack.id
                          ? 'Adding…'
                          : existingCount > 0
                            ? `Add remaining (+${remainingCount})`
                            : `Add pack (+${inspectingPack.cardCount})`}
                      </button>
                    )}
                  </div>
                </div>
              )
            })()}

            <div className="starter-pack-inspect-search-wrap">
              <input
                type="search"
                className="starter-pack-inspect-search"
                placeholder={`Search ${inspectingPack.notes.length} ${inspectingPack.id === 'mexican-street-phrases' ? 'phrases' : 'verbs'} in this pack…`}
                value={inspectSearch}
                onChange={(e) => setInspectSearch(e.target.value)}
                aria-label="Search cards in this pack"
              />
            </div>

            <div
              className="starter-pack-inspect-list"
              role="list"
              tabIndex={0}
              aria-label="Cards in this pack"
            >
              {filteredInspectNotes.map((note, idx) => {
                const isBidirectional = note.bidirectional !== false
                const hasEsEn = existingKeys.has(
                  normalizeCardKey(note.spanish, 'es-en'),
                )
                const hasEnEs =
                  isBidirectional &&
                  existingKeys.has(normalizeCardKey(note.english, 'en-es'))
                const isFullyInDeck = isBidirectional
                  ? hasEsEn && hasEnEs
                  : hasEsEn
                const isPartiallyInDeck = !isFullyInDeck && (hasEsEn || hasEnEs)

                return (
                  <div
                    key={idx}
                    className={`starter-pack-inspect-item ${isFullyInDeck ? 'is-in-deck' : isPartiallyInDeck ? 'is-partial-deck' : ''}`}
                    role="listitem"
                  >
                    <div className="inspect-item-content">
                      <div className="inspect-item-words">
                        <strong className="inspect-item-spanish">
                          {note.spanish}
                        </strong>
                        <span className="inspect-item-arrow" aria-hidden="true">
                          →
                        </span>
                        <span className="inspect-item-english">
                          {note.english}
                        </span>
                      </div>
                      {note.context && (
                        <p className="inspect-item-context">{note.context}</p>
                      )}
                    </div>
                    <div className="inspect-item-badge-wrap">
                      {isFullyInDeck ? (
                        <span
                          className="inspect-badge in-deck"
                          title="Both cards are in your deck"
                        >
                          ✓ In deck
                        </span>
                      ) : isPartiallyInDeck ? (
                        <span
                          className="inspect-badge partial-deck"
                          title="1 card in your deck. Missing reciprocal card will be added."
                        >
                          1 of 2 in deck
                        </span>
                      ) : (
                        <span className="inspect-badge new-card">+ New</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          /* Main pack list view */
          <>
            <div className="modal-header">
              <div className="modal-header-copy">
                <h2 id="starter-packs-modal-title">Curated starter packs</h2>
                <p className="modal-subtitle">
                  Pick a pack to expand your deck.
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
                    data-pack-id={pack.id}
                    className={`starter-pack-card theme-${pack.themeColor} ${isAllAdded ? 'is-added' : ''}`}
                    role="listitem"
                  >
                    <div className="starter-pack-head">
                      <div className="starter-pack-header-row">
                        <div className="starter-pack-title-wrap">
                          <span
                            className={`starter-pack-theme-tag theme-${pack.themeColor}`}
                          >
                            {pack.badge}
                          </span>
                          <h3 className="starter-pack-title">{pack.title}</h3>
                        </div>
                      </div>
                      <p className="starter-pack-desc">{pack.description}</p>
                    </div>

                    <div className="starter-pack-actions">
                      <button
                        type="button"
                        className="secondary-button starter-pack-inspect-btn"
                        onClick={() => {
                          lastInspectedPackIdRef.current = pack.id
                          setInspectingPackId(pack.id)
                          setInspectSearch('')
                        }}
                        aria-label={`Inspect ${pack.title} cards`}
                      >
                        Inspect pack
                      </button>

                      <div className="starter-pack-action-right">
                        {existingCount > 0 && !isAllAdded && (
                          <span className="starter-pack-conflict-info">
                            {existingCount} of {pack.cardCount} cards in deck
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
                                ? `Add remaining ${remainingCount} ${remainingCount === 1 ? 'card' : 'cards'} from ${pack.title}`
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
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function StarterPacksModal(props: StarterPacksModalProps) {
  if (!props.isOpen) return null
  return <StarterPacksModalInner {...props} />
}
