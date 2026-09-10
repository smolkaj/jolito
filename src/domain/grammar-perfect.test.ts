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

const now = 1_800_000_000_000

describe('perfecto alongside indefinido', () => {
  it('requires the whole haber phrase for every person, including irregular and accented participles', () => {
    const cards = createGrammarCards(now, 'perfect')
    const forms = (verb: string) =>
      cards
        .filter((card) => card.grammar.verb === verb)
        .map((card) => card.answer)
    expect(forms('hablar')).toEqual([
      'he hablado',
      'has hablado',
      'ha hablado',
      'hemos hablado',
      'han hablado',
    ])
    expect(forms('hacer')).toEqual([
      'he hecho',
      'has hecho',
      'ha hecho',
      'hemos hecho',
      'han hecho',
    ])
    expect(forms('leer')).toEqual([
      'he leído',
      'has leído',
      'ha leído',
      'hemos leído',
      'han leído',
    ])
    expect(forms('abrir')[0]).toBe('he abierto')
    expect(forms('escribir')[0]).toBe('he escrito')
    expect(forms('volver')[0]).toBe('he vuelto')
    expect(forms('romper')[0]).toBe('he roto')
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
        expect(context.explanation).toContain('participle')
        expect(context.sentence + context.translation).not.toMatch(
          /[{}]|undefined|Ayer|anoche/,
        )
      }
    }
  })

  it('keeps tense identities, due queues and tombstones independent', () => {
    const past = createGrammarCards(now)
    const perfect = createGrammarCards(now, 'perfect')
    expect(new Set([...past, ...perfect].map((card) => card.id)).size).toBe(
      past.length + perfect.length,
    )
    const reviewed = scheduleReview(perfect[0]!, 'easy', now)
    const available = availableGrammarCards([reviewed], [past[0]!.id])
    expect(available.find((card) => card.id === reviewed.id)).toEqual(reviewed)
    expect(available.some((card) => card.id === past[0]!.id)).toBe(false)
    const queue = grammarQueue(available, now, 'mixed', 'perfect')
    expect(queue).toHaveLength(8)
    expect(queue.every((card) => card.grammar.topic === 'perfect')).toBe(true)
    expect(queue.some((card) => card.id === reviewed.id)).toBe(false)
    expect(
      grammarQueue(available, now, 'mixed', 'preterite').every(
        (card) => card.grammar.topic === 'preterite',
      ),
    ).toBe(true)
  })

  it('migrates existing progress unchanged and round-trips both tenses through backup and sync', () => {
    const past = scheduleReview(createGrammarCards(now)[0]!, 'easy', now)
    const perfect = scheduleReview(
      createGrammarCards(now, 'perfect')[0]!,
      'good',
      now,
    )
    expect(
      studyCardCollectionSchema.parse({ version: 2, cards: [past] }),
    ).toMatchObject({ version: 3, cards: [past] })
    const cards = [past, perfect]
    expect(
      parseDeckBackup(JSON.stringify({ version: 3, cards })),
    ).toMatchObject({ success: true, cards })
    expect(
      deckSyncPayloadSchema.parse({
        version: 3,
        app: 'jolito',
        updatedAt: '2026-09-10',
        deviceId: 'perfect-test',
        cards,
      }).cards,
    ).toEqual(cards)
    for (const change of [
      { answer: 'hablado' },
      { answer: 'has hablado' },
      { grammar: { ...perfect.grammar, topic: 'preterite' } },
      { grammar: { ...perfect.grammar, verb: 'invented' } },
    ]) {
      expect(studyCardSchema.safeParse({ ...perfect, ...change }).success).toBe(
        false,
      )
    }
  })
})
