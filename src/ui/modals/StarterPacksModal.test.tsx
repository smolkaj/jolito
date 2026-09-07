import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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

    expect(screen.getByText(/2 already in your deck/i)).toBeInTheDocument()
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
})
