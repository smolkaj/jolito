import { describe, expect, it } from 'vitest'
import { createGrammarCards, grammarContext, grammarQueue } from './grammar'
import {
  studyCardCollectionSchema,
  studyCardSchema,
  scheduleReview,
} from './card'
import { parseDeckBackup } from './deck-backup'
import { deckSyncPayloadSchema } from './sync'
import { futureFamilies, futureVerbs } from './grammar-future'

const now = 1_800_000_000_000

describe('future tense (futuro simple)', () => {
  it('covers all authored future verbs and persons with correct forms and accents', () => {
    const cards = createGrammarCards(now, 'future')
    expect(cards).toHaveLength(Object.keys(futureVerbs).length * 5)

    const forms = (verb: string) =>
      cards
        .filter((card) => card.grammar.verb === verb)
        .map((card) => card.answer)

    // Regular verbs: accents on all except nosotros
    expect(forms('hablar')).toEqual([
      'hablaré',
      'hablarás',
      'hablará',
      'hablaremos',
      'hablarán',
    ])
    expect(forms('comer')).toEqual([
      'comeré',
      'comerás',
      'comerá',
      'comeremos',
      'comerán',
    ])
    expect(forms('vivir')).toEqual([
      'viviré',
      'vivirás',
      'vivirá',
      'viviremos',
      'vivirán',
    ])

    // -dr- stems
    expect(forms('tener')).toEqual([
      'tendré',
      'tendrás',
      'tendrá',
      'tendremos',
      'tendrán',
    ])
    expect(forms('poner')).toEqual([
      'pondré',
      'pondrás',
      'pondrá',
      'pondremos',
      'pondrán',
    ])
    expect(forms('salir')).toEqual([
      'saldré',
      'saldrás',
      'saldrá',
      'saldremos',
      'saldrán',
    ])
    expect(forms('venir')).toEqual([
      'vendré',
      'vendrás',
      'vendrá',
      'vendremos',
      'vendrán',
    ])

    // Vowel-dropping stems
    expect(forms('poder')).toEqual([
      'podré',
      'podrás',
      'podrá',
      'podremos',
      'podrán',
    ])
    expect(forms('saber')).toEqual([
      'sabré',
      'sabrás',
      'sabrá',
      'sabremos',
      'sabrán',
    ])
    expect(forms('haber')).toEqual([
      'habré',
      'habrás',
      'habrá',
      'habremos',
      'habrán',
    ])
    expect(forms('querer')).toEqual([
      'querré',
      'querrás',
      'querrá',
      'querremos',
      'querrán',
    ])

    // Shortened stems
    expect(forms('hacer')).toEqual([
      'haré',
      'harás',
      'hará',
      'haremos',
      'harán',
    ])
    expect(forms('decir')).toEqual([
      'diré',
      'dirás',
      'dirá',
      'diremos',
      'dirán',
    ])

    // Verify all families are represented
    for (const family of futureFamilies) {
      expect(
        cards.some((c) => futureVerbs[c.grammar.verb]?.family === family.id),
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

  it('keeps future cards independent across queues and reviews', () => {
    const futureCards = createGrammarCards(now, 'future')
    const queue = grammarQueue(futureCards, now, 'mixed', 'future')
    expect(queue).toHaveLength(8)
    expect(queue.every((c) => c.grammar.topic === 'future')).toBe(true)
  })

  it('round-trips future cards through backup and sync schemas', () => {
    const card = scheduleReview(
      createGrammarCards(now, 'future')[0]!,
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
      deviceId: 'future-test',
      cards: [card],
    })
    expect(syncPayload.cards[0]!.grammar?.topic).toBe('future')
    expect(
      studyCardCollectionSchema.parse({ version: 2, cards: [card] }),
    ).toMatchObject({ cards: [card] })
  })
})
