import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createStudyCards } from '../domain/card'
import { PracticeCard } from './PracticeCard'
import type { HapticsPlayer } from '../application/ports'

function createMockHaptics() {
  const trigger = vi.fn()
  const haptics: HapticsPlayer = {
    trigger,
  }
  return { trigger, haptics }
}

const mockCards = createStudyCards(
  {
    spanish: 'hola',
    english: 'hello',
    context: 'friendly greeting',
    bidirectional: false,
  },
  'test-batch',
  0,
)

describe('PracticeCard Gestural Practice Canvas (Milestone 1)', () => {
  it('swipes left to grade "again" with deferred exit animation and haptics', () => {
    vi.useFakeTimers()
    const card = mockCards[0]!
    const onGrade = vi.fn()
    const { trigger, haptics } = createMockHaptics()

    const { container } = render(
      <PracticeCard
        card={card}
        prompt={<h1>{card.prompt}</h1>}
        answer=""
        revealed={true}
        onAnswerChange={vi.fn()}
        onReveal={vi.fn()}
        onGrade={onGrade}
        onPlayAnswer={vi.fn()}
        paused={false}
        audioUnavailable={false}
        haptics={haptics}
      />,
    )

    const studyCard = container.querySelector('.study-card')!

    // Start touch drag
    fireEvent.pointerDown(studyCard, {
      clientX: 200,
      clientY: 200,
      button: 0,
      pointerType: 'touch',
    })
    // Move left past threshold (dx = -100)
    fireEvent.pointerMove(studyCard, {
      clientX: 100,
      clientY: 200,
      pointerType: 'touch',
    })

    // Haptic should be triggered when passing decision threshold
    expect(trigger).toHaveBeenCalledWith('selection')

    // Release pointer
    fireEvent.pointerUp(studyCard, {
      clientX: 100,
      clientY: 200,
      pointerType: 'touch',
    })

    // onGrade is deferred while the exit fling animation completes
    expect(onGrade).not.toHaveBeenCalled()

    // Advance through exit animation (200ms)
    vi.advanceTimersByTime(200)
    expect(onGrade).toHaveBeenCalledWith('again')
    vi.useRealTimers()
  })

  it('swipes right to grade "good" with deferred exit animation and haptics', () => {
    vi.useFakeTimers()
    const card = mockCards[0]!
    const onGrade = vi.fn()
    const { trigger, haptics } = createMockHaptics()

    const { container } = render(
      <PracticeCard
        card={card}
        prompt={<h1>{card.prompt}</h1>}
        answer=""
        revealed={true}
        onAnswerChange={vi.fn()}
        onReveal={vi.fn()}
        onGrade={onGrade}
        onPlayAnswer={vi.fn()}
        paused={false}
        audioUnavailable={false}
        haptics={haptics}
      />,
    )

    const studyCard = container.querySelector('.study-card')!

    fireEvent.pointerDown(studyCard, {
      clientX: 200,
      clientY: 200,
      button: 0,
      pointerType: 'touch',
    })
    // Move right past threshold (dx = +100)
    fireEvent.pointerMove(studyCard, {
      clientX: 300,
      clientY: 200,
      pointerType: 'touch',
    })
    expect(trigger).toHaveBeenCalledWith('selection')

    fireEvent.pointerUp(studyCard, {
      clientX: 300,
      clientY: 200,
      pointerType: 'touch',
    })
    expect(onGrade).not.toHaveBeenCalled()

    vi.advanceTimersByTime(200)
    expect(onGrade).toHaveBeenCalledWith('good')
    vi.useRealTimers()
  })

  it('does not trigger grades on vertical touch drags, preserving natural vertical scrolling', () => {
    vi.useFakeTimers()
    const card = mockCards[0]!
    const onGrade = vi.fn()
    const { trigger, haptics } = createMockHaptics()

    const { container } = render(
      <PracticeCard
        card={card}
        prompt={<h1>{card.prompt}</h1>}
        answer=""
        revealed={true}
        onAnswerChange={vi.fn()}
        onReveal={vi.fn()}
        onGrade={onGrade}
        onPlayAnswer={vi.fn()}
        paused={false}
        audioUnavailable={false}
        haptics={haptics}
      />,
    )

    const studyCard = container.querySelector('.study-card')!

    // Swipe up (dy = -100)
    fireEvent.pointerDown(studyCard, {
      clientX: 200,
      clientY: 200,
      button: 0,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(studyCard, {
      clientX: 200,
      clientY: 100,
      pointerType: 'touch',
    })
    fireEvent.pointerUp(studyCard, {
      clientX: 200,
      clientY: 100,
      pointerType: 'touch',
    })

    vi.advanceTimersByTime(300)
    expect(onGrade).not.toHaveBeenCalled()
    expect(trigger).not.toHaveBeenCalled()

    // Swipe down (dy = +100)
    fireEvent.pointerDown(studyCard, {
      clientX: 200,
      clientY: 200,
      button: 0,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(studyCard, {
      clientX: 200,
      clientY: 300,
      pointerType: 'touch',
    })
    fireEvent.pointerUp(studyCard, {
      clientX: 200,
      clientY: 300,
      pointerType: 'touch',
    })

    vi.advanceTimersByTime(300)
    expect(onGrade).not.toHaveBeenCalled()
    expect(trigger).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('ignores mouse/desktop pointer gestures to restore natural text selection and clicks', () => {
    vi.useFakeTimers()
    const card = mockCards[0]!
    const onGrade = vi.fn()
    const onReveal = vi.fn()
    const { trigger, haptics } = createMockHaptics()

    const { container, rerender } = render(
      <PracticeCard
        card={card}
        prompt={<h1>{card.prompt}</h1>}
        answer=""
        revealed={true}
        onAnswerChange={vi.fn()}
        onReveal={onReveal}
        onGrade={onGrade}
        onPlayAnswer={vi.fn()}
        paused={false}
        audioUnavailable={false}
        haptics={haptics}
      />,
    )

    const studyCard = container.querySelector('.study-card')!

    // Mouse drag past threshold (pointerType: 'mouse')
    fireEvent.pointerDown(studyCard, {
      clientX: 200,
      clientY: 200,
      button: 0,
      pointerType: 'mouse',
    })
    fireEvent.pointerMove(studyCard, {
      clientX: 100,
      clientY: 200,
      pointerType: 'mouse',
    })
    fireEvent.pointerUp(studyCard, {
      clientX: 100,
      clientY: 200,
      pointerType: 'mouse',
    })

    vi.advanceTimersByTime(300)
    expect(onGrade).not.toHaveBeenCalled()
    expect(trigger).not.toHaveBeenCalled()

    // Unrevealed mouse click / selection should not tap-to-reveal
    rerender(
      <PracticeCard
        card={card}
        prompt={<h1>{card.prompt}</h1>}
        answer=""
        revealed={false}
        onAnswerChange={vi.fn()}
        onReveal={onReveal}
        onGrade={onGrade}
        onPlayAnswer={vi.fn()}
        paused={false}
        audioUnavailable={false}
        haptics={haptics}
      />,
    )

    const promptHeader = screen.getByRole('heading', { name: card.prompt })
    fireEvent.pointerDown(promptHeader, {
      clientX: 200,
      clientY: 200,
      button: 0,
      pointerType: 'mouse',
    })
    fireEvent.pointerUp(promptHeader, {
      clientX: 201,
      clientY: 201,
      pointerType: 'mouse',
    })

    expect(onReveal).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('springs back and does not grade when drag is below decision threshold', () => {
    const card = mockCards[0]!
    const onGrade = vi.fn()
    const haptics = createMockHaptics()

    const { container } = render(
      <PracticeCard
        card={card}
        prompt={<h1>{card.prompt}</h1>}
        answer=""
        revealed={true}
        onAnswerChange={vi.fn()}
        onReveal={vi.fn()}
        onGrade={onGrade}
        onPlayAnswer={vi.fn()}
        paused={false}
        audioUnavailable={false}
        haptics={haptics}
      />,
    )

    const studyCard = container.querySelector('.study-card')!

    fireEvent.pointerDown(studyCard, {
      clientX: 200,
      clientY: 200,
      button: 0,
      pointerType: 'touch',
    })
    // Move slightly (only 30px, below 75px threshold)
    fireEvent.pointerMove(studyCard, {
      clientX: 230,
      clientY: 200,
      pointerType: 'touch',
    })
    fireEvent.pointerUp(studyCard, {
      clientX: 230,
      clientY: 200,
      pointerType: 'touch',
    })

    expect(onGrade).not.toHaveBeenCalled()
  })

  it('reveals answer on tap when unrevealed and triggers haptic feedback', () => {
    const card = mockCards[0]!
    const onReveal = vi.fn()
    const { trigger, haptics } = createMockHaptics()

    render(
      <PracticeCard
        card={card}
        prompt={<h1>{card.prompt}</h1>}
        answer=""
        revealed={false}
        onAnswerChange={vi.fn()}
        onReveal={onReveal}
        onGrade={vi.fn()}
        onPlayAnswer={vi.fn()}
        paused={false}
        audioUnavailable={false}
        haptics={haptics}
      />,
    )

    // Tap on prompt area with touch
    const promptHeader = screen.getByRole('heading', { name: card.prompt })
    fireEvent.pointerDown(promptHeader, {
      clientX: 200,
      clientY: 200,
      button: 0,
      pointerType: 'touch',
    })
    fireEvent.pointerUp(promptHeader, {
      clientX: 202,
      clientY: 201,
      pointerType: 'touch',
    })

    expect(onReveal).toHaveBeenCalledTimes(1)
    expect(trigger).toHaveBeenCalledWith('selection')
  })

  it('does not initiate drag or swipe when interacting with the answer input field', () => {
    const card = mockCards[0]!
    const onReveal = vi.fn()
    const haptics = createMockHaptics()

    render(
      <PracticeCard
        card={card}
        prompt={<h1>{card.prompt}</h1>}
        answer=""
        revealed={false}
        onAnswerChange={vi.fn()}
        onReveal={onReveal}
        onGrade={vi.fn()}
        onPlayAnswer={vi.fn()}
        paused={false}
        audioUnavailable={false}
        haptics={haptics}
      />,
    )

    const input = screen.getByRole('textbox')

    fireEvent.pointerDown(input, {
      clientX: 200,
      clientY: 200,
      button: 0,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(input, {
      clientX: 100,
      clientY: 200,
      pointerType: 'touch',
    })
    fireEvent.pointerUp(input, {
      clientX: 100,
      clientY: 200,
      pointerType: 'touch',
    })

    expect(onReveal).not.toHaveBeenCalled()
  })

  it('renders horizontal dynamic gesture overlay badges (again and good) in revealed state', () => {
    const card = mockCards[0]!

    const { container } = render(
      <PracticeCard
        card={card}
        prompt={<h1>{card.prompt}</h1>}
        answer=""
        revealed={true}
        onAnswerChange={vi.fn()}
        onReveal={vi.fn()}
        onGrade={vi.fn()}
        onPlayAnswer={vi.fn()}
        paused={false}
        audioUnavailable={false}
      />,
    )

    expect(
      container.querySelector('.gesture-zone-badge.zone-again'),
    ).toBeInTheDocument()
    expect(
      container.querySelector('.gesture-zone-badge.zone-good'),
    ).toBeInTheDocument()
    expect(
      container.querySelector('.gesture-zone-badge.zone-easy'),
    ).not.toBeInTheDocument()
    expect(
      container.querySelector('.gesture-zone-badge.zone-hard'),
    ).not.toBeInTheDocument()
  })

  it('does not reveal on horizontal swipe when unrevealed', () => {
    const card = mockCards[0]!
    const onReveal = vi.fn()
    const { trigger, haptics } = createMockHaptics()

    const { container } = render(
      <PracticeCard
        card={card}
        prompt={<h1>{card.prompt}</h1>}
        answer=""
        revealed={false}
        onAnswerChange={vi.fn()}
        onReveal={onReveal}
        onGrade={vi.fn()}
        onPlayAnswer={vi.fn()}
        paused={false}
        audioUnavailable={false}
        haptics={haptics}
      />,
    )

    const studyCard = container.querySelector('.study-card')!

    // Horizontal swipe (dx = 120px, dy = 0)
    fireEvent.pointerDown(studyCard, {
      clientX: 100,
      clientY: 200,
      button: 0,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(studyCard, {
      clientX: 220,
      clientY: 200,
      pointerType: 'touch',
    })
    fireEvent.pointerUp(studyCard, {
      clientX: 220,
      clientY: 200,
      pointerType: 'touch',
    })

    expect(onReveal).not.toHaveBeenCalled()
    expect(trigger).not.toHaveBeenCalled()
  })

  it('does not reveal on swipe up if drag started on the answer input', () => {
    const card = mockCards[0]!
    const onReveal = vi.fn()
    const { trigger, haptics } = createMockHaptics()

    render(
      <PracticeCard
        card={card}
        prompt={<h1>{card.prompt}</h1>}
        answer=""
        revealed={false}
        onAnswerChange={vi.fn()}
        onReveal={onReveal}
        onGrade={vi.fn()}
        onPlayAnswer={vi.fn()}
        paused={false}
        audioUnavailable={false}
        haptics={haptics}
      />,
    )

    const input = screen.getByRole('textbox')

    // Swipe up starting on input
    fireEvent.pointerDown(input, {
      clientX: 200,
      clientY: 300,
      button: 0,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(input, {
      clientX: 200,
      clientY: 200,
      pointerType: 'touch',
    })
    fireEvent.pointerUp(input, {
      clientX: 200,
      clientY: 200,
      pointerType: 'touch',
    })

    expect(onReveal).not.toHaveBeenCalled()
    expect(trigger).not.toHaveBeenCalled()
  })

  it('ignores secondary button (right click) for card drag gestures', () => {
    const card = mockCards[0]!
    const onGrade = vi.fn()
    const { trigger, haptics } = createMockHaptics()

    const { container } = render(
      <PracticeCard
        card={card}
        prompt={<h1>{card.prompt}</h1>}
        answer=""
        revealed={true}
        onAnswerChange={vi.fn()}
        onReveal={vi.fn()}
        onGrade={onGrade}
        onPlayAnswer={vi.fn()}
        paused={false}
        audioUnavailable={false}
        haptics={haptics}
      />,
    )

    const studyCard = container.querySelector('.study-card')!

    // Right click (button = 2)
    fireEvent.pointerDown(studyCard, {
      clientX: 200,
      clientY: 200,
      button: 2,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(studyCard, {
      clientX: 100,
      clientY: 200,
      pointerType: 'touch',
    })
    fireEvent.pointerUp(studyCard, {
      clientX: 100,
      clientY: 200,
      button: 2,
      pointerType: 'touch',
    })

    expect(onGrade).not.toHaveBeenCalled()
    expect(trigger).not.toHaveBeenCalled()
  })

  it('recovers from exit animation if the same card repeats in queue', () => {
    vi.useFakeTimers()
    const card = mockCards[0]!
    const onGrade = vi.fn()
    const onReveal = vi.fn()

    const { container, rerender } = render(
      <PracticeCard
        card={card}
        prompt={<h1>{card.prompt}</h1>}
        answer=""
        revealed={true}
        onAnswerChange={vi.fn()}
        onReveal={onReveal}
        onGrade={onGrade}
        onPlayAnswer={vi.fn()}
        paused={false}
        audioUnavailable={false}
      />,
    )

    const studyCard = container.querySelector('.study-card')!

    // Grade again (swipe left)
    fireEvent.pointerDown(studyCard, {
      clientX: 200,
      clientY: 200,
      button: 0,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(studyCard, {
      clientX: 100,
      clientY: 200,
      pointerType: 'touch',
    })
    fireEvent.pointerUp(studyCard, {
      clientX: 100,
      clientY: 200,
      pointerType: 'touch',
    })

    vi.advanceTimersByTime(200)
    expect(onGrade).toHaveBeenCalledWith('again')

    // Same card remains, flipped back to unrevealed
    rerender(
      <PracticeCard
        card={card}
        prompt={<h1>{card.prompt}</h1>}
        answer=""
        revealed={false}
        onAnswerChange={vi.fn()}
        onReveal={onReveal}
        onGrade={onGrade}
        onPlayAnswer={vi.fn()}
        paused={false}
        audioUnavailable={false}
      />,
    )

    // Tap to reveal should now work immediately
    fireEvent.pointerDown(studyCard, {
      clientX: 200,
      clientY: 200,
      button: 0,
      pointerType: 'touch',
    })
    fireEvent.pointerUp(studyCard, {
      clientX: 201,
      clientY: 201,
      pointerType: 'touch',
    })

    expect(onReveal).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
