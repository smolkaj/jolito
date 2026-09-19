import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ModalSheet } from './ModalSheet'
import type { HapticsPlayer } from '../../application/ports'

function createMockHaptics() {
  const trigger = vi.fn()
  const haptics: HapticsPlayer = {
    trigger,
  }
  return { trigger, haptics }
}

describe('ModalSheet Bottom Sheet (Milestone 2)', () => {
  it('renders children with grabber handle and dialog role', () => {
    render(
      <ModalSheet isOpen={true} onClose={vi.fn()} ariaLabel="Test Sheet">
        <p>Sheet body content</p>
      </ModalSheet>,
    )

    expect(
      screen.getByRole('dialog', { name: 'Test Sheet' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Sheet body content')).toBeInTheDocument()
    expect(
      screen.getByRole('presentation', { name: 'Drag down to dismiss' }),
    ).toBeInTheDocument()
  })

  it('dismisses modal and triggers haptics when dragged down past threshold', () => {
    const onClose = vi.fn()
    const { trigger, haptics } = createMockHaptics()

    render(
      <ModalSheet
        isOpen={true}
        onClose={onClose}
        haptics={haptics}
        ariaLabel="Test Sheet"
      >
        <p>Sheet body content</p>
      </ModalSheet>,
    )

    const grabber = screen.getByRole('presentation', {
      name: 'Drag down to dismiss',
    })

    // Drag down 100px (past 85px threshold)
    fireEvent.pointerDown(grabber, { clientY: 100, button: 0 })
    fireEvent.pointerMove(grabber, { clientY: 200 })

    expect(trigger).toHaveBeenCalledWith('selection')

    fireEvent.pointerUp(grabber, { clientY: 200 })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('springs back to position and does not dismiss when dragged below threshold', () => {
    const onClose = vi.fn()
    const haptics = createMockHaptics()

    render(
      <ModalSheet
        isOpen={true}
        onClose={onClose}
        haptics={haptics}
        ariaLabel="Test Sheet"
      >
        <p>Sheet body content</p>
      </ModalSheet>,
    )

    const grabber = screen.getByRole('presentation', {
      name: 'Drag down to dismiss',
    })

    // Drag down only 30px (below 85px threshold)
    fireEvent.pointerDown(grabber, { clientY: 100, button: 0 })
    fireEvent.pointerMove(grabber, { clientY: 130 })
    fireEvent.pointerUp(grabber, { clientY: 130 })

    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when clicking backdrop', () => {
    const onClose = vi.fn()
    const { container } = render(
      <ModalSheet isOpen={true} onClose={onClose}>
        <p>Sheet body content</p>
      </ModalSheet>,
    )

    const backdrop = container.querySelector('.modal-backdrop')!
    fireEvent.click(backdrop)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when clicking inside the sheet content', () => {
    const onClose = vi.fn()
    render(
      <ModalSheet isOpen={true} onClose={onClose}>
        <button type="button">Inside Button</button>
      </ModalSheet>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Inside Button' }))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('ignores secondary button (right click) on grabber handle', () => {
    const onClose = vi.fn()
    const { trigger, haptics } = createMockHaptics()

    render(
      <ModalSheet isOpen={true} onClose={onClose} haptics={haptics}>
        <p>Modal content</p>
      </ModalSheet>,
    )

    const grabber = screen.getByRole('presentation', {
      name: 'Drag down to dismiss',
    })

    fireEvent.pointerDown(grabber, { clientY: 100, button: 2 })
    fireEvent.pointerMove(grabber, { clientY: 250 })
    fireEvent.pointerUp(grabber, { clientY: 250, button: 2 })

    expect(onClose).not.toHaveBeenCalled()
    expect(trigger).not.toHaveBeenCalled()
  })

  it('safely handles drag and dismiss without explicit haptics prop', () => {
    const onClose = vi.fn()
    render(
      <ModalSheet isOpen={true} onClose={onClose}>
        <p>Modal content</p>
      </ModalSheet>,
    )

    const grabber = screen.getByRole('presentation', {
      name: 'Drag down to dismiss',
    })

    fireEvent.pointerDown(grabber, { clientY: 100, button: 0 })
    fireEvent.pointerMove(grabber, { clientY: 200 })
    fireEvent.pointerUp(grabber, { clientY: 200 })

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
