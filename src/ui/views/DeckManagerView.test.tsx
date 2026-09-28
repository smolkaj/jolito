import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { StudyCard } from '../../domain/card'
import { findStarterPack } from '../../domain/starter-decks'
import { DeckManagerView, type DeckManagerViewProps } from './DeckManagerView'

function createSampleCard(overrides: Partial<StudyCard> = {}): StudyCard {
  return {
    id: `card-${Math.random().toString(36).slice(2, 8)}`,
    noteId: `note-${Math.random().toString(36).slice(2, 8)}`,
    prompt: '¡Qué padre!',
    answer: 'How cool!',
    context: 'Exclamation of approval',
    direction: 'es-en',
    scene: 'conversation',
    schedule: {
      state: 'new',
      dueAt: 1000,
      intervalDays: 0,
      easeFactor: 2.5,
      reviews: 0,
      lapses: 0,
    },
    createdAt: 1000,
    contentRevision: 1,
    resetRevision: { generation: 0, at: 1000 },
    ...overrides,
  }
}

function renderDeckManager(overrides: Partial<DeckManagerViewProps> = {}) {
  const sampleCards = [
    createSampleCard({
      id: 'card-1',
      prompt: '¡Qué padre!',
      answer: 'How cool!',
      schedule: {
        state: 'learning',
        dueAt: 500,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 1,
        lapses: 0,
      },
      direction: 'es-en',
    }),
    createSampleCard({
      id: 'card-2',
      prompt: 'No manches',
      answer: 'No way!',
      schedule: {
        state: 'new',
        dueAt: 2000,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      },
      direction: 'es-en',
    }),
    createSampleCard({
      id: 'card-3',
      prompt: 'Watermelon',
      answer: 'Sandía',
      schedule: {
        state: 'review',
        dueAt: 5000,
        intervalDays: 5,
        easeFactor: 2.5,
        reviews: 5,
        lapses: 0,
      },
      direction: 'en-es',
    }),
  ]

  const defaultProps: DeckManagerViewProps = {
    cards: sampleCards,
    vocabularyCards: sampleCards,
    referenceTime: 1000,
    saveError: null,
    deletedCardIds: [],
    authUser: null,
    syncStatus: 'idle',
    isOnline: true,
    accountNotice: null,
    redirectAuthBanner: null,
    onDismissAccountNotice: vi.fn(),
    onDismissRedirectBanner: vi.fn(),
    onGoHome: vi.fn(),
    onNavigateToCreate: vi.fn(),
    onCards: vi.fn(),
    onGrammar: vi.fn(),
    onOpenSync: vi.fn(),
    onOpenFeedback: vi.fn(),
    onEditCard: vi.fn(),
    onDeleteCards: vi.fn(),
    onUpdateCards: vi.fn(),
    onAddStarterPack: vi.fn(),
    onAddStarterNote: vi.fn(),
    onRemoveStarterPack: vi.fn(),
    onRemoveStarterNote: vi.fn(),
    clock: { now: () => 1000 },
    ...overrides,
  }

  return {
    ...render(<DeckManagerView {...defaultProps} />),
    props: defaultProps,
  }
}

describe('DeckManagerView', () => {
  it('renders the cohesive deck ledger with search icon, card count, and cards table', () => {
    const { container } = renderDeckManager()

    expect(
      screen.getByRole('heading', { level: 1, name: /manage deck/i }),
    ).toBeInTheDocument()

    // Accessible vector search icon is rendered
    expect(container.querySelector('.icon-search')).toBeInTheDocument()

    // Card count summary
    expect(screen.getByText('3 cards')).toBeInTheDocument()

    // Table rows
    const rows = screen.getAllByRole('row', { name: /card:/i })
    expect(rows).toHaveLength(3)
  })

  it('filters cards by search query across prompt and answer', async () => {
    const user = userEvent.setup()
    renderDeckManager()

    const searchInput = screen.getByRole('searchbox', {
      name: /search cards in deck/i,
    })

    await user.type(searchInput, 'padre')
    expect(screen.getAllByRole('row', { name: /card:/i })).toHaveLength(1)
    expect(screen.getByText('¡Qué padre!')).toBeInTheDocument()
    expect(screen.getByText('1 of 3 cards')).toBeInTheDocument()

    await user.clear(searchInput)
    await user.type(searchInput, 'sandía')
    expect(screen.getAllByRole('row', { name: /card:/i })).toHaveLength(1)
    expect(screen.getByText('Watermelon')).toBeInTheDocument()
    expect(screen.getByText('1 of 3 cards')).toBeInTheDocument()
  })

  it('filters cards by duplicates when duplicates exist', async () => {
    const user = userEvent.setup()
    const duplicateCard = createSampleCard({
      id: 'card-4',
      prompt: '¡Qué padre!',
      answer: 'How neat!',
      direction: 'es-en',
    })
    renderDeckManager({
      vocabularyCards: [
        createSampleCard({
          id: 'card-1',
          prompt: '¡Qué padre!',
          answer: 'How cool!',
          direction: 'es-en',
        }),
        createSampleCard({
          id: 'card-2',
          prompt: 'No manches',
          answer: 'No way!',
          direction: 'es-en',
        }),
        duplicateCard,
      ],
    })

    const dupePill = screen.getByRole('button', { name: /duplicates \(2\)/i })
    expect(dupePill).toBeInTheDocument()

    // Click duplicates pill to filter
    await user.click(dupePill)
    expect(screen.getByText('2 of 3 cards')).toBeInTheDocument()
    const rows = screen.getAllByRole('row', { name: /card:/i })
    expect(rows).toHaveLength(2)
    expect(screen.getByText('How cool!')).toBeInTheDocument()
    expect(screen.getByText('How neat!')).toBeInTheDocument()
    expect(screen.queryByText('No way!')).not.toBeInTheDocument()

    // Toggle off
    await user.click(dupePill)
    expect(screen.getByText('3 cards')).toBeInTheDocument()
    expect(screen.getAllByRole('row', { name: /card:/i })).toHaveLength(3)
  })

  it('supports selecting cards and performing batch delete with TrashIcon', async () => {
    const user = userEvent.setup()
    const onDeleteCards = vi.fn()
    const { container } = renderDeckManager({ onDeleteCards })

    const rows = screen.getAllByRole('row', { name: /card:/i })

    // Select first card via checkbox
    const firstCheckbox = screen.getByRole('checkbox', {
      name: /select card ¡qué padre!/i,
    })
    await user.click(firstCheckbox)

    expect(rows[0]).toHaveClass('is-selected')

    // Batch actions appear with TrashIcon
    const deleteBtn = screen.getByRole('button', {
      name: /delete selected \(1\)/i,
    })
    expect(deleteBtn).toBeInTheDocument()
    expect(container.querySelector('.icon-trash')).toBeInTheDocument()

    await user.click(deleteBtn)
    expect(onDeleteCards).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'card-1' }),
    ])
  })

  it('supports keyboard navigation: space to toggle selection and enter to edit', () => {
    const onEditCard = vi.fn()
    renderDeckManager({ onEditCard })

    const rows = screen.getAllByRole('row', { name: /card:/i })
    rows[0]!.focus()

    // Space toggles selection
    fireEvent.keyDown(rows[0]!, { key: ' ', code: 'Space' })
    expect(rows[0]).toHaveClass('is-selected')

    // Enter opens edit modal
    fireEvent.keyDown(rows[0]!, { key: 'Enter' })
    expect(onEditCard).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'card-1' }),
    )
  })

  it('renders authentic MexicoFlag and EnglishBadge for direction cues', () => {
    const { container } = renderDeckManager()

    expect(container.querySelector('.flag-mx')).toBeInTheDocument()
    expect(container.querySelector('.language-icon')).toBeInTheDocument()

    const dirBadges = container.querySelectorAll('.deck-direction-badge')
    expect(dirBadges).toHaveLength(3)

    // ES → EN badges
    const esToEnBadges = screen.getAllByRole('img', {
      name: 'Mexican Spanish Prompt → English Answer',
    })
    expect(esToEnBadges).toHaveLength(2)
    const firstEsToEn = esToEnBadges[0]!
    expect(firstEsToEn.firstElementChild).toHaveClass('flag-mx')
    expect(firstEsToEn.querySelector('.deck-dir-arrow')).toHaveTextContent('→')
    expect(firstEsToEn.lastElementChild).toHaveClass('badge-en')

    // EN → ES badge
    const enToEsBadge = screen.getByRole('img', {
      name: 'English Prompt → Mexican Spanish Answer',
    })
    expect(enToEsBadge).toBeInTheDocument()
    expect(enToEsBadge.firstElementChild).toHaveClass('badge-en')
    expect(enToEsBadge.querySelector('.deck-dir-arrow')).toHaveTextContent('→')
    expect(enToEsBadge.lastElementChild).toHaveClass('flag-mx')
  })

  it('renders sort options matching SORT_ORDER_LABELS as single source of truth', () => {
    renderDeckManager()

    const select = screen.getByRole('combobox', { name: /sort cards/i })
    const options = Array.from(select.querySelectorAll('option')).map(
      (opt) => ({
        value: opt.value,
        label: opt.textContent,
      }),
    )

    expect(options).toEqual([
      { value: 'created-desc', label: 'Newest first' },
      { value: 'created-asc', label: 'Oldest first' },
      { value: 'alpha-asc', label: 'Alphabetical (A–Z)' },
      { value: 'alpha-desc', label: 'Alphabetical (Z–A)' },
      { value: 'answer-asc', label: 'Answer (A–Z)' },
      { value: 'answer-desc', label: 'Answer (Z–A)' },
      { value: 'direction-asc', label: 'ES → EN first' },
      { value: 'direction-desc', label: 'EN → ES first' },
      { value: 'mastery-desc', label: 'Highest mastery' },
      { value: 'mastery-asc', label: 'Lowest mastery' },
      { value: 'difficulty-desc', label: 'Spiciest first' },
      { value: 'difficulty-asc', label: 'Mildest first' },
      { value: 'status-asc', label: 'Due first' },
      { value: 'status-desc', label: 'Due last' },
    ])
  })

  it('cycles Direction, Answer, and Status column headers through ascending, descending, and reset', async () => {
    const user = userEvent.setup()
    renderDeckManager()

    const sortSelect = screen.getByRole('combobox', { name: /sort cards/i })
    expect(sortSelect).toHaveValue('created-desc')

    // 1. Direction header
    const dirBtn = screen.getByRole('button', { name: /sort by direction/i })
    await user.click(dirBtn)
    expect(sortSelect).toHaveValue('direction-asc')
    await user.click(dirBtn)
    expect(sortSelect).toHaveValue('direction-desc')
    await user.click(dirBtn)
    expect(sortSelect).toHaveValue('created-desc')

    // 2. Answer header
    const answerBtn = screen.getByRole('button', { name: /sort by answer/i })
    await user.click(answerBtn)
    expect(sortSelect).toHaveValue('answer-asc')
    await user.click(answerBtn)
    expect(sortSelect).toHaveValue('answer-desc')
    await user.click(answerBtn)
    expect(sortSelect).toHaveValue('created-desc')

    // 3. Status header
    const statusBtn = screen.getByRole('button', { name: /sort by status/i })
    await user.click(statusBtn)
    expect(sortSelect).toHaveValue('status-asc')
    await user.click(statusBtn)
    expect(sortSelect).toHaveValue('status-desc')
    await user.click(statusBtn)
    expect(sortSelect).toHaveValue('created-desc')
  })

  it('renders clean empty state with clear search button when search has no matches', async () => {
    const user = userEvent.setup()
    renderDeckManager()

    const searchInput = screen.getByRole('searchbox', {
      name: /search cards in deck/i,
    })
    await user.type(searchInput, 'nonexistent query')

    expect(
      screen.getByRole('heading', { level: 3, name: /no cards found/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'No cards match “nonexistent query”. Try a different search term.',
      ),
    ).toBeInTheDocument()

    const clearBtn = screen.getByRole('button', {
      name: /clear search/i,
    })
    await user.click(clearBtn)

    expect(screen.getAllByRole('row', { name: /card:/i })).toHaveLength(3)
  })

  it('renders clean empty duplicate search state and preserves duplicate audit on clear search', async () => {
    const user = userEvent.setup()
    const duplicateCard1: StudyCard = {
      ...createSampleCard({ id: 'dup-1' }),
      prompt: 'Same Prompt',
      answer: 'Answer 1',
    }
    const duplicateCard2: StudyCard = {
      ...createSampleCard({ id: 'dup-2' }),
      prompt: 'Same Prompt',
      answer: 'Answer 2',
    }
    const uniqueCard: StudyCard = {
      ...createSampleCard({ id: 'uniq-1' }),
      prompt: 'Unique Prompt',
      answer: 'Unique Answer',
    }

    renderDeckManager({
      cards: [duplicateCard1, duplicateCard2, uniqueCard],
      vocabularyCards: [duplicateCard1, duplicateCard2, uniqueCard],
    })

    // Initially 3 rows
    expect(screen.getAllByRole('row', { name: /card:/i })).toHaveLength(3)

    // Activate duplicates audit -> 2 rows
    const duplicatesBtn = screen.getByRole('button', {
      name: /duplicates \(2\)/i,
    })
    await user.click(duplicatesBtn)
    expect(screen.getAllByRole('row', { name: /card:/i })).toHaveLength(2)

    // Search for something not matching duplicates
    const searchInput = screen.getByRole('searchbox', {
      name: /search cards in deck/i,
    })
    await user.type(searchInput, 'nonexistent')

    expect(
      screen.getByText(
        'No duplicate cards match “nonexistent”. Try a different search term.',
      ),
    ).toBeInTheDocument()

    const clearBtn = screen.getByRole('button', {
      name: /clear search/i,
    })
    await user.click(clearBtn)

    // Crucial check: clearing search must preserve duplicates audit (2 rows, NOT 3)
    expect(screen.getAllByRole('row', { name: /card:/i })).toHaveLength(2)
  })

  it('preserves user sort order when clicking Show all cards from empty duplicates audit', async () => {
    const user = userEvent.setup()
    const duplicateCard1: StudyCard = {
      ...createSampleCard({ id: 'dup-1' }),
      prompt: 'Same Prompt',
      answer: 'Answer 1',
    }
    const duplicateCard2: StudyCard = {
      ...createSampleCard({ id: 'dup-2' }),
      prompt: 'Same Prompt',
      answer: 'Answer 2',
    }
    const uniqueCard: StudyCard = {
      ...createSampleCard({ id: 'uniq-1' }),
      prompt: 'Unique Prompt',
      answer: 'Unique Answer',
    }

    const { rerender, props } = renderDeckManager({
      cards: [duplicateCard1, duplicateCard2, uniqueCard],
      vocabularyCards: [duplicateCard1, duplicateCard2, uniqueCard],
    })

    // Change sort order to alphabetical
    const sortSelect = screen.getByRole('combobox', { name: /sort cards/i })
    await user.selectOptions(sortSelect, 'alpha-asc')
    expect(sortSelect).toHaveValue('alpha-asc')

    // Activate duplicates audit
    const duplicatesBtn = screen.getByRole('button', {
      name: /duplicates \(2\)/i,
    })
    await user.click(duplicatesBtn)

    // Simulate deleting duplicates so only uniqueCard remains in deck
    rerender(
      <DeckManagerView
        {...props}
        cards={[uniqueCard]}
        vocabularyCards={[uniqueCard]}
        deletedCardIds={['dup-1', 'dup-2']}
      />,
    )

    // Empty duplicates state is shown
    expect(
      screen.getByText('No duplicate cards found in your deck.'),
    ).toBeInTheDocument()

    // Click 'Show all cards'
    const showAllBtn = screen.getByRole('button', { name: /show all cards/i })
    await user.click(showAllBtn)

    // Unique card row is back
    expect(screen.getAllByRole('row', { name: /card:/i })).toHaveLength(1)

    // Crucial check: user's alphabetical sort order was NOT reset back to created-desc
    expect(sortSelect).toHaveValue('alpha-asc')
  })

  it('renders row memory indicators on deck cards in dedicated columns with mastery preceding difficulty', () => {
    const { container } = renderDeckManager()

    const headers = screen.getAllByRole('columnheader')
    const headerTexts = headers.map((h) => h.textContent?.trim())
    const masteryHeaderIdx = headerTexts.findIndex((t) =>
      t?.includes('Mastery'),
    )
    const diffHeaderIdx = headerTexts.findIndex((t) =>
      t?.includes('Difficulty'),
    )
    expect(masteryHeaderIdx).toBeGreaterThan(-1)
    expect(diffHeaderIdx).toBeGreaterThan(-1)
    expect(masteryHeaderIdx).toBeLessThan(diffHeaderIdx)

    const rows = screen.getAllByRole('row', { name: /card:/i })
    expect(rows[0]).toHaveAttribute(
      'aria-label',
      expect.stringMatching(
        /card:.*answer:.*mexican spanish → english.*status: due.*mastery: \d of 3 bubbles.*difficulty: \d of 3 chilies/i,
      ),
    )
    const firstRowCells = Array.from(rows[0]!.querySelectorAll('[role="cell"]'))
    const rowMasteryIdx = firstRowCells.findIndex((c) =>
      c.classList.contains('col-mastery'),
    )
    const rowDiffIdx = firstRowCells.findIndex((c) =>
      c.classList.contains('col-difficulty'),
    )
    expect(rowMasteryIdx).toBeGreaterThan(-1)
    expect(rowDiffIdx).toBeGreaterThan(-1)
    expect(rowMasteryIdx).toBeLessThan(rowDiffIdx)

    expect(
      container.querySelectorAll('.col-mastery .progress-bubbles'),
    ).toHaveLength(3)
    expect(
      container.querySelectorAll('.col-difficulty .chili-meter'),
    ).toHaveLength(3)
  })

  it('supports opening starter packs modal and removing an added pack with confirmation', async () => {
    const user = userEvent.setup()
    const streetPack = findStarterPack('mexican-street-phrases')!
    const streetCards = streetPack.createCards(0)
    const onRemoveStarterPack = vi.fn()

    renderDeckManager({
      cards: streetCards,
      vocabularyCards: streetCards,
      onRemoveStarterPack,
    })

    // Open starter packs modal
    const starterPacksBtn = screen.getByRole('button', {
      name: /^starter packs$/i,
    })
    await user.click(starterPacksBtn)

    expect(screen.getByText('Curated starter packs')).toBeInTheDocument()

    // Find Remove button for Mexican Street Phrases
    const removeBtn = screen.getByRole('button', {
      name: /Remove Mexican Street Phrases from deck/i,
    })
    await user.click(removeBtn)
    expect(screen.getByText(/Remove 72 cards from deck\?/i)).toBeInTheDocument()

    // Confirm removal
    const confirmBtn = screen.getByRole('button', {
      name: /Confirm remove Mexican Street Phrases from deck/i,
    })
    await user.click(confirmBtn)

    expect(onRemoveStarterPack).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'mexican-street-phrases' }),
    )
  })
})
