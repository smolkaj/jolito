export function AppFooter({
  onOpenFeedback,
  onOpenPrivacy,
  showPrivacy = true,
}: {
  onOpenFeedback: () => void
  onOpenPrivacy?: (() => void) | undefined
  showPrivacy?: boolean
}) {
  return (
    <footer className="app-footer" aria-label="Site footer">
      <div className="app-footer-inner" data-nosnippet>
        {showPrivacy && (
          <button
            type="button"
            className="footer-link-button"
            onClick={
              onOpenPrivacy ??
              (() => {
                window.location.hash = '#/privacy'
              })
            }
          >
            Privacy
          </button>
        )}
        <button
          type="button"
          className="footer-link-button"
          onClick={onOpenFeedback}
        >
          Feedback
        </button>
      </div>
    </footer>
  )
}
