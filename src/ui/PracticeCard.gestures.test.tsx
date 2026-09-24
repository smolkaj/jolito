import { act, fireEvent, render, screen } from '@testing-library/react'
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

  it('reveals answer on swipe up when unrevealed and triggers haptic feedback', () => {
    vi.useFakeTimers()
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

    // Swipe up on prompt area with touch (dy = -50)
    const promptHeader = screen.getByRole('heading', { name: card.prompt })
    fireEvent.pointerDown(promptHeader, {
      clientX: 200,
      clientY: 200,
      button: 0,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(promptHeader, {
      clientX: 200,
      clientY: 150,
      pointerType: 'touch',
    })
    fireEvent.pointerUp(promptHeader, {
      clientX: 200,
      clientY: 150,
      pointerType: 'touch',
    })

    expect(trigger).toHaveBeenCalledWith('selection')
    expect(onReveal).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('does not reveal answer on single tap when unrevealed, preventing accidental reveals', () => {
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

    // Tap on prompt area with touch (distance < 10)
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

    expect(onReveal).not.toHaveBeenCalled()
    expect(trigger).not.toHaveBeenCalled()
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

  it('unifies gestural discoverability cues into reveal button in unrevealed state and rating buttons in revealed state', () => {
    const card = mockCards[0]!

    // Unrevealed state
    const { container, rerender } = render(
      <PracticeCard
        card={card}
        prompt={<h1>{card.prompt}</h1>}
        answer=""
        revealed={false}
        onAnswerChange={vi.fn()}
        onReveal={vi.fn()}
        onGrade={vi.fn()}
        onPlayAnswer={vi.fn()}
        paused={false}
        audioUnavailable={false}
      />,
    )

    // Redundant cue bar beneath the card is removed completely
    expect(
      container.querySelector('.card-gesture-cue-bar'),
    ).not.toBeInTheDocument()

    // Reveal button itself renders the upward swipe gesture cue
    const revealBtn = container.querySelector('.reveal-button')!
    expect(revealBtn).toBeInTheDocument()
    expect(revealBtn.querySelector('.reveal-gesture-cue')).toHaveTextContent(
      '↑',
    )
    expect(revealBtn).toHaveTextContent('Reveal answer')

    // Revealed state
    rerender(
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

    // Redundant cue bar beneath the card is also removed in revealed state
    expect(
      container.querySelector('.card-gesture-cue-bar'),
    ).not.toBeInTheDocument()

    // Instead, the rating buttons themselves render the directional cues
    const againBtn = container.querySelector('.grade-buttons .grade-again')!
    const goodBtn = container.querySelector('.grade-buttons .grade-good')!
    expect(againBtn).toBeInTheDocument()
    expect(goodBtn).toBeInTheDocument()
    expect(
      againBtn.querySelector('.grade-gesture-cue.cue-again'),
    ).toHaveTextContent('←')
    expect(
      goodBtn.querySelector('.grade-gesture-cue.cue-good'),
    ).toHaveTextContent('→')
  })

  it('activates ready state on reveal button while keeping label and arrow calm when pulling up past threshold', () => {
    const card = mockCards[0]!
    const { trigger, haptics } = createMockHaptics()

    const { container } = render(
      <PracticeCard
        card={card}
        prompt={<h1>{card.prompt}</h1>}
        answer=""
        revealed={false}
        onAnswerChange={vi.fn()}
        onReveal={vi.fn()}
        onGrade={vi.fn()}
        onPlayAnswer={vi.fn()}
        paused={false}
        audioUnavailable={false}
        haptics={haptics}
      />,
    )

    const studyCard = container.querySelector('.study-card')!
    const revealBtn = container.querySelector('.reveal-button')!
    const revealCue = container.querySelector(
      '.reveal-gesture-cue',
    ) as HTMLElement
    expect(revealBtn).toHaveTextContent('Reveal answer')
    expect(revealCue).toHaveTextContent('↑')
    expect(revealBtn).not.toHaveClass('is-gesture-ready')

    // Drag upward past threshold (dy = -60)
    fireEvent.pointerDown(studyCard, {
      clientX: 200,
      clientY: 200,
      button: 0,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(studyCard, {
      clientX: 200,
      clientY: 140,
      pointerType: 'touch',
    })

    expect(revealBtn).toHaveClass('is-gesture-ready')
    expect(revealBtn).toHaveTextContent('Reveal answer')
    expect(revealCue).toHaveTextContent('↑')
    expect(revealCue.style.transform).toMatch(/^translateY\(-[0-9.]+px\)$/)
    expect(trigger).toHaveBeenCalledWith('selection')

    // Pull back down below threshold (dy = -10) -> reverts ready state
    fireEvent.pointerMove(studyCard, {
      clientX: 200,
      clientY: 190,
      pointerType: 'touch',
    })

    expect(revealBtn).not.toHaveClass('is-gesture-ready')
    expect(revealBtn).toHaveTextContent('Reveal answer')
    expect(revealCue).toHaveTextContent('↑')
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

    // Swipe up to reveal should now work immediately
    fireEvent.pointerDown(studyCard, {
      clientX: 200,
      clientY: 200,
      button: 0,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(studyCard, {
      clientX: 200,
      clientY: 150,
      pointerType: 'touch',
    })
    fireEvent.pointerUp(studyCard, {
      clientX: 200,
      clientY: 150,
      pointerType: 'touch',
    })

    vi.advanceTimersByTime(200)
    expect(onReveal).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('reveals on vertical swipe up when unrevealed, but does not reveal on vertical swipe down', () => {
    vi.useFakeTimers()
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

    // Vertical swipe down (dy = +100) -> should NOT reveal
    fireEvent.pointerDown(studyCard, {
      clientX: 200,
      clientY: 100,
      button: 0,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(studyCard, {
      clientX: 200,
      clientY: 200,
      pointerType: 'touch',
    })
    fireEvent.pointerUp(studyCard, {
      clientX: 200,
      clientY: 200,
      pointerType: 'touch',
    })

    expect(onReveal).not.toHaveBeenCalled()
    expect(trigger).not.toHaveBeenCalled()

    // Vertical swipe up (dy = -60) -> SHOULD reveal
    fireEvent.pointerDown(studyCard, {
      clientX: 200,
      clientY: 260,
      button: 0,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(studyCard, {
      clientX: 200,
      clientY: 200,
      pointerType: 'touch',
    })
    fireEvent.pointerUp(studyCard, {
      clientX: 200,
      clientY: 200,
      pointerType: 'touch',
    })

    expect(trigger).toHaveBeenCalledWith('selection')
    vi.advanceTimersByTime(200)
    expect(onReveal).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('ignores grade button clicks and keyboard shortcuts during exit animation, preventing double grading', () => {
    vi.useFakeTimers()
    const card = mockCards[0]!
    const onGrade = vi.fn()

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
      />,
    )

    const studyCard = container.querySelector('.study-card')!

    // Swipe left (again) past threshold
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

    // During the 200ms exit animation: attempt to click grade button "Good"
    const goodButton = screen.getByRole('button', { name: /good/i })
    fireEvent.click(goodButton)

    // Attempt to press keyboard shortcut '1' during exit animation
    fireEvent.keyDown(window, { key: '1' })

    // No premature or duplicate grading has occurred yet
    expect(onGrade).not.toHaveBeenCalled()

    // Complete the exit animation
    vi.advanceTimersByTime(200)

    // Exactly one grade for 'again' (from the initial swipe) is submitted
    expect(onGrade).toHaveBeenCalledTimes(1)
    expect(onGrade).toHaveBeenCalledWith('again')
    vi.useRealTimers()
  })

  it('immediately resets drag offset and animation state when advancing to a new card in the deck', () => {
    vi.useFakeTimers()
    const card1 = mockCards[0]!
    const card2 = createStudyCards(
      {
        spanish: 'gracias',
        english: 'thank you',
        context: '',
        bidirectional: false,
      },
      'batch-2',
      1000,
    )[0]!
    const onGrade = vi.fn()

    const { container, rerender } = render(
      <PracticeCard
        card={card1}
        prompt={<h1>{card1.prompt}</h1>}
        answer=""
        revealed={true}
        onAnswerChange={vi.fn()}
        onReveal={vi.fn()}
        onGrade={onGrade}
        onPlayAnswer={vi.fn()}
        paused={false}
        audioUnavailable={false}
      />,
    )

    const studyCard = container.querySelector('.study-card')!

    // Swipe right (good)
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

    // Advance 200ms to finish exit fling
    vi.advanceTimersByTime(200)
    expect(onGrade).toHaveBeenCalledWith('good')

    // Parent immediately passes the next card
    rerender(
      <PracticeCard
        card={card2}
        prompt={<h1>{card2.prompt}</h1>}
        answer=""
        revealed={false}
        onAnswerChange={vi.fn()}
        onReveal={vi.fn()}
        onGrade={onGrade}
        onPlayAnswer={vi.fn()}
        paused={false}
        audioUnavailable={false}
      />,
    )

    // New card should have no residual transform offset
    expect(studyCard).not.toHaveClass('is-dragging')
    expect(studyCard).toHaveStyle({ transform: 'none' })
    vi.useRealTimers()
  })

  it('grades immediately without exit animation delay when prefers-reduced-motion is active', () => {
    vi.useFakeTimers()
    const originalMatchMedia =
      typeof window.matchMedia === 'function'
        ? window.matchMedia.bind(window)
        : undefined
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string): MediaQueryList => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    try {
      const card = mockCards[0]!
      const onGrade = vi.fn()

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
        />,
      )

      const studyCard = container.querySelector('.study-card')!

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

      vi.advanceTimersByTime(0)
      expect(onGrade).toHaveBeenCalledWith('again')
    } finally {
      if (originalMatchMedia) {
        window.matchMedia = originalMatchMedia
      } else {
        delete (window as { matchMedia?: unknown }).matchMedia
      }
      vi.useRealTimers()
    }
  })

  it('provides interactive release feedback in grade buttons when crossing horizontal swipe thresholds', () => {
    const card = mockCards[0]!
    const { trigger, haptics } = createMockHaptics()

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
        haptics={haptics}
      />,
    )

    const studyCard = container.querySelector('.study-card')!
    const againBtn = container.querySelector('.grade-buttons .grade-again')!
    const goodBtn = container.querySelector('.grade-buttons .grade-good')!
    const againCue = againBtn.querySelector('.grade-gesture-cue.cue-again')!
    const goodCue = goodBtn.querySelector('.grade-gesture-cue.cue-good')!

    expect(againCue).toHaveTextContent('←')
    expect(goodCue).toHaveTextContent('→')
    expect(againBtn).not.toHaveClass('is-gesture-active')
    expect(goodBtn).not.toHaveClass('is-gesture-active')

    // 1. Drag right past threshold (dx = +110) -> Good
    fireEvent.pointerDown(studyCard, {
      clientX: 200,
      clientY: 200,
      button: 0,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(studyCard, {
      clientX: 310,
      clientY: 200,
      pointerType: 'touch',
    })

    expect(goodBtn).toHaveClass('is-gesture-active')
    const activeGoodCue = goodBtn.querySelector(
      '.grade-gesture-cue.cue-good',
    ) as HTMLElement
    expect(activeGoodCue).toHaveTextContent('✓')
    expect(activeGoodCue.style.transform).toContain('scale(1.2)')
    expect(againBtn).not.toHaveClass('is-gesture-active')
    expect(trigger).toHaveBeenCalledWith('selection')

    // Drag back below threshold (dx = +40)
    fireEvent.pointerMove(studyCard, {
      clientX: 240,
      clientY: 200,
      pointerType: 'touch',
    })

    expect(goodBtn).not.toHaveClass('is-gesture-active')
    expect(
      goodBtn.querySelector('.grade-gesture-cue.cue-good'),
    ).toHaveTextContent('→')

    // 2. Drag left past threshold (dx = -110) -> Again
    fireEvent.pointerMove(studyCard, {
      clientX: 90,
      clientY: 200,
      pointerType: 'touch',
    })

    expect(againBtn).toHaveClass('is-gesture-active')
    const activeAgainCue = againBtn.querySelector(
      '.grade-gesture-cue.cue-again',
    ) as HTMLElement
    expect(activeAgainCue).toHaveTextContent('↺')
    expect(activeAgainCue.style.transform).toContain('scale(1.2)')
    expect(goodBtn).not.toHaveClass('is-gesture-active')

    // Drag back to neutral center (dx = 0)
    fireEvent.pointerMove(studyCard, {
      clientX: 200,
      clientY: 200,
      pointerType: 'touch',
    })

    expect(againBtn).not.toHaveClass('is-gesture-active')
    expect(
      againBtn.querySelector('.grade-gesture-cue.cue-again'),
    ).toHaveTextContent('←')
    expect(
      goodBtn.querySelector('.grade-gesture-cue.cue-good'),
    ).toHaveTextContent('→')

    fireEvent.pointerUp(studyCard, {
      clientX: 200,
      clientY: 200,
      pointerType: 'touch',
    })
  })

  it('respects prefers-reduced-motion by suppressing inline arrow translations and transforms', () => {
    const card = mockCards[0]!
    const originalMatchMedia =
      typeof window.matchMedia === 'function'
        ? window.matchMedia.bind(window)
        : undefined
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string): MediaQueryList => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    try {
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

      const studyCard = container.querySelector('.study-card')!
      const leftArrow = container.querySelector(
        '.grade-gesture-cue.cue-again',
      ) as HTMLElement
      const rightArrow = container.querySelector(
        '.grade-gesture-cue.cue-good',
      ) as HTMLElement

      // Drag left sub-threshold
      fireEvent.pointerDown(studyCard, {
        clientX: 200,
        clientY: 200,
        button: 0,
        pointerType: 'touch',
      })
      fireEvent.pointerMove(studyCard, {
        clientX: 150,
        clientY: 200,
        pointerType: 'touch',
      })

      // Arrow inline styles should NOT have translateX transform
      expect(leftArrow.style.transform).toBe('')
      expect(rightArrow.style.transform).toBe('')

      // Drag right sub-threshold
      fireEvent.pointerMove(studyCard, {
        clientX: 250,
        clientY: 200,
        pointerType: 'touch',
      })

      expect(leftArrow.style.transform).toBe('')
      expect(rightArrow.style.transform).toBe('')

      fireEvent.pointerUp(studyCard, {
        clientX: 250,
        clientY: 200,
        pointerType: 'touch',
      })

      // Also verify unrevealed reveal-gesture-cue suppresses translateY transform
      const { container: unrevealedContainer } = render(
        <PracticeCard
          card={card}
          prompt={<h1>{card.prompt}</h1>}
          answer=""
          revealed={false}
          onAnswerChange={vi.fn()}
          onReveal={vi.fn()}
          onGrade={vi.fn()}
          onPlayAnswer={vi.fn()}
          paused={false}
          audioUnavailable={false}
        />,
      )
      const unrevealedCard = unrevealedContainer.querySelector('.study-card')!
      const upArrow = unrevealedContainer.querySelector(
        '.reveal-gesture-cue',
      ) as HTMLElement

      fireEvent.pointerDown(unrevealedCard, {
        clientX: 200,
        clientY: 200,
        button: 0,
        pointerType: 'touch',
      })
      fireEvent.pointerMove(unrevealedCard, {
        clientX: 200,
        clientY: 180,
        pointerType: 'touch',
      })
      expect(upArrow.style.transform).toBe('')
      fireEvent.pointerUp(unrevealedCard, {
        clientX: 200,
        clientY: 180,
        pointerType: 'touch',
      })
    } finally {
      if (originalMatchMedia) {
        window.matchMedia = originalMatchMedia
      } else {
        delete (window as { matchMedia?: unknown }).matchMedia
      }
    }
  })

  it('aligns gesture cues spatially with swipe directions (left for Again, right for Good)', () => {
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

    const againBtn = container.querySelector('.grade-buttons .grade-again')!
    const goodBtn = container.querySelector('.grade-buttons .grade-good')!
    const hardBtn = container.querySelector('.grade-buttons .grade-hard')!
    const easyBtn = container.querySelector('.grade-buttons .grade-easy')!

    expect(
      againBtn.querySelector('.grade-gesture-cue.cue-again'),
    ).toHaveTextContent('←')
    expect(
      goodBtn.querySelector('.grade-gesture-cue.cue-good'),
    ).toHaveTextContent('→')
    expect(hardBtn.querySelector('.grade-gesture-cue')).not.toBeInTheDocument()
    expect(easyBtn.querySelector('.grade-gesture-cue')).not.toBeInTheDocument()

    // Verify all 4 buttons have leading and trailing slots for vertical typographic alignment
    for (const btn of [againBtn, goodBtn, hardBtn, easyBtn]) {
      expect(
        btn.querySelector('.grade-gesture-slot.leading'),
      ).toBeInTheDocument()
      expect(
        btn.querySelector('.grade-gesture-slot.trailing'),
      ).toBeInTheDocument()
    }
  })

  it('smoothly settles to rest on swipe up reveal without artificial lift, scale shrink, or dimming', () => {
    vi.useFakeTimers()
    const card = mockCards[0]!
    const onReveal = vi.fn()
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
      />,
    )

    const studyCard = container.querySelector('.study-card') as HTMLElement

    // Drag up past threshold (dy = -60)
    fireEvent.pointerDown(studyCard, {
      clientX: 200,
      clientY: 200,
      button: 0,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(studyCard, {
      clientX: 200,
      clientY: 140,
      pointerType: 'touch',
    })

    // During drag, transform reflects pointer lift with no transition
    expect(studyCard.style.transform).toMatch(
      /translate3d\(0px, -43\..*px, 0px\)/,
    )
    expect(studyCard.style.opacity).toBe('1')

    // Release pointer
    fireEvent.pointerUp(studyCard, {
      clientX: 200,
      clientY: 140,
      pointerType: 'touch',
    })

    // Immediately reveals without 200ms delay
    expect(onReveal).toHaveBeenCalledTimes(1)

    // Enters smooth settling transition back to (0, 0) with full opacity and no scale shrink
    expect(studyCard.style.transform).toBe(
      'translate3d(0px, 0px, 0px) rotate(0deg)',
    )
    expect(studyCard.style.opacity).toBe('1')
    expect(studyCard.style.transition).toContain(
      'transform 260ms cubic-bezier(0.16, 1, 0.3, 1)',
    )

    // After settling duration, inline transform is cleanly cleared to pristine rest
    act(() => {
      vi.advanceTimersByTime(260)
    })
    expect(studyCard.style.transform).toBe('')
    vi.useRealTimers()
  })

  it('smoothly settles to rest when swipe up is cancelled below threshold', () => {
    vi.useFakeTimers()
    const card = mockCards[0]!
    const onReveal = vi.fn()
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
      />,
    )

    const studyCard = container.querySelector('.study-card') as HTMLElement

    // Drag up below threshold (dy = -25)
    fireEvent.pointerDown(studyCard, {
      clientX: 200,
      clientY: 200,
      button: 0,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(studyCard, {
      clientX: 200,
      clientY: 175,
      pointerType: 'touch',
    })

    expect(studyCard.style.transform).toContain('translate3d(0px, -18px, 0px)')

    // Release pointer
    fireEvent.pointerUp(studyCard, {
      clientX: 200,
      clientY: 175,
      pointerType: 'touch',
    })

    expect(onReveal).not.toHaveBeenCalled()
    // Smoothly glides home instead of snapping
    expect(studyCard.style.transform).toBe(
      'translate3d(0px, 0px, 0px) rotate(0deg)',
    )
    expect(studyCard.style.transition).toContain('transform 260ms')

    act(() => {
      vi.advanceTimersByTime(260)
    })
    expect(studyCard.style.transform).toBe('')
    vi.useRealTimers()
  })

  it('smoothly settles to rest when horizontal drag on revealed card is cancelled below threshold', () => {
    vi.useFakeTimers()
    const card = mockCards[0]!
    const onGrade = vi.fn()
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
      />,
    )

    const studyCard = container.querySelector('.study-card') as HTMLElement

    // Drag right below threshold (dx = 30)
    fireEvent.pointerDown(studyCard, {
      clientX: 200,
      clientY: 200,
      button: 0,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(studyCard, {
      clientX: 230,
      clientY: 200,
      pointerType: 'touch',
    })

    expect(studyCard.style.transform).toContain('translate3d(30px, 0px, 0px)')

    fireEvent.pointerUp(studyCard, {
      clientX: 230,
      clientY: 200,
      pointerType: 'touch',
    })

    expect(onGrade).not.toHaveBeenCalled()
    expect(studyCard.style.transform).toBe(
      'translate3d(0px, 0px, 0px) rotate(0deg)',
    )
    expect(studyCard.style.transition).toContain('transform 260ms')

    act(() => {
      vi.advanceTimersByTime(260)
    })
    expect(studyCard.style.transform).toBe('')
    vi.useRealTimers()
  })

  it('cancels settling animation cleanly when a new touch gesture begins mid-settle', () => {
    vi.useFakeTimers()
    const card = mockCards[0]!
    const onReveal = vi.fn()
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
      />,
    )

    const studyCard = container.querySelector('.study-card') as HTMLElement

    // Drag below threshold and release
    fireEvent.pointerDown(studyCard, {
      clientX: 200,
      clientY: 200,
      button: 0,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(studyCard, {
      clientX: 200,
      clientY: 175,
      pointerType: 'touch',
    })
    fireEvent.pointerUp(studyCard, {
      clientX: 200,
      clientY: 175,
      pointerType: 'touch',
    })

    expect(studyCard.style.transform).toBe(
      'translate3d(0px, 0px, 0px) rotate(0deg)',
    )

    // 100ms into the 260ms settling transition, user starts a new drag
    act(() => {
      vi.advanceTimersByTime(100)
    })
    fireEvent.pointerDown(studyCard, {
      clientX: 200,
      clientY: 200,
      button: 0,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(studyCard, {
      clientX: 200,
      clientY: 140,
      pointerType: 'touch',
    })

    // Active drag takes over immediately without delay or conflicting settling timer
    expect(studyCard.style.transform).toMatch(
      /translate3d\(0px, -43\..*px, 0px\)/,
    )
    expect(studyCard.style.transition).toBe('none')

    fireEvent.pointerUp(studyCard, {
      clientX: 200,
      clientY: 140,
      pointerType: 'touch',
    })
    expect(onReveal).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
