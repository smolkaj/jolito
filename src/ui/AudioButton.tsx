export function AudioButton({
  label,
  onClick,
  prompt = false,
  playing = false,
}: {
  label: string
  onClick: () => void
  prompt?: boolean
  playing?: boolean
}) {
  return (
    <button
      className={`audio-button ${playing ? 'is-playing' : ''}`.trim()}
      type="button"
      aria-label={label}
      aria-pressed={playing || undefined}
      title={label}
      data-prompt-audio={prompt || undefined}
      data-playing={playing || undefined}
      onClick={onClick}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M5 9v6h4l5 4V5L9 9H5Zm11.5-.5a5 5 0 0 1 0 7M18.8 6a8.2 8.2 0 0 1 0 12" />
      </svg>
    </button>
  )
}
