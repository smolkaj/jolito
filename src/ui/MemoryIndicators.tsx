import { type ReviewSchedule, cardMemoryIndicators } from '../domain/card'
import { ChiliIcon } from './icons'

export interface ProgressBubblesProps {
  level: 0 | 1 | 2 | 3
  size?: number
  className?: string
  ariaLabel?: string
  ariaHidden?: boolean
}

export function ProgressBubbles({
  level,
  size = 28,
  className = '',
  ariaLabel,
  ariaHidden = false,
}: ProgressBubblesProps) {
  const safeLevel = Math.max(0, Math.min(3, level)) as 0 | 1 | 2 | 3
  const label = ariaLabel ?? `Progress: ${safeLevel} of 3 bubbles`

  return (
    <span
      className={`progress-bubbles level-${safeLevel} ${className}`.trim()}
      role={ariaHidden ? undefined : 'img'}
      aria-label={ariaHidden ? undefined : label}
      aria-hidden={ariaHidden ? true : undefined}
      title={label}
    >
      <svg
        viewBox="0 0 29 9"
        width={size}
        height={Math.round((size * 9) / 29)}
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="4.5"
          cy="4.5"
          r="3.5"
          className={`bubble-dot ${safeLevel >= 1 ? 'is-filled' : 'is-empty'}`}
          fill={safeLevel >= 1 ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <circle
          cx="14.5"
          cy="4.5"
          r="3.5"
          className={`bubble-dot ${safeLevel >= 2 ? 'is-filled' : 'is-empty'}`}
          fill={safeLevel >= 2 ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <circle
          cx="24.5"
          cy="4.5"
          r="3.5"
          className={`bubble-dot ${safeLevel >= 3 ? 'is-filled' : 'is-empty'}`}
          fill={safeLevel >= 3 ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.2"
        />
      </svg>
    </span>
  )
}

export interface ChiliMeterProps {
  level: 0 | 1 | 2 | 3
  size?: number
  className?: string
  ariaLabel?: string
  ariaHidden?: boolean
  hideWhenZero?: boolean
}

export function ChiliMeter({
  level,
  size = 13,
  className = '',
  ariaLabel,
  ariaHidden = false,
  hideWhenZero = false,
}: ChiliMeterProps) {
  const safeLevel = Math.max(0, Math.min(3, level)) as 0 | 1 | 2 | 3

  if (hideWhenZero && safeLevel === 0) {
    return null
  }

  const label =
    ariaLabel ??
    (safeLevel === 0
      ? 'Difficulty: 0 of 3 chilies (no heat)'
      : `Difficulty: ${safeLevel} of 3 chilies`)

  return (
    <span
      className={`chili-meter level-${safeLevel} ${className}`.trim()}
      role={ariaHidden ? undefined : 'img'}
      aria-label={ariaHidden ? undefined : label}
      aria-hidden={ariaHidden ? true : undefined}
      title={label}
    >
      <ChiliIcon
        size={size}
        filled={safeLevel >= 1}
        className={safeLevel < 1 ? 'is-dimmed' : ''}
      />
      <ChiliIcon
        size={size}
        filled={safeLevel >= 2}
        className={safeLevel < 2 ? 'is-dimmed' : ''}
      />
      <ChiliIcon
        size={size}
        filled={safeLevel >= 3}
        className={safeLevel < 3 ? 'is-dimmed' : ''}
      />
    </span>
  )
}

export interface MemoryIndicatorsProps {
  schedule: ReviewSchedule
  className?: string
  compact?: boolean
}

export function MemoryIndicators({
  schedule,
  className = '',
  compact = false,
}: MemoryIndicatorsProps) {
  const indicators = cardMemoryIndicators(schedule)

  return (
    <div
      className={`memory-indicators ${compact ? 'is-compact' : ''} ${className}`.trim()}
    >
      <ProgressBubbles
        level={indicators.progress}
        ariaLabel={indicators.progressLabel}
      />
      <ChiliMeter
        level={indicators.difficulty}
        ariaLabel={indicators.difficultyLabel}
        hideWhenZero={compact}
      />
    </div>
  )
}
