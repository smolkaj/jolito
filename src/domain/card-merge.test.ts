import { describe, expect, it } from 'vitest'
import type { StudyCard } from './card'
import { mergeStudyCardsSemantic } from './card-merge'

function makeCard(
  partial: Partial<StudyCard> & { prompt: string; answer: string },
): StudyCard {
  const direction = partial.direction ?? 'es-en'
  const id = partial.id ?? `id-${partial.prompt}-${direction}`
  const noteId = partial.noteId ?? `note-${partial.prompt}`
  return {
    id,
    noteId,
    prompt: partial.prompt,
    answer: partial.answer,
    direction,
    context: partial.context ?? '',
    scene: partial.scene ?? 'conversation',
    schedule: partial.schedule ?? {
      state: 'new',
      dueAt: 0,
      intervalDays: 0,
      easeFactor: 2.5,
      reviews: 0,
      lapses: 0,
    },
    createdAt: partial.createdAt ?? 1000,
  }
}

describe('mergeStudyCardsSemantic', () => {
  it('appends non-overlapping cards cleanly', () => {
    const existing = [makeCard({ prompt: 'aguacate', answer: 'avocado' })]
    const incoming = [makeCard({ prompt: 'qué padre', answer: 'how cool' })]

    const result = mergeStudyCardsSemantic(existing, incoming)
    expect(result.addedCount).toBe(1)
    expect(result.skippedCount).toBe(0)
    expect(result.enrichedCount).toBe(0)
    expect(result.cards).toHaveLength(2)
    expect(result.cards[0]?.prompt).toBe('aguacate')
    expect(result.cards[1]?.prompt).toBe('qué padre')
  })

  it('detects duplicate by semantic key even with different card IDs', () => {
    const existing = [
      makeCard({
        id: 'user-card-1',
        prompt: '¿Mande?',
        answer: 'Pardon?',
        direction: 'es-en',
        schedule: {
          state: 'review',
          dueAt: 50000,
          intervalDays: 14,
          easeFactor: 2.6,
          reviews: 5,
          lapses: 0,
        },
      }),
    ]
    const incoming = [
      makeCard({
        id: 'starter-card-mande',
        prompt: 'mande', // different case and punctuation, but normalized same
        answer: 'Excuse me? / What?',
        direction: 'es-en',
        schedule: {
          state: 'new',
          dueAt: 0,
          intervalDays: 0,
          easeFactor: 2.5,
          reviews: 0,
          lapses: 0,
        },
      }),
    ]

    const result = mergeStudyCardsSemantic(existing, incoming)
    expect(result.addedCount).toBe(0)
    expect(result.skippedCount).toBe(1)
    expect(result.cards).toHaveLength(1)
    expect(result.cards[0]?.id).toBe('user-card-1')
    expect(result.cards[0]?.schedule.intervalDays).toBe(14)
    expect(result.cards[0]?.schedule.reviews).toBe(5)
  })

  it('enriches empty context on existing card when incoming has context', () => {
    const existing = [
      makeCard({
        id: 'c1',
        prompt: 'ahorita',
        answer: 'right now',
        context: '',
        schedule: {
          state: 'review',
          dueAt: 20000,
          intervalDays: 7,
          easeFactor: 2.5,
          reviews: 3,
          lapses: 0,
        },
      }),
    ]
    const incoming = [
      makeCard({
        id: 'c2',
        prompt: 'ahorita',
        answer: 'right now',
        context:
          'Quintessential Mexican idiom that can mean immediately, later, or never.',
      }),
    ]

    const result = mergeStudyCardsSemantic(existing, incoming)
    expect(result.addedCount).toBe(0)
    expect(result.skippedCount).toBe(1)
    expect(result.enrichedCount).toBe(1)
    expect(result.cards[0]?.context).toBe(
      'Quintessential Mexican idiom that can mean immediately, later, or never.',
    )
    expect(result.cards[0]?.schedule.reviews).toBe(3)
  })

  it('does not overwrite non-empty existing context', () => {
    const existing = [
      makeCard({
        id: 'c1',
        prompt: 'ahorita',
        answer: 'right now',
        context: 'My custom personal note from Spanish class',
      }),
    ]
    const incoming = [
      makeCard({
        id: 'c2',
        prompt: 'ahorita',
        answer: 'right now',
        context: 'Starter deck explanation',
      }),
    ]

    const result = mergeStudyCardsSemantic(existing, incoming)
    expect(result.enrichedCount).toBe(0)
    expect(result.cards[0]?.context).toBe(
      'My custom personal note from Spanish class',
    )
  })

  it('deduplicates within incoming cards if incoming batch contains duplicates', () => {
    const existing: StudyCard[] = []
    const incoming = [
      makeCard({ id: 'inc1', prompt: 'tener', answer: 'to have' }),
      makeCard({ id: 'inc2', prompt: 'tener', answer: 'to have' }),
    ]

    const result = mergeStudyCardsSemantic(existing, incoming)
    expect(result.cards).toHaveLength(1)
    expect(result.addedCount).toBe(1)
    expect(result.skippedCount).toBe(1)
  })

  it('distinguishes directions correctly (es-en vs en-es)', () => {
    const existing = [
      makeCard({ prompt: 'hablar', answer: 'to speak', direction: 'es-en' }),
    ]
    const incoming = [
      makeCard({ prompt: 'hablar', answer: 'to speak', direction: 'es-en' }),
      makeCard({ prompt: 'to speak', answer: 'hablar', direction: 'en-es' }),
    ]

    const result = mergeStudyCardsSemantic(existing, incoming)
    expect(result.addedCount).toBe(1)
    expect(result.skippedCount).toBe(1)
    expect(result.cards).toHaveLength(2)
  })

  it('safely merges a curated starter pack when learner already has some of the cards', () => {
    // Learner already created and practiced 'tener'
    const practicedTener = makeCard({
      id: 'my-custom-tener',
      prompt: 'tener',
      answer: 'to have',
      direction: 'es-en',
      context: '',
      schedule: {
        state: 'review',
        dueAt: 1234567,
        intervalDays: 21,
        easeFactor: 2.7,
        reviews: 8,
        lapses: 1,
      },
    })

    const incoming = [
      practicedTener, // existing card
      makeCard({
        prompt: 'hacer',
        answer: 'to do / to make',
        direction: 'es-en',
      }),
      makeCard({ prompt: 'ir', answer: 'to go', direction: 'es-en' }),
    ]

    const result = mergeStudyCardsSemantic([practicedTener], incoming)
    expect(result.addedCount).toBe(2)
    expect(result.skippedCount).toBe(1)
    expect(result.cards).toHaveLength(3)

    const tenerInResult = result.cards.find((c) => c.prompt === 'tener')
    expect(tenerInResult?.id).toBe('my-custom-tener')
    expect(tenerInResult?.schedule.intervalDays).toBe(21)
    expect(tenerInResult?.schedule.reviews).toBe(8)
  })
})
