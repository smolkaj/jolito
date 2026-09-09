import { describe, expect, it } from 'vitest'
import { DAY, scheduleReview, studyCardCollectionSchema } from './card'
import {
  createGrammarCards,
  grammarContext,
  grammarFeedback,
  grammarQueue,
  grammarStats,
} from './grammar'
import { preteriteVerbs, grammarFamilies } from './grammar-content'
import { createStudyCards } from './card'
const starterCards = createStudyCards(
  { spanish: 'hola', english: 'hello', context: '', bidirectional: true },
  'vocabulary',
  0,
)
import { deckSyncPayloadSchema, reconcileStudyCards } from './sync'
import { mergeStudyCardsSemantic } from './card-merge'
import { parseDeckBackup } from './deck-backup'

const now = 1_800_000_000_000

describe('preterite practice contracts', () => {
  it('covers every person of each authored verb with unique, validated, portable exercises', () => {
    const cards = createGrammarCards(now)
    expect(cards).toHaveLength(Object.keys(preteriteVerbs).length * 5)
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length)
    expect(
      studyCardCollectionSchema.parse({ version: 2, cards }).cards,
    ).toEqual(cards)
    for (const family of grammarFamilies) {
      expect(
        cards.some((c) => preteriteVerbs[c.grammar.verb].family === family.id),
      ).toBe(true)
    }
    for (const card of cards) {
      const context = grammarContext(card)
      expect(context.sentence.split('___')).toHaveLength(2)
      expect(context.completed).toContain(card.answer)
      expect(context.explanation.length).toBeGreaterThan(20)
    }
  })

  it('teaches the major exception classes and regular endings, including accents', () => {
    const forms = (verb: keyof typeof preteriteVerbs) =>
      createGrammarCards(now)
        .filter((c) => c.grammar?.verb === verb)
        .map((c) => c.answer)
    expect(forms('hablar')).toEqual([
      'hablé',
      'hablaste',
      'habló',
      'hablamos',
      'hablaron',
    ])
    expect(forms('comer')).toEqual([
      'comí',
      'comiste',
      'comió',
      'comimos',
      'comieron',
    ])
    expect(forms('vivir')).toEqual([
      'viví',
      'viviste',
      'vivió',
      'vivimos',
      'vivieron',
    ])
    expect(forms('hacer')).toEqual([
      'hice',
      'hiciste',
      'hizo',
      'hicimos',
      'hicieron',
    ])
    expect(forms('decir')).toEqual([
      'dije',
      'dijiste',
      'dijo',
      'dijimos',
      'dijeron',
    ])
    expect(forms('ir')).toEqual(forms('ser'))
    expect(forms('dar')).toEqual(['di', 'diste', 'dio', 'dimos', 'dieron'])
    expect(forms('buscar')[0]).toBe('busqué')
    expect(forms('llegar')[0]).toBe('llegué')
    expect(forms('empezar')[0]).toBe('empecé')
    expect(forms('pedir')).toEqual([
      'pedí',
      'pediste',
      'pidió',
      'pedimos',
      'pidieron',
    ])
    expect(forms('dormir')).toEqual([
      'dormí',
      'dormiste',
      'durmió',
      'dormimos',
      'durmieron',
    ])
    expect(forms('leer')).toEqual([
      'leí',
      'leíste',
      'leyó',
      'leímos',
      'leyeron',
    ])
    expect(forms('construir')).toEqual([
      'construí',
      'construiste',
      'construyó',
      'construimos',
      'construyeron',
    ])
  })

  it('interleaves families, verbs, and people while admitting at most eight forms', () => {
    const cards = createGrammarCards(now)
    const queue = grammarQueue(cards, now, 'mixed')
    expect(queue).toHaveLength(8)
    expect(
      new Set(queue.map((c) => preteriteVerbs[c.grammar.verb].family)).size,
    ).toBe(6)
    expect(new Set(queue.map((c) => c.grammar.person)).size).toBe(5)
    expect(new Set(queue.map((c) => c.grammar.verb)).size).toBe(8)
    expect(
      grammarQueue(cards, now, 'spelling').every(
        (c) => preteriteVerbs[c.grammar.verb].family === 'spelling',
      ),
    ).toBe(true)
  })

  it('prioritizes due practiced forms, excludes future forms and vocabulary, and keeps schedules independent', () => {
    const cards = createGrammarCards(now)
    const first = cards[0]!
    const weak = scheduleReview(cards[cards.length - 1]!, 'again', now - DAY)
    const known = scheduleReview(first, 'easy', now)
    const pool = [known, ...cards.slice(1, -1), weak, ...starterCards]
    expect(grammarQueue(pool, now, 'mixed')[0]!.id).toBe(weak.id)
    expect(
      grammarQueue(pool, now, 'mixed').some((c) => c.id === known.id),
    ).toBe(false)
    expect(
      grammarQueue(pool, now + 5 * DAY, 'mixed').some((c) => c.id === known.id),
    ).toBe(true)
    expect(cards[1]!.schedule.reviews).toBe(0)
    expect(grammarQueue([], now, 'mixed')).toEqual([])
    expect(grammarStats(pool, now).introduced).toBe(2)
  })

  it('rotates contexts on delayed and in-session recall without changing the target skill', () => {
    const card = createGrammarCards(now)[0]!
    const reviewed = {
      ...scheduleReview(card, 'again', now),
      grammar: card.grammar,
    }
    expect(grammarContext(reviewed).sentence).not.toBe(
      grammarContext(card).sentence,
    )
    expect(grammarContext(reviewed).completed).toContain(card.answer)
    expect(reviewed.id).toBe(card.id)
    expect(grammarFeedback('HABLÉ ', 'hablé')).toBe('That’s it.')
    expect(grammarFeedback('hable\u0301', 'hablé')).toBe('That’s it.')
    expect(grammarFeedback('hable', 'hablé')).toBe('Almost — keep the accent.')
    expect(grammarFeedback('hablaste', 'hablé')).toBe(
      'Compare the form, then try it again.',
    )
    expect(grammarFeedback('', 'hablé')).toBe(
      'Take a look, then try it from memory.',
    )
  })

  it('keeps authored vocabulary distinct from grammar and rejects mismatched exercise identities or answers', () => {
    const grammar = createGrammarCards(now)[0]!
    const vocabulary = {
      ...grammar,
      id: 'my-card',
      noteId: 'my-note',
      grammar: undefined,
    }
    const merged = mergeStudyCardsSemantic([vocabulary], [grammar])
    expect(merged.cards).toHaveLength(2)
    expect(mergeStudyCardsSemantic([grammar], [vocabulary]).cards).toHaveLength(
      2,
    )
    for (const change of [
      { id: 'wrong' },
      { noteId: 'shared' },
      { answer: 'hablo' },
      { direction: 'es-en' },
    ]) {
      expect(
        studyCardCollectionSchema.safeParse({
          version: 2,
          cards: [{ ...grammar, ...change }],
        }).success,
      ).toBe(false)
    }
  })

  it('migrates v1 vocabulary and round-trips grammar through storage, backup, and sync without flattening it', () => {
    const legacy = studyCardCollectionSchema.parse({
      version: 1,
      cards: starterCards,
    })
    expect(legacy.version).toBe(2)
    expect(legacy.cards).toEqual(starterCards)
    const card = scheduleReview(createGrammarCards(now)[0]!, 'easy', now)
    const cards = [...legacy.cards, card]
    const backup = parseDeckBackup(JSON.stringify({ version: 2, cards }))
    expect(backup.success && backup.cards).toEqual(cards)
    const remote = deckSyncPayloadSchema.parse({
      version: 2,
      app: 'jolito',
      updatedAt: '2026-09-08',
      deviceId: 'test',
      cards,
    })
    expect(
      reconcileStudyCards(
        createGrammarCards(now).slice(0, 1),
        remote.cards,
      ).cards.find((c) => c.id === card.id),
    ).toEqual(card)
    expect(
      studyCardCollectionSchema.safeParse({ version: 3, cards }).success,
    ).toBe(false)
    expect(
      studyCardCollectionSchema.safeParse({
        version: 2,
        cards: [
          {
            ...card,
            grammar: { topic: 'preterite', verb: 'invented', person: 9 },
          },
        ],
      }).success,
    ).toBe(false)
  })
})
