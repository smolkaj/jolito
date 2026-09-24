import type { HapticsPlayer } from '../application/ports'
import type { View } from '../navigation'

export interface MobileTabBarProps {
  currentView: View
  onCards: () => void
  onGrammar: () => void
  onNavigateToDeck: () => void
  onNavigateToCreate: () => void
  haptics?: HapticsPlayer | undefined
}

export function CardsTabIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="15" rx="3" />
      <path d="m9 9 5 3-5 3V9Z" fill="currentColor" stroke="none" />
      <path d="M7 22h10" />
    </svg>
  )
}

export const PracticeTabIcon = CardsTabIcon

export function GrammarTabIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}

export function DeckTabIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="7" width="16" height="13" rx="2" />
      <path d="M6 3h14a2 2 0 0 1 2 2v12" />
    </svg>
  )
}

export function CreateTabIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  )
}

export function MobileTabBar({
  currentView,
  onCards,
  onGrammar,
  onNavigateToDeck,
  onNavigateToCreate,
  haptics,
}: MobileTabBarProps) {
  const isCardsActive = currentView === 'review' || currentView === 'complete'
  const isGrammarActive = currentView === 'grammar'
  const isDeckActive = currentView === 'deck'
  const isCreateActive = currentView === 'create'

  const handleTabClick = (action: () => void) => {
    haptics?.trigger('selection')
    action()
  }

  return (
    <nav className="mobile-tab-bar" aria-label="Mobile navigation">
      <button
        type="button"
        aria-current={isCardsActive ? 'page' : undefined}
        className={`mobile-tab-btn ${isCardsActive ? 'is-active' : ''}`}
        onClick={() => handleTabClick(onCards)}
        aria-label="Cards (Study session)"
      >
        <div className="tab-icon-wrapper">
          <CardsTabIcon />
        </div>
        <span className="tab-label">Cards</span>
      </button>

      <button
        type="button"
        aria-current={isGrammarActive ? 'page' : undefined}
        className={`mobile-tab-btn ${isGrammarActive ? 'is-active' : ''}`}
        onClick={() => handleTabClick(onGrammar)}
        aria-label="Grammar (Practice grammar)"
      >
        <div className="tab-icon-wrapper">
          <GrammarTabIcon />
        </div>
        <span className="tab-label">Grammar</span>
      </button>

      <button
        type="button"
        aria-current={isDeckActive ? 'page' : undefined}
        className={`mobile-tab-btn ${isDeckActive ? 'is-active' : ''}`}
        onClick={() => handleTabClick(onNavigateToDeck)}
        aria-label="Deck"
      >
        <div className="tab-icon-wrapper">
          <DeckTabIcon />
        </div>
        <span className="tab-label">Deck</span>
      </button>

      <button
        type="button"
        aria-current={isCreateActive ? 'page' : undefined}
        className={`mobile-tab-btn ${isCreateActive ? 'is-active' : ''}`}
        onClick={() => handleTabClick(onNavigateToCreate)}
        aria-label="Create"
      >
        <div className="tab-icon-wrapper">
          <CreateTabIcon />
        </div>
        <span className="tab-label">Create</span>
      </button>
    </nav>
  )
}
