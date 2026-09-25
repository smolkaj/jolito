import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AccentToolbar } from './AccentToolbar'
import { SPANISH_ACCENT_CHARACTERS } from './accent-characters'

describe('AccentToolbar', () => {
  it('renders all Spanish accent and punctuation characters', () => {
    const onInsert = vi.fn()
    render(<AccentToolbar onInsert={onInsert} />)

    const toolbar = screen.getByRole('toolbar', { name: 'Spanish accents' })
    expect(toolbar).toBeInTheDocument()

    for (const char of SPANISH_ACCENT_CHARACTERS) {
      expect(
        screen.getByRole('button', { name: `Insert ${char}` }),
      ).toBeInTheDocument()
    }
  })

  it('triggers onInsert when button is clicked via mouse and prevents input blur', () => {
    const onInsert = vi.fn()
    render(<AccentToolbar onInsert={onInsert} />)

    const btn = screen.getByRole('button', { name: 'Insert á' })
    const mousedownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0,
    })
    const preventDefaultSpy = vi.spyOn(mousedownEvent, 'preventDefault')
    btn.dispatchEvent(mousedownEvent)
    expect(preventDefaultSpy).toHaveBeenCalled()

    fireEvent.click(btn)
    expect(onInsert).toHaveBeenCalledWith('á')
    expect(onInsert).toHaveBeenCalledTimes(1)
  })

  it('triggers onInsert on clean touch tap (pointerdown followed by pointerup) and prevents default blur', () => {
    const onInsert = vi.fn()
    render(<AccentToolbar onInsert={onInsert} />)

    const btn = screen.getByRole('button', { name: 'Insert ñ' })
    const pointerDownEvent = new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      pointerType: 'touch',
      pointerId: 1,
      clientX: 50,
      clientY: 50,
    })
    const preventDefaultSpy = vi.spyOn(pointerDownEvent, 'preventDefault')
    btn.dispatchEvent(pointerDownEvent)

    // Touch down must prevent default blur to keep software keyboard active
    expect(preventDefaultSpy).toHaveBeenCalled()
    // Touch down must NOT prematurely insert character before gesture intent is known
    expect(onInsert).not.toHaveBeenCalled()

    // Clean tap releases at same position without dragging
    const pointerUpEvent = new PointerEvent('pointerup', {
      bubbles: true,
      cancelable: true,
      pointerType: 'touch',
      pointerId: 1,
      clientX: 51,
      clientY: 51,
    })
    btn.dispatchEvent(pointerUpEvent)

    expect(onInsert).toHaveBeenCalledWith('ñ')
    expect(onInsert).toHaveBeenCalledTimes(1)

    // Deduplicate trailing synthetic click
    fireEvent.click(btn)
    expect(onInsert).toHaveBeenCalledTimes(1)
  })

  it('suppresses onInsert when a touch gesture is a horizontal or vertical drag', () => {
    const onInsert = vi.fn()
    render(<AccentToolbar onInsert={onInsert} />)

    const btn = screen.getByRole('button', { name: 'Insert ¿' })

    // 1. Horizontal drag (e.g. scrolling the toolbar)
    btn.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 2,
        clientX: 100,
        clientY: 50,
      }),
    )
    btn.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 2,
        clientX: 125,
        clientY: 50,
      }),
    )
    btn.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 2,
        clientX: 125,
        clientY: 50,
      }),
    )

    expect(onInsert).not.toHaveBeenCalled()

    // 2. Vertical drag (e.g. card swipe up)
    btn.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 3,
        clientX: 100,
        clientY: 50,
      }),
    )
    btn.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 3,
        clientX: 100,
        clientY: 20,
      }),
    )
    btn.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 3,
        clientX: 100,
        clientY: 20,
      }),
    )

    expect(onInsert).not.toHaveBeenCalled()
  })

  it('cancels touch insertion on pointercancel', () => {
    const onInsert = vi.fn()
    render(<AccentToolbar onInsert={onInsert} />)

    const btn = screen.getByRole('button', { name: 'Insert á' })
    btn.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 4,
        clientX: 40,
        clientY: 40,
      }),
    )
    btn.dispatchEvent(
      new PointerEvent('pointercancel', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 4,
      }),
    )
    btn.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 4,
        clientX: 40,
        clientY: 40,
      }),
    )

    expect(onInsert).not.toHaveBeenCalled()
  })

  it('supports subsequent clean taps after an interrupted drag gesture', () => {
    const onInsert = vi.fn()
    render(<AccentToolbar onInsert={onInsert} />)

    const btn = screen.getByRole('button', { name: 'Insert é' })

    // Interrupted drag gesture
    btn.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 5,
        clientX: 10,
        clientY: 10,
      }),
    )
    btn.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 5,
        clientX: 40,
        clientY: 10,
      }),
    )
    btn.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 5,
        clientX: 40,
        clientY: 10,
      }),
    )
    expect(onInsert).not.toHaveBeenCalled()

    // Subsequent intentional tap
    btn.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 6,
        clientX: 10,
        clientY: 10,
      }),
    )
    btn.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 6,
        clientX: 10,
        clientY: 10,
      }),
    )
    expect(onInsert).toHaveBeenCalledWith('é')
    expect(onInsert).toHaveBeenCalledTimes(1)
  })

  it('does not trigger onInsert when disabled', () => {
    const onInsert = vi.fn()
    render(<AccentToolbar onInsert={onInsert} disabled={true} />)

    const btn = screen.getByRole('button', { name: 'Insert é' })
    expect(btn).toBeDisabled()

    const pointerDownEvent = new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      pointerType: 'touch',
    })
    btn.dispatchEvent(pointerDownEvent)
    fireEvent.click(btn)

    expect(onInsert).not.toHaveBeenCalled()
  })

  it('applies docked styling and keyboard inset CSS property', () => {
    const onInsert = vi.fn()
    render(
      <AccentToolbar onInsert={onInsert} isDocked={true} keyboardInset={290} />,
    )

    const toolbar = screen.getByRole('toolbar', { name: 'Spanish accents' })
    expect(toolbar).toHaveClass('is-docked')
    expect(toolbar).toHaveStyle({ '--keyboard-inset': '290px' })
  })
})
