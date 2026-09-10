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

const catalog = createGrammarCards(0)

export function availableGrammarCards(
  cards: StudyCard[],
  deletedCardIds: string[],
): GrammarCard[] {
  const saved = new Map(
    cards.filter(isGrammarCard).map((card) => [card.id, card]),
  )
  const deleted = new Set(deletedCardIds)
  return catalog
    .filter((card) => !deleted.has(card.id))
    .map((card) => saved.get(card.id) ?? card)
}

export function grammarContext(card: GrammarCard) {
  const verb = preteriteVerbs[card.grammar.verb]
  const variant = card.schedule.reviews % 2
  const subjects =
    variant === 0
      ? ['yo', 'tú', 'Marta', 'nosotros', 'los vecinos']
      : ['yo', 'tú', 'usted', 'nosotras', 'ustedes']
  const englishSubjects =
    variant === 0
      ? ['I', 'you', 'Marta', 'we', 'the neighbors']
      : ['I', 'you', 'you', 'we', 'you all']
  const person = card.grammar.person
  const [spanish, english] = verb.contexts[variant]!
  // First/second person and nosotros are clear from the preceding verb. Keep an
  // explicit noun/pronoun for third person so its referent is never a guessing game.
  const cueSubject = person === 2 || person === 4 ? `${subjects[person]} ` : ''
  const capitalize = (text: string) => text[0]!.toUpperCase() + text.slice(1)
  const sentence = capitalize(
    spanish
      .replace('{subject}', subjects[person]!)
      .replace('{ir}', cueSubject + preteriteVerbs.ir.forms[person]!)
      .replace('{llegar}', cueSubject + preteriteVerbs.llegar.forms[person]!),
  )
  const translation = capitalize(
    english
      .replace('{subject}', englishSubjects[person]!)
      .replace(
        '{was}',
        person === 0 || (person === 2 && variant === 0) ? 'was' : 'were',
      ),
  )
  const family = grammarFamilies.find((family) => family.id === verb.family)!
  return {
    sentence,
    spokenPrompt: sentence.replace('___', '…'),
    completed: sentence.replace('___', card.answer),
    translation,
    explanation:
      family.id === 'regular'
        ? `Replace -${card.grammar.verb.slice(-2)} with -${verb.forms[person]!.slice(card.grammar.verb.length - 2)}.`
        : 'note' in verb
          ? verb.note
          : family.rule,
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
