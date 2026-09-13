import { describe, expect, it } from 'vitest'
import { getCardScheduleBadge } from './card-badge'
import { createStudyCards, type StudyCard } from '../domain/card'

function makeCard(schedule: Partial<StudyCard['schedule']>): StudyCard {
  const cards = createStudyCards(
    { spanish: 'hola', english: 'hello', context: '', bidirectional: false },
    'note-1',
    1000,
  )
  const base = cards[0]!
  return {
    ...base,
    schedule: {
      ...base.schedule,
      ...schedule,
    },
  }
}

describe('getCardScheduleBadge', () => {
  it('returns "Due now" when card is due at current time', () => {
    const card = makeCard({ state: 'review', dueAt: 1000 })
    expect(getCardScheduleBadge(card, 1000)).toEqual({
      label: 'Due now',
      type: 'due',
    })
    expect(getCardScheduleBadge(card, 2000)).toEqual({
      label: 'Due now',
      type: 'due',
    })
  })

  it('returns "Unstudied" when card is in new state and not yet due', () => {
    const card = makeCard({ state: 'new', dueAt: 2000 })
    expect(getCardScheduleBadge(card, 1000)).toEqual({
      label: 'Unstudied',
      type: 'new',
    })
  })

  it('returns "Learning" when card is in learning or relearning state and not due', () => {
    const learningCard = makeCard({ state: 'learning', dueAt: 2000 })
    expect(getCardScheduleBadge(learningCard, 1000)).toEqual({
      label: 'Learning',
      type: 'learning',
    })

    const relearningCard = makeCard({ state: 'relearning', dueAt: 2000 })
    expect(getCardScheduleBadge(relearningCard, 1000)).toEqual({
      label: 'Learning',
      type: 'learning',
    })
  })

  it('returns "Due in Xd" for review cards scheduled in the future', () => {
    const oneDayMs = 24 * 60 * 60 * 1000
    const card = makeCard({ state: 'review', dueAt: 1000 + oneDayMs * 5 })
    expect(getCardScheduleBadge(card, 1000)).toEqual({
      label: 'Due in 5d',
      type: 'review',
    })

    const shortReviewCard = makeCard({ state: 'review', dueAt: 1000 + 3600000 })
    expect(getCardScheduleBadge(shortReviewCard, 1000)).toEqual({
      label: 'Due in 1d',
      type: 'review',
    })
  })
})
