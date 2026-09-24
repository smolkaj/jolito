import type { HapticsPlayer } from '../application/ports'
import type { View } from '../navigation'
import { PracticeTabIcon, DeckTabIcon, CreateTabIcon } from './MobileTabBar'

export interface DesktopSegmentedNavProps {
  currentView: View
  dueCount?: number
  onPractice: () => void
  onNavigateToDeck: () => void
  onNavigateToCreate: () => void
  haptics?: HapticsPlayer | undefined
}

export function DesktopSegmentedNav({
  currentView,
  dueCount = 0,
  onPractice,
  onNavigateToDeck,
  onNavigateToCreate,
  haptics,
}: DesktopSegmentedNavProps) {
  const isPracticeActive =
    currentView === 'review' ||
    currentView === 'welcome' ||
    currentView === 'grammar' ||
    currentView === 'complete'
  const isDeckActive = currentView === 'deck'
  const isCreateActive = currentView === 'create'
  const showDueBadge =
    dueCount > 0 && currentView !== 'review' && currentView !== 'complete'

  const handleClick = (action: () => void) => {
    haptics?.trigger('selection')
    action()
  }

  return (
    <div className="desktop-segmented-nav" role="group" aria-label="Navigation">
      <button
        type="button"
        aria-current={isPracticeActive ? 'page' : undefined}
        className={`desktop-segmented-btn ${isPracticeActive ? 'is-active' : ''}`}
        onClick={() => handleClick(onPractice)}
        aria-label={
          showDueBadge ? `Practice (${dueCount} cards due)` : 'Practice'
        }
      >
        <PracticeTabIcon size={16} />
        <span className="desktop-segmented-label">Practice</span>
        {showDueBadge && (
          <span
            className="desktop-segmented-badge"
            aria-hidden="true"
            title={`${dueCount} cards due`}
          >
            {dueCount > 99 ? '99+' : dueCount}
          </span>
        )}
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
