import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import {
  ProgressBubbles,
  ChiliMeter,
  MemoryIndicators,
} from './MemoryIndicators'
import type { ReviewSchedule } from '../domain/card'

describe('ProgressBubbles', () => {
  it('renders 0 of 3 bubbles with empty circles', () => {
    const { container } = render(<ProgressBubbles level={0} />)
    const span = container.querySelector('.progress-bubbles')
    expect(span).toBeInTheDocument()
    expect(span).toHaveAttribute('role', 'img')
    expect(span).toHaveAttribute('aria-label', 'Progress: 0 of 3 bubbles')
    const filledCircles = container.querySelectorAll('.bubble-dot.is-filled')
    expect(filledCircles.length).toBe(0)
    const emptyCircles = container.querySelectorAll('.bubble-dot.is-empty')
    expect(emptyCircles.length).toBe(3)
  })

  it('renders 2 of 3 bubbles with two filled circles and one empty', () => {
    const { container } = render(<ProgressBubbles level={2} />)
    const span = container.querySelector('.progress-bubbles')
    expect(span).toHaveAttribute('aria-label', 'Progress: 2 of 3 bubbles')
    const filledCircles = container.querySelectorAll('.bubble-dot.is-filled')
    expect(filledCircles.length).toBe(2)
    const emptyCircles = container.querySelectorAll('.bubble-dot.is-empty')
    expect(emptyCircles.length).toBe(1)
  })

  it('renders 3 of 3 bubbles when mastered', () => {
    const { container } = render(<ProgressBubbles level={3} />)
    const filledCircles = container.querySelectorAll('.bubble-dot.is-filled')
    expect(filledCircles.length).toBe(3)
  })
})

describe('ChiliMeter', () => {
  it('renders 0 chilies with dimmed outlines when unrated', () => {
    const { container } = render(<ChiliMeter level={0} />)
    const span = container.querySelector('.chili-meter')
    expect(span).toBeInTheDocument()
    expect(span).toHaveAttribute('role', 'img')
    expect(span).toHaveAttribute(
      'aria-label',
      'Difficulty: 0 of 3 chilies (no heat)',
    )
    const svgs = container.querySelectorAll('svg.icon-chili')
    expect(svgs.length).toBe(3)
    const filledSvgs = container.querySelectorAll('svg.icon-chili.is-filled')
    expect(filledSvgs.length).toBe(0)
  })

  it('renders 2 filled chilies and 1 dimmed empty chili for medium difficulty', () => {
    const { container } = render(<ChiliMeter level={2} />)
    const span = container.querySelector('.chili-meter')
    expect(span).toHaveAttribute('aria-label', 'Difficulty: 2 of 3 chilies')
    const filledSvgs = container.querySelectorAll('svg.icon-chili.is-filled')
    expect(filledSvgs.length).toBe(2)
    const emptySvgs = container.querySelectorAll('svg.icon-chili.is-empty')
    expect(emptySvgs.length).toBe(1)
  })

  it('renders 3 filled chilies for spicy difficulty', () => {
    const { container } = render(<ChiliMeter level={3} />)
    const filledSvgs = container.querySelectorAll('svg.icon-chili.is-filled')
    expect(filledSvgs.length).toBe(3)
  })
})

describe('MemoryIndicators', () => {
  it('renders both bubbles and chilies from review schedule', () => {
    const sched: ReviewSchedule = {
      state: 'review',
      dueAt: Date.now(),
      intervalDays: 20,
      easeFactor: 2.5,
      reviews: 5,
      lapses: 0,
      stability: 18.0,
      difficulty: 8.0,
    }
    const { container } = render(<MemoryIndicators schedule={sched} />)
    expect(container.querySelector('.memory-indicators')).toBeInTheDocument()
    expect(container.querySelector('.progress-bubbles')).toBeInTheDocument()
    expect(container.querySelector('.chili-meter')).toBeInTheDocument()
    expect(
      container.querySelector('.progress-bubbles.level-2'),
    ).toBeInTheDocument()
    expect(container.querySelector('.chili-meter.level-3')).toBeInTheDocument()
  })
})
