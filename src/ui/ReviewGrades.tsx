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
}: {
  card: StudyCard
  onGrade: (grade: Grade) => void
}) {
  return (
    <fieldset className="grade-fieldset">
      <legend className="sr-only">How did that feel?</legend>
      <div className="grade-buttons">
        {grades.map((grade, index) => (
          <button
            type="button"
            className={`grade-${grade}`}
            data-grade={index + 1}
            onClick={() => onGrade(grade)}
            key={grade}
          >
            <kbd>{index + 1}</kbd>
            <strong>{labels[grade]}</strong>
            <small>{intervalLabel(card, grade)}</small>
          </button>
        ))}
      </div>
    </fieldset>
  )
}
