import { describe, expect, it } from 'vitest'
import {
  createGrammarCards,
  grammarContext,
  grammarQueue,
  availableGrammarCards,
} from './grammar'
import {
  studyCardCollectionSchema,
  studyCardSchema,
  scheduleReview,
} from './card'
import { parseDeckBackup } from './deck-backup'
import { deckSyncPayloadSchema } from './sync'
import { imperfectFamilies, imperfectVerbs } from './grammar-imperfect'

const now = 1_800_000_000_000

describe('imperfect tense (pretérito imperfecto)', () => {
  it('covers all authored imperfect verbs and persons with correct forms and accents', () => {
    const cards = createGrammarCards(now, 'imperfect')
    expect(cards).toHaveLength(Object.keys(imperfectVerbs).length * 5)

    const forms = (verb: string) =>
      cards
        .filter((card) => card.grammar.verb === verb)
        .map((card) => card.answer)

    // Regular -ar: note accent on nosotros
    expect(forms('hablar')).toEqual([
      'hablaba',
      'hablabas',
      'hablaba',
      'hablábamos',
      'hablaban',
    ])
    expect(forms('trabajar')).toEqual([
      'trabajaba',
      'trabajabas',
      'trabajaba',
      'trabajábamos',
      'trabajaban',
    ])
    expect(forms('estudiar')).toEqual([
      'estudiaba',
      'estudiabas',
      'estudiaba',
      'estudiábamos',
      'estudiaban',
    ])

    // Regular -er and -ir: accent on every í
    expect(forms('comer')).toEqual([
      'comía',
      'comías',
      'comía',
      'comíamos',
      'comían',
    ])
    expect(forms('vivir')).toEqual([
      'vivía',
      'vivías',
      'vivía',
      'vivíamos',
      'vivían',
    ])
    expect(forms('tener')).toEqual([
      'tenía',
      'tenías',
      'tenía',
      'teníamos',
      'tenían',
    ])
    expect(forms('leer')).toEqual(['leía', 'leías', 'leía', 'leíamos', 'leían'])

    // The only 3 irregulars in Spanish imperfect
    expect(forms('ser')).toEqual(['era', 'eras', 'era', 'éramos', 'eran'])
    expect(forms('ir')).toEqual(['iba', 'ibas', 'iba', 'íbamos', 'iban'])
    expect(forms('ver')).toEqual(['veía', 'veías', 'veía', 'veíamos', 'veían'])

    // Verify all pattern families are represented
    for (const family of imperfectFamilies) {
      expect(
        cards.some((c) => imperfectVerbs[c.grammar.verb]?.family === family.id),
      ).toBe(true)
    }

    // Verify card structure and sentence contexts
    for (const card of cards) {
      expect(studyCardSchema.parse(card)).toEqual(card)
      for (const reviews of [0, 1]) {
        const context = grammarContext({
          ...card,
          schedule: { ...card.schedule, reviews },
        })
        expect(context.sentence.split('___')).toHaveLength(2)
        expect(context.completed).toContain(card.answer)
        expect(context.spokenPrompt).toContain('…')
        expect(context.explanation.length).toBeGreaterThan(0)
        expect(context.sentence + context.translation).not.toMatch(
          /[{}]|undefined/i,
        )
      }
    }
  })

  it('keeps imperfect cards independent across queues, reviews, and tombstones', () => {
    const imperfectCards = createGrammarCards(now, 'imperfect')
    const preteriteCards = createGrammarCards(now, 'preterite')

    expect(
      new Set([...imperfectCards, ...preteriteCards].map((c) => c.id)).size,
    ).toBe(imperfectCards.length + preteriteCards.length)

    const reviewed = scheduleReview(imperfectCards[0]!, 'easy', now)
    const available = availableGrammarCards([reviewed], [preteriteCards[0]!.id])

    expect(available.find((c) => c.id === reviewed.id)).toEqual(reviewed)
    expect(available.some((c) => c.id === preteriteCards[0]!.id)).toBe(false)

    const queue = grammarQueue(available, now, 'mixed', 'imperfect')
    expect(queue).toHaveLength(8)
    expect(queue.every((c) => c.grammar.topic === 'imperfect')).toBe(true)
    expect(queue.some((c) => c.id === reviewed.id)).toBe(false)
  })

  it('round-trips imperfect cards through backup and sync schemas', () => {
    const card = scheduleReview(
      createGrammarCards(now, 'imperfect')[0]!,
      'good',
      now,
    )
    const backupJson = JSON.stringify({
      version: 2,
      cards: [card],
    })
    expect(parseDeckBackup(backupJson)).toMatchObject({
      success: true,
      cards: [card],
    })

    const syncPayload = deckSyncPayloadSchema.parse({
      version: 4,
      app: 'jolito',
      updatedAt: '2026-09-26',
      deviceId: 'imperfect-test',
      cards: [card],
    })
    expect(syncPayload.cards[0]!.grammar?.topic).toBe('imperfect')
    expect(
      studyCardCollectionSchema.parse({ version: 2, cards: [card] }),
    ).toMatchObject({ cards: [card] })
  })
})
