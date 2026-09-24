import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { AppleIcon } from './icons'

describe('AppleIcon', () => {
  it('renders authentic Apple icon SVG with 24x24 viewBox and accessible attributes', () => {
    const { container } = render(
      <AppleIcon size={18} className="custom-apple" />,
    )
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(svg?.getAttribute('width')).toBe('18')
    expect(svg?.getAttribute('height')).toBe('18')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect(svg?.classList.contains('icon-apple')).toBe(true)
    expect(svg?.classList.contains('custom-apple')).toBe(true)

    const path = svg?.querySelector('path')
    expect(path).toBeInTheDocument()
    expect(path?.getAttribute('d')).toContain('M12.152 6.896')
  })
})
