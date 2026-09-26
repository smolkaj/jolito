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

  it('renders all 10 curated starter packs when isOpen is true', () => {
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
    expect(screen.getByText("Founder's CDMX Notebook")).toBeInTheDocument()
    expect(screen.getByText('Top Verbs: 1–50')).toBeInTheDocument()
    expect(screen.getByText('Top Verbs: 51–100')).toBeInTheDocument()
    expect(screen.getByText('Top Verbs: 101–150')).toBeInTheDocument()
    expect(screen.getByText('Top Verbs: 151–200')).toBeInTheDocument()
    expect(screen.getByText('Top Connectors: 1–50')).toBeInTheDocument()
    expect(screen.getByText('Top Adjectives: 1–50')).toBeInTheDocument()
    expect(screen.getByText('Top Idioms: 1–30')).toBeInTheDocument()
    expect(screen.getByText('Top Adverbs: 1–50')).toBeInTheDocument()
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
    expect(
      screen.getAllByRole('button', { name: /Add .* to deck/i }).length,
    ).toBeGreaterThan(0)

    // 4. Add pack from within inspect view
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

  it('displays partial button (+ Add reverse) when only the forward es-en directional card exists', () => {
    const streetPack = findStarterPack('mexican-street-phrases')!
    const allStreetCards = streetPack.createCards(0)
    // Only have the first card (es-en direction) of the first reciprocal pair
    const forwardCard = allStreetCards.slice(0, 1)

    render(
      <StarterPacksModal
        isOpen={true}
        onClose={vi.fn()}
        cards={forwardCard}
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
    expect(
      screen.getByRole('button', { name: /Add reverse card for/i }),
    ).toHaveTextContent('+ Add reverse')
  })

  it('displays clean status copy when all cards in pack are in deck', () => {
    const streetPack = findStarterPack('mexican-street-phrases')!
    const allStreetCards = streetPack.createCards(0)

    render(
      <StarterPacksModal
        isOpen={true}
        onClose={vi.fn()}
        cards={allStreetCards}
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
      screen.getByText('All 72 cards are in your deck'),
    ).toBeInTheDocument()
  })

  it('manages focus between pack list and inspect view', () => {
    render(
      <StarterPacksModal
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        onAddPack={vi.fn()}
      />,
    )

    const inspectBtn = screen.getByRole('button', {
      name: /Inspect Mexican Street Phrases cards/i,
    })
    fireEvent.click(inspectBtn)

    const backBtn = screen.getByRole('button', {
      name: /Back to all starter packs/i,
    })
    expect(document.activeElement).toBe(backBtn)

    fireEvent.click(backBtn)
    expect(document.activeElement).toBe(
      screen.getByRole('button', {
        name: /Inspect Mexican Street Phrases cards/i,
      }),
    )
  })

  it('allows adding individual words/notes directly from inspect view', () => {
    const onAddNote = vi.fn()
    render(
      <StarterPacksModal
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        onAddPack={vi.fn()}
        onAddNote={onAddNote}
      />,
    )

    // Inspect Mexican Street Phrases
    fireEvent.click(
      screen.getByRole('button', {
        name: /Inspect Mexican Street Phrases cards/i,
      }),
    )

    // Find the "+ Add" button for ¿Mande?
    const addMandeBtn = screen.getByRole('button', {
      name: /Add ¿Mande\? to deck/i,
    })
    fireEvent.click(addMandeBtn)

    expect(onAddNote).toHaveBeenCalledTimes(1)
    expect(onAddNote).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'mexican-street-phrases' }),
      0,
    )
  })

  it('renders "+ Add missing" button when only reverse card exists in deck', () => {
    const streetPack = findStarterPack('mexican-street-phrases')!
    const allStreetCards = streetPack.createCards(0)
    // Only keep en-es card for ¿Mande? (index 0)
    const reverseOnly = allStreetCards.filter(
      (c) => c.direction === 'en-es' && c.answer === '¿Mande?',
    )

    render(
      <StarterPacksModal
        isOpen={true}
        onClose={vi.fn()}
        cards={reverseOnly}
        onAddPack={vi.fn()}
        onAddNote={vi.fn()}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: /Inspect Mexican Street Phrases cards/i,
      }),
    )

    expect(
      screen.getByRole('button', {
        name: /Add missing card for ¿Mande\?/i,
      }),
    ).toHaveTextContent('+ Add missing')
  })

  it('allows removing an added pack with confirmation from the main list', () => {
    const streetPack = findStarterPack('mexican-street-phrases')!
    const allStreetCards = streetPack.createCards(0)
    const onRemovePack = vi.fn()

    render(
      <StarterPacksModal
        isOpen={true}
        onClose={vi.fn()}
        cards={allStreetCards}
        onAddPack={vi.fn()}
        onRemovePack={onRemovePack}
      />,
    )

    // Remove button should be visible when pack is in deck
    const removeBtn = screen.getByRole('button', {
      name: /Remove Mexican Street Phrases from deck/i,
    })
    expect(removeBtn).toBeInTheDocument()

    // Clicking Remove prompts for confirmation and focuses Cancel
    fireEvent.click(removeBtn)
    expect(screen.getByText(/Remove 72 cards from deck\?/i)).toBeInTheDocument()

    // Confirm button executes onRemovePack
    const confirmBtn = screen.getByRole('button', {
      name: /Confirm remove Mexican Street Phrases from deck/i,
    })
    fireEvent.click(confirmBtn)
    expect(onRemovePack).toHaveBeenCalledTimes(1)
    expect(onRemovePack).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'mexican-street-phrases' }),
    )
  })

  it('allows cancelling pack removal confirmation via Cancel button or Escape key and restores focus', () => {
    const streetPack = findStarterPack('mexican-street-phrases')!
    const allStreetCards = streetPack.createCards(0)
    const onRemovePack = vi.fn()
    const onClose = vi.fn()

    render(
      <StarterPacksModal
        isOpen={true}
        onClose={onClose}
        cards={allStreetCards}
        onAddPack={vi.fn()}
        onRemovePack={onRemovePack}
      />,
    )

    const removeBtn = screen.getByRole('button', {
      name: /Remove Mexican Street Phrases from deck/i,
    })
    fireEvent.click(removeBtn)
    expect(screen.getByText(/Remove 72 cards from deck\?/i)).toBeInTheDocument()

    // Cancel button is focused on open
    const cancelBtn = screen.getByRole('button', {
      name: /Cancel removing Mexican Street Phrases/i,
    })
    expect(document.activeElement).toBe(cancelBtn)

    // Cancel button resets confirmation and restores focus to Remove button
    fireEvent.click(cancelBtn)
    expect(screen.queryByText(/Remove 72 cards from deck\?/i)).toBeNull()
    expect(onRemovePack).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(
      screen.getByRole('button', {
        name: /Remove Mexican Street Phrases from deck/i,
      }),
    )

    // Escape key resets confirmation and restores focus to Remove button
    const removeBtnAgain = screen.getByRole('button', {
      name: /Remove Mexican Street Phrases from deck/i,
    })
    fireEvent.click(removeBtnAgain)
    expect(screen.getByText(/Remove 72 cards from deck\?/i)).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByText(/Remove 72 cards from deck\?/i)).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(
      screen.getByRole('button', {
        name: /Remove Mexican Street Phrases from deck/i,
      }),
    )
  })

  it('allows removing a pack from within the inspect toolbar', () => {
    const streetPack = findStarterPack('mexican-street-phrases')!
    const allStreetCards = streetPack.createCards(0)
    const onRemovePack = vi.fn()

    render(
      <StarterPacksModal
        isOpen={true}
        onClose={vi.fn()}
        cards={allStreetCards}
        onAddPack={vi.fn()}
        onRemovePack={onRemovePack}
      />,
    )

    // Drill down into inspect view
    fireEvent.click(
      screen.getByRole('button', {
        name: /Inspect Mexican Street Phrases cards/i,
      }),
    )

    // Click "Remove pack" in inspect toolbar
    const removeToolbarBtn = screen.getByRole('button', {
      name: /Remove Mexican Street Phrases from deck/i,
    })
    fireEvent.click(removeToolbarBtn)

    expect(screen.getByText(/Remove 72 cards from deck\?/i)).toBeInTheDocument()

    // Confirm removal
    fireEvent.click(
      screen.getByRole('button', {
        name: /Confirm remove Mexican Street Phrases from deck/i,
      }),
    )
    expect(onRemovePack).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'mexican-street-phrases' }),
    )
  })

  it('allows removing an individual note card from the inspect list', () => {
    const streetPack = findStarterPack('mexican-street-phrases')!
    const allStreetCards = streetPack.createCards(0)
    const onRemoveNote = vi.fn()

    render(
      <StarterPacksModal
        isOpen={true}
        onClose={vi.fn()}
        cards={allStreetCards}
        onAddPack={vi.fn()}
        onRemoveNote={onRemoveNote}
      />,
    )

    // Drill down into inspect view
    fireEvent.click(
      screen.getByRole('button', {
        name: /Inspect Mexican Street Phrases cards/i,
      }),
    )

    // ¿Mande? is note index 0 and has a Remove button
    const removeMandeBtn = screen.getByRole('button', {
      name: /Remove ¿Mande\? from deck/i,
    })
    expect(removeMandeBtn).toBeInTheDocument()
    fireEvent.click(removeMandeBtn)

    expect(onRemoveNote).toHaveBeenCalledTimes(1)
    expect(onRemoveNote).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'mexican-street-phrases' }),
      0,
    )
  })

  it('clears active removal confirmation when navigating into or out of inspect view', () => {
    const streetPack = findStarterPack('mexican-street-phrases')!
    const allStreetCards = streetPack.createCards(0)

    render(
      <StarterPacksModal
        isOpen={true}
        onClose={vi.fn()}
        cards={allStreetCards}
        onAddPack={vi.fn()}
        onRemovePack={vi.fn()}
      />,
    )

    // 1. Enter inspect view and trigger confirmation
    fireEvent.click(
      screen.getByRole('button', {
        name: /Inspect Mexican Street Phrases cards/i,
      }),
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: /Remove Mexican Street Phrases from deck/i,
      }),
    )
    expect(screen.getByText(/Remove 72 cards from deck\?/i)).toBeInTheDocument()

    // 2. Click Back to all packs -> confirmation should be reset
    fireEvent.click(
      screen.getByRole('button', {
        name: /Back to all starter packs/i,
      }),
    )
    expect(screen.queryByText(/Remove 72 cards from deck\?/i)).toBeNull()
    expect(
      screen.getByRole('button', {
        name: /Remove Mexican Street Phrases from deck/i,
      }),
    ).toBeInTheDocument()

    // 3. Trigger confirmation on main list, then click Inspect -> confirmation should be reset
    fireEvent.click(
      screen.getByRole('button', {
        name: /Remove Mexican Street Phrases from deck/i,
      }),
    )
    expect(screen.getByText(/Remove 72 cards from deck\?/i)).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', {
        name: /Inspect Mexican Street Phrases cards/i,
      }),
    )
    expect(screen.queryByText(/Remove 72 cards from deck\?/i)).toBeNull()
  })

  it('opens inspect view when clicking anywhere on a starter pack card outside action buttons', () => {
    const onAddPack = vi.fn()
    const { rerender } = render(
      <StarterPacksModal
        isOpen={true}
        onClose={vi.fn()}
        cards={[]}
        onAddPack={onAddPack}
      />,
    )

    // 1. Clicking on pack title inspects the pack
    const title = screen.getByText('Mexican Street Phrases')
    fireEvent.click(title)

    expect(
      screen.getByRole('button', { name: /Back to all starter packs/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Mexican Street Phrases' }),
    ).toBeInTheDocument()

    // Return to pack list
    fireEvent.click(
      screen.getByRole('button', { name: /Back to all starter packs/i }),
    )
    expect(screen.getByText('Curated starter packs')).toBeInTheDocument()

    // 2. Clicking on pack description inspects the pack
    const desc = screen.getByText(
      /Authentic street slang and polite spoken etiquette from Mexico City\./i,
    )
    fireEvent.click(desc)
    expect(
      screen.getByRole('button', { name: /Back to all starter packs/i }),
    ).toBeInTheDocument()

    // Return to pack list
    fireEvent.click(
      screen.getByRole('button', { name: /Back to all starter packs/i }),
    )

    // 3. Clicking on the card container element itself inspects the pack
    const cardElement = screen
      .getByText('Top Connectors: 1–50')
      .closest('.starter-pack-card')!
    expect(cardElement).toBeInTheDocument()
    fireEvent.click(cardElement)
    expect(
      screen.getByRole('heading', { name: 'Top Connectors: 1–50' }),
    ).toBeInTheDocument()

    // Return to pack list
    fireEvent.click(
      screen.getByRole('button', { name: /Back to all starter packs/i }),
    )

    // 4. Clicking the Add button does NOT trigger inspect, but calls onAddPack
    const addBtn = screen.getByRole('button', {
      name: /Add Mexican Street Phrases \(72 cards\)/i,
    })
    fireEvent.click(addBtn)
    expect(onAddPack).toHaveBeenCalledTimes(1)
    expect(onAddPack).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'mexican-street-phrases' }),
    )
    // We should still be on the main pack list, NOT inside inspect view
    expect(
      screen.queryByRole('button', { name: /Back to all starter packs/i }),
    ).toBeNull()

    // 5. Clicking on an already-added pack card still opens inspect view
    const streetPack = findStarterPack('mexican-street-phrases')!
    const allStreetCards = streetPack.createCards(0)
    rerender(
      <StarterPacksModal
        isOpen={true}
        onClose={vi.fn()}
        cards={allStreetCards}
        onAddPack={onAddPack}
      />,
    )
    const addedCard = screen
      .getByText('Mexican Street Phrases')
      .closest('.starter-pack-card')!
    expect(addedCard).toHaveClass('is-added')
    fireEvent.click(addedCard)
    expect(
      screen.getByRole('button', { name: /Back to all starter packs/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Mexican Street Phrases' }),
    ).toBeInTheDocument()
  })
})
