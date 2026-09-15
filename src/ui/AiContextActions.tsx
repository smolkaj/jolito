export interface AiContextActionsProps {
  aiAvailable: boolean
  loading: 'example' | 'mnemonic' | null
  error: string | null
  statusMessage: string | null
  canGenerateExample: boolean
  canGenerateMnemonic: boolean
  onGenerateExample: () => void
  onGenerateMnemonic: () => void
}

export function AiContextActions({
  aiAvailable,
  loading,
  error,
  statusMessage,
  canGenerateExample,
  canGenerateMnemonic,
  onGenerateExample,
  onGenerateMnemonic,
}: AiContextActionsProps) {
  if (!aiAvailable) return null

  const isExampleDisabled = !canGenerateExample || loading !== null
  const isMnemonicDisabled = !canGenerateMnemonic || loading !== null

  return (
    <div className="ai-context-actions">
      <button
        type="button"
        className="ai-suggestion-btn"
        tabIndex={isExampleDisabled ? -1 : 0}
        aria-disabled={isExampleDisabled}
        aria-busy={loading === 'example'}
        aria-label={
          loading === 'example'
            ? 'Generating example sentence…'
            : 'Example: Generate authentic example sentence'
        }
        onClick={(e) => {
          if (isExampleDisabled) {
            e.preventDefault()
            return
          }
          onGenerateExample()
        }}
      >
        {loading === 'example' ? '✨ Generating…' : '✨ Example'}
      </button>
      <button
        type="button"
        className="ai-suggestion-btn"
        tabIndex={isMnemonicDisabled ? -1 : 0}
        aria-disabled={isMnemonicDisabled}
        aria-busy={loading === 'mnemonic'}
        aria-label={
          loading === 'mnemonic'
            ? 'Generating mnemonic hook…'
            : 'Mnemonic: Generate mnemonic hook'
        }
        onClick={(e) => {
          if (isMnemonicDisabled) {
            e.preventDefault()
            return
          }
          onGenerateMnemonic()
        }}
      >
        {loading === 'mnemonic' ? '💡 Generating…' : '💡 Mnemonic'}
      </button>
      {!error && statusMessage && (
        <div className="sr-only" role="status" aria-live="polite">
          {statusMessage}
        </div>
      )}
      {error && (
        <div className="ai-suggestion-error" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}
