import {
  grades,
  intervalLabel,
  type Grade,
  type StudyCard,
} from '../domain/card'

const labels: Record<Grade, string> = {
  again: 'Again',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
}

export function ReviewGrades({
  card,
  onGrade,
  activeZone,
  dragOffset,
  prefersReducedMotion = false,
}: {
  card: StudyCard
  onGrade: (grade: Grade) => void
  activeZone?: Grade | null
  dragOffset?: { x: number; y: number }
  prefersReducedMotion?: boolean
}) {
  const isDraggingAgain = Boolean(dragOffset && dragOffset.x < 0)
  const isDraggingGood = Boolean(dragOffset && dragOffset.x > 0)
  const isAgainActive = activeZone === 'again'
  const isGoodActive = activeZone === 'good'

  const arrowAgainTransform = prefersReducedMotion
    ? undefined
    : isDraggingAgain && dragOffset
      ? `${isAgainActive ? 'scale(1.2) ' : ''}translateX(${Math.max(-8, dragOffset.x * 0.08)}px)`.trim()
      : isAgainActive
        ? 'scale(1.2)'
        : undefined

  const arrowGoodTransform = prefersReducedMotion
    ? undefined
    : isDraggingGood && dragOffset
      ? `${isGoodActive ? 'scale(1.2) ' : ''}translateX(${Math.min(8, dragOffset.x * 0.08)}px)`.trim()
      : isGoodActive
        ? 'scale(1.2)'
        : undefined

  return (
    <fieldset className="grade-fieldset">
      <legend className="sr-only">How did that feel?</legend>
      <div className="grade-buttons">
        {grades.map((grade, index) => {
          const isActive = activeZone === grade
          return (
            <button
              type="button"
              className={`grade-${grade} ${isActive ? 'is-gesture-active' : ''}`.trim()}
              data-grade={index + 1}
              onClick={() => onGrade(grade)}
              key={grade}
              aria-label={`${index + 1} ${labels[grade]} ${intervalLabel(card, grade)}`}
            >
              <kbd aria-hidden="true">{index + 1}</kbd>
              {grade === 'again' && (
                <span
                  className={`grade-gesture-cue cue-again ${isActive ? 'is-active' : ''}`.trim()}
                  style={{ transform: arrowAgainTransform }}
                  aria-hidden="true"
                >
                  {isActive ? '↺' : '←'}
                </span>
              )}
              <span className="grade-copy">
                <strong>{labels[grade]}</strong>
                <small>{intervalLabel(card, grade)}</small>
              </span>
              {grade === 'good' && (
                <span
                  className={`grade-gesture-cue cue-good ${isActive ? 'is-active' : ''}`.trim()}
                  style={{ transform: arrowGoodTransform }}
                  aria-hidden="true"
                >
                  {isActive ? '✓' : '→'}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
