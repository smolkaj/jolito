import { useEffect, useRef, type ReactNode } from 'react'
import celebrateUrl from '../../assets/jolito-celebrate.webp'
import { formatPracticedSummary } from '../domain/study-session'

export function SessionComplete({
  practicedCount,
  unit,
  demo = false,
  emptyMessage,
  primaryAction,
  onHome,
  children,
}: {
  practicedCount: number
  unit: 'card' | 'form'
  demo?: boolean
  emptyMessage: string
  primaryAction: { label: string; onClick: () => void }
  onHome: () => void
  children?: ReactNode
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])
  return (
    <section className="complete-card">
      <div className="complete-mascot-frame" aria-hidden="true">
        <img src={celebrateUrl} alt="" className="complete-mascot-img" />
      </div>
      <p className="eyebrow">
        {demo ? 'DEMO SESSION COMPLETE' : 'SESSION COMPLETE'}
      </p>
      <h1 ref={heading} tabIndex={-1}>
        {practicedCount > 0 ? '¡Hecho!' : 'You’re caught up.'}
      </h1>
      <div className="complete-copy">
        <p>
          {practicedCount > 0
            ? `${formatPracticedSummary(practicedCount, unit)}.`
            : emptyMessage}
        </p>
        {children}
      </div>
      <div className="complete-actions">
        <button className="primary-button" onClick={primaryAction.onClick}>
          {primaryAction.label} <span aria-hidden="true">→</span>
        </button>
        <button className="secondary-button" onClick={onHome}>
          Back home
        </button>
      </div>
    </section>
  )
}
