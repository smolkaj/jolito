import { describe, expect, it } from 'vitest'
import {
  chooseScene,
  createStudyCards,
  intervalLabel,
  isDue,
  nextIntervalDays,
  scheduleReview,
  type ReviewSchedule,
} from './card'

const now = Date.UTC(2026, 7, 21)

describe('createStudyCards', () => {
  it('creates linked directions with independently editable reverse text', () => {
    const cards = createStudyCards(
      {
        spanish: '  ¿Me lo pone para llevar? ',
        english: ' Can you make it to go? ',
        context: '  Polite in a restaurant. ',
        bidirectional: true,
        reversePrompt: 'Could I get this to go?',
        reverseAnswer: '¿Me lo puede poner para llevar?',
      },
      'note-1',
      now,
    )

    expect(cards).toHaveLength(2)
    expect(cards[0]).toMatchObject({
      id: 'note-1:es-en',
      prompt: '¿Me lo pone para llevar?',
      answer: 'Can you make it to go?',
      context: 'Polite in a restaurant.',
      direction: 'es-en',
      scene: 'takeaway',
      schedule: { dueAt: now, intervalDays: 0 },
    })
    expect(cards[1]).toMatchObject({
      id: 'note-1:en-es',
      prompt: 'Could I get this to go?',
      answer: '¿Me lo puede poner para llevar?',
      direction: 'en-es',
    })
  })

  it('mirrors the concise text by default and supports one-way cards', () => {
    const reverse = createStudyCards(
      {
        spanish: 'Qué padre',
        english: 'How cool',
        context: '',
        bidirectional: true,
      },
      'note-2',
      now,
    )
    expect(reverse[1]).toMatchObject({
      prompt: 'How cool',
      answer: 'Qué padre',
    })

    expect(
      createStudyCards(
        {
          spanish: 'hola',
          english: 'hello',
          context: '',
          bidirectional: false,
        },
        'note-3',
        now,
      ),
    ).toHaveLength(1)
    expect(
      createStudyCards(
        {
          spanish: '   ',
          english: 'hello',
          context: '',
          bidirectional: true,
        },
        'empty',
        now,
      ),
    ).toEqual([])
  })
})

describe('illustration selection', () => {
  it('selects a useful scene from either language', () => {
    expect(chooseScene('¿Dónde está el metro?')).toBe('metro')
    expect(chooseScene('¿Dónde está la estación?')).toBe('metro')
    expect(chooseScene('A coffee, please')).toBe('takeaway')
    expect(chooseScene('Un café con leche, por favor')).toBe('takeaway')
    expect(chooseScene('Mucho gusto')).toBe('conversation')
  })
})

describe('review scheduling', () => {
  const schedule: ReviewSchedule = {
    dueAt: now,
    intervalDays: 5,
    reviews: 2,
    lapses: 1,
  }
  const card = createStudyCards(
    {
      spanish: 'sale',
      english: 'sounds good',
      context: '',
      bidirectional: false,
    },
    'schedule',
    now,
  )[0]!

  it('uses gentle, predictable intervals for each self-grade', () => {
    expect(nextIntervalDays(schedule, 'again')).toBe(0)
    expect(nextIntervalDays(schedule, 'hard')).toBe(6)
    expect(nextIntervalDays(schedule, 'good')).toBe(12)
    expect(nextIntervalDays(schedule, 'easy')).toBe(16)
    expect(nextIntervalDays(card.schedule, 'hard')).toBe(1)
    expect(nextIntervalDays(card.schedule, 'good')).toBe(3)
    expect(nextIntervalDays(card.schedule, 'easy')).toBe(7)
  })

  it('records reviews, lapses, and the next due time', () => {
    const again = scheduleReview(card, 'again', now)
    expect(again.schedule).toEqual({
      dueAt: now + 60_000,
      intervalDays: 0,
      reviews: 1,
      lapses: 1,
    })
    expect(isDue(again, now)).toBe(false)
    expect(isDue(again, now + 60_000)).toBe(true)

    const good = scheduleReview({ ...card, schedule }, 'good', now)
    expect(good.schedule).toMatchObject({
      dueAt: now + 12 * 24 * 60 * 60 * 1000,
      intervalDays: 12,
      reviews: 3,
      lapses: 1,
    })
  })

  it('describes intervals in compact learner-facing language', () => {
    expect(intervalLabel(card, 'again')).toBe('< 1 min')
    expect(intervalLabel(card, 'hard')).toBe('1 day')
    expect(intervalLabel(card, 'good')).toBe('3 days')
  })
})
