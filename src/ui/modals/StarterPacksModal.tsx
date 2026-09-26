import { useEffect, useMemo, useRef, useState } from 'react'
import type { HapticsPlayer } from '../../application/ports'
import { filterOutStarterCards } from '../../application/starter-cards'
import type { StudyCard } from '../../domain/card'
import { normalizeCardKey } from '../../domain/duplicate'
import {
  getStarterNoteCardsInDeck,
  getStarterPackCardsInDeck,
  starterPacks,
  type StarterPack,
} from '../../domain/starter-decks'
import { ModalSheet } from './ModalSheet'

export interface StarterPacksModalProps {
  isOpen: boolean
  onClose: () => void
  saveErrorMessage?: string | null | undefined
  cards: StudyCard[]
  onAddPack: (pack: StarterPack) => boolean | void
  onAddNote?:
    ((pack: StarterPack, noteIndex: number) => boolean | void) | undefined
  onRemovePack?: ((pack: StarterPack) => boolean | void) | undefined
  onRemoveNote?:
    ((pack: StarterPack, noteIndex: number) => boolean | void) | undefined
  haptics?: HapticsPlayer | undefined
}

function StarterPacksModalInner({
  saveErrorMessage,
  onClose,
  cards,
  onAddPack,
  onAddNote,
  onRemovePack,
  onRemoveNote,
  haptics,
}: StarterPacksModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const inspectBackBtnRef = useRef<HTMLButtonElement>(null)
  const lastInspectedPackIdRef = useRef<string | null>(null)
  const saveErrorRef = useRef<HTMLParagraphElement>(null)
  const addTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const confirmCancelBtnRef = useRef<HTMLButtonElement | null>(null)
  const lastConfirmingRemovePackIdRef = useRef<string | null>(null)

  const [inspectingPackId, setInspectingPackId] = useState<string | null>(null)
  const [addingPackId, setAddingPackId] = useState<string | null>(null)
  const [confirmingRemovePackId, setConfirmingRemovePackId] = useState<
    string | null
  >(null)

  function isElementVisible(el: HTMLElement): boolean {
    if (typeof el.checkVisibility === 'function') {
      return el.checkVisibility()
    }
    if (
      typeof window !== 'undefined' &&
      typeof window.getComputedStyle === 'function'
    ) {
      const style = window.getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden')
        return false
    }
    return true
  }

  useEffect(() => {
    return () => {
      if (addTimerRef.current) {
        clearTimeout(addTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    previousFocusRef.current = (document.activeElement as HTMLElement) || null
    if (closeBtnRef.current && isElementVisible(closeBtnRef.current)) {
      closeBtnRef.current.focus()
    } else {
      const container = modalRef.current
      if (container) {
        const firstInteractive = Array.from(
          container.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).find(isElementVisible)
        firstInteractive?.focus()
      }
    }

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
    if (confirmingRemovePackId) {
      confirmCancelBtnRef.current?.focus()
    } else if (lastConfirmingRemovePackIdRef.current) {
      const targetId = lastConfirmingRemovePackIdRef.current
      const removeBtn = modalRef.current?.querySelector<HTMLButtonElement>(
        `[data-remove-pack-id="${targetId}"]`,
      )
      removeBtn?.focus()
      lastConfirmingRemovePackIdRef.current = null
    }
  }, [confirmingRemovePackId])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmingRemovePackId !== null) {
          setConfirmingRemovePackId(null)
          return
        }
        if (inspectingPackId !== null) {
          setConfirmingRemovePackId(null)
          setInspectingPackId(null)
          return
        }
        onClose()
        return
      }

      if (e.key === 'Tab') {
        const container = modalRef.current
        if (!container) return

        const focusable = Array.from(
          container.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter(isElementVisible)
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (!first || !last) return

        if (e.shiftKey) {
          if (
            document.activeElement === first ||
            document.activeElement === saveErrorRef.current ||
            !container.contains(document.activeElement)
          ) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (
            document.activeElement === last ||
            document.activeElement === saveErrorRef.current ||
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
  }, [onClose, inspectingPackId, confirmingRemovePackId])

  const existingKeys = useMemo(() => {
    const set = new Set<string>()
    const permanentCards = filterOutStarterCards(cards)
    for (const card of permanentCards) {
      set.add(normalizeCardKey(card.prompt, card.direction))
    }
    return set
  }, [cards])

  const [saveError, setSaveError] = useState(0)
  useEffect(() => {
    if (!saveError) return
    saveErrorRef.current?.focus({ preventScroll: true })
    saveErrorRef.current?.scrollIntoView({
      block: 'center',
      behavior: 'instant',
    })
  }, [saveError])
  const handleAdd = (pack: StarterPack) => {
    const saved = onAddPack(pack)
    setSaveError((attempt) => (saved === false ? attempt + 1 : 0))
    if (saved === false) return
    setAddingPackId(pack.id)
    if (addTimerRef.current) {
      clearTimeout(addTimerRef.current)
    }
    addTimerRef.current = setTimeout(() => {
      setAddingPackId(null)
    }, 400)
  }

  const inspectingPack = useMemo(
    () => starterPacks.find((p) => p.id === inspectingPackId),
    [inspectingPackId],
  )

  const handleAddNote = (originalIndex: number) => {
    if (!inspectingPack || !onAddNote) return
    const saved = onAddNote(inspectingPack, originalIndex)
    setSaveError((attempt) => (saved === false ? attempt + 1 : 0))
  }

  const handleRemovePack = (pack: StarterPack) => {
    if (!onRemovePack) return
    haptics?.trigger('again')
    const saved = onRemovePack(pack)
    setSaveError((attempt) => (saved === false ? attempt + 1 : 0))
    setConfirmingRemovePackId(null)
  }

  const handleRemoveNote = (originalIndex: number) => {
    if (!inspectingPack || !onRemoveNote) return
    haptics?.trigger('again')
    const saved = onRemoveNote(inspectingPack, originalIndex)
    setSaveError((attempt) => (saved === false ? attempt + 1 : 0))
  }

  const inspectNotes = useMemo(() => {
    if (!inspectingPack) return []
    return inspectingPack.notes.map((note, originalIndex) => ({
      note,
      originalIndex,
    }))
  }, [inspectingPack])

  return (
    <ModalSheet
      ref={modalRef}
      onClose={onClose}
      backdropClassName="starter-packs-modal-backdrop"
      className={`starter-packs-modal ${inspectingPack ? 'is-inspecting' : ''}`.trim()}
      ariaLabelledBy="starter-packs-modal-title"
      haptics={haptics}
    >
      {saveError > 0 && (
        <p ref={saveErrorRef} role="alert" tabIndex={-1}>
          {saveErrorMessage ??
            'Your cards couldn’t be saved. Free up device storage, then try again.'}
        </p>
      )}
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
                  setConfirmingRemovePackId(null)
                  setInspectingPackId(null)
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
            const inspectDeckCards = getStarterPackCardsInDeck(
              cards,
              inspectingPack.id,
            )
            const inspectDeckCount = inspectDeckCards.length

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
                  {confirmingRemovePackId === inspectingPack.id ? (
                    <div className="starter-pack-confirm-wrap">
                      <span className="starter-pack-confirm-text">
                        Remove {inspectDeckCount}{' '}
                        {inspectDeckCount === 1 ? 'card' : 'cards'} from deck?
                      </span>
                      <button
                        ref={confirmCancelBtnRef}
                        type="button"
                        className="secondary-button starter-pack-btn is-cancel"
                        onClick={() => setConfirmingRemovePackId(null)}
                        aria-label="Cancel removing pack"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="danger-button starter-pack-btn is-confirm"
                        onClick={() => handleRemovePack(inspectingPack)}
                        aria-label={`Confirm remove ${inspectingPack.title} from deck`}
                      >
                        Confirm
                      </button>
                    </div>
                  ) : (
                    <>
                      {onRemovePack && inspectDeckCount > 0 && (
                        <button
                          type="button"
                          data-remove-pack-id={`inspect-${inspectingPack.id}`}
                          className="secondary-button starter-pack-btn is-remove"
                          onClick={() => {
                            lastConfirmingRemovePackIdRef.current = `inspect-${inspectingPack.id}`
                            setConfirmingRemovePackId(inspectingPack.id)
                          }}
                          aria-label={`Remove ${inspectingPack.title} from deck`}
                        >
                          Remove pack
                        </button>
                      )}
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
                    </>
                  )}
                </div>
              </div>
            )
          })()}

          <div
            className="starter-pack-inspect-list"
            role="list"
            tabIndex={0}
            aria-label="Cards in this pack"
          >
            {inspectNotes.map(({ note, originalIndex }) => {
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
              const noteDeckCards = getStarterNoteCardsInDeck(
                cards,
                inspectingPack.id,
                originalIndex,
              )
              const hasNoteDeckCards = noteDeckCards.length > 0

              return (
                <div
                  key={originalIndex}
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
                      <div className="inspect-item-in-deck-actions">
                        <span
                          className="inspect-badge in-deck"
                          title="Both cards are in your deck"
                        >
                          ✓ In deck
                        </span>
                        {onRemoveNote && hasNoteDeckCards && (
                          <button
                            type="button"
                            className="inspect-item-remove-btn"
                            onClick={() => handleRemoveNote(originalIndex)}
                            aria-label={`Remove ${note.spanish} from deck`}
                            title="Remove from your deck"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ) : isPartiallyInDeck ? (
                      <div className="inspect-item-in-deck-actions">
                        <button
                          type="button"
                          className="inspect-item-add-btn is-partial"
                          onClick={() => handleAddNote(originalIndex)}
                          aria-label={
                            hasEsEn
                              ? `Add reverse card for ${note.spanish}`
                              : `Add missing card for ${note.spanish}`
                          }
                          title="Add missing reciprocal card to your deck"
                        >
                          {hasEsEn ? '+ Add reverse' : '+ Add missing'}
                        </button>
                        {onRemoveNote && hasNoteDeckCards && (
                          <button
                            type="button"
                            className="inspect-item-remove-btn"
                            onClick={() => handleRemoveNote(originalIndex)}
                            aria-label={`Remove ${note.spanish} from deck`}
                            title="Remove from your deck"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="inspect-item-add-btn"
                        onClick={() => handleAddNote(originalIndex)}
                        aria-label={`Add ${note.spanish} to deck`}
                        title="Add to your deck"
                      >
                        + Add
                      </button>
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
              <p className="modal-subtitle">Pick a pack to expand your deck.</p>
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
              const packDeckCards = getStarterPackCardsInDeck(cards, pack.id)
              const deckCardCount = packDeckCards.length

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
                        setConfirmingRemovePackId(null)
                        lastInspectedPackIdRef.current = pack.id
                        setInspectingPackId(pack.id)
                      }}
                      aria-label={`Inspect ${pack.title} cards`}
                    >
                      Inspect pack
                    </button>

                    <div className="starter-pack-action-right">
                      {confirmingRemovePackId === pack.id ? (
                        <div className="starter-pack-confirm-wrap">
                          <span className="starter-pack-confirm-text">
                            Remove {deckCardCount}{' '}
                            {deckCardCount === 1 ? 'card' : 'cards'} from deck?
                          </span>
                          <button
                            ref={confirmCancelBtnRef}
                            type="button"
                            className="secondary-button starter-pack-btn is-cancel"
                            onClick={() => setConfirmingRemovePackId(null)}
                            aria-label={`Cancel removing ${pack.title}`}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="danger-button starter-pack-btn is-confirm"
                            onClick={() => handleRemovePack(pack)}
                            aria-label={`Confirm remove ${pack.title} from deck`}
                          >
                            Confirm
                          </button>
                        </div>
                      ) : (
                        <>
                          {existingCount > 0 && !isAllAdded && (
                            <span className="starter-pack-conflict-info">
                              {existingCount} of {pack.cardCount} cards in deck
                            </span>
                          )}
                          {onRemovePack && deckCardCount > 0 && (
                            <button
                              type="button"
                              data-remove-pack-id={pack.id}
                              className="secondary-button starter-pack-btn is-remove"
                              onClick={() => {
                                lastConfirmingRemovePackIdRef.current = pack.id
                                setConfirmingRemovePackId(pack.id)
                              }}
                              aria-label={`Remove ${pack.title} from deck`}
                            >
                              Remove
                            </button>
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
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </ModalSheet>
  )
}

export function StarterPacksModal(props: StarterPacksModalProps) {
  if (!props.isOpen) return null
  return <StarterPacksModalInner {...props} />
}
