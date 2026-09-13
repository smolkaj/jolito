import {
  type KeyboardEvent as ReactKeyboardEvent,
  useMemo,
  useState,
} from 'react'
import {
  type DeckFilterState,
  type DeckSortOrder,
  filterDeckCards,
  getDeckStats,
} from '../../application/deck-management'
import type { AuthUser } from '../../application/ports'
import type { StudyCard } from '../../domain/card'
import { getDuplicateGroups } from '../../domain/duplicate'
import type { StarterPack } from '../../domain/starter-decks'
import type { SyncStatus } from '../../domain/sync'
import { AppFooter } from '../AppFooter'
import { Brand } from '../Brand'
import { getCardScheduleBadge } from '../card-badge'
import { ConnectionPill } from '../ConnectionPill'
import { EnglishBadge, MexicoFlag } from '../icons'
import { DeckBackupModal } from '../modals/DeckBackupModal'
import { DemoDeckModal } from '../modals/DemoDeckModal'
import { StarterPacksModal } from '../modals/StarterPacksModal'
import { RedirectAuthNotice } from '../RedirectAuthNotice'
import { handleFocusSelect } from '../utils'

export interface DeckManagerViewProps {
  cards: StudyCard[]
  vocabularyCards: StudyCard[]
  referenceTime: number
  saveError: string | null
  deletedCardIds: string[]
  queue: string[]
  dueCount: number
  authUser: AuthUser | null
  syncStatus: SyncStatus
  isOnline: boolean
  accountNotice: string | null
  redirectAuthBanner: string | null
  onDismissAccountNotice: () => void
  onDismissRedirectBanner: () => void
  onCopySessionLink?: (() => Promise<boolean> | boolean) | undefined
  onGoHome: () => void
  onNavigateToCreate: () => void
  onPractice: () => void
  onOpenSync: () => void
  onOpenFeedback: () => void
  onOpenPrivacy: () => void
  onEditCard: (card: StudyCard) => void
  onDeleteCards: (cards: StudyCard[]) => void
  onUpdateCards: (
    newCards: StudyCard[],
    syncToCloud?: boolean,
    newDeletedCardIds?: string[],
  ) => boolean | void
  onAddStarterPack: (pack: StarterPack) => boolean | void
  onAddStarterNote: (pack: StarterPack, noteIndex: number) => boolean | void
  clock: { now(): number }
}

export function DeckManagerView({
  cards,
  vocabularyCards,
  referenceTime,
  saveError,
  deletedCardIds,
  queue,
  dueCount,
  authUser,
  syncStatus,
  isOnline,
  accountNotice,
  redirectAuthBanner,
  onDismissAccountNotice,
  onDismissRedirectBanner,
  onCopySessionLink,
  onGoHome,
  onNavigateToCreate,
  onPractice,
  onOpenSync,
  onOpenFeedback,
  onOpenPrivacy,
  onEditCard,
  onDeleteCards,
  onUpdateCards,
  onAddStarterPack,
  onAddStarterNote,
  clock,
}: DeckManagerViewProps) {
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [deckSearchQuery, setDeckSearchQuery] = useState('')
  const [deckFilterState, setDeckFilterState] = useState<DeckFilterState>('all')
  const [deckSortOrder, setDeckSortOrder] =
    useState<DeckSortOrder>('created-desc')
  const [isStarterPacksOpen, setIsStarterPacksOpen] = useState(false)
  const [isBackupOpen, setIsBackupOpen] = useState(false)
  const [isDemoDeckDismissed, setIsDemoDeckDismissed] = useState(false)

  const activeSelectedCardIds = useMemo(() => {
    if (selectedCardIds.size === 0) return selectedCardIds
    const existingIds = new Set(vocabularyCards.map((c) => c.id))
    let changed = false
    const next = new Set<string>()
    for (const id of selectedCardIds) {
      if (existingIds.has(id)) {
        next.add(id)
      } else {
        changed = true
      }
    }
    return changed ? next : selectedCardIds
  }, [selectedCardIds, vocabularyCards])

  const duplicateCardIds = useMemo(
    () =>
      new Set(
        Array.from(getDuplicateGroups(vocabularyCards).values()).flatMap(
          (group) => group.map((c) => c.id),
        ),
      ),
    [vocabularyCards],
  )

  const deckStats = useMemo(
    () => getDeckStats(vocabularyCards, referenceTime),
    [vocabularyCards, referenceTime],
  )

  const filteredDeckCards = useMemo(
    () =>
      filterDeckCards(vocabularyCards, {
        query: deckSearchQuery,
        stateFilter: deckFilterState,
        sortOrder: deckSortOrder,
        now: referenceTime,
      }),
    [
      vocabularyCards,
      deckFilterState,
      deckSearchQuery,
      deckSortOrder,
      referenceTime,
    ],
  )

  const isAllSelected =
    filteredDeckCards.length > 0 &&
    filteredDeckCards.every((c) => activeSelectedCardIds.has(c.id))
  const isSomeSelected = filteredDeckCards.some((c) =>
    activeSelectedCardIds.has(c.id),
  )

  const handleRowKeyDown = (
    e: ReactKeyboardEvent<HTMLElement>,
    card: StudyCard,
  ) => {
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault()
      e.stopPropagation()
      setSelectedCardIds((prev) => {
        const next = new Set(prev)
        if (next.has(card.id)) next.delete(card.id)
        else next.add(card.id)
        return next
      })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      onEditCard(card)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const nextRow = e.currentTarget.nextElementSibling as HTMLElement | null
      if (nextRow && typeof nextRow.focus === 'function') nextRow.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prevRow = e.currentTarget
        .previousElementSibling as HTMLElement | null
      if (prevRow && typeof prevRow.focus === 'function') prevRow.focus()
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      if (
        activeSelectedCardIds.has(card.id) &&
        activeSelectedCardIds.size > 1
      ) {
        onDeleteCards(cards.filter((c) => activeSelectedCardIds.has(c.id)))
      } else {
        onDeleteCards([card])
      }
    }
  }

  return (
    <>
      <main className="app-shell deck-page">
        <nav className="topbar" aria-label="Deck navigation">
          <Brand onClick={onGoHome} />
          <div className="nav-actions" data-nosnippet>
            {vocabularyCards.length > 0 && (
              <button className="text-button" onClick={onNavigateToCreate}>
                + New card
              </button>
            )}
            {(queue.length > 0 || dueCount > 0) && (
              <button className="text-button" onClick={onPractice}>
                Practice
              </button>
            )}
            <ConnectionPill
              authUser={authUser}
              syncStatus={syncStatus}
              isOnline={isOnline}
              onClick={onOpenSync}
            />
          </div>
        </nav>
        {saveError && (
          <p className="storage-save-error" role="alert">
            {saveError}
          </p>
        )}
        <RedirectAuthNotice
          message={accountNotice ?? redirectAuthBanner}
          onDismiss={() => {
            onDismissAccountNotice()
            onDismissRedirectBanner()
          }}
          onCopySessionLink={onCopySessionLink}
        />
        <section className="deck-layout">
          <header className="deck-header-row">
            <h1>Manage deck</h1>
            <div className="deck-header-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIsStarterPacksOpen(true)}
              >
                Starter packs
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIsBackupOpen(true)}
              >
                Backup & Import
              </button>
            </div>
          </header>

          <div className="deck-toolbar">
            <div className="deck-search-wrap">
              <span className="deck-search-icon" aria-hidden="true">
                🔍
              </span>
              <input
                type="search"
                className="deck-search-input"
                placeholder="Search cards by Spanish, English, or notes…"
                value={deckSearchQuery}
                onChange={(e) => setDeckSearchQuery(e.target.value)}
                onFocus={handleFocusSelect}
                aria-label="Search cards in deck"
                autoCapitalize="none"
              />
            </div>

            <div className="deck-toolbar-controls">
              <div
                className="deck-filter-pills"
                role="radiogroup"
                aria-label="Filter cards by state"
              >
                <button
                  type="button"
                  className={`deck-filter-pill ${deckFilterState === 'all' ? 'is-active' : ''}`}
                  onClick={() => setDeckFilterState('all')}
                  aria-pressed={deckFilterState === 'all'}
                  title="All cards in your deck"
                >
                  All ({deckStats.total})
                </button>
                <button
                  type="button"
                  className={`deck-filter-pill ${deckFilterState === 'due' ? 'is-active' : ''}`}
                  onClick={() => setDeckFilterState('due')}
                  aria-pressed={deckFilterState === 'due'}
                  title="Cards ready to practice right now (unstudied cards + due reviews)"
                >
                  Due now ({deckStats.due})
                </button>
                <button
                  type="button"
                  className={`deck-filter-pill ${deckFilterState === 'new' ? 'is-active' : ''}`}
                  onClick={() => setDeckFilterState('new')}
                  aria-pressed={deckFilterState === 'new'}
                  title="Cards you haven't practiced yet"
                >
                  Unstudied ({deckStats.newCount})
                </button>
                <button
                  type="button"
                  className={`deck-filter-pill ${deckFilterState === 'learning' ? 'is-active' : ''}`}
                  onClick={() => setDeckFilterState('learning')}
                  aria-pressed={deckFilterState === 'learning'}
                  title="Cards you are currently acquiring in short repetition steps"
                >
                  Learning ({deckStats.learningCount})
                </button>
                <button
                  type="button"
                  className={`deck-filter-pill ${deckFilterState === 'review' ? 'is-active' : ''}`}
                  onClick={() => setDeckFilterState('review')}
                  aria-pressed={deckFilterState === 'review'}
                  title="Graduated cards scheduled for long-term memory retention (1+ days)"
                >
                  Mastered ({deckStats.reviewCount})
                </button>
                {((deckStats.duplicatesCount ?? 0) > 0 ||
                  deckFilterState === 'duplicates') && (
                  <button
                    type="button"
                    className={`deck-filter-pill ${deckFilterState === 'duplicates' ? 'is-active' : ''}`}
                    onClick={() => setDeckFilterState('duplicates')}
                    aria-pressed={deckFilterState === 'duplicates'}
                    title="Cards sharing the same prompt in the same direction"
                  >
                    Duplicates ({deckStats.duplicatesCount ?? 0})
                  </button>
                )}
              </div>

              {activeSelectedCardIds.size > 0 ? (
                <div
                  className="deck-batch-actions"
                  aria-label="Batch card actions"
                >
                  <button
                    type="button"
                    className="danger-button batch-delete-btn"
                    onClick={() =>
                      onDeleteCards(
                        cards.filter((c) => activeSelectedCardIds.has(c.id)),
                      )
                    }
                  >
                    🗑️ Delete selected ({activeSelectedCardIds.size})
                  </button>
                  <button
                    type="button"
                    className="secondary-button deck-clear-selection-btn"
                    onClick={() => setSelectedCardIds(new Set())}
                  >
                    Clear selection
                  </button>
                </div>
              ) : (
                vocabularyCards.length > 0 && (
                  <div className="deck-sort-wrap">
                    <label htmlFor="pill-select" className="deck-sort-label">
                      Sort
                    </label>
                    <select
                      id="pill-select"
                      className="pill-select"
                      value={deckSortOrder}
                      onChange={(e) =>
                        setDeckSortOrder(e.target.value as DeckSortOrder)
                      }
                      aria-label="Sort cards"
                    >
                      <option value="created-desc">Newest first</option>
                      <option value="created-asc">Oldest first</option>
                      <option value="alpha-asc">Alphabetical (A–Z)</option>
                      <option value="alpha-desc">Alphabetical (Z–A)</option>
                    </select>
                  </div>
                )
              )}
            </div>
          </div>

          {filteredDeckCards.length === 0 ? (
            <div className="deck-empty-state">
              <h3>No cards found</h3>
              <p>
                {deckSearchQuery.trim()
                  ? `No cards match “${deckSearchQuery.trim()}”. Try a different search term or clear the filter.`
                  : vocabularyCards.length === 0
                    ? 'Your deck is currently empty. Create a card or import an Anki deck to start practicing.'
                    : `No cards in the “${{ all: 'all', due: 'due now', new: 'unstudied', learning: 'learning', review: 'mastered', duplicates: 'duplicates' }[deckFilterState]}” category right now.`}
              </p>
              {vocabularyCards.length === 0 ? (
                <div className="deck-empty-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setIsStarterPacksOpen(true)}
                  >
                    Explore starter packs →
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={onNavigateToCreate}
                  >
                    Create a card
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setIsBackupOpen(true)}
                  >
                    Import Anki / Backup
                  </button>
                </div>
              ) : deckSearchQuery.trim() ||
                deckFilterState !== 'all' ||
                deckSortOrder !== 'created-desc' ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setDeckSearchQuery('')
                    setDeckFilterState('all')
                    setDeckSortOrder('created-desc')
                  }}
                >
                  Clear search & filters
                </button>
              ) : null}
            </div>
          ) : (
            <div
              className="deck-cards-list is-compact"
              role="table"
              aria-label="Deck cards"
            >
              <div className="deck-list-table-header" role="row">
                <div className="col-select" role="columnheader">
                  <input
                    type="checkbox"
                    className="deck-select-checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el)
                        el.indeterminate = isSomeSelected && !isAllSelected
                    }}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCardIds(
                          new Set(filteredDeckCards.map((c) => c.id)),
                        )
                      } else {
                        setSelectedCardIds(new Set())
                      }
                    }}
                    aria-label={
                      isAllSelected ? 'Deselect all cards' : 'Select all cards'
                    }
                  />
                </div>
                <div className="col-dir" role="columnheader">
                  Direction
                </div>
                <div
                  className="col-phrase col-prompt"
                  role="columnheader"
                  aria-sort={
                    deckSortOrder === 'alpha-asc'
                      ? 'ascending'
                      : deckSortOrder === 'alpha-desc'
                        ? 'descending'
                        : 'none'
                  }
                >
                  <button
                    type="button"
                    className="deck-sort-header-btn"
                    onClick={() => {
                      setDeckSortOrder((current) => {
                        if (current === 'alpha-asc') return 'alpha-desc'
                        if (current === 'alpha-desc') return 'created-desc'
                        return 'alpha-asc'
                      })
                    }}
                    aria-label="Sort by prompt"
                  >
                    <span>Prompt</span>
                    {deckSortOrder === 'alpha-asc' && (
                      <span className="deck-sort-icon" aria-hidden="true">
                        ↑
                      </span>
                    )}
                    {deckSortOrder === 'alpha-desc' && (
                      <span className="deck-sort-icon" aria-hidden="true">
                        ↓
                      </span>
                    )}
                  </button>
                </div>
                <div className="col-phrase col-answer" role="columnheader">
                  Answer
                </div>
                <div className="col-status" role="columnheader">
                  Status
                </div>
              </div>

              {filteredDeckCards.map((card) => {
                const scheduleBadge = getCardScheduleBadge(card, referenceTime)
                const isEsToEn = card.direction === 'es-en'

                return (
                  <div
                    key={card.id}
                    className={`deck-card-row ${activeSelectedCardIds.has(card.id) ? 'is-selected' : ''}`}
                    role="row"
                    tabIndex={0}
                    aria-selected={activeSelectedCardIds.has(card.id)}
                    aria-label={`Card: ${card.prompt}, answer: ${card.answer}. Click or press Enter to edit, Space to select.`}
                    title="Click or press Enter to edit card"
                    onClick={() => onEditCard(card)}
                    onKeyDown={(e) => handleRowKeyDown(e, card)}
                  >
                    <div
                      className="col-select"
                      role="cell"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="deck-select-checkbox"
                        checked={activeSelectedCardIds.has(card.id)}
                        onChange={(e) => {
                          e.stopPropagation()
                          setSelectedCardIds((prev) => {
                            const next = new Set(prev)
                            if (next.has(card.id)) next.delete(card.id)
                            else next.add(card.id)
                            return next
                          })
                        }}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select card ${card.prompt}`}
                      />
                    </div>
                    <div className="col-dir" role="cell">
                      <span
                        className="deck-direction-badge"
                        title={
                          isEsToEn
                            ? 'Mexican Spanish Prompt → English Answer'
                            : 'English Prompt → Mexican Spanish Answer'
                        }
                      >
                        {isEsToEn ? <MexicoFlag /> : <EnglishBadge />}
                        <span>{isEsToEn ? 'ES → EN' : 'EN → ES'}</span>
                      </span>
                    </div>
                    <div className="col-phrase col-prompt" role="cell">
                      <span className="deck-phrase-text">{card.prompt}</span>
                      {duplicateCardIds.has(card.id) && (
                        <span
                          className="deck-card-duplicate-pill"
                          title="Duplicate prompt in deck"
                          aria-label="Duplicate card"
                        >
                          Duplicate
                        </span>
                      )}
                    </div>
                    <div className="col-phrase col-answer" role="cell">
                      <span className="deck-answer-text">{card.answer}</span>
                    </div>

                    <div className="col-status" role="cell">
                      <span
                        className={`deck-stat-chip is-${scheduleBadge.type} is-mini`}
                      >
                        {scheduleBadge.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
        <AppFooter
          onOpenFeedback={onOpenFeedback}
          onOpenPrivacy={onOpenPrivacy}
        />
      </main>
      <StarterPacksModal
        saveErrorMessage={saveError}
        isOpen={isStarterPacksOpen}
        onClose={() => setIsStarterPacksOpen(false)}
        cards={cards}
        onAddPack={onAddStarterPack}
        onAddNote={onAddStarterNote}
      />

      <DeckBackupModal
        saveError={saveError}
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
        cards={cards}
        deletedCardIds={deletedCardIds}
        onUpdateCards={onUpdateCards}
        clock={clock}
      />

      <DemoDeckModal
        isOpen={!authUser && !isDemoDeckDismissed}
        onClose={() => setIsDemoDeckDismissed(true)}
        onSignIn={onOpenSync}
      />
    </>
  )
}
