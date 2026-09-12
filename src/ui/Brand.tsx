import { JolitoMark } from './icons'

export function Brand({ onClick }: { onClick?: () => void }) {
  const content = (
    <>
      <JolitoMark className="brand-mark" />
      <span>Jolito</span>
    </>
  )

  return onClick ? (
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
}
