export function SessionProgress({
  percentage,
  remaining,
  unit,
}: {
  percentage: number
  remaining: number
  unit: 'card' | 'form'
}) {
  return (
    <div
      className="review-progress-track"
      role="progressbar"
      aria-label="Session progress"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${remaining} ${unit}${remaining === 1 ? '' : 's'} remaining`}
    >
      <div
        className="review-progress-bar"
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}
