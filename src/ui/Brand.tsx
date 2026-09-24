import { JolitoMark } from './icons'

export function Brand({
  onClick,
  className,
}: {
  onClick?: () => void
  className?: string
}) {
  const content = (
    <>
      <JolitoMark className="brand-mark" />
      <span>Jolito</span>
    </>
  )

  const brandElement = onClick ? (
    <button
      className="brand"
      type="button"
      onClick={onClick}
      aria-label="Jolito home"
    >
      {content}
    </button>
  ) : (
    <div className="brand">{content}</div>
  )

  return (
    <div className={`topbar-brand ${className || ''}`.trim()}>
      {brandElement}
    </div>
  )
}
