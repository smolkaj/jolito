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
  it('renders all three navigation items with correct accessible labels and roles', () => {
    const { rerender } = render(
      <DesktopSegmentedNav
        currentView="deck"
        dueCount={5}
        onPractice={vi.fn()}
        onNavigateToDeck={vi.fn()}
        onNavigateToCreate={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('navigation', { name: 'Desktop navigation' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Practice' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Manage deck' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '+ New card' }),
    ).toBeInTheDocument()

    rerender(
      <DesktopSegmentedNav
        currentView="deck"
        dueCount={0}
        onPractice={vi.fn()}
        onNavigateToDeck={vi.fn()}
        onNavigateToCreate={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Practice' })).toBeInTheDocument()
  })

  it('omits practice button when canPractice is false', () => {
    render(
      <DesktopSegmentedNav
        currentView="create"
        dueCount={0}
        canPractice={false}
        onPractice={vi.fn()}
        onNavigateToDeck={vi.fn()}
        onNavigateToCreate={vi.fn()}
      />,
    )

    expect(
      screen.queryByRole('button', { name: /^practice$/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Manage deck' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '+ New card' }),
    ).toBeInTheDocument()
  })

  it('highlights the correct tab based on currentView', () => {
    const { rerender } = render(
      <DesktopSegmentedNav
        currentView="review"
        dueCount={0}
        onPractice={vi.fn()}
        onNavigateToDeck={vi.fn()}
        onNavigateToCreate={vi.fn()}
      />,
    )

    const practiceBtn = screen.getByRole('button', { name: 'Practice' })
    const deckBtn = screen.getByRole('button', { name: 'Manage deck' })
    const createBtn = screen.getByRole('button', { name: '+ New card' })

    expect(practiceBtn).toHaveClass('is-active')
    expect(practiceBtn).toHaveAttribute('aria-current', 'page')
    expect(deckBtn).not.toHaveClass('is-active')
    expect(createBtn).not.toHaveClass('is-active')

    // Switch to deck
    rerender(
      <DesktopSegmentedNav
        currentView="deck"
        dueCount={0}
        onPractice={vi.fn()}
        onNavigateToDeck={vi.fn()}
        onNavigateToCreate={vi.fn()}
      />,
    )
    expect(practiceBtn).not.toHaveClass('is-active')
    expect(deckBtn).toHaveClass('is-active')
    expect(deckBtn).toHaveAttribute('aria-current', 'page')

    // Switch to create
    rerender(
      <DesktopSegmentedNav
        currentView="create"
        dueCount={0}
        onPractice={vi.fn()}
        onNavigateToDeck={vi.fn()}
        onNavigateToCreate={vi.fn()}
      />,
    )
    expect(createBtn).toHaveClass('is-active')
    expect(createBtn).toHaveAttribute('aria-current', 'page')
    expect(deckBtn).not.toHaveClass('is-active')
  })

  it('triggers haptics and invokes navigation callbacks on click', () => {
    const { trigger, haptics } = createMockHaptics()
    const onPractice = vi.fn()
    const onNavigateToDeck = vi.fn()
    const onNavigateToCreate = vi.fn()

    render(
      <DesktopSegmentedNav
        currentView="deck"
        dueCount={3}
        onPractice={onPractice}
        onNavigateToDeck={onNavigateToDeck}
        onNavigateToCreate={onNavigateToCreate}
        haptics={haptics}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Practice' }))
    expect(onPractice).toHaveBeenCalledTimes(1)
    expect(trigger).toHaveBeenCalledWith('selection')

    fireEvent.click(screen.getByRole('button', { name: 'Manage deck' }))
    expect(onNavigateToDeck).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '+ New card' }))
    expect(onNavigateToCreate).toHaveBeenCalledTimes(1)
  })
})
