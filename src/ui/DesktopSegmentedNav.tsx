import type { HapticsPlayer } from '../application/ports'
import type { View } from '../navigation'
import {
  CardsTabIcon,
  GrammarTabIcon,
  DeckTabIcon,
  CreateTabIcon,
} from './MobileTabBar'

export interface DesktopSegmentedNavProps {
  currentView: View
  onCards: () => void
  onGrammar: () => void
  onNavigateToDeck: () => void
  onNavigateToCreate: () => void
  haptics?: HapticsPlayer | undefined
}

export function DesktopSegmentedNav({
  currentView,
  onCards,
  onGrammar,
  onNavigateToDeck,
  onNavigateToCreate,
  haptics,
}: DesktopSegmentedNavProps) {
  const isCardsActive = currentView === 'review' || currentView === 'complete'
  const isGrammarActive = currentView === 'grammar'
  const isDeckActive = currentView === 'deck'
  const isCreateActive = currentView === 'create'

  const handleClick = (action: () => void) => {
    haptics?.trigger('selection')
    action()
  }

  return (
    <div className="desktop-segmented-nav" role="group" aria-label="Navigation">
      <button
        type="button"
        aria-current={isCardsActive ? 'page' : undefined}
        className={`desktop-segmented-btn ${isCardsActive ? 'is-active' : ''}`}
        onClick={() => handleClick(onCards)}
        aria-label="Cards (Study session)"
      >
        <CardsTabIcon size={16} />
        <span className="desktop-segmented-label">Cards</span>
      </button>

      <button
        type="button"
        aria-current={isGrammarActive ? 'page' : undefined}
        className={`desktop-segmented-btn ${isGrammarActive ? 'is-active' : ''}`}
        onClick={() => handleClick(onGrammar)}
        aria-label="Grammar (Practice grammar)"
      >
        <GrammarTabIcon size={16} />
        <span className="desktop-segmented-label">Grammar</span>
      </button>

      <button
        type="button"
        aria-current={isDeckActive ? 'page' : undefined}
        className={`desktop-segmented-btn ${isDeckActive ? 'is-active' : ''}`}
        onClick={() => handleClick(onNavigateToDeck)}
        aria-label="Deck (Manage deck)"
      >
        <DeckTabIcon size={16} />
        <span className="desktop-segmented-label">Deck</span>
      </button>

      <button
        type="button"
        aria-current={isCreateActive ? 'page' : undefined}
        className={`desktop-segmented-btn ${isCreateActive ? 'is-active' : ''}`}
        onClick={() => handleClick(onNavigateToCreate)}
        aria-label="Create (+ New card)"
      >
        <CreateTabIcon size={16} />
        <span className="desktop-segmented-label">Create</span>
      </button>
    </div>
  )
}
