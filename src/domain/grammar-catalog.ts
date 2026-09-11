import { preteriteFamilies, preteriteVerbs } from './grammar-content'
import { perfectFamilies, perfectVerbs } from './grammar-perfect'
import { gerundFamilies, gerundVerbs } from './grammar-gerund'
import type { GrammarVerb } from './grammar-catalog-types'

export const grammarTopics = {
  preterite: {
    title: 'Pretérito indefinido',
    description: 'Spanish simple past',
    families: preteriteFamilies,
    verbs: preteriteVerbs,
  },
  perfect: {
    title: 'Pretérito perfecto',
    description: 'Spanish present perfect',
    families: perfectFamilies,
    verbs: perfectVerbs,
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
