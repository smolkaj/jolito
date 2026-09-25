import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ModalSheet } from './ModalSheet'
import { initKeyboardAvoidance } from '../../infrastructure/browser/keyboard-avoidance'
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

  it('inherits --keyboard-inset and is-keyboard-open state from root keyboard avoidance controller', () => {
    const controller = initKeyboardAvoidance()
    try {
      const { container } = render(
        <ModalSheet isOpen={true} onClose={vi.fn()}>
          <p>Sheet with global keyboard awareness</p>
        </ModalSheet>,
      )

      const backdrop = container.querySelector('.modal-backdrop') as HTMLElement
      expect(backdrop).toBeInTheDocument()

      // When keyboard shows via global avoidance system
      act(() => {
        window.dispatchEvent(
          new CustomEvent('keyboardWillShow', {
            detail: { keyboardHeight: 336 },
          }),
        )
      })

      expect(
        document.documentElement.style.getPropertyValue('--keyboard-inset'),
      ).toBe('336px')
      expect(document.documentElement).toHaveClass('is-keyboard-open')

      // When keyboard hides
      act(() => {
        window.dispatchEvent(new Event('keyboardWillHide'))
      })

      expect(
        document.documentElement.style.getPropertyValue('--keyboard-inset'),
      ).toBe('0px')
      expect(document.documentElement).not.toHaveClass('is-keyboard-open')
    } finally {
      controller.destroy()
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

  it('enforces architectural invariant that modal-sheet suppresses close buttons on mobile viewports', () => {
    const cssContent = readFileSync(
      resolve(process.cwd(), 'src/styles.css'),
      'utf-8',
    )
    const milestone2Marker =
      '/* Milestone 2: Draggable Bottom Sheets for Modals */'
    const milestone2Index = cssContent.indexOf(milestone2Marker)
    expect(milestone2Index).toBeGreaterThan(-1)

    const milestone2Section = cssContent.slice(milestone2Index)
    const mediaStartIndex = milestone2Section.indexOf(
      '@media (max-width: 680px)',
    )
    expect(mediaStartIndex).toBeGreaterThan(-1)

    // Slice to next milestone or closing section
    const milestone3Marker = '/* Milestone 3: Touch Feedback'
    const mediaEndIndex = milestone2Section.indexOf(milestone3Marker)
    const sheetMediaBlock = milestone2Section.slice(
      mediaStartIndex,
      mediaEndIndex,
    )

    // Verify .modal-sheet .modal-close is suppressed under max-width: 680px
    expect(sheetMediaBlock).toMatch(
      /\.modal-sheet\s+\.modal-close\s*\{[^}]*display:\s*none;/s,
    )
  })

  it('enforces that ModalSheet does not attach competing private keyboard listeners', () => {
    // Verifies architectural invariant: only initKeyboardAvoidance is the authority
    const { container, unmount } = render(
      <ModalSheet isOpen={true} onClose={vi.fn()}>
        <p>Single Authority Test</p>
      </ModalSheet>,
    )
    const backdrop = container.querySelector('.modal-backdrop') as HTMLElement
    expect(backdrop).toBeInTheDocument()
    // Backdrop relies on CSS inheritance for --keyboard-inset without inline style overrides
    expect(backdrop.style.getPropertyValue('--keyboard-inset')).toBe('')
    unmount()
  })

  it('enforces architectural invariant that modal styles respond to global keyboard state', () => {
    const cssContent = readFileSync(
      resolve(process.cwd(), 'src/styles.css'),
      'utf-8',
    )

    // Verify .modal-backdrop uses var(--keyboard-inset, 0px)
    expect(cssContent).toMatch(
      /\.modal-backdrop\s*\{[^}]*padding-bottom:\s*var\(--keyboard-inset,\s*0px\)/s,
    )

    // Verify modal sheet adjusts padding when keyboard is open
    expect(cssContent).toMatch(
      /(?:html\[data-keyboard-open=['"]true['"]\]\s*\.modal-content\.modal-sheet|\.is-keyboard-open\s*\.modal-content\.modal-sheet)[\s\S]*?padding-bottom:\s*20px\s*!important;/,
    )
  })

  it('enforces architectural invariant that modal-backdrop has smooth padding-bottom transition with reduced motion override', () => {
    const cssContent = readFileSync(
      resolve(process.cwd(), 'src/styles.css'),
      'utf-8',
    )

    // Base modal-backdrop transition
    expect(cssContent).toMatch(
      /\.modal-backdrop\s*\{[^}]*transition:\s*padding-bottom\s+240ms/s,
    )

    // Reduced motion suppression
    const reducedMotionMarker = '@media (prefers-reduced-motion: reduce)'
    const index = cssContent.lastIndexOf(reducedMotionMarker)
    expect(index).toBeGreaterThan(-1)
    const block = cssContent.slice(index)
    expect(block).toMatch(
      /\.modal-backdrop,\s*\.modal-content\.modal-sheet\s*\{[^}]*transition:\s*none\s*!important;/s,
    )
  })

  it('animates downward and calls onClose when dragged from modal-header on mobile', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    const { trigger, haptics } = createMockHaptics()

    const { container } = render(
      <ModalSheet isOpen={true} onClose={onClose} haptics={haptics}>
        <div className="modal-header">
          <div className="modal-header-copy">
            <h2 id="feedback-title">Share feedback</h2>
            <p className="modal-subtitle">Your note helps us improve Jolito.</p>
          </div>
        </div>
      </ModalSheet>,
    )

    const header = container.querySelector('.modal-header')!
    const sheet = container.querySelector('.modal-sheet')!

    fireEvent.pointerDown(header, { clientY: 100, button: 0 })
    fireEvent.pointerMove(header, { clientY: 210 })

    expect(trigger).toHaveBeenCalledWith('selection')

    fireEvent.pointerUp(header, { clientY: 210 })
    expect(sheet).toHaveClass('is-closing-sheet')
    expect(onClose).not.toHaveBeenCalled()

    vi.advanceTimersByTime(240)
    expect(onClose).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('springs back to position when dragged from modal-header below threshold', () => {
    const onClose = vi.fn()
    const haptics = createMockHaptics()

    const { container } = render(
      <ModalSheet isOpen={true} onClose={onClose} haptics={haptics}>
        <div className="modal-header">
          <h2>Share feedback</h2>
        </div>
      </ModalSheet>,
    )

    const title = screen.getByRole('heading', { name: 'Share feedback' })
    const sheet = container.querySelector('.modal-sheet')!

    fireEvent.pointerDown(title, { clientY: 100, button: 0 })
    fireEvent.pointerMove(title, { clientY: 140 })
    fireEvent.pointerUp(title, { clientY: 140 })

    expect(onClose).not.toHaveBeenCalled()
    expect(sheet).toHaveStyle({ transform: 'translateY(0px)' })
  })

  it('allows button clicks inside modal-header without triggering drag dismissal', () => {
    const onBack = vi.fn()
    const onClose = vi.fn()

    const { container } = render(
      <ModalSheet isOpen={true} onClose={onClose}>
        <div className="modal-header">
          <button type="button" onClick={onBack}>
            ← All packs
          </button>
          <h2>Starter Pack</h2>
        </div>
      </ModalSheet>,
    )

    const button = screen.getByRole('button', { name: '← All packs' })
    const sheet = container.querySelector('.modal-sheet')!

    fireEvent.pointerDown(button, { clientY: 100, button: 0 })
    fireEvent.pointerMove(button, { clientY: 250 })
    fireEvent.pointerUp(button, { clientY: 250 })
    fireEvent.click(button)

    expect(onBack).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(sheet).not.toHaveClass('is-closing-sheet')
  })

  it('ignores dragging from modal-header when on desktop viewport (min-width: 681px)', () => {
    const onClose = vi.fn()
    const originalMatchMedia =
      typeof window.matchMedia === 'function'
        ? window.matchMedia.bind(window)
        : undefined
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string): MediaQueryList => ({
        matches: query.includes('min-width: 681px'),
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
      const { container } = render(
        <ModalSheet isOpen={true} onClose={onClose}>
          <div className="modal-header">
            <h2>Desktop Dialog Header</h2>
          </div>
        </ModalSheet>,
      )

      const header = container.querySelector('.modal-header')!
      const sheet = container.querySelector('.modal-sheet')!

      fireEvent.pointerDown(header, { clientY: 100, button: 0 })
      fireEvent.pointerMove(header, { clientY: 250 })
      fireEvent.pointerUp(header, { clientY: 250 })

      expect(sheet).not.toHaveClass('is-closing-sheet')
      expect(onClose).not.toHaveBeenCalled()
    } finally {
      if (originalMatchMedia) {
        window.matchMedia = originalMatchMedia
      } else {
        delete (window as { matchMedia?: unknown }).matchMedia
      }
    }
  })

  it('blurs active element to dismiss software keyboard when user touches modal-header', () => {
    const { container } = render(
      <ModalSheet isOpen={true} onClose={vi.fn()}>
        <div className="modal-header">
          <h2>Share feedback</h2>
        </div>
        <input data-testid="active-field" />
      </ModalSheet>,
    )

    const input = screen.getByTestId('active-field')
    input.focus()
    expect(document.activeElement).toBe(input)

    const header = container.querySelector('.modal-header')!
    fireEvent.pointerDown(header, { clientY: 100, button: 0 })

    expect(document.activeElement).not.toBe(input)
  })

  it('enforces architectural invariant that modal-sheet modal-header has touch-action none on mobile viewports', () => {
    const cssContent = readFileSync(
      resolve(process.cwd(), 'src/styles.css'),
      'utf-8',
    )
    const milestone2Marker =
      '/* Milestone 2: Draggable Bottom Sheets for Modals */'
    const milestone2Index = cssContent.indexOf(milestone2Marker)
    expect(milestone2Index).toBeGreaterThan(-1)

    const milestone2Section = cssContent.slice(milestone2Index)
    const mediaStartIndex = milestone2Section.indexOf(
      '@media (max-width: 680px)',
    )
    expect(mediaStartIndex).toBeGreaterThan(-1)

    const milestone3Marker = '/* Milestone 3: Touch Feedback'
    const mediaEndIndex = milestone2Section.indexOf(milestone3Marker)
    const sheetMediaBlock = milestone2Section.slice(
      mediaStartIndex,
      mediaEndIndex,
    )

    // Verify .modal-sheet .modal-header has touch-action: none and cursor: grab
    expect(sheetMediaBlock).toMatch(
      /\.modal-sheet\s+\.modal-header\s*\{[^}]*touch-action:\s*none;/s,
    )
    expect(sheetMediaBlock).toMatch(
      /\.modal-sheet\s+\.modal-header\s*\{[^}]*cursor:\s*grab;/s,
    )
  })
})
