import { grammarVerb } from './grammar-catalog'
import { describe, expect, it } from 'vitest'
import {
  DAY,
  scheduleReview,
  studyCardCollectionSchema,
  localeForPrompt,
  localeForAnswer,
} from './card'
import {
  createGrammarCards,
  grammarContext,
  grammarQueue,
  grammarFamilyIndicators,
} from './grammar'
import { preteriteVerbs, preteriteFamilies } from './grammar-content'
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
    for (const family of preteriteFamilies) {
      expect(
        cards.some(
          (c) =>
            grammarVerb(c.grammar.topic, c.grammar.verb)!.family === family.id,
        ),
      ).toBe(true)
    }
    for (const card of cards) {
      const context = grammarContext(card)
      expect(context.sentence.split('___')).toHaveLength(2)
      expect(context.completed).toContain(card.answer)
      expect(context.explanation).not.toBe('')
    }
  })

  it('limits regular feedback to the current infinitive ending and person', () => {
    const endings = {
      ar: ['é', 'aste', 'ó', 'amos', 'aron'],
      er: ['í', 'iste', 'ió', 'imos', 'ieron'],
      ir: ['í', 'iste', 'ió', 'imos', 'ieron'],
    }
    for (const card of createGrammarCards(now).filter(
      (card) =>
        grammarVerb(card.grammar.topic, card.grammar.verb)!.family ===
        'regular',
    )) {
      const infinitiveEnding = card.grammar.verb.slice(
        -2,
      ) as keyof typeof endings
      const ending = endings[infinitiveEnding][card.grammar.person]!
      expect(grammarContext(card).explanation).toBe(
        `Replace -${infinitiveEnding} with -${ending}.`,
      )
      expect(card.grammar.verb.slice(0, -2) + ending).toBe(card.answer)
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
      new Set(
        queue.map((c) => grammarVerb(c.grammar.topic, c.grammar.verb)!.family),
      ).size,
    ).toBe(6)
    expect(new Set(queue.map((c) => c.grammar.person)).size).toBe(5)
    expect(new Set(queue.map((c) => c.grammar.verb)).size).toBe(8)
    expect(
      grammarQueue(cards, now, 'spelling').every(
        (c) =>
          grammarVerb(c.grammar.topic, c.grammar.verb)!.family === 'spelling',
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
      grammarQueue(pool, now + 10 * DAY, 'mixed').some(
        (c) => c.id === known.id,
      ),
    ).toBe(true)
    expect(cards[1]!.schedule.reviews).toBe(0)
    expect(grammarQueue([], now, 'mixed')).toEqual([])
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
  })

  it('varies authored sentence openings and makes omitted subjects recoverable', () => {
    const cards = createGrammarCards(now)
    const contexts = cards.flatMap((card) => [
      grammarContext(card),
      grammarContext({
        ...card,
        schedule: { ...card.schedule, reviews: 1 },
      }),
    ])
    expect(
      new Set(
        contexts.map((context) =>
          context.sentence.split(' ').slice(0, 2).join(' '),
        ),
      ).size,
    ).toBeGreaterThan(12)
    for (const context of contexts) {
      expect(context.sentence.split('___')).toHaveLength(2)
      expect(context.sentence + context.translation).not.toMatch(/[{}]/)
    }
    for (const card of cards) {
      for (const reviews of [0, 1]) {
        const context = grammarContext({
          ...card,
          schedule: { ...card.schedule, reviews },
        })
        const words = context.sentence
          .toLocaleLowerCase('es')
          .match(/[\p{L}]+/gu)!
        expect(words).not.toContain(card.answer)
        expect(context.spokenPrompt).toBe(context.sentence.replace('___', '…'))
        expect(
          context.spokenPrompt.toLocaleLowerCase('es').match(/[\p{L}]+/gu),
        ).toEqual(words)
        expect(localeForPrompt(card)).toBe('es-MX')
        expect(localeForAnswer(card)).toBe('es-MX')
      }
    }
    const comer = cards.find(
      (card) => card.grammar.verb === 'comer' && card.grammar.person === 1,
    )!
    expect(grammarContext(comer).sentence).toBe(
      'Fuiste al mercado y ___ en un puesto de tacos.',
    )
    expect(grammarContext(comer).translation).toBe(
      'You went to the market and ate at a taco stand.',
    )
    const comerYo = cards.find(
      (card) => card.grammar.verb === 'comer' && card.grammar.person === 0,
    )!
    expect(grammarContext(comerYo).sentence).toBe(
      'Fui al mercado y ___ en un puesto de tacos.',
    )
    expect(grammarContext(comerYo).translation).toBe(
      'I went to the market and ate at a taco stand.',
    )
    const comerMarta = cards.find(
      (card) => card.grammar.verb === 'comer' && card.grammar.person === 2,
    )!
    expect(grammarContext(comerMarta).sentence).toBe(
      'Marta fue al mercado y ___ en un puesto de tacos.',
    )
    const ponerUstedes = cards.find(
      (card) => card.grammar.verb === 'poner' && card.grammar.person === 4,
    )!
    expect(
      grammarContext({
        ...ponerUstedes,
        schedule: { ...ponerUstedes.schedule, reviews: 1 },
      }).sentence,
    ).toBe('Ustedes llegaron a casa y ___ música para cocinar.')
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

  it('rejects unusable schedules at storage, backup, and sync boundaries without downgrading modern cards to legacy vocabulary', () => {
    const card = createGrammarCards(now)[0]!
    for (const [fields, invalidValues] of [
      [
        ['reviews', 'lapses'],
        [-1, 1.5],
      ],
      [
        ['dueAt', 'lastReviewedAt'],
        [-8.64e15 - 1, 8.64e15 + 1, -1e20, 1e20],
      ],
    ] as const) {
      for (const field of fields) {
        for (const invalid of invalidValues) {
          const cards = [
            { ...card, schedule: { ...card.schedule, [field]: invalid } },
          ]
          expect(
            studyCardCollectionSchema.safeParse({ version: 2, cards }).success,
          ).toBe(false)
          expect(
            parseDeckBackup(JSON.stringify({ version: 2, cards })).success,
          ).toBe(false)
          expect(parseDeckBackup(JSON.stringify(cards)).success).toBe(false)
          expect(
            deckSyncPayloadSchema.safeParse({
              version: 2,
              app: 'jolito',
              updatedAt: '2026-09-08',
              deviceId: 'test',
              cards,
            }).success,
          ).toBe(false)
        }
      }
    }
  })

  it('accepts the full representable date range for schedule timestamps', () => {
    const card = createGrammarCards(now)[0]!
    for (const timestamp of [-8.64e15, 0, now, 8.64e15]) {
      const parsed = studyCardCollectionSchema.parse({
        version: 2,
        cards: [
          {
            ...card,
            schedule: {
              ...card.schedule,
              dueAt: timestamp,
              lastReviewedAt: timestamp,
            },
          },
        ],
      })
      expect(parsed.cards[0]!.schedule.dueAt).toBe(timestamp)
      expect(() =>
        new Intl.DateTimeFormat('en').format(parsed.cards[0]!.schedule.dueAt),
      ).not.toThrow()
    }
  })

  it('migrates v1 vocabulary and round-trips grammar through storage, backup, and sync without flattening it', () => {
    const legacy = studyCardCollectionSchema.parse({
      version: 1,
      cards: starterCards,
    })
    expect(legacy.version).toBe(4)
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
      studyCardCollectionSchema.safeParse({ version: 5, cards }).success,
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

  describe('grammarFamilyIndicators', () => {
    it('returns 0 mastery and 0 difficulty when no cards have been practiced', () => {
      const cards = createGrammarCards(now, 'preterite')
      const indicators = grammarFamilyIndicators(cards, 'preterite', 'regular')
      expect(indicators.mastery).toBe(0)
      expect(indicators.difficulty).toBe(0)
      expect(indicators.masteryLabel).toBe('Mastery: 0 of 3 bubbles')
      expect(indicators.difficultyLabel).toBe(
        'Difficulty: 0 of 3 chilies (no heat)',
      )
      expect(indicators.practicedForms).toBe(0)
      expect(indicators.totalForms).toBeGreaterThan(0)
    })

    it('returns 0 indicators for empty cards list', () => {
      const indicators = grammarFamilyIndicators([], 'preterite', 'regular')
      expect(indicators.mastery).toBe(0)
      expect(indicators.difficulty).toBe(0)
      expect(indicators.totalForms).toBe(0)
    })

    it('computes mastery level when cards are learned and mastered', () => {
      const allCards = createGrammarCards(now, 'preterite')
      const regularCards = allCards.filter(
        (c) =>
          grammarVerb(c.grammar.topic, c.grammar.verb)!.family === 'regular',
      )

      // Practice all regular cards to mastered stability (>= 30 days)
      const masteredCards = allCards.map((c) => {
        if (grammarVerb(c.grammar.topic, c.grammar.verb)!.family !== 'regular')
          return c
        return {
          ...c,
          schedule: {
            state: 'review' as const,
            dueAt: now + 30 * DAY,
            intervalDays: 30,
            easeFactor: 2.5,
            reviews: 5,
            lapses: 0,
            stability: 35.0,
            difficulty: 2.5,
          },
        }
      })

      const indicators = grammarFamilyIndicators(
        masteredCards,
        'preterite',
        'regular',
      )
      expect(indicators.mastery).toBe(3)
      expect(indicators.difficulty).toBe(0) // 2.5 < 3.0 => 0 chilies
      expect(indicators.masteryLabel).toBe('Mastery: 3 of 3 bubbles')
      expect(indicators.difficultyLabel).toBe(
        'Difficulty: 0 of 3 chilies (no heat)',
      )
      expect(indicators.practicedForms).toBe(regularCards.length)
    })

    it('computes spicy difficulty when cards have high FSRS difficulty', () => {
      const allCards = createGrammarCards(now, 'preterite')

      // Practice essential irregular cards with high difficulty
      const spicyCards = allCards.map((c) => {
        if (
          grammarVerb(c.grammar.topic, c.grammar.verb)!.family !== 'essential'
        )
          return c
        return {
          ...c,
          schedule: {
            state: 'review' as const,
            dueAt: now + 2 * DAY,
            intervalDays: 2,
            easeFactor: 1.7,
            reviews: 4,
            lapses: 2,
            stability: 2.0,
            difficulty: 8.2,
          },
        }
      })

      const indicators = grammarFamilyIndicators(
        spicyCards,
        'preterite',
        'essential',
      )
      expect(indicators.mastery).toBe(1) // stability 2.0 is level 1
      expect(indicators.difficultyLabel).toBe(
        'Difficulty: 3 of 3 chilies (hot)',
      )
    })

    it('computes mixed / all patterns across all families in a topic', () => {
      const allCards = createGrammarCards(now, 'preterite')
      const indicators = grammarFamilyIndicators(allCards, 'preterite', 'mixed')
      expect(indicators.totalForms).toBe(allCards.length)
      expect(indicators.practicedForms).toBe(0)
    })
  })
})
