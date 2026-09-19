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
  it('swipes left to grade "again" and triggers haptic threshold feedback', () => {
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

    // Start drag
    fireEvent.pointerDown(studyCard, { clientX: 200, clientY: 200, button: 0 })
    // Move left past threshold (80px left: dx = -100)
    fireEvent.pointerMove(studyCard, { clientX: 100, clientY: 200 })

    // Haptic should be triggered when passing decision threshold
    expect(trigger).toHaveBeenCalledWith('selection')

    // Release pointer
    fireEvent.pointerUp(studyCard, { clientX: 100, clientY: 200 })

    expect(onGrade).toHaveBeenCalledWith('again')
  })

  it('swipes right to grade "good" and triggers haptic threshold feedback', () => {
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

    fireEvent.pointerDown(studyCard, { clientX: 200, clientY: 200, button: 0 })
    // Move right past threshold (dx = +100)
    fireEvent.pointerMove(studyCard, { clientX: 300, clientY: 200 })
    expect(trigger).toHaveBeenCalledWith('selection')

    fireEvent.pointerUp(studyCard, { clientX: 300, clientY: 200 })
    expect(onGrade).toHaveBeenCalledWith('good')
  })

  it('swipes up to grade "easy" and triggers haptic threshold feedback', () => {
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

    fireEvent.pointerDown(studyCard, { clientX: 200, clientY: 200, button: 0 })
    // Move up past threshold (dy = -100)
    fireEvent.pointerMove(studyCard, { clientX: 200, clientY: 100 })
    expect(trigger).toHaveBeenCalledWith('selection')

    fireEvent.pointerUp(studyCard, { clientX: 200, clientY: 100 })
    expect(onGrade).toHaveBeenCalledWith('easy')
  })

  it('swipes down to grade "hard" and triggers haptic threshold feedback', () => {
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

    fireEvent.pointerDown(studyCard, { clientX: 200, clientY: 200, button: 0 })
    // Move down past threshold (dy = +100)
    fireEvent.pointerMove(studyCard, { clientX: 200, clientY: 300 })
    expect(trigger).toHaveBeenCalledWith('selection')

    fireEvent.pointerUp(studyCard, { clientX: 200, clientY: 300 })
    expect(onGrade).toHaveBeenCalledWith('hard')
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

    fireEvent.pointerDown(studyCard, { clientX: 200, clientY: 200, button: 0 })
    // Move slightly (only 30px, below 75px threshold)
    fireEvent.pointerMove(studyCard, { clientX: 230, clientY: 200 })
    fireEvent.pointerUp(studyCard, { clientX: 230, clientY: 200 })

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

    // Tap on prompt area
    const promptHeader = screen.getByRole('heading', { name: card.prompt })
    fireEvent.pointerDown(promptHeader, {
      clientX: 200,
      clientY: 200,
      button: 0,
    })
    fireEvent.pointerUp(promptHeader, { clientX: 202, clientY: 201 })

    expect(onReveal).toHaveBeenCalledTimes(1)
    expect(trigger).toHaveBeenCalledWith('selection')
  })

  it('reveals answer on swipe up when unrevealed', () => {
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

    fireEvent.pointerDown(studyCard, { clientX: 200, clientY: 300, button: 0 })
    fireEvent.pointerMove(studyCard, { clientX: 200, clientY: 220 })
    fireEvent.pointerUp(studyCard, { clientX: 200, clientY: 220 })

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

    fireEvent.pointerDown(input, { clientX: 200, clientY: 200, button: 0 })
    fireEvent.pointerMove(input, { clientX: 100, clientY: 200 })
    fireEvent.pointerUp(input, { clientX: 100, clientY: 200 })

    expect(onReveal).not.toHaveBeenCalled()
  })

  it('renders all four dynamic gesture overlay badges in revealed state', () => {
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
    ).toBeInTheDocument()
    expect(
      container.querySelector('.gesture-zone-badge.zone-hard'),
    ).toBeInTheDocument()
  })
})
