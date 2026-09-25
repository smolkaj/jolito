export function MexicoFlag({ className }: { className?: string }) {
  return (
    <svg
      className={`language-icon flag-mx ${className ?? ''}`}
      viewBox="0 0 18 12"
      width="18"
      height="12"
      aria-hidden="true"
    >
      <rect width="6" height="12" fill="#006847" />
      <rect x="6" width="6" height="12" fill="#ffffff" />
      <rect x="12" width="6" height="12" fill="#ce1126" />
      <circle cx="9" cy="6" r="1.8" fill="#bfa054" />
      <circle cx="9" cy="6" r="1.1" fill="#4a2e12" />
      <circle cx="9" cy="5.4" r="0.5" fill="#006847" />
    </svg>
  )
}

export function EnglishBadge({ className }: { className?: string }) {
  return (
    <svg
      className={`language-icon ${className ?? ''}`}
      viewBox="0 0 20 14"
      width="20"
      height="14"
      aria-hidden="true"
    >
      <rect
        width="20"
        height="14"
        fill="var(--english-badge-background, var(--turquesa))"
      />
      <path
        fill="var(--ink)"
        d="M3.5 3h5v1.5H5v2h3v1.5H5v2h3.5v1.5h-5zM10.5 11.5V3H12l3 5.4V3h1.5v8.5H15l-3-5.4v5.4z"
      />
    </svg>
  )
}

export function JolitoMark({
  className = '',
  size = 34,
  ariaHidden = true,
}: {
  className?: string
  size?: number
  ariaHidden?: boolean
}) {
  return (
    <svg
      className={`jolito-mark ${className}`.trim()}
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden={ariaHidden}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g className="jolito-gills jolito-gills-left">
        <rect
          className="jolito-gill gill-tl"
          x="3"
          y="6.5"
          width="11"
          height="4.5"
          rx="2.25"
        />
        <rect
          className="jolito-gill gill-ml"
          x="1"
          y="13.75"
          width="12"
          height="4.5"
          rx="2.25"
        />
        <rect
          className="jolito-gill gill-bl"
          x="3"
          y="21"
          width="11"
          height="4.5"
          rx="2.25"
        />
      </g>
      <g className="jolito-gills jolito-gills-right">
        <rect
          className="jolito-gill gill-tr"
          x="18"
          y="6.5"
          width="11"
          height="4.5"
          rx="2.25"
        />
        <rect
          className="jolito-gill gill-mr"
          x="19"
          y="13.75"
          width="12"
          height="4.5"
          rx="2.25"
        />
        <rect
          className="jolito-gill gill-br"
          x="18"
          y="21"
          width="11"
          height="4.5"
          rx="2.25"
        />
      </g>
      <g className="jolito-core">
        <circle className="jolito-core-outer" cx="16" cy="16" r="6" />
        <circle className="jolito-core-mid" cx="16" cy="16" r="4.2" />
        <circle className="jolito-core-inner" cx="16" cy="16" r="2.2" />
      </g>
    </svg>
  )
}

export function CloudCheckIcon({
  className = '',
  size = 15,
  ariaHidden = true,
}: {
  className?: string
  size?: number
  ariaHidden?: boolean
}) {
  return (
    <svg
      className={`icon-cloud-check ${className}`.trim()}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden={ariaHidden}
    >
      <path
        d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"
        fill="currentColor"
      />
      <path
        d="m7.8 13.5 2.8 2.8 5.6-5.6"
        fill="none"
        stroke="var(--turquesa-soft, #eaf3ed)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CloudCheckSticker({
  size = 60,
  className = '',
  status = 'synced',
}: {
  size?: number
  className?: string
  status?: 'synced' | 'syncing' | 'error' | 'offline' | 'idle'
}) {
  const bodyFill =
    status === 'error'
      ? 'var(--tezontle, #d32f2f)'
      : status === 'offline'
        ? 'var(--cempasuchil-dark, #b45309)'
        : 'var(--turquesa-deep, #2d5a43)'
  const highlightStroke =
    status === 'error'
      ? '#f87171'
      : status === 'offline'
        ? 'var(--cempasuchil, #f59e0b)'
        : 'var(--turquesa-border, #9ec2ad)'

  return (
    <svg
      className={`cloud-check-sticker status-${status} ${className}`.trim()}
      viewBox="0 0 64 48"
      width={size}
      height={(size * 48) / 64}
      aria-hidden="true"
    >
      {/* Soft sticker drop shadow */}
      <path
        d="M51.5 24C49.8 15.6 42.4 9.5 33.5 9.5c-7 0-13.1 3.9-16.1 9.8C7.6 20 2 26.2 2 33.7 2 41.6 8.5 48 16.5 48h35c6.6 0 12-5.4 12-12 0-6.3-4.9-11.4-11.2-11.9z"
        fill="rgba(18, 24, 21, 0.08)"
        transform="translate(2, 3)"
      />
      {/* Cloud sticker body */}
      <path
        d="M51.5 21C49.8 12.6 42.4 6.5 33.5 6.5c-7 0-13.1 3.9-16.1 9.8C7.6 17 2 23.2 2 30.7 2 38.6 8.5 45 16.5 45h35c6.6 0 12-5.4 12-12 0-6.3-4.9-11.4-11.2-11.9z"
        fill={bodyFill}
      />
      {/* Subtle organic upper highlight */}
      <path
        d="M33.5 8.5c6.2 0 11.6 3.8 13.8 9.5"
        fill="none"
        stroke={highlightStroke}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Inner emblem based on status */}
      {status === 'syncing' ? (
        <g
          className="sticker-spinner is-spinning"
          style={{ transformOrigin: '33px 29px' }}
        >
          <g transform="translate(33 29) scale(0.85) translate(-12 -12)">
            <path
              d="M21 12a9 9 0 0 0-15.5-6.36L3 8"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M3 3v5h5"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M3 12a9 9 0 0 0 15.5 6.36L21 16"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M21 21v-5h-5"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </g>
      ) : status === 'error' ? (
        <g>
          <path
            d="M33.5 20v9"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle cx="33.5" cy="35" r="2" fill="#ffffff" />
        </g>
      ) : status === 'offline' ? (
        <path
          d="M21 19L45 39"
          fill="none"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M22 28.5l7.5 7.5 15-15"
          fill="none"
          stroke="#ffffff"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

export function UserIcon({
  className = '',
  size = 15,
  ariaHidden = true,
}: {
  className?: string
  size?: number
  ariaHidden?: boolean
}) {
  return (
    <svg
      className={`icon-user ${className}`.trim()}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
    >
      <circle cx="12" cy="7.5" r="3.75" />
      <path d="M19.5 20.5a7.5 7.5 0 0 0-15 0" />
    </svg>
  )
}

export function SyncSpinnerIcon({
  className = '',
  size = 15,
  ariaHidden = true,
}: {
  className?: string
  size?: number
  ariaHidden?: boolean
}) {
  return (
    <svg
      className={`icon-sync-spinner ${className}`.trim()}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
    >
      <path d="M21 12a9 9 0 0 0-15.5-6.36L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 15.5 6.36L21 16" />
      <path d="M21 21v-5h-5" />
    </svg>
  )
}

export function CloudOffIcon({
  className = '',
  size = 15,
  ariaHidden = true,
}: {
  className?: string
  size?: number
  ariaHidden?: boolean
}) {
  return (
    <svg
      className={`icon-cloud-off ${className}`.trim()}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
    >
      <path d="M2 2l20 20" />
      <path d="M8.8 3.5A5.5 5.5 0 0 1 16.9 7.2 4.2 4.2 0 0 1 20 11.2a4 4 0 0 1-2.1 3.5" />
      <path d="M5.5 9.8A4.5 4.5 0 0 0 7 17.5h8.5" />
    </svg>
  )
}

export function SyncAlertIcon({
  className = '',
  size = 15,
  ariaHidden = true,
}: {
  className?: string
  size?: number
  ariaHidden?: boolean
}) {
  return (
    <svg
      className={`icon-sync-alert ${className}`.trim()}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
    >
      <path d="m12 3.5 9 15.5a1.2 1.2 0 0 1-1.04 1.8H4.04A1.2 1.2 0 0 1 3 19L12 3.5Z" />
      <path d="M12 9v4" />
      <circle cx="12" cy="16.5" r="0.75" fill="currentColor" />
    </svg>
  )
}

export function ShieldIcon({
  className = '',
  size = 20,
  ariaHidden = true,
}: {
  className?: string
  size?: number
  ariaHidden?: boolean
}) {
  return (
    <svg
      className={`icon-shield ${className}`.trim()}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export function PhoneLinkIcon({
  className = '',
  size = 16,
  ariaHidden = true,
}: {
  className?: string
  size?: number
  ariaHidden?: boolean
}) {
  return (
    <svg
      className={`icon-phone-link ${className}`.trim()}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
    >
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </svg>
  )
}

export function ClipboardIcon({
  className = '',
  size = 14,
  ariaHidden = true,
}: {
  className?: string
  size?: number
  ariaHidden?: boolean
}) {
  return (
    <svg
      className={`icon-clipboard ${className}`.trim()}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
    >
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  )
}

export function AppleIcon({
  className = '',
  size = 16,
  ariaHidden = true,
}: {
  className?: string
  size?: number
  ariaHidden?: boolean
}) {
  return (
    <svg
      className={`icon-apple ${className}`.trim()}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden={ariaHidden}
    >
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  )
}

export function MicIcon({
  className = '',
  size = 18,
  ariaHidden = true,
}: {
  className?: string
  size?: number
  ariaHidden?: boolean
}) {
  return (
    <svg
      className={`icon-mic ${className}`.trim()}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

export function PencilIcon({
  className = '',
  size = 14,
  ariaHidden = true,
}: {
  className?: string
  size?: number
  ariaHidden?: boolean
}) {
  return (
    <svg
      className={`icon-pencil ${className}`.trim()}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  )
}

export function TrashIcon({
  className = '',
  size = 14,
  ariaHidden = true,
}: {
  className?: string
  size?: number
  ariaHidden?: boolean
}) {
  return (
    <svg
      className={`icon-trash ${className}`.trim()}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  )
}

export function SearchIcon({
  className = '',
  size = 16,
  ariaHidden = true,
}: {
  className?: string
  size?: number
  ariaHidden?: boolean
}) {
  return (
    <svg
      className={`icon-search ${className}`.trim()}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

export function ChiliIcon({
  className = '',
  size = 14,
  filled = true,
  ariaHidden = true,
}: {
  className?: string
  size?: number
  filled?: boolean
  ariaHidden?: boolean
}) {
  return (
    <svg
      className={`icon-chili ${filled ? 'is-filled' : 'is-empty'} ${className}`.trim()}
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden={ariaHidden}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10 3.8C10.8 2.6 12 1.8 13.5 1.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M9.8 4.2C7.5 4 4.8 5.6 3.8 8.8C2.6 12.2 4.2 14.6 4.8 14.6C5.3 14.6 6.5 13.2 8.2 11.2C10.4 8.6 11.2 6.5 9.8 4.2Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={filled ? '0.4' : '1.2'}
        strokeLinejoin="round"
      />
    </svg>
  )
}
