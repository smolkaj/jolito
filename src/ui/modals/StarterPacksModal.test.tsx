import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { starterCards } from '../../application/starter-cards'
import { findStarterPack } from '../../domain/starter-decks'
import { StarterPacksModal } from './StarterPacksModal'

describe('StarterPacksModal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <StarterPacksModal
        isOpen={false}
        onClose={vi.fn()}
        cards={[]}
        onAddPack={vi.fn()}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders all 5 curated starter packs when isOpen is true', () => {
    render(
      <StarterPacksModal
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        onAddPack={vi.fn()}
      />,
    )

    expect(screen.getByText('Curated starter packs')).toBeInTheDocument()
    expect(screen.getByText('Mexican Street Phrases')).toBeInTheDocument()
    expect(screen.getByText('Top Verbs: 1–50')).toBeInTheDocument()
    expect(screen.getByText('Top Verbs: 51–100')).toBeInTheDocument()
    expect(screen.getByText('Top Verbs: 101–150')).toBeInTheDocument()
    expect(screen.getByText('Top Verbs: 151–200')).toBeInTheDocument()
  })

  it('calls onAddPack when clicking Add Pack button', () => {
    const onAddPack = vi.fn()
    render(
      <StarterPacksModal
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        onAddPack={onAddPack}
      />,
    )

    const addStreetBtn = screen.getByRole('button', {
      name: /Add Mexican Street Phrases/i,
    })
    fireEvent.click(addStreetBtn)

    expect(onAddPack).toHaveBeenCalledTimes(1)
    expect(onAddPack).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'mexican-street-phrases' }),
    )
  })

  it('accurately identifies partial and full duplicate presence in deck', () => {
    const streetPack = findStarterPack('mexican-street-phrases')!
    const allStreetCards = streetPack.createCards(0)

    // User has 2 of the cards in their deck
    const partialCards = allStreetCards.slice(0, 2)

    const { rerender } = render(
      <StarterPacksModal
        isOpen={true}
        onClose={vi.fn()}
        cards={partialCards}
        onAddPack={vi.fn()}
      />,
    )

    expect(screen.getByText(/2 of 72 cards in deck/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /Add remaining 70 cards from Mexican Street Phrases/i,
      }),
    ).toBeInTheDocument()

    // Now rerender with ALL street cards in deck
    rerender(
      <StarterPacksModal
        isOpen={true}
        onClose={vi.fn()}
        cards={allStreetCards}
        onAddPack={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('button', {
        name: /Mexican Street Phrases is already added to your deck/i,
      }),
    ).toBeDisabled()
  })

  it('invokes onClose when pressing Escape or clicking close button', () => {
    const onClose = vi.fn()
    render(
      <StarterPacksModal
        isOpen={true}
        onClose={onClose}
        cards={[]}
        onAddPack={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByLabelText('Close dialog'))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('ignores ephemeral demo starter cards so they do not collide with curated packs', () => {
    // Guest starts with ephemeral starterCards including 'qué padre'
    render(
      <StarterPacksModal
        isOpen={true}
        onClose={vi.fn()}
        cards={starterCards}
        onAddPack={vi.fn()}
      />,
    )

    // Mexican Street Phrases has 72 cards. Since the ephemeral card is ignored,
    // all 72 are available to add (0 already in deck).
    expect(screen.queryByText(/already in your deck/i)).toBeNull()
    expect(
      screen.getByRole('button', {
        name: /Add Mexican Street Phrases \(72 cards\)/i,
      }),
    ).toBeInTheDocument()
  })

  it('traps focus and restores focus to the previously active element', () => {
    // Create an external trigger button in the document
    const triggerBtn = document.createElement('button')
    triggerBtn.textContent = 'Open Starter Packs'
    document.body.appendChild(triggerBtn)
    triggerBtn.focus()
    expect(document.activeElement).toBe(triggerBtn)

    const onClose = vi.fn()
    const { unmount } = render(
      <StarterPacksModal
        isOpen={true}
        onClose={onClose}
        cards={[]}
        onAddPack={vi.fn()}
      />,
    )

    // Focus should be directed to the close button on mount
    const closeBtn = screen.getByLabelText('Close dialog')
    expect(document.activeElement).toBe(closeBtn)

    // Test Tab key wrapping
    // When Shift+Tab is pressed on the first element (closeBtn), focus wraps to the last focusable element
    const allButtons = screen.getAllByRole('button')
    const lastButton = allButtons[allButtons.length - 1]

    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(lastButton)

    // When Tab is pressed on the last element, focus wraps back to the first
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(document.activeElement).toBe(closeBtn)

    // Unmounting modal should restore focus to triggerBtn
    unmount()
    expect(document.activeElement).toBe(triggerBtn)

    document.body.removeChild(triggerBtn)
  })
  it('allows inspecting a pack, searching cards, and seeing in-deck duplicate badges', () => {
    const streetPack = findStarterPack('mexican-street-phrases')!
    const allStreetCards = streetPack.createCards(0)
    // User already has 2 of the cards
    const partialCards = allStreetCards.slice(0, 2)
    const onAddPack = vi.fn()

    render(
      <StarterPacksModal
        isOpen={true}
        onClose={vi.fn()}
        cards={partialCards}
        onAddPack={onAddPack}
      />,
    )

    // 1. Click "Inspect pack" for Mexican Street Phrases
    const inspectBtn = screen.getByRole('button', {
      name: /Inspect Mexican Street Phrases cards/i,
    })
    fireEvent.click(inspectBtn)

    // 2. We are now in the inspect view
    expect(
      screen.getByRole('button', { name: /Back to all starter packs/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/2 of 72 cards in your deck \(70 cards to add\)/i),
    ).toBeInTheDocument()

    // 3. Check presence of "¿Mande?" in inspect list
    expect(screen.getByText('¿Mande?')).toBeInTheDocument()
    expect(screen.getByText('✓ In deck')).toBeInTheDocument()
    expect(screen.getAllByText('+ New').length).toBeGreaterThan(0)

    // 4. Test search input in inspect view
    const searchInput = screen.getByLabelText(/Search cards in this pack/i)
    fireEvent.change(searchInput, { target: { value: 'Ahorita' } })
    expect(screen.getByText('Ahorita')).toBeInTheDocument()
    expect(screen.queryByText('¿Mande?')).toBeNull()

    // 5. Add pack from within inspect view
    const addFromInspectBtn = screen.getByRole('button', {
      name: /Add remaining 70 cards from Mexican Street Phrases/i,
    })
    fireEvent.click(addFromInspectBtn)
    expect(onAddPack).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'mexican-street-phrases' }),
    )

    // 6. Pressing Escape while inspecting returns to pack list
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByText('Curated starter packs')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Back to all starter packs/i }),
    ).toBeNull()
  })

  it('displays partial badge (1 of 2 in deck) when only one directional card exists', () => {
    const streetPack = findStarterPack('mexican-street-phrases')!
    const allStreetCards = streetPack.createCards(0)
    // Only have 1 card of the first reciprocal pair
    const singleCard = allStreetCards.slice(0, 1)

    render(
      <StarterPacksModal
        isOpen={true}
        onClose={vi.fn()}
        cards={singleCard}
        onAddPack={vi.fn()}
      />,
    )

    // Inspect Mexican Street Phrases
    fireEvent.click(
      screen.getByRole('button', {
        name: /Inspect Mexican Street Phrases cards/i,
      }),
    )

    expect(
      screen.getByText(/1 of 72 cards in your deck \(71 cards to add\)/i),
    ).toBeInTheDocument()
    expect(screen.getByText('1 of 2 in deck')).toBeInTheDocument()
  })
})
