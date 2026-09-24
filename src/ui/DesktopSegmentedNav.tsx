import type { HapticsPlayer } from '../application/ports'
import type { View } from '../navigation'
import { PracticeTabIcon, DeckTabIcon, CreateTabIcon } from './MobileTabBar'

export interface DesktopSegmentedNavProps {
  currentView: View
  dueCount?: number
  canPractice?: boolean
  onPractice: () => void
  onNavigateToDeck: () => void
  onNavigateToCreate: () => void
  haptics?: HapticsPlayer | undefined
}

export function DesktopSegmentedNav({
  currentView,
  dueCount = 0,
  canPractice = true,
  onPractice,
  onNavigateToDeck,
  onNavigateToCreate,
  haptics,
}: DesktopSegmentedNavProps) {
  const isPracticeActive =
    currentView === 'review' ||
    currentView === 'grammar' ||
    currentView === 'complete'
  const isDeckActive = currentView === 'deck'
  const isCreateActive = currentView === 'create'

  const handleClick = (action: () => void) => {
    haptics?.trigger('selection')
    action()
  }

  return (
    <nav className="desktop-segmented-nav" aria-label="Desktop navigation">
      {canPractice && (
        <button
          type="button"
          aria-current={isPracticeActive ? 'page' : undefined}
          className={`desktop-segmented-btn ${isPracticeActive ? 'is-active' : ''}`}
          onClick={() => handleClick(onPractice)}
          aria-label={
            currentView === 'welcome'
              ? dueCount > 0
                ? `Practice (${dueCount} cards due)`
                : 'Practice cards'
              : undefined
          }
        >
          <PracticeTabIcon size={16} />
          <span className="desktop-segmented-label">Practice</span>
          {dueCount > 0 && (
            <span
              className="desktop-segmented-badge"
              aria-hidden="true"
              title={`${dueCount} cards due`}
            >
              {dueCount > 99 ? '99+' : dueCount}
            </span>
          )}
        </button>
      )}

      <button
        type="button"
        aria-current={isDeckActive ? 'page' : undefined}
        className={`desktop-segmented-btn ${isDeckActive ? 'is-active' : ''}`}
        onClick={() => handleClick(onNavigateToDeck)}
        aria-label="Manage deck"
      >
        <DeckTabIcon size={16} />
        <span className="desktop-segmented-label">Deck</span>
      </button>

      <button
        type="button"
        aria-current={isCreateActive ? 'page' : undefined}
        className={`desktop-segmented-btn ${isCreateActive ? 'is-active' : ''}`}
        onClick={() => handleClick(onNavigateToCreate)}
        aria-label="+ New card"
      >
        <CreateTabIcon size={16} />
        <span className="desktop-segmented-label">Create</span>
      </button>
    </nav>
  )
}
