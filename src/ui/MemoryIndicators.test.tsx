import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import {
  ProgressBubbles,
  ChiliMeter,
  MemoryIndicators,
} from './MemoryIndicators'
import type { ReviewSchedule } from '../domain/card'

describe('MasteryBubbles', () => {
  it('renders 0 of 3 bubbles with empty circles', () => {
    const { container } = render(<ProgressBubbles level={0} />)
    const span = container.querySelector('.progress-bubbles')
    expect(span).toBeInTheDocument()
    expect(span).toHaveAttribute('role', 'img')
    expect(span).toHaveAttribute('aria-label', 'Mastery: 0 of 3 bubbles')
    const filledCircles = container.querySelectorAll('.bubble-dot.is-filled')
    expect(filledCircles.length).toBe(0)
    const emptyCircles = container.querySelectorAll('.bubble-dot.is-empty')
    expect(emptyCircles.length).toBe(3)
  })

  it('renders 2 of 3 bubbles with two filled circles and one empty', () => {
    const { container } = render(<ProgressBubbles level={2} />)
    const span = container.querySelector('.progress-bubbles')
    expect(span).toHaveAttribute('aria-label', 'Mastery: 2 of 3 bubbles')
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

  it('supports ariaHidden to suppress accessible name and title for decorative usage', () => {
    const { container } = render(
      <ProgressBubbles level={2} ariaHidden={true} />,
    )
    const span = container.querySelector('.progress-bubbles')
    expect(span).toHaveAttribute('aria-hidden', 'true')
    expect(span).not.toHaveAttribute('role')
    expect(span).not.toHaveAttribute('aria-label')
    expect(span).not.toHaveAttribute('title')
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

  it('always renders all 3 chilies even when level is 0', () => {
    const { container } = render(<ChiliMeter level={0} />)
    const meter = container.querySelector('.chili-meter')
    expect(meter).toBeInTheDocument()
    const emptySvgs = container.querySelectorAll('svg.icon-chili.is-empty')
    expect(emptySvgs.length).toBe(3)
  })

  it('supports ariaHidden to suppress accessible name and title for decorative usage', () => {
    const { container } = render(<ChiliMeter level={2} ariaHidden={true} />)
    const span = container.querySelector('.chili-meter')
    expect(span).toHaveAttribute('aria-hidden', 'true')
    expect(span).not.toHaveAttribute('role')
    expect(span).not.toHaveAttribute('aria-label')
    expect(span).not.toHaveAttribute('title')
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

  it('renders both bubbles and chilies in compact mode even when card difficulty is 0', () => {
    const sched: ReviewSchedule = {
      state: 'new',
      dueAt: Date.now(),
      intervalDays: 0,
      easeFactor: 2.5,
      reviews: 0,
      lapses: 0,
      stability: 0,
      difficulty: 0,
    }
    const { container } = render(
      <MemoryIndicators schedule={sched} compact={true} />,
    )
    expect(container.querySelector('.progress-bubbles')).toBeInTheDocument()
    expect(container.querySelector('.chili-meter')).toBeInTheDocument()
  })
})
