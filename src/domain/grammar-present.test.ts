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
import { presentFamilies, presentVerbs } from './grammar-present'

const now = 1_800_000_000_000

describe('present tense alongside preterite, perfect, and gerund', () => {
  it('covers all authored present verbs and persons with correct forms and accents', () => {
    const cards = createGrammarCards(now, 'present')
    expect(cards).toHaveLength(Object.keys(presentVerbs).length * 5)

    const forms = (verb: string) =>
      cards
        .filter((card) => card.grammar.verb === verb)
        .map((card) => card.answer)

    // Regular
    expect(forms('hablar')).toEqual([
      'hablo',
      'hablas',
      'habla',
      'hablamos',
      'hablan',
    ])
    expect(forms('comer')).toEqual([
      'como',
      'comes',
      'come',
      'comemos',
      'comen',
    ])
    expect(forms('vivir')).toEqual([
      'vivo',
      'vives',
      'vive',
      'vivimos',
      'viven',
    ])

    // Stem changes e → ie
    expect(forms('querer')).toEqual([
      'quiero',
      'quieres',
      'quiere',
      'queremos',
      'quieren',
    ])
    expect(forms('pensar')).toEqual([
      'pienso',
      'piensas',
      'piensa',
      'pensamos',
      'piensan',
    ])
    expect(forms('entender')).toEqual([
      'entiendo',
      'entiendes',
      'entiende',
      'entendemos',
      'entienden',
    ])

    // Stem changes o → ue
    expect(forms('poder')).toEqual([
      'puedo',
      'puedes',
      'puede',
      'podemos',
      'pueden',
    ])
    expect(forms('dormir')).toEqual([
      'duermo',
      'duermes',
      'duerme',
      'dormimos',
      'duermen',
    ])
    expect(forms('jugar')).toEqual([
      'juego',
      'juegas',
      'juega',
      'jugamos',
      'juegan',
    ])

    // Stem changes e → i
    expect(forms('pedir')).toEqual([
      'pido',
      'pides',
      'pide',
      'pedimos',
      'piden',
    ])
    expect(forms('servir')).toEqual([
      'sirvo',
      'sirves',
      'sirve',
      'servimos',
      'sirven',
    ])
    expect(forms('seguir')).toEqual([
      'sigo',
      'sigues',
      'sigue',
      'seguimos',
      'siguen',
    ])

    // Irregular yo
    expect(forms('hacer')).toEqual([
      'hago',
      'haces',
      'hace',
      'hacemos',
      'hacen',
    ])
    expect(forms('poner')).toEqual([
      'pongo',
      'pones',
      'pone',
      'ponemos',
      'ponen',
    ])
    expect(forms('salir')).toEqual([
      'salgo',
      'sales',
      'sale',
      'salimos',
      'salen',
    ])
    expect(forms('conocer')).toEqual([
      'conozco',
      'conoces',
      'conoce',
      'conocemos',
      'conocen',
    ])
    expect(forms('saber')).toEqual(['sé', 'sabes', 'sabe', 'sabemos', 'saben'])
    expect(forms('dar')).toEqual(['doy', 'das', 'da', 'damos', 'dan'])
    expect(forms('ver')).toEqual(['veo', 'ves', 've', 'vemos', 'ven'])

    // Common irregulars with accents verified
    expect(forms('ser')).toEqual(['soy', 'eres', 'es', 'somos', 'son'])
    expect(forms('estar')).toEqual([
      'estoy',
      'estás',
      'está',
      'estamos',
      'están',
    ])
    expect(forms('ir')).toEqual(['voy', 'vas', 'va', 'vamos', 'van'])
    expect(forms('tener')).toEqual([
      'tengo',
      'tienes',
      'tiene',
      'tenemos',
      'tienen',
    ])
    expect(forms('decir')).toEqual([
      'digo',
      'dices',
      'dice',
      'decimos',
      'dicen',
    ])
    expect(forms('oír')).toEqual(['oigo', 'oyes', 'oye', 'oímos', 'oyen'])

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

  it('keeps tense identities, due queues and tombstones independent across all four tenses', () => {
    const present = createGrammarCards(now, 'present')
    const past = createGrammarCards(now, 'preterite')
    const perfect = createGrammarCards(now, 'perfect')
    const gerund = createGrammarCards(now, 'gerund')

    expect(
      new Set(
        [...present, ...past, ...perfect, ...gerund].map((card) => card.id),
      ).size,
    ).toBe(present.length + past.length + perfect.length + gerund.length)

    const reviewed = scheduleReview(present[0]!, 'easy', now)
    const available = availableGrammarCards(
      [reviewed],
      [past[0]!.id, perfect[0]!.id, gerund[0]!.id],
    )
    expect(available.find((card) => card.id === reviewed.id)).toEqual(reviewed)
    expect(available.some((card) => card.id === past[0]!.id)).toBe(false)
    expect(available.some((card) => card.id === perfect[0]!.id)).toBe(false)
    expect(available.some((card) => card.id === gerund[0]!.id)).toBe(false)

    const queue = grammarQueue(available, now, 'mixed', 'present')
    expect(queue).toHaveLength(8)
    expect(queue.every((card) => card.grammar.topic === 'present')).toBe(true)
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
    expect(
      grammarQueue(available, now, 'mixed', 'gerund').every(
        (card) => card.grammar.topic === 'gerund',
      ),
    ).toBe(true)
  })

  it('round-trips present tense through backup and sync and validates schema integrity', () => {
    const present = scheduleReview(
      createGrammarCards(now, 'present')[0]!,
      'easy',
      now,
    )
    const past = scheduleReview(
      createGrammarCards(now, 'preterite')[0]!,
      'good',
      now,
    )
    const cards = [present, past]

    expect(
      studyCardCollectionSchema.parse({ version: 2, cards: [present] }),
    ).toMatchObject({ version: 4, cards: [present] })

    expect(
      parseDeckBackup(JSON.stringify({ version: 3, cards })),
    ).toMatchObject({ success: true, cards })

    expect(
      deckSyncPayloadSchema.parse({
        version: 3,
        app: 'jolito',
        updatedAt: '2026-09-26',
        deviceId: 'present-test',
        cards,
      }).cards,
    ).toEqual(cards)

    for (const change of [
      { answer: 'hablar' },
      { answer: 'hablas' },
      { grammar: { ...present.grammar, topic: 'preterite' } },
      { grammar: { ...present.grammar, verb: 'invented' } },
    ]) {
      expect(studyCardSchema.safeParse({ ...present, ...change }).success).toBe(
        false,
      )
    }
  })

  it('provides precise explanations for regular forms and pattern rules for irregulars', () => {
    const cards = createGrammarCards(now, 'present')
    const hablarYo = cards.find(
      (c) => c.grammar.verb === 'hablar' && c.grammar.person === 0,
    )!
    const hablarTu = cards.find(
      (c) => c.grammar.verb === 'hablar' && c.grammar.person === 1,
    )!
    const comerEl = cards.find(
      (c) => c.grammar.verb === 'comer' && c.grammar.person === 2,
    )!
    const vivirNosotros = cards.find(
      (c) => c.grammar.verb === 'vivir' && c.grammar.person === 3,
    )!

    expect(grammarContext(hablarYo).explanation).toBe('Replace -ar with -o.')
    expect(grammarContext(hablarTu).explanation).toBe('Replace -ar with -as.')
    expect(grammarContext(comerEl).explanation).toBe('Replace -er with -e.')
    expect(grammarContext(vivirNosotros).explanation).toBe(
      'Replace -ir with -imos.',
    )

    const stemIe = cards.find((c) => c.grammar.verb === 'querer')!
    expect(grammarContext(stemIe).explanation).toContain('e → ie')

    const stemUe = cards.find((c) => c.grammar.verb === 'poder')!
    expect(grammarContext(stemUe).explanation).toContain('→ ue')

    const stemI = cards.find((c) => c.grammar.verb === 'pedir')!
    expect(grammarContext(stemI).explanation).toContain('e → i')

    const irregYo = cards.find((c) => c.grammar.verb === 'hacer')!
    expect(grammarContext(irregYo).explanation).toContain(
      'yo form is irregular',
    )

    const essential = cards.find((c) => c.grammar.verb === 'estar')!
    expect(grammarContext(essential).explanation).toContain('irregular stems')
  })

  it('verifies that each present family has valid example and description', () => {
    for (const family of presentFamilies) {
      expect(family.title.length).toBeGreaterThan(0)
      expect(family.example.length).toBeGreaterThan(0)
      if (family.id !== 'regular') {
        expect('rule' in family && family.rule.length > 0).toBe(true)
      }
    }
  })
})
