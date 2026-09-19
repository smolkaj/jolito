import type { AuthUser, HapticsPlayer } from '../application/ports'
import type { SyncStatus } from '../domain/sync'
import type { View } from '../navigation'
import { CloudCheckIcon, SyncSpinnerIcon, UserIcon } from './icons'

export interface MobileTabBarProps {
  currentView: View
  isSyncOpen: boolean
  syncStatus: SyncStatus
  authUser: AuthUser | null
  dueCount?: number
  onPractice: () => void
  onNavigateToDeck: () => void
  onNavigateToCreate: () => void
  onOpenSync: () => void
  haptics?: HapticsPlayer
}

function PracticeTabIcon({ size = 22 }: { size?: number }) {
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

function DeckTabIcon({ size = 22 }: { size?: number }) {
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

function CreateTabIcon({ size = 22 }: { size?: number }) {
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
  isSyncOpen,
  syncStatus,
  authUser,
  dueCount = 0,
  onPractice,
  onNavigateToDeck,
  onNavigateToCreate,
  onOpenSync,
  haptics,
}: MobileTabBarProps) {
  const isPracticeActive =
    !isSyncOpen &&
    (currentView === 'review' ||
      currentView === 'welcome' ||
      currentView === 'grammar' ||
      currentView === 'complete')
  const isDeckActive = !isSyncOpen && currentView === 'deck'
  const isCreateActive = !isSyncOpen && currentView === 'create'
  const isSyncActive = isSyncOpen

  const handleTabClick = (action: () => void) => {
    haptics?.trigger('selection')
    action()
  }

  return (
    <nav
      className="mobile-tab-bar"
      role="tablist"
      aria-label="Mobile navigation"
    >
      <button
        type="button"
        role="tab"
        aria-selected={isPracticeActive}
        className={`mobile-tab-btn ${isPracticeActive ? 'is-active' : ''}`}
        onClick={() => handleTabClick(onPractice)}
        aria-label="Practice"
      >
        <div className="tab-icon-wrapper">
          <PracticeTabIcon />
          {dueCount > 0 && !isPracticeActive && (
            <span className="tab-badge" aria-label={`${dueCount} cards due`}>
              {dueCount > 99 ? '99+' : dueCount}
            </span>
          )}
        </div>
        <span className="tab-label">Practice</span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={isDeckActive}
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
        role="tab"
        aria-selected={isCreateActive}
        className={`mobile-tab-btn ${isCreateActive ? 'is-active' : ''}`}
        onClick={() => handleTabClick(onNavigateToCreate)}
        aria-label="Create"
      >
        <div className="tab-icon-wrapper">
          <CreateTabIcon />
        </div>
        <span className="tab-label">Create</span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={isSyncActive}
        className={`mobile-tab-btn ${isSyncActive ? 'is-active' : ''}`}
        onClick={() => handleTabClick(onOpenSync)}
        aria-label={authUser ? 'Sync' : 'Account'}
      >
        <div className="tab-icon-wrapper">
          {syncStatus === 'syncing' ? (
            <SyncSpinnerIcon size={22} className="spinning-icon" />
          ) : authUser ? (
            <CloudCheckIcon size={22} />
          ) : (
            <UserIcon size={22} />
          )}
          {authUser && syncStatus !== 'syncing' && (
            <span className="tab-online-dot" aria-hidden="true" />
          )}
        </div>
        <span className="tab-label">{authUser ? 'Sync' : 'Account'}</span>
      </button>
    </nav>
  )
}
