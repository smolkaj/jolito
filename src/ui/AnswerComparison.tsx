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
  isPlayingAudio = false,
  correctionRule,
  inputMode = 'typed',
}: {
  typed: string
  expected: string
  lang: string
  onPlayAudio?: (() => void) | undefined
  isPlayingAudio?: boolean | undefined
  correctionRule?: string | undefined
  inputMode?: 'typed' | 'spoken' | undefined
}) {
  const comparison = compareAnswer(typed, expected)
  const hasTyped = typed.trim().length > 0

  if (comparison.isExact) {
    return (
      <div className="diff-exact-card" aria-label="Answer comparison">
        <p className="diff-text diff-match" lang={lang}>
          {expected}
        </p>
        {onPlayAudio && (
          <AudioButton
            label="Play answer audio"
            playing={isPlayingAudio}
            onClick={onPlayAudio}
          />
        )}
      </div>
    )
  }

  return (
    <div className="diff-card" aria-label="Answer comparison">
      <div className="diff-rows">
        {hasTyped && (
          <div className="diff-row">
            <span className="diff-label">
              {inputMode === 'spoken' ? 'You said' : 'You wrote'}
            </span>
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
          {onPlayAudio && (
            <AudioButton
              label="Play answer audio"
              playing={isPlayingAudio}
              onClick={onPlayAudio}
            />
          )}
          {correctionRule && (
            <p className="diff-rule">
              <strong>Rule:</strong> {correctionRule}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
