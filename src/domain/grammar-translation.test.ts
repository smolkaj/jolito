import { describe, expect, it } from 'vitest'
import { createGrammarCards, grammarContext } from './grammar'
import { grammarVerb } from './grammar-catalog'

describe('authored English verb alignment', () => {
  it.each(['preterite', 'perfect'] as const)(
    'resolves every %s person and context into clean text with explicit verb spans',
    (topic) => {
      for (const card of createGrammarCards(0, topic)) {
        for (const reviews of [0, 1]) {
          const authored = grammarVerb(topic, card.grammar.verb)!.contexts[
            reviews
          ]![1]
          expect(authored).toMatch(/\[[^\[\]]+\]/)
          expect(authored.replace(/\[[^\[\]]+\]/g, '')).not.toMatch(/[\[\]]/)
          const context = grammarContext({
            ...card,
            schedule: { ...card.schedule, reviews },
          })
          expect(
            context.translationParts.map((part) => part.text).join(''),
          ).toBe(context.translation)
          expect(context.translation).not.toMatch(/[\[\]{}]/)
          const verbs = context.translationParts.filter((part) => part.isAnswer)
          expect(verbs.length).toBeGreaterThan(0)
          for (const part of verbs) expect(part.text.trim()).toBe(part.text)
        }
      }
    },
  )

  it.each([
    ['preterite', 'comer', 0, 0, ['I', 'ate']],
    ['preterite', 'poder', 0, 0, ['I', 'managed to']],
    ['preterite', 'poner', 0, 1, ['I', 'put on']],
    ['preterite', 'ser', 2, 0, ['was']],
    ['preterite', 'ser', 2, 1, ['You', 'were']],
    ['perfect', 'hablar', 2, 0, ['has talked']],
    ['perfect', 'hablar', 2, 1, ['You', 'have', 'talked']],
    ['perfect', 'terminar', 0, 0, ['I', 'have', 'finished']],
    ['perfect', 'hablar', 4, 0, ['have talked']],
    ['perfect', 'hablar', 4, 1, ['You all', 'have', 'talked']],
    ['perfect', 'visitar', 2, 1, ['You', 'have visited']],
  ] as const)(
    'aligns %s %s person %s context %s without capturing other verbs or negation',
    (topic, verb, person, reviews, expected) => {
      const card = createGrammarCards(0, topic).find(
        (card) => card.grammar.verb === verb && card.grammar.person === person,
      )!
      const context = grammarContext({
        ...card,
        schedule: { ...card.schedule, reviews },
      })
      expect(
        context.translationParts
          .filter((part) => part.isAnswer)
          .map((part) => part.text),
      ).toEqual(expected)
    },
  )
})
