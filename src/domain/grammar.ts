import { createNewReviewSchedule, isDue, type StudyCard } from './card'
import {
  grammarCardId,
  grammarFamilies,
  grammarPeople,
  preteriteVerbs,
  type GrammarFocus,
  type PreteriteVerb,
} from './grammar-content'

export type GrammarCard = StudyCard & {
  grammar: NonNullable<StudyCard['grammar']>
}
export function isGrammarCard(card: StudyCard): card is GrammarCard {
  return card.grammar !== undefined
}

export function createGrammarCards(now: number): GrammarCard[] {
  return (Object.keys(preteriteVerbs) as PreteriteVerb[]).flatMap((verb) =>
    grammarPeople.map((person, index) => ({
      id: grammarCardId(verb, index),
      noteId: grammarCardId(verb, index),
      prompt: `${verb} · ${person}`,
      answer: preteriteVerbs[verb].forms[index]!,
      direction: 'en-es' as const,
      context: '',
      scene: 'conversation' as const,
      createdAt: now,
      schedule: createNewReviewSchedule(now),
      grammar: { topic: 'preterite' as const, verb, person: index },
    })),
  )
}

export function grammarContext(card: GrammarCard) {
  const verb = preteriteVerbs[card.grammar.verb]
  const variant = card.schedule.reviews % 2
  const subjects =
    variant === 0
      ? ['yo', 'tú', 'ella', 'nosotros', 'ellos']
      : ['yo', 'tú', 'usted', 'nosotras', 'ustedes']
  const englishSubjects =
    variant === 0
      ? ['I', 'you', 'she', 'we', 'they']
      : ['I', 'you', 'you', 'we', 'you all']
  const person = card.grammar.person
  const [tail, english] = verb.contexts[variant]!
  const sentence = `${variant === 0 ? 'Ayer' : 'El sábado'} ${subjects[person]} ___ ${tail}.`
  const family = grammarFamilies.find((f) => f.id === verb.family)!
  return {
    sentence,
    completed: sentence.replace('___', card.answer),
    translation: `${variant === 0 ? 'Yesterday' : 'On Saturday'}, ${englishSubjects[person]} ${english.replace('{was}', person === 0 || (person === 2 && variant === 0) ? 'was' : 'were')}.`,
    subject: subjects[person]!,
    explanation: 'note' in verb ? verb.note : family.rule,
    family,
    meaning: verb.meaning,
  }
}

/** Due practice always precedes unseen forms. Within each group, choose diverse
 * patterns, people and verbs so a conjugation chart never gives away the next turn. */
export function grammarQueue(
  cards: StudyCard[],
  now: number,
  focus: GrammarFocus,
): GrammarCard[] {
  const eligible = cards
    .filter(isGrammarCard)
    .filter(
      (c) =>
        isDue(c, now) &&
        (focus === 'mixed' || preteriteVerbs[c.grammar.verb].family === focus),
    )
  const due = eligible
    .filter((c) => c.schedule.reviews > 0)
    .sort(
      (a, b) =>
        a.schedule.dueAt - b.schedule.dueAt ||
        b.schedule.lapses - a.schedule.lapses,
    )
  const fresh = eligible.filter((c) => c.schedule.reviews === 0)
  const selected: GrammarCard[] = []
  const families = new Map<string, number>()
  const people = new Map<number, number>()
  const verbs = new Map<string, number>()
  const score = (c: GrammarCard) =>
    (families.get(preteriteVerbs[c.grammar.verb].family) ?? 0) * 3 +
    (people.get(c.grammar.person) ?? 0) * 2 +
    (verbs.get(c.grammar.verb) ?? 0) * 5
  for (const pool of [due, fresh]) {
    while (pool.length && selected.length < 8) {
      // Preserve overdue priority for practiced forms; diversify new material.
      const index =
        pool === due
          ? 0
          : pool.reduce(
              (best, c, i) => (score(c) < score(pool[best]!) ? i : best),
              0,
            )
      const card = pool.splice(index, 1)[0]!
      selected.push(card)
      const family = preteriteVerbs[card.grammar.verb].family
      families.set(family, (families.get(family) ?? 0) + 1)
      people.set(
        card.grammar.person,
        (people.get(card.grammar.person) ?? 0) + 1,
      )
      verbs.set(card.grammar.verb, (verbs.get(card.grammar.verb) ?? 0) + 1)
    }
  }
  return selected
}

export function grammarStats(cards: StudyCard[], now: number) {
  const practiced = cards
    .filter(isGrammarCard)
    .filter((c) => c.schedule.reviews > 0)
  return {
    introduced: practiced.length,
    due: practiced.filter((c) => isDue(c, now)).length,
    nextDue: practiced
      .filter((c) => !isDue(c, now))
      .reduce((next, c) => Math.min(next, c.schedule.dueAt), Infinity),
  }
}
