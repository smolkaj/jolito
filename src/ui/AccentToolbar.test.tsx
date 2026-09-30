import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { HapticsPlayer, SoundPlayer } from '../application/ports'
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
    render(<AccentToolbar onInsert={onInsert} isDocked={true} />)

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

  it('allows touch-scrubbing across keys to correct selection before release', () => {
    const onInsert = vi.fn()
    const trigger = vi.fn()
    const play = vi.fn()
    const haptics: HapticsPlayer = { trigger }
    const sounds: SoundPlayer = { play }
    render(
      <AccentToolbar onInsert={onInsert} haptics={haptics} sounds={sounds} />,
    )

    const btnA = screen.getByRole('button', { name: 'Insert á' })
    const btnE = screen.getByRole('button', { name: 'Insert é' })

    vi.spyOn(btnA, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      right: 50,
      top: 100,
      bottom: 144,
      width: 40,
      height: 44,
      x: 10,
      y: 100,
      toJSON: () => {},
    })
    vi.spyOn(btnE, 'getBoundingClientRect').mockReturnValue({
      left: 54,
      right: 94,
      top: 100,
      bottom: 144,
      width: 40,
      height: 44,
      x: 54,
      y: 100,
      toJSON: () => {},
    })

    // 1. Initial touch down on 'á'
    fireEvent(
      btnA,
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 100,
        clientX: 30,
        clientY: 120,
      }),
    )

    expect(btnA).toHaveClass('is-pressed')
    expect(btnE).not.toHaveClass('is-pressed')
    expect(document.querySelector('.accent-key-popup')).toHaveTextContent('á')
    expect(trigger).toHaveBeenCalledWith('selection')
    expect(play).toHaveBeenCalledWith('click')

    // 2. Slide finger across to 'é' pre-release (correcting selection)
    fireEvent(
      btnA,
      new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 100,
        clientX: 74,
        clientY: 120,
      }),
    )

    expect(btnA).not.toHaveClass('is-pressed')
    expect(btnE).toHaveClass('is-pressed')
    expect(document.querySelector('.accent-key-popup')).toHaveTextContent('é')
    expect(trigger).toHaveBeenCalledTimes(2)
    expect(play).toHaveBeenCalledTimes(2)

    // Not yet inserted while finger is held down
    expect(onInsert).not.toHaveBeenCalled()

    // 3. Release finger over 'é'
    fireEvent(
      btnA,
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 100,
        clientX: 74,
        clientY: 120,
      }),
    )

    // Fires only upon release with the corrected character!
    expect(onInsert).toHaveBeenCalledWith('é')
    expect(onInsert).toHaveBeenCalledTimes(1)
    expect(btnE).not.toHaveClass('is-pressed')
    expect(document.querySelector('.accent-key-popup')).toBeNull()
  })

  it('suppresses onInsert when a touch gesture slides vertically away from the toolbar to cancel', () => {
    const onInsert = vi.fn()
    render(<AccentToolbar onInsert={onInsert} />)

    const btn = screen.getByRole('button', { name: 'Insert ¿' })

    // Touch down on '¿'
    fireEvent(
      btn,
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 2,
        clientX: 100,
        clientY: 100,
      }),
    )
    expect(btn).toHaveClass('is-pressed')

    // Slide vertically away (>35px) to cancel
    fireEvent(
      btn,
      new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 2,
        clientX: 100,
        clientY: 50,
      }),
    )

    expect(btn).not.toHaveClass('is-pressed')
    expect(document.querySelector('.accent-key-popup')).toBeNull()

    // Release after sliding away does not insert
    fireEvent(
      btn,
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 2,
        clientX: 100,
        clientY: 50,
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

  it('supports subsequent clean taps after an aborted vertical slide gesture', () => {
    const onInsert = vi.fn()
    render(<AccentToolbar onInsert={onInsert} />)

    const btn = screen.getByRole('button', { name: 'Insert é' })

    // Aborted gesture (slid vertically away >35px)
    fireEvent(
      btn,
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 5,
        clientX: 10,
        clientY: 100,
      }),
    )
    fireEvent(
      btn,
      new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 5,
        clientX: 10,
        clientY: 50,
      }),
    )
    fireEvent(
      btn,
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 5,
        clientX: 10,
        clientY: 50,
      }),
    )
    expect(onInsert).not.toHaveBeenCalled()

    // Subsequent intentional tap
    fireEvent(
      btn,
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 6,
        clientX: 10,
        clientY: 100,
      }),
    )
    fireEvent(
      btn,
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 6,
        clientX: 10,
        clientY: 100,
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

  it('supports rapid overlapping two-thumb typing without dropping keypresses', () => {
    const onInsert = vi.fn()
    render(<AccentToolbar onInsert={onInsert} isDocked={true} />)

    const btnA = screen.getByRole('button', { name: 'Insert á' })
    const btnE = screen.getByRole('button', { name: 'Insert é' })

    // Thumb 1 lands on 'á'
    btnA.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 20,
        clientX: 20,
        clientY: 20,
      }),
    )

    // Thumb 2 lands on 'é' while Thumb 1 is still touching glass
    btnE.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 21,
        clientX: 60,
        clientY: 20,
      }),
    )

    // Thumb 1 lifts up
    btnA.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 20,
        clientX: 22,
        clientY: 21,
      }),
    )
    expect(onInsert).toHaveBeenCalledWith('á')

    // Thumb 2 lifts up
    btnE.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 21,
        clientX: 61,
        clientY: 20,
      }),
    )
    expect(onInsert).toHaveBeenCalledWith('é')
    expect(onInsert).toHaveBeenCalledTimes(2)
  })

  it('gates pointerdown preventDefault strictly to docked toolbar, leaving inline mode unprevented for natural scrolling', () => {
    const onInsert = vi.fn()

    // 1. Inline toolbar does not call preventDefault on pointerdown
    const { unmount } = render(
      <AccentToolbar onInsert={onInsert} isDocked={false} />,
    )
    const inlineBtn = screen.getByRole('button', { name: 'Insert í' })
    const inlinePointerDown = new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      pointerType: 'touch',
      pointerId: 30,
    })
    const inlineSpy = vi.spyOn(inlinePointerDown, 'preventDefault')
    inlineBtn.dispatchEvent(inlinePointerDown)
    expect(inlineSpy).not.toHaveBeenCalled()
    unmount()

    // 2. Docked toolbar calls preventDefault on pointerdown
    render(<AccentToolbar onInsert={onInsert} isDocked={true} />)
    const dockedBtn = screen.getByRole('button', { name: 'Insert í' })
    const dockedPointerDown = new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      pointerType: 'touch',
      pointerId: 31,
    })
    const dockedSpy = vi.spyOn(dockedPointerDown, 'preventDefault')
    dockedBtn.dispatchEvent(dockedPointerDown)
    expect(dockedSpy).toHaveBeenCalled()
  })

  it('provides immediate haptic and acoustic feedback on pointerdown', () => {
    const onInsert = vi.fn()
    const trigger = vi.fn()
    const play = vi.fn()
    const haptics: HapticsPlayer = { trigger }
    const sounds: SoundPlayer = { play }

    render(
      <AccentToolbar onInsert={onInsert} haptics={haptics} sounds={sounds} />,
    )

    const btn = screen.getByRole('button', { name: 'Insert á' })
    const pointerDown = new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      pointerType: 'touch',
      pointerId: 40,
      clientX: 50,
      clientY: 50,
    })
    btn.dispatchEvent(pointerDown)

    expect(trigger).toHaveBeenCalledWith('selection')
    expect(trigger).toHaveBeenCalledTimes(1)
    expect(play).toHaveBeenCalledWith('click')
    expect(play).toHaveBeenCalledTimes(1)
    expect(onInsert).not.toHaveBeenCalled()
  })

  it('renders key preview popup callout and is-pressed state on pointerdown, and clears them on pointerup', () => {
    const onInsert = vi.fn()
    render(<AccentToolbar onInsert={onInsert} />)

    const btn = screen.getByRole('button', { name: 'Insert é' })
    expect(btn).not.toHaveClass('is-pressed')
    expect(document.querySelector('.accent-key-popup')).toBeNull()

    const pointerDown = new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      pointerType: 'touch',
      pointerId: 41,
      clientX: 50,
      clientY: 50,
    })
    fireEvent(btn, pointerDown)

    expect(btn).toHaveClass('is-pressed')
    const popup = document.querySelector('.accent-key-popup')
    expect(popup).not.toBeNull()
    expect(popup).toHaveTextContent('é')

    // Clean pointerup clears popup and is-pressed
    const pointerUp = new PointerEvent('pointerup', {
      bubbles: true,
      cancelable: true,
      pointerType: 'touch',
      pointerId: 41,
      clientX: 50,
      clientY: 50,
    })
    fireEvent(btn, pointerUp)

    expect(btn).not.toHaveClass('is-pressed')
    expect(document.querySelector('.accent-key-popup')).toBeNull()
    expect(onInsert).toHaveBeenCalledWith('é')
  })

  it('clears key preview popup and is-pressed state when sliding vertically away from toolbar', () => {
    const onInsert = vi.fn()
    render(<AccentToolbar onInsert={onInsert} />)

    const btn = screen.getByRole('button', { name: 'Insert ú' })
    fireEvent(
      btn,
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 42,
        clientX: 100,
        clientY: 100,
      }),
    )

    expect(btn).toHaveClass('is-pressed')
    expect(document.querySelector('.accent-key-popup')).toHaveTextContent('ú')

    // Slide vertically away (>35px)
    fireEvent(
      btn,
      new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 42,
        clientX: 100,
        clientY: 50,
      }),
    )

    expect(btn).not.toHaveClass('is-pressed')
    expect(document.querySelector('.accent-key-popup')).toBeNull()

    // Up after sliding away should not insert
    fireEvent(
      btn,
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 42,
        clientX: 100,
        clientY: 50,
      }),
    )
    expect(onInsert).not.toHaveBeenCalled()
  })

  it('flashes key preview popup and is-pressed state when activeShortcut pulse arrives, including consecutive same-key presses', () => {
    vi.useFakeTimers()
    const onInsert = vi.fn()
    const { rerender } = render(
      <AccentToolbar onInsert={onInsert} activeShortcut={null} />,
    )

    const btn = screen.getByRole('button', { name: 'Insert ñ' })
    expect(btn).not.toHaveClass('is-pressed')
    expect(document.querySelector('.accent-key-popup')).toBeNull()

    // 1. First shortcut press
    rerender(
      <AccentToolbar
        onInsert={onInsert}
        activeShortcut={{ char: 'ñ', token: 1 }}
      />,
    )

    expect(btn).toHaveClass('is-pressed')
    expect(document.querySelector('.accent-key-popup')).toHaveTextContent('ñ')

    // After timeout, it clears
    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(btn).not.toHaveClass('is-pressed')
    expect(document.querySelector('.accent-key-popup')).toBeNull()

    // 2. Immediate second press of the EXACT SAME key ('ñ')
    rerender(
      <AccentToolbar
        onInsert={onInsert}
        activeShortcut={{ char: 'ñ', token: 2 }}
      />,
    )

    expect(btn).toHaveClass('is-pressed')
    expect(document.querySelector('.accent-key-popup')).toHaveTextContent('ñ')

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(btn).not.toHaveClass('is-pressed')
    expect(document.querySelector('.accent-key-popup')).toBeNull()

    vi.useRealTimers()
  })

  it('suppresses key preview popups and pressed state when disabled', () => {
    vi.useFakeTimers()
    const onInsert = vi.fn()
    render(
      <AccentToolbar
        onInsert={onInsert}
        disabled={true}
        activeShortcut={{ char: 'á', token: 1 }}
      />,
    )

    const btn = screen.getByRole('button', { name: 'Insert á' })
    expect(btn).not.toHaveClass('is-pressed')
    expect(document.querySelector('.accent-key-popup')).toBeNull()

    // Pointerdown while disabled does not show popup or set pressed
    fireEvent(
      btn,
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        pointerId: 50,
      }),
    )

    expect(btn).not.toHaveClass('is-pressed')
    expect(document.querySelector('.accent-key-popup')).toBeNull()
    vi.useRealTimers()
  })
})
