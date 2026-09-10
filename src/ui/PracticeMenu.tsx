import { useEffect, useId, useRef, useState } from 'react'

export function PracticeMenu({
  onCards,
  onGrammar,
}: {
  onCards: () => void
  onGrammar: () => void
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const items = useRef<(HTMLButtonElement | null)[]>([])
  const initialItem = useRef(0)

  useEffect(() => {
    if (!open) return
    items.current[initialItem.current]?.focus()
    const dismiss = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !root.current?.contains(event.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

  return (
    <div
      className="practice-menu"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <button
        className="secondary-button practice-menu-trigger"
        ref={trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          initialItem.current = 0
          setOpen(!open)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            initialItem.current = event.key === 'ArrowUp' ? 1 : 0
            setOpen(true)
          }
        }}
      >
        Practice <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div
          className="practice-menu-options"
          id={id}
          role="menu"
          aria-label="Practice"
          onKeyDown={(event) => {
            if (
              event.altKey ||
              event.ctrlKey ||
              event.metaKey ||
              event.nativeEvent.isComposing
            )
              return
            const index = items.current.findIndex(
              (item) => item === document.activeElement,
            )
            let next: number
            switch (event.key) {
              case 'ArrowDown':
                next = (index + 1) % 2
                break
              case 'ArrowUp':
                next = (index + 1) % 2
                break
              case 'Home':
              case 'c':
              case 'C':
                next = 0
                break
              case 'End':
              case 'g':
              case 'G':
                next = 1
                break
              case 'Escape':
                event.preventDefault()
                event.stopPropagation()
                setOpen(false)
                trigger.current?.focus()
                return
              case 'Tab':
                if (event.shiftKey) {
                  event.preventDefault()
                  setOpen(false)
                  trigger.current?.focus()
                }
                return
              default:
                return
            }
            event.preventDefault()
            items.current[next]?.focus()
          }}
        >
          {[
            { label: 'Cards', action: onCards },
            { label: 'Grammar', action: onGrammar },
          ].map(({ label, action }, index) => (
            <button
              key={label}
              className="flat-choice"
              role="menuitem"
              tabIndex={-1}
              ref={(element) => {
                items.current[index] = element
              }}
              onClick={() => {
                setOpen(false)
                action()
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
