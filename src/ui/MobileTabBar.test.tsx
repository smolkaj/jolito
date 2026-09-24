import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MobileTabBar } from './MobileTabBar'
import type { HapticsPlayer } from '../application/ports'

function createMockHaptics() {
  const trigger = vi.fn()
  const haptics: HapticsPlayer = {
    trigger,
  }
  return { trigger, haptics }
}

describe('MobileTabBar', () => {
  it('renders all four navigation items with correct accessible labels and roles', () => {
    render(
      <MobileTabBar
        currentView="review"
        onCards={vi.fn()}
        onGrammar={vi.fn()}
        onNavigateToDeck={vi.fn()}
        onNavigateToCreate={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('navigation', { name: 'Mobile navigation' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Cards (Study session)' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Grammar (Practice grammar)' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deck' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
    expect(screen.queryByText(/cards? due/i)).not.toBeInTheDocument()
  })

  it('highlights the correct tab and leaves welcome view inactive', () => {
    const { rerender } = render(
      <MobileTabBar
        currentView="review"
        onCards={vi.fn()}
        onGrammar={vi.fn()}
        onNavigateToDeck={vi.fn()}
        onNavigateToCreate={vi.fn()}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Cards (Study session)' }),
    ).toHaveAttribute('aria-current', 'page')
    expect(
      screen.getByRole('button', { name: 'Grammar (Practice grammar)' }),
    ).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: 'Deck' })).not.toHaveAttribute(
      'aria-current',
    )
    expect(screen.getByRole('button', { name: 'Create' })).not.toHaveAttribute(
      'aria-current',
    )

    // Switch to grammar
    rerender(
      <MobileTabBar
        currentView="grammar"
        onCards={vi.fn()}
        onGrammar={vi.fn()}
        onNavigateToDeck={vi.fn()}
        onNavigateToCreate={vi.fn()}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Grammar (Practice grammar)' }),
    ).toHaveAttribute('aria-current', 'page')
    expect(
      screen.getByRole('button', { name: 'Cards (Study session)' }),
    ).not.toHaveAttribute('aria-current')

    // Switch to welcome (Home): no tab should be active
    rerender(
      <MobileTabBar
        currentView="welcome"
        onCards={vi.fn()}
        onGrammar={vi.fn()}
        onNavigateToDeck={vi.fn()}
        onNavigateToCreate={vi.fn()}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Cards (Study session)' }),
    ).not.toHaveAttribute('aria-current')
    expect(
      screen.getByRole('button', { name: 'Grammar (Practice grammar)' }),
    ).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: 'Deck' })).not.toHaveAttribute(
      'aria-current',
    )
    expect(screen.getByRole('button', { name: 'Create' })).not.toHaveAttribute(
      'aria-current',
    )

    // Switch to deck
    rerender(
      <MobileTabBar
        currentView="deck"
        onCards={vi.fn()}
        onGrammar={vi.fn()}
        onNavigateToDeck={vi.fn()}
        onNavigateToCreate={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Deck' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      screen.getByRole('button', { name: 'Cards (Study session)' }),
    ).not.toHaveAttribute('aria-current')

    // Switch to create
    rerender(
      <MobileTabBar
        currentView="create"
        onCards={vi.fn()}
        onGrammar={vi.fn()}
        onNavigateToDeck={vi.fn()}
        onNavigateToCreate={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Create' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('calls tab click callbacks and triggers haptics', () => {
    const { trigger, haptics } = createMockHaptics()
    const onCards = vi.fn()
    const onGrammar = vi.fn()
    const onDeck = vi.fn()
    const onCreate = vi.fn()

    render(
      <MobileTabBar
        currentView="welcome"
        onCards={onCards}
        onGrammar={onGrammar}
        onNavigateToDeck={onDeck}
        onNavigateToCreate={onCreate}
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

    fireEvent.click(screen.getByRole('button', { name: 'Deck' }))
    expect(onDeck).toHaveBeenCalledTimes(1)
    expect(trigger).toHaveBeenCalledWith('selection')

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(trigger).toHaveBeenCalledWith('selection')
  })
})
