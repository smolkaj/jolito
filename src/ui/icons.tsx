export function MexicoFlag({ className }: { className?: string }) {
  return (
    <svg
      className={`flag-icon flag-mx ${className ?? ''}`}
      viewBox="0 0 18 12"
      width="16"
      height="11"
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

export function UsFlag({ className }: { className?: string }) {
  return (
    <svg
      className={`flag-icon flag-us ${className ?? ''}`}
      viewBox="0 0 18 12"
      width="16"
      height="11"
      aria-hidden="true"
    >
      <rect width="18" height="12" fill="#bf0a30" />
      <rect y="1.8" width="18" height="1.8" fill="#ffffff" />
      <rect y="5.4" width="18" height="1.8" fill="#ffffff" />
      <rect y="9" width="18" height="1.8" fill="#ffffff" />
      <rect width="8" height="6" fill="#002868" />
      <circle cx="2.5" cy="2" r="0.55" fill="#ffffff" />
      <circle cx="5.5" cy="2" r="0.55" fill="#ffffff" />
      <circle cx="4" cy="4" r="0.55" fill="#ffffff" />
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
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      className={`cloud-check-sticker ${className}`.trim()}
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
      {/* Cloud sticker body - Vibrant Oaxacan Turquesa */}
      <path
        d="M51.5 21C49.8 12.6 42.4 6.5 33.5 6.5c-7 0-13.1 3.9-16.1 9.8C7.6 17 2 23.2 2 30.7 2 38.6 8.5 45 16.5 45h35c6.6 0 12-5.4 12-12 0-6.3-4.9-11.4-11.2-11.9z"
        fill="#2a7a63"
      />
      {/* Subtle organic upper highlight */}
      <path
        d="M33.5 8.5c6.2 0 11.6 3.8 13.8 9.5"
        fill="none"
        stroke="#5ab69c"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Bold Crisp White Checkmark */}
      <path
        d="M22 28.5l7.5 7.5 15-15"
        fill="none"
        stroke="#ffffff"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

export function AudioButton({
  label,
  onClick,
  prompt = false,
}: {
  label: string
  onClick: () => void
  prompt?: boolean
}) {
  return (
    <button
      className="audio-button"
      type="button"
      aria-label={label}
      title={label}
      data-prompt-audio={prompt || undefined}
      onClick={onClick}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M5 9v6h4l5 4V5L9 9H5Zm11.5-.5a5 5 0 0 1 0 7M18.8 6a8.2 8.2 0 0 1 0 12" />
      </svg>
    </button>
  )
}
