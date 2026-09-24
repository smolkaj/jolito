import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DesktopSegmentedNav } from './DesktopSegmentedNav'
import type { HapticsPlayer } from '../application/ports'

function createMockHaptics() {
  const trigger = vi.fn()
  const haptics: HapticsPlayer = {
    trigger,
  }
  return { trigger, haptics }
}

describe('DesktopSegmentedNav', () => {
  it('renders all four navigation items with clean, accessible labels and roles', () => {
    render(
      <DesktopSegmentedNav
        currentView="deck"
        onCards={vi.fn()}
        onGrammar={vi.fn()}
        onNavigateToDeck={vi.fn()}
        onNavigateToCreate={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('group', { name: 'Navigation' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Cards (Study session)' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Grammar (Practice grammar)' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Deck (Manage deck)' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Create (+ New card)' }),
    ).toBeInTheDocument()

    // Confirms no badge counter is rendered
    expect(screen.queryByText(/cards? due/i)).not.toBeInTheDocument()
  })

  it('highlights the correct tab based on currentView and leaves welcome inactive', () => {
    const { rerender } = render(
      <DesktopSegmentedNav
        currentView="review"
        onCards={vi.fn()}
        onGrammar={vi.fn()}
        onNavigateToDeck={vi.fn()}
        onNavigateToCreate={vi.fn()}
      />,
    )

    const cardsBtn = screen.getByRole('button', {
      name: 'Cards (Study session)',
    })
    const grammarBtn = screen.getByRole('button', {
      name: 'Grammar (Practice grammar)',
    })
    const deckBtn = screen.getByRole('button', { name: 'Deck (Manage deck)' })
    const createBtn = screen.getByRole('button', {
      name: 'Create (+ New card)',
    })

    expect(cardsBtn).toHaveClass('is-active')
    expect(cardsBtn).toHaveAttribute('aria-current', 'page')
    expect(grammarBtn).not.toHaveClass('is-active')
    expect(deckBtn).not.toHaveClass('is-active')
    expect(createBtn).not.toHaveClass('is-active')

    // Switch to grammar
    rerender(
      <DesktopSegmentedNav
        currentView="grammar"
        onCards={vi.fn()}
        onGrammar={vi.fn()}
        onNavigateToDeck={vi.fn()}
        onNavigateToCreate={vi.fn()}
      />,
    )
    expect(cardsBtn).not.toHaveClass('is-active')
    expect(grammarBtn).toHaveClass('is-active')
    expect(grammarBtn).toHaveAttribute('aria-current', 'page')
    expect(deckBtn).not.toHaveClass('is-active')
    expect(createBtn).not.toHaveClass('is-active')

    // Switch to deck
    rerender(
      <DesktopSegmentedNav
        currentView="deck"
        onCards={vi.fn()}
        onGrammar={vi.fn()}
        onNavigateToDeck={vi.fn()}
        onNavigateToCreate={vi.fn()}
      />,
    )
    expect(cardsBtn).not.toHaveClass('is-active')
    expect(grammarBtn).not.toHaveClass('is-active')
    expect(deckBtn).toHaveClass('is-active')
    expect(deckBtn).toHaveAttribute('aria-current', 'page')

    // Switch to create
    rerender(
      <DesktopSegmentedNav
        currentView="create"
        onCards={vi.fn()}
        onGrammar={vi.fn()}
        onNavigateToDeck={vi.fn()}
        onNavigateToCreate={vi.fn()}
      />,
    )
    expect(createBtn).toHaveClass('is-active')
    expect(createBtn).toHaveAttribute('aria-current', 'page')
    expect(cardsBtn).not.toHaveClass('is-active')
    expect(deckBtn).not.toHaveClass('is-active')

    // Switch to welcome (Home): NO tab should be active
    rerender(
      <DesktopSegmentedNav
        currentView="welcome"
        onCards={vi.fn()}
        onGrammar={vi.fn()}
        onNavigateToDeck={vi.fn()}
        onNavigateToCreate={vi.fn()}
      />,
    )
    expect(cardsBtn).not.toHaveClass('is-active')
    expect(cardsBtn).not.toHaveAttribute('aria-current')
    expect(grammarBtn).not.toHaveClass('is-active')
    expect(grammarBtn).not.toHaveAttribute('aria-current')
    expect(deckBtn).not.toHaveClass('is-active')
    expect(deckBtn).not.toHaveAttribute('aria-current')
    expect(createBtn).not.toHaveClass('is-active')
    expect(createBtn).not.toHaveAttribute('aria-current')
  })

  it('triggers haptics and invokes navigation callbacks on click', () => {
    const { trigger, haptics } = createMockHaptics()
    const onCards = vi.fn()
    const onGrammar = vi.fn()
    const onNavigateToDeck = vi.fn()
    const onNavigateToCreate = vi.fn()

    render(
      <DesktopSegmentedNav
        currentView="deck"
        onCards={onCards}
        onGrammar={onGrammar}
        onNavigateToDeck={onNavigateToDeck}
        onNavigateToCreate={onNavigateToCreate}
        haptics={haptics}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Cards (Study session)' }),
    )
    expect(onCards).toHaveBeenCalledTimes(1)
    expect(trigger).toHaveBeenCalledWith('selection')

    fireEvent.click(
      screen.getByRole('button', { name: 'Grammar (Practice grammar)' }),
    )
    expect(onGrammar).toHaveBeenCalledTimes(1)
    expect(trigger).toHaveBeenCalledWith('selection')

    fireEvent.click(screen.getByRole('button', { name: 'Deck (Manage deck)' }))
    expect(onNavigateToDeck).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Create (+ New card)' }))
    expect(onNavigateToCreate).toHaveBeenCalledTimes(1)
  })
})
