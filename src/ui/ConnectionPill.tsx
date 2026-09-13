import type { AuthUser } from '../application/ports'
import type { SyncStatus } from '../domain/sync'
import {
  CloudCheckIcon,
  CloudOffIcon,
  SyncAlertIcon,
  SyncSpinnerIcon,
  UserIcon,
} from './icons'

export interface ConnectionPillProps {
  authUser: AuthUser | null
  syncStatus: SyncStatus
  isOnline: boolean
  onClick: () => void
}

export function ConnectionPill({
  authUser,
  syncStatus,
  isOnline,
  onClick,
}: ConnectionPillProps) {
  let stateClass = 'is-signed-out'
  let label = 'Sign in'
  let ariaLabel = 'Not signed in. Tap to sign in and sync your deck.'
  let icon = <UserIcon />

  if (!isOnline) {
    stateClass = 'is-offline'
    label = 'Offline'
    ariaLabel = authUser
      ? 'Offline. Card changes are saved to this device.'
      : 'Offline demo. Connect to internet and sign in to build your deck.'
    icon = <CloudOffIcon />
  } else if (authUser) {
    if (syncStatus === 'syncing') {
      stateClass = 'is-syncing'
      label = 'Syncing…'
      ariaLabel = 'Synchronizing deck with cloud…'
      icon = <SyncSpinnerIcon />
    } else if (syncStatus === 'error') {
      stateClass = 'is-error'
      label = 'Sync issue'
      ariaLabel = 'Sync issue. Tap to view status and retry.'
      icon = <SyncAlertIcon />
    } else {
      stateClass = 'is-synced'
      label = 'Synced'
      ariaLabel = 'Deck synced with cloud. Tap to manage sync.'
      icon = <CloudCheckIcon />
    }
  }

  return (
    <button
      type="button"
      className={`connection-pill ${stateClass}`}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <span className="pill-icon" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  )
}
