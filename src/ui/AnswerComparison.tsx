import { compareAnswer, type DiffSegment } from '../domain/answer'
import { AudioButton } from './AudioButton'

function renderDiffSegments(segments: DiffSegment[]) {
  return segments.map((seg, i) => {
    const isSpaceOnly = /^ +$/.test(seg.value)
    return (
      <span
        className={`diff-seg diff-seg-${seg.status}${
          isSpaceOnly ? ' diff-seg-space' : ''
        }`}
        key={i}
      >
        {isSpaceOnly && seg.status === 'extra' ? '␣' : seg.value}
      </span>
    )
  })
}

export function AnswerComparison({
  typed,
  expected,
  lang,
  onPlayAudio,
}: {
  typed: string
  expected: string
  lang: string
  onPlayAudio: () => void
}) {
  const comparison = compareAnswer(typed, expected)
  const hasTyped = typed.trim().length > 0

  if (comparison.isExact) {
    return (
      <div className="diff-exact-card" aria-label="Answer comparison">
        <p className="diff-text diff-match" lang={lang}>
          {expected}
        </p>
        <AudioButton label="Play answer audio" onClick={onPlayAudio} />
      </div>
    )
  }

  return (
    <div className="diff-card" aria-label="Answer comparison">
      <div className="diff-rows">
        {hasTyped && (
          <div className="diff-row">
            <span className="diff-label">You wrote</span>
            <p className="diff-text" lang={lang}>
              {renderDiffSegments(comparison.typedSegments)}
            </p>
          </div>
        )}

        <div className="diff-row expected-row">
          <span className="diff-label">Expected</span>
          <p className="diff-text" lang={lang}>
            {renderDiffSegments(comparison.expectedSegments)}
          </p>
          <AudioButton label="Play answer audio" onClick={onPlayAudio} />
        </div>
      </div>
    </div>
  )
}
