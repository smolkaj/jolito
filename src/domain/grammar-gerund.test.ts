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

describe('gerund alongside indefinido and perfecto', () => {
  it('requires the whole estar phrase for every person, including irregular and stem changes', () => {
    const cards = createGrammarCards(now, 'gerund')
    expect(cards).toHaveLength(25 * 5)
    const forms = (verb: string) =>
      cards
        .filter((card) => card.grammar.verb === verb)
        .map((card) => card.answer)
    expect(forms('hablar')).toEqual([
      'estoy hablando',
      'estás hablando',
      'está hablando',
      'estamos hablando',
      'están hablando',
    ])
    expect(forms('decir')).toEqual([
      'estoy diciendo',
      'estás diciendo',
      'está diciendo',
      'estamos diciendo',
      'están diciendo',
    ])
    expect(forms('dormir')).toEqual([
      'estoy durmiendo',
      'estás durmiendo',
      'está durmiendo',
      'estamos durmiendo',
      'están durmiendo',
    ])
    expect(forms('leer')).toEqual([
      'estoy leyendo',
      'estás leyendo',
      'está leyendo',
      'estamos leyendo',
      'están leyendo',
    ])
    expect(forms('pedir')[0]).toBe('estoy pidiendo')
    expect(forms('servir')[0]).toBe('estoy sirviendo')
    expect(forms('seguir')[0]).toBe('estoy siguiendo')
    expect(forms('sentir')[0]).toBe('estoy sintiendo')
    expect(forms('venir')[0]).toBe('estoy viniendo')
    expect(forms('vestir')[0]).toBe('estoy vistiendo')
    expect(forms('repetir')[0]).toBe('estoy repitiendo')
    expect(forms('morir')[0]).toBe('estoy muriendo')
    expect(forms('poder')[0]).toBe('estoy pudiendo')
    expect(forms('creer')[0]).toBe('estoy creyendo')
    expect(forms('traer')[0]).toBe('estoy trayendo')
    expect(forms('caer')[0]).toBe('estoy cayendo')
    expect(forms('oír')[0]).toBe('estoy oyendo')
    expect(forms('ir')[0]).toBe('estoy yendo')
    expect(forms('construir')[0]).toBe('estoy construyendo')
    expect(forms('huir')[0]).toBe('estoy huyendo')

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
          /[{}]|undefined|Ayer|anoche|\bconcentrarse\b|\bjuntos\b/i,
        )
      }
    }
  })

  it('keeps tense identities, due queues and tombstones independent', () => {
    const past = createGrammarCards(now)
    const perfect = createGrammarCards(now, 'perfect')
    const gerund = createGrammarCards(now, 'gerund')
    expect(
      new Set([...past, ...perfect, ...gerund].map((card) => card.id)).size,
    ).toBe(past.length + perfect.length + gerund.length)

    const reviewed = scheduleReview(gerund[0]!, 'easy', now)
    const available = availableGrammarCards(
      [reviewed],
      [past[0]!.id, perfect[0]!.id],
    )
    expect(available.find((card) => card.id === reviewed.id)).toEqual(reviewed)
    expect(available.some((card) => card.id === past[0]!.id)).toBe(false)
    expect(available.some((card) => card.id === perfect[0]!.id)).toBe(false)

    const queue = grammarQueue(available, now, 'mixed', 'gerund')
    expect(queue).toHaveLength(8)
    expect(queue.every((card) => card.grammar.topic === 'gerund')).toBe(true)
    expect(queue.some((card) => card.id === reviewed.id)).toBe(false)

    expect(
      grammarQueue(available, now, 'mixed', 'preterite').every(
        (card) => card.grammar.topic === 'preterite',
      ),
    ).toBe(true)
    expect(
      grammarQueue(available, now, 'mixed', 'perfect').every(
        (card) => card.grammar.topic === 'perfect',
      ),
    ).toBe(true)
  })

  it('migrates existing progress unchanged and round-trips all three tenses through backup and sync', () => {
    const past = scheduleReview(createGrammarCards(now)[0]!, 'easy', now)
    const perfect = scheduleReview(
      createGrammarCards(now, 'perfect')[0]!,
      'good',
      now,
    )
    const gerund = scheduleReview(
      createGrammarCards(now, 'gerund')[0]!,
      'hard',
      now,
    )
    expect(
      studyCardCollectionSchema.parse({ version: 2, cards: [past] }),
    ).toMatchObject({ version: 4, cards: [past] })

    const cards = [past, perfect, gerund]
    expect(
      parseDeckBackup(JSON.stringify({ version: 3, cards })),
    ).toMatchObject({ success: true, cards })

    expect(
      deckSyncPayloadSchema.parse({
        version: 3,
        app: 'jolito',
        updatedAt: '2026-09-10',
        deviceId: 'gerund-test',
        cards,
      }).cards,
    ).toEqual(cards)

    for (const change of [
      { answer: 'hablando' },
      { answer: 'estás hablando' },
      { grammar: { ...gerund.grammar, topic: 'preterite' } },
      { grammar: { ...gerund.grammar, verb: 'invented' } },
    ]) {
      expect(studyCardSchema.safeParse({ ...gerund, ...change }).success).toBe(
        false,
      )
    }
  })
})
