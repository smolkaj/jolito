import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { AppleIcon, ChiliIcon, SearchIcon } from './icons'

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

describe('SearchIcon', () => {
  it('renders search SVG with 24x24 viewBox, stroke styling, and accessible attributes', () => {
    const { container } = render(
      <SearchIcon size={16} className="custom-search" />,
    )
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(svg?.getAttribute('width')).toBe('16')
    expect(svg?.getAttribute('height')).toBe('16')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect(svg?.classList.contains('icon-search')).toBe(true)
    expect(svg?.classList.contains('custom-search')).toBe(true)

    expect(svg?.querySelector('circle')).toBeInTheDocument()
    expect(svg?.querySelector('line')).toBeInTheDocument()
  })
})

describe('ChiliIcon', () => {
  it('renders chili SVG with 16x16 viewBox, filled/empty styling, and accessible attributes', () => {
    const { container: filledContainer } = render(
      <ChiliIcon size={14} filled={true} className="custom-chili" />,
    )
    const filledSvg = filledContainer.querySelector('svg')
    expect(filledSvg).toBeInTheDocument()
    expect(filledSvg?.getAttribute('viewBox')).toBe('0 0 36 36')
    expect(filledSvg?.getAttribute('width')).toBe('14')
    expect(filledSvg?.getAttribute('height')).toBe('14')
    expect(filledSvg?.getAttribute('aria-hidden')).toBe('true')
    expect(filledSvg?.classList.contains('icon-chili')).toBe(true)
    expect(filledSvg?.classList.contains('is-filled')).toBe(true)
    expect(filledSvg?.classList.contains('custom-chili')).toBe(true)

    const { container: emptyContainer } = render(
      <ChiliIcon size={12} filled={false} />,
    )
    const emptySvg = emptyContainer.querySelector('svg')
    expect(emptySvg?.classList.contains('is-empty')).toBe(true)
  })
})
