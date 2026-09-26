import { describe, expect, it } from 'vitest'
import { createGrammarCards, grammarContext, grammarQueue } from './grammar'
import {
  studyCardCollectionSchema,
  studyCardSchema,
  scheduleReview,
} from './card'
import { parseDeckBackup } from './deck-backup'
import { deckSyncPayloadSchema } from './sync'
import { conditionalFamilies, conditionalVerbs } from './grammar-conditional'

const now = 1_800_000_000_000

describe('conditional tense (condicional simple)', () => {
  it('covers all authored conditional verbs and persons with correct forms and accents', () => {
    const cards = createGrammarCards(now, 'conditional')
    expect(cards).toHaveLength(Object.keys(conditionalVerbs).length * 5)

    const forms = (verb: string) =>
      cards
        .filter((card) => card.grammar.verb === verb)
        .map((card) => card.answer)

    // Regular verbs: accents on all í
    expect(forms('hablar')).toEqual([
      'hablaría',
      'hablarías',
      'hablaría',
      'hablaríamos',
      'hablarían',
    ])
    expect(forms('comer')).toEqual([
      'comería',
      'comerías',
      'comería',
      'comeríamos',
      'comerían',
    ])
    expect(forms('vivir')).toEqual([
      'viviría',
      'vivirías',
      'viviría',
      'viviríamos',
      'vivirían',
    ])

    // -dr- stems
    expect(forms('tener')).toEqual([
      'tendría',
      'tendrías',
      'tendría',
      'tendríamos',
      'tendrían',
    ])
    expect(forms('poner')).toEqual([
      'pondría',
      'pondrías',
      'pondría',
      'pondríamos',
      'pondrían',
    ])
    expect(forms('salir')).toEqual([
      'saldría',
      'saldrías',
      'saldría',
      'saldríamos',
      'saldrían',
    ])
    expect(forms('venir')).toEqual([
      'vendría',
      'vendrías',
      'vendría',
      'vendríamos',
      'vendrían',
    ])

    // Vowel-dropping stems
    expect(forms('poder')).toEqual([
      'podría',
      'podrías',
      'podría',
      'podríamos',
      'podrían',
    ])
    expect(forms('saber')).toEqual([
      'sabría',
      'sabrías',
      'sabría',
      'sabríamos',
      'sabrían',
    ])
    expect(forms('haber')).toEqual([
      'habría',
      'habrías',
      'habría',
      'habríamos',
      'habrían',
    ])
    expect(forms('querer')).toEqual([
      'querría',
      'querrías',
      'querría',
      'querríamos',
      'querrían',
    ])

    // Shortened stems
    expect(forms('hacer')).toEqual([
      'haría',
      'harías',
      'haría',
      'haríamos',
      'harían',
    ])
    expect(forms('decir')).toEqual([
      'diría',
      'dirías',
      'diría',
      'diríamos',
      'dirían',
    ])

    // Verify all families are represented
    for (const family of conditionalFamilies) {
      expect(
        cards.some(
          (c) => conditionalVerbs[c.grammar.verb]?.family === family.id,
        ),
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

  it('keeps conditional cards independent across queues and reviews', () => {
    const conditionalCards = createGrammarCards(now, 'conditional')
    const queue = grammarQueue(conditionalCards, now, 'mixed', 'conditional')
    expect(queue).toHaveLength(8)
    expect(queue.every((c) => c.grammar.topic === 'conditional')).toBe(true)
  })

  it('round-trips conditional cards through backup and sync schemas', () => {
    const card = scheduleReview(
      createGrammarCards(now, 'conditional')[0]!,
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
      deviceId: 'conditional-test',
      cards: [card],
    })
    expect(syncPayload.cards[0]!.grammar?.topic).toBe('conditional')
    expect(
      studyCardCollectionSchema.parse({ version: 2, cards: [card] }),
    ).toMatchObject({ cards: [card] })
  })

  it('renders grammatical context sentences across all persons and variants without if-clause subject mismatches', () => {
    const cards = createGrammarCards(now, 'conditional')
    for (const card of cards) {
      for (const reviews of [0, 1]) {
        const context = grammarContext({
          ...card,
          schedule: { ...card.schedule, reviews },
        })
        expect(context.sentence).not.toMatch(/\{[^}]+\}/)
        expect(context.translation).not.toMatch(/\{[^}]+\}/)
        expect(context.completed).toContain(card.answer)
        // If-clauses must not have singular tuviera when subject can be tú/nosotros/vecinos
        expect(context.sentence).not.toMatch(/\bsi tuviera\b/i)
        // English must not use broken gerunds like 'if having time'
        expect(context.translation).not.toMatch(/if having/i)
      }
    }
  })
})
