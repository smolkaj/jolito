import {
  type ReviewSchedule,
  cardMemoryIndicators,
  cardDifficultyLabel,
  cardMasteryLabel,
} from '../domain/card'
import { ChiliIcon } from './icons'

export interface MasteryBubblesProps {
  level: 0 | 1 | 2 | 3
  size?: number
  className?: string
  ariaLabel?: string
  ariaHidden?: boolean
  title?: string
}

export type ProgressBubblesProps = MasteryBubblesProps

export function MasteryBubbles({
  level,
  size = 42,
  className = '',
  ariaLabel,
  ariaHidden = false,
  title,
}: MasteryBubblesProps) {
  const safeLevel = Math.max(0, Math.min(3, level)) as 0 | 1 | 2 | 3
  const label = ariaLabel ?? cardMasteryLabel(safeLevel)

  const resolvedTitle =
    title !== undefined ? title : ariaHidden ? undefined : label

  return (
    <span
      className={`progress-bubbles level-${safeLevel} ${className}`.trim()}
      role={ariaHidden ? undefined : 'img'}
      aria-label={ariaHidden ? undefined : label}
      aria-hidden={ariaHidden ? true : undefined}
      title={resolvedTitle}
    >
      <svg
        viewBox="0 0 42 13"
        width={size}
        height={Math.round((size * 13) / 42)}
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="7"
          cy="6.5"
          r="4.25"
          className={`bubble-dot ${safeLevel >= 1 ? 'is-filled' : 'is-empty'}`}
          fill={safeLevel >= 1 ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.3"
        />
        <circle
          cx="21"
          cy="6.5"
          r="4.25"
          className={`bubble-dot ${safeLevel >= 2 ? 'is-filled' : 'is-empty'}`}
          fill={safeLevel >= 2 ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.3"
        />
        <circle
          cx="35"
          cy="6.5"
          r="4.25"
          className={`bubble-dot ${safeLevel >= 3 ? 'is-filled' : 'is-empty'}`}
          fill={safeLevel >= 3 ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.3"
        />
      </svg>
    </span>
  )
}

export const ProgressBubbles = MasteryBubbles

export interface ChiliMeterProps {
  level: 0 | 1 | 2 | 3
  size?: number
  className?: string
  ariaLabel?: string
  ariaHidden?: boolean
  hideWhenZero?: boolean
  title?: string
}

export function ChiliMeter({
  level,
  size = 13,
  className = '',
  ariaLabel,
  ariaHidden = false,
  title,
}: ChiliMeterProps) {
  const safeLevel = Math.max(0, Math.min(3, level)) as 0 | 1 | 2 | 3

  const label = ariaLabel ?? cardDifficultyLabel(safeLevel)
  const resolvedTitle =
    title !== undefined ? title : ariaHidden ? undefined : label

  return (
    <span
      className={`chili-meter level-${safeLevel} ${className}`.trim()}
      role={ariaHidden ? undefined : 'img'}
      aria-label={ariaHidden ? undefined : label}
      aria-hidden={ariaHidden ? true : undefined}
      title={resolvedTitle}
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
  ariaHidden?: boolean
}

export function MemoryIndicators({
  schedule,
  className = '',
  compact = false,
  ariaHidden = false,
}: MemoryIndicatorsProps) {
  const indicators = cardMemoryIndicators(schedule)

  return (
    <div
      className={`memory-indicators ${compact ? 'is-compact' : ''} ${className}`.trim()}
    >
      <ChiliMeter
        level={indicators.difficulty}
        ariaLabel={indicators.difficultyLabel}
        title={indicators.difficultyLabel}
        ariaHidden={ariaHidden}
      />
      <MasteryBubbles
        level={indicators.mastery}
        ariaLabel={indicators.masteryLabel}
        title={indicators.masteryLabel}
        ariaHidden={ariaHidden}
      />
    </div>
  )
}
