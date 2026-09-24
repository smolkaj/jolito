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

  it('triggers instant onInsert on touch pointerdown and prevents default blur', () => {
    const onInsert = vi.fn()
    render(<AccentToolbar onInsert={onInsert} />)

    const btn = screen.getByRole('button', { name: 'Insert ñ' })
    const pointerDownEvent = new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      pointerType: 'touch',
    })
    const preventDefaultSpy = vi.spyOn(pointerDownEvent, 'preventDefault')
    btn.dispatchEvent(pointerDownEvent)

    expect(preventDefaultSpy).toHaveBeenCalled()
    expect(onInsert).toHaveBeenCalledWith('ñ')
    expect(onInsert).toHaveBeenCalledTimes(1)

    // Deduplicate trailing synthetic click
    fireEvent.click(btn)
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
