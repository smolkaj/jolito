import { describe, expect, it } from 'vitest'
import { createGrammarCards, grammarContext, grammarQueue } from './grammar'
import {
  studyCardCollectionSchema,
  studyCardSchema,
  scheduleReview,
} from './card'
import { parseDeckBackup } from './deck-backup'
import { deckSyncPayloadSchema } from './sync'
import { subjunctiveFamilies, subjunctiveVerbs } from './grammar-subjunctive'

const now = 1_800_000_000_000

describe('present subjunctive (presente de subjuntivo)', () => {
  it('covers all authored subjunctive verbs and persons with correct forms and accents', () => {
    const cards = createGrammarCards(now, 'subjunctive')
    expect(cards).toHaveLength(Object.keys(subjunctiveVerbs).length * 5)

    const forms = (verb: string) =>
      cards
        .filter((card) => card.grammar.verb === verb)
        .map((card) => card.answer)

    // Regular opposite vowels: -ar takes -e, -er/-ir takes -a
    expect(forms('hablar')).toEqual([
      'hable',
      'hables',
      'hable',
      'hablemos',
      'hablen',
    ])
    expect(forms('comer')).toEqual([
      'coma',
      'comas',
      'coma',
      'comamos',
      'coman',
    ])
    expect(forms('vivir')).toEqual([
      'viva',
      'vivas',
      'viva',
      'vivamos',
      'vivan',
    ])

    // Stem changes
    expect(forms('pensar')).toEqual([
      'piense',
      'pienses',
      'piense',
      'pensemos',
      'piensen',
    ])
    expect(forms('querer')).toEqual([
      'quiera',
      'quieras',
      'quiera',
      'queramos',
      'quieran',
    ])
    expect(forms('poder')).toEqual([
      'pueda',
      'puedas',
      'pueda',
      'podamos',
      'puedan',
    ])
    expect(forms('dormir')).toEqual([
      'duerma',
      'duermas',
      'duerma',
      'durmamos',
      'duerman',
    ])
    expect(forms('pedir')).toEqual([
      'pida',
      'pidas',
      'pida',
      'pidamos',
      'pidan',
    ])

    // Irregular yo-stems
    expect(forms('tener')).toEqual([
      'tenga',
      'tengas',
      'tenga',
      'tengamos',
      'tengan',
    ])
    expect(forms('hacer')).toEqual([
      'haga',
      'hagas',
      'haga',
      'hagamos',
      'hagan',
    ])
    expect(forms('poner')).toEqual([
      'ponga',
      'pongas',
      'ponga',
      'pongamos',
      'pongan',
    ])
    expect(forms('salir')).toEqual([
      'salga',
      'salgas',
      'salga',
      'salgamos',
      'salgan',
    ])
    expect(forms('venir')).toEqual([
      'venga',
      'vengas',
      'venga',
      'vengamos',
      'vengan',
    ])
    expect(forms('decir')).toEqual([
      'diga',
      'digas',
      'diga',
      'digamos',
      'digan',
    ])

    // Essential irregulars: note accents on esté and dé
    expect(forms('ser')).toEqual(['sea', 'seas', 'sea', 'seamos', 'sean'])
    expect(forms('estar')).toEqual([
      'esté',
      'estés',
      'esté',
      'estemos',
      'estén',
    ])
    expect(forms('ir')).toEqual(['vaya', 'vayas', 'vaya', 'vayamos', 'vayan'])
    expect(forms('saber')).toEqual([
      'sepa',
      'sepas',
      'sepa',
      'sepamos',
      'sepan',
    ])
    expect(forms('dar')).toEqual(['dé', 'des', 'dé', 'demos', 'den'])

    // Verify all families are represented
    for (const family of subjunctiveFamilies) {
      expect(
        cards.some(
          (c) => subjunctiveVerbs[c.grammar.verb]?.family === family.id,
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

  it('keeps subjunctive cards independent across queues and reviews', () => {
    const subjunctiveCards = createGrammarCards(now, 'subjunctive')
    const queue = grammarQueue(subjunctiveCards, now, 'mixed', 'subjunctive')
    expect(queue).toHaveLength(8)
    expect(queue.every((c) => c.grammar.topic === 'subjunctive')).toBe(true)
  })

  it('round-trips subjunctive cards through backup and sync schemas', () => {
    const card = scheduleReview(
      createGrammarCards(now, 'subjunctive')[0]!,
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
      deviceId: 'subjunctive-test',
      cards: [card],
    })
    expect(syncPayload.cards[0]!.grammar?.topic).toBe('subjunctive')
    expect(
      studyCardCollectionSchema.parse({ version: 2, cards: [card] }),
    ).toMatchObject({ cards: [card] })
  })

  it('renders grammatical context sentences across all persons and variants without volition or adjective agreement defects', () => {
    const cards = createGrammarCards(now, 'subjunctive')
    for (const card of cards) {
      for (const reviews of [0, 1]) {
        const context = grammarContext({
          ...card,
          schedule: { ...card.schedule, reviews },
        })
        expect(context.sentence).not.toMatch(/\{[^}]+\}/)
        expect(context.translation).not.toMatch(/\{[^}]+\}/)
        expect(context.completed).toContain(card.answer)
        // Volition verbs must not match subject (e.g. Queremos que nosotros)
        if (card.grammar.person === 3) {
          expect(context.sentence).not.toMatch(/\bqueremos que\b/i)
        }
        // Subordinate clause pronouns and adjectives
        expect(context.sentence).not.toMatch(/\bacompañarnos\b/i)
        expect(context.sentence).not.toMatch(/\blisto cuando\b/i)
        expect(context.sentence).not.toMatch(/\bpreparado para\b/i)
      }
    }
  })
})
