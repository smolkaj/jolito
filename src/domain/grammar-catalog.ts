import { presentFamilies, presentVerbs } from './grammar-present'
import { preteriteFamilies, preteriteVerbs } from './grammar-content'
import { imperfectFamilies, imperfectVerbs } from './grammar-imperfect'
import { perfectFamilies, perfectVerbs } from './grammar-perfect'
import { futureFamilies, futureVerbs } from './grammar-future'
import { conditionalFamilies, conditionalVerbs } from './grammar-conditional'
import { subjunctiveFamilies, subjunctiveVerbs } from './grammar-subjunctive'
import { gerundFamilies, gerundVerbs } from './grammar-gerund'
import type { GrammarVerb } from './grammar-catalog-types'

export const grammarTopics = {
  present: {
    title: 'Presente',
    description: 'Spanish present tense',
    families: presentFamilies,
    verbs: presentVerbs,
  },
  preterite: {
    title: 'Pretérito indefinido',
    description: 'Spanish simple past',
    families: preteriteFamilies,
    verbs: preteriteVerbs,
  },
  imperfect: {
    title: 'Pretérito imperfecto',
    description: 'Spanish imperfect past',
    families: imperfectFamilies,
    verbs: imperfectVerbs,
  },
  perfect: {
    title: 'Pretérito perfecto',
    description: 'Spanish present perfect',
    families: perfectFamilies,
    verbs: perfectVerbs,
  },
  future: {
    title: 'Futuro simple',
    description: 'Spanish simple future',
    families: futureFamilies,
    verbs: futureVerbs,
  },
  conditional: {
    title: 'Condicional simple',
    description: 'Spanish conditional',
    families: conditionalFamilies,
    verbs: conditionalVerbs,
  },
  subjunctive: {
    title: 'Presente de subjuntivo',
    description: 'Spanish present subjunctive',
    families: subjunctiveFamilies,
    verbs: subjunctiveVerbs,
  },
  gerund: {
    title: 'Gerundio',
    description: 'Spanish present progressive',
    families: gerundFamilies,
    verbs: gerundVerbs,
  },
} as const
export type GrammarTopic = keyof typeof grammarTopics
export type GrammarFocus =
  'mixed' | (typeof grammarTopics)[GrammarTopic]['families'][number]['id']

export function grammarVerb(
  topic: GrammarTopic,
  verb: string,
): GrammarVerb | undefined {
  const verbs: Readonly<Record<string, GrammarVerb>> =
    grammarTopics[topic].verbs
  return Object.prototype.hasOwnProperty.call(verbs, verb)
    ? verbs[verb]
    : undefined
}

export function grammarCardId(
  verb: string,
  person: number,
  topic: GrammarTopic,
): string {
  return `grammar:${topic}:${verb}:${person}`
}
