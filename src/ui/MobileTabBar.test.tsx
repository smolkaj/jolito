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

describe('MobileTabBar (Milestone 2)', () => {
  it('renders all four navigation tabs with correct accessible labels and roles', () => {
    render(
      <MobileTabBar
        currentView="review"
        isSyncOpen={false}
        syncStatus="idle"
        authUser={null}
        dueCount={5}
        onPractice={vi.fn()}
        onNavigateToDeck={vi.fn()}
        onNavigateToCreate={vi.fn()}
        onOpenSync={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('tablist', { name: 'Mobile navigation' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Practice' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Manage deck' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Create card' })).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: 'Sign in or sync' }),
    ).toBeInTheDocument()
  })

  it('highlights Practice tab when in review, welcome, grammar, or complete view', () => {
    const { rerender } = render(
      <MobileTabBar
        currentView="review"
        isSyncOpen={false}
        syncStatus="idle"
        authUser={null}
        onPractice={vi.fn()}
        onNavigateToDeck={vi.fn()}
        onNavigateToCreate={vi.fn()}
        onOpenSync={vi.fn()}
      />,
    )
    expect(screen.getByRole('tab', { name: 'Practice' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: 'Manage deck' })).toHaveAttribute(
      'aria-selected',
      'false',
    )

    rerender(
      <MobileTabBar
        currentView="welcome"
        isSyncOpen={false}
        syncStatus="idle"
        authUser={null}
        onPractice={vi.fn()}
        onNavigateToDeck={vi.fn()}
        onNavigateToCreate={vi.fn()}
        onOpenSync={vi.fn()}
      />,
    )
    expect(screen.getByRole('tab', { name: 'Practice' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    rerender(
      <MobileTabBar
        currentView="deck"
        isSyncOpen={false}
        syncStatus="idle"
        authUser={null}
        onPractice={vi.fn()}
        onNavigateToDeck={vi.fn()}
        onNavigateToCreate={vi.fn()}
        onOpenSync={vi.fn()}
      />,
    )
    expect(screen.getByRole('tab', { name: 'Manage deck' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: 'Practice' })).toHaveAttribute(
      'aria-selected',
      'false',
    )

    rerender(
      <MobileTabBar
        currentView="create"
        isSyncOpen={false}
        syncStatus="idle"
        authUser={null}
        onPractice={vi.fn()}
        onNavigateToDeck={vi.fn()}
        onNavigateToCreate={vi.fn()}
        onOpenSync={vi.fn()}
      />,
    )
    expect(screen.getByRole('tab', { name: 'Create card' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    rerender(
      <MobileTabBar
        currentView="deck"
        isSyncOpen={true}
        syncStatus="idle"
        authUser={null}
        onPractice={vi.fn()}
        onNavigateToDeck={vi.fn()}
        onNavigateToCreate={vi.fn()}
        onOpenSync={vi.fn()}
      />,
    )
    expect(
      screen.getByRole('tab', { name: 'Sign in or sync' }),
    ).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Manage deck' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })

  it('calls tab click callbacks and triggers haptics', () => {
    const { trigger, haptics } = createMockHaptics()
    const onPractice = vi.fn()
    const onDeck = vi.fn()
    const onCreate = vi.fn()
    const onSync = vi.fn()

    render(
      <MobileTabBar
        currentView="welcome"
        isSyncOpen={false}
        syncStatus="idle"
        authUser={null}
        onPractice={onPractice}
        onNavigateToDeck={onDeck}
        onNavigateToCreate={onCreate}
        onOpenSync={onSync}
        haptics={haptics}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Manage deck' }))
    expect(onDeck).toHaveBeenCalledTimes(1)
    expect(trigger).toHaveBeenCalledWith('selection')

    fireEvent.click(screen.getByRole('tab', { name: 'Create card' }))
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(trigger).toHaveBeenCalledWith('selection')

    fireEvent.click(screen.getByRole('tab', { name: 'Sign in or sync' }))
    expect(onSync).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('tab', { name: 'Practice' }))
    expect(onPractice).toHaveBeenCalledTimes(1)
  })

  it('displays due count badge when cards are due and not currently on practice tab', () => {
    render(
      <MobileTabBar
        currentView="deck"
        isSyncOpen={false}
        syncStatus="idle"
        authUser={null}
        dueCount={12}
        onPractice={vi.fn()}
        onNavigateToDeck={vi.fn()}
        onNavigateToCreate={vi.fn()}
        onOpenSync={vi.fn()}
      />,
    )

    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByLabelText('12 cards due')).toBeInTheDocument()
  })
})
