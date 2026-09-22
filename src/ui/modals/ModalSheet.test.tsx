import { act, fireEvent, render, screen } from '@testing-library/react'
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
    const { container } = render(
      <ModalSheet isOpen={true} onClose={vi.fn()} ariaLabel="Test Sheet">
        <p>Sheet body content</p>
      </ModalSheet>,
    )

    expect(
      screen.getByRole('dialog', { name: 'Test Sheet' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Sheet body content')).toBeInTheDocument()
    const grabber = container.querySelector('.sheet-grabber-zone')
    expect(grabber).toBeInTheDocument()
    expect(grabber).toHaveAttribute('aria-hidden', 'true')
  })

  it('animates downward and calls onClose after 240ms exit animation when dragged down past threshold', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    const { trigger, haptics } = createMockHaptics()

    const { container } = render(
      <ModalSheet
        isOpen={true}
        onClose={onClose}
        haptics={haptics}
        ariaLabel="Test Sheet"
      >
        <p>Sheet body content</p>
      </ModalSheet>,
    )

    const grabber = container.querySelector('.sheet-grabber-zone')!
    const sheet = container.querySelector('.modal-sheet')!

    // Drag down 100px (past 85px threshold)
    fireEvent.pointerDown(grabber, { clientY: 100, button: 0 })
    fireEvent.pointerMove(grabber, { clientY: 200 })

    expect(trigger).toHaveBeenCalledWith('selection')

    fireEvent.pointerUp(grabber, { clientY: 200 })

    // Immediately after release: is-closing-sheet class applied, animate downward, onClose not yet called
    expect(sheet).toHaveClass('is-closing-sheet')
    expect(onClose).not.toHaveBeenCalled()

    // Advance through exit animation (240ms)
    vi.advanceTimersByTime(240)
    expect(onClose).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('springs back to position and does not dismiss when dragged below threshold', () => {
    const onClose = vi.fn()
    const haptics = createMockHaptics()

    const { container } = render(
      <ModalSheet
        isOpen={true}
        onClose={onClose}
        haptics={haptics}
        ariaLabel="Test Sheet"
      >
        <p>Sheet body content</p>
      </ModalSheet>,
    )

    const grabber = container.querySelector('.sheet-grabber-zone')!
    const sheet = container.querySelector('.modal-sheet')!

    // Drag down only 30px (below 85px threshold)
    fireEvent.pointerDown(grabber, { clientY: 100, button: 0 })
    fireEvent.pointerMove(grabber, { clientY: 130 })
    fireEvent.pointerUp(grabber, { clientY: 130 })

    expect(onClose).not.toHaveBeenCalled()
    // Snapback animates back to 0 with transition active
    expect(sheet).toHaveStyle({ transform: 'translateY(0px)' })
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

    const { container } = render(
      <ModalSheet isOpen={true} onClose={onClose} haptics={haptics}>
        <p>Modal content</p>
      </ModalSheet>,
    )

    const grabber = container.querySelector('.sheet-grabber-zone')!

    fireEvent.pointerDown(grabber, { clientY: 100, button: 2 })
    fireEvent.pointerMove(grabber, { clientY: 250 })
    fireEvent.pointerUp(grabber, { clientY: 250, button: 2 })

    expect(onClose).not.toHaveBeenCalled()
    expect(trigger).not.toHaveBeenCalled()
  })

  it('safely handles drag and dismiss without explicit haptics prop', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    const { container } = render(
      <ModalSheet isOpen={true} onClose={onClose}>
        <p>Modal content</p>
      </ModalSheet>,
    )

    const grabber = container.querySelector('.sheet-grabber-zone')!

    fireEvent.pointerDown(grabber, { clientY: 100, button: 0 })
    fireEvent.pointerMove(grabber, { clientY: 200 })
    fireEvent.pointerUp(grabber, { clientY: 200 })

    vi.advanceTimersByTime(240)
    expect(onClose).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('dismisses immediately without delay when prefers-reduced-motion is active', () => {
    vi.useFakeTimers()
    const hadMatchMedia = 'matchMedia' in window
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string): MediaQueryList => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    try {
      const onClose = vi.fn()
      const { container } = render(
        <ModalSheet
          isOpen={true}
          onClose={onClose}
          ariaLabel="Accessible Sheet"
        >
          <p>Modal content</p>
        </ModalSheet>,
      )

      const grabber = container.querySelector('.sheet-grabber-zone')!
      fireEvent.pointerDown(grabber, { clientY: 100, button: 0 })
      fireEvent.pointerMove(grabber, { clientY: 200 })
      fireEvent.pointerUp(grabber, { clientY: 200 })

      vi.advanceTimersByTime(0)
      expect(onClose).toHaveBeenCalledTimes(1)
    } finally {
      if (!hadMatchMedia) {
        delete (window as { matchMedia?: unknown }).matchMedia
      }
      vi.useRealTimers()
    }
  })

  it('updates --keyboard-inset style on backdrop when visualViewport reports keyboard occlusion', () => {
    type Listener = () => void
    const listeners: Record<string, Listener[]> = {}
    const mockVisualViewport = {
      height: 500,
      offsetTop: 0,
      addEventListener: vi.fn((event: string, cb: Listener) => {
        listeners[event] = listeners[event] || []
        listeners[event].push(cb)
      }),
      removeEventListener: vi.fn((event: string, cb: Listener) => {
        listeners[event] = (listeners[event] || []).filter((l) => l !== cb)
      }),
    }

    const originalInnerHeight = window.innerHeight
    const hadVisualViewport = 'visualViewport' in window
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 844,
    })
    Object.defineProperty(window, 'visualViewport', {
      writable: true,
      configurable: true,
      value: mockVisualViewport,
    })

    try {
      const { container, rerender } = render(
        <ModalSheet isOpen={true} onClose={vi.fn()}>
          <p>Sheet with keyboard awareness</p>
        </ModalSheet>,
      )

      const backdrop = container.querySelector('.modal-backdrop') as HTMLElement
      // 844 - (0 + 500) = 344px keyboard inset
      expect(backdrop.style.getPropertyValue('--keyboard-inset')).toBe('344px')
      expect(backdrop).toHaveClass('is-keyboard-open')

      // Simulate keyboard closing: visualViewport.height becomes 844
      mockVisualViewport.height = 844
      act(() => {
        listeners['resize']?.forEach((cb) => cb())
      })
      expect(backdrop.style.getPropertyValue('--keyboard-inset')).toBe('')
      expect(backdrop).not.toHaveClass('is-keyboard-open')

      // Simulate modal close: inset resets
      rerender(
        <ModalSheet isOpen={false} onClose={vi.fn()}>
          <p>Sheet closed</p>
        </ModalSheet>,
      )
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: originalInnerHeight,
      })
      if (!hadVisualViewport) {
        delete (window as { visualViewport?: unknown }).visualViewport
      }
    }
  })

  it('blurs active element to dismiss software keyboard when user touches the grabber bar', () => {
    const { container } = render(
      <ModalSheet isOpen={true} onClose={vi.fn()}>
        <input data-testid="test-input" />
      </ModalSheet>,
    )

    const input = screen.getByTestId('test-input')
    input.focus()
    expect(document.activeElement).toBe(input)

    const grabber = container.querySelector('.sheet-grabber-zone')!
    fireEvent.pointerDown(grabber, { clientY: 100, button: 0 })

    expect(document.activeElement).not.toBe(input)
  })
})
