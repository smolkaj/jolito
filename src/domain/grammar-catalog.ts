import { grammarFamilies, preteriteVerbs } from './grammar-content'
import { perfectFamilies, perfectVerbs } from './grammar-perfect'
import type { GrammarVerb } from './grammar-catalog-types'

export const grammarTopics = {
  preterite: {
    title: 'Pretérito indefinido',
    description: 'Spanish simple past',
    families: grammarFamilies,
    verbs: preteriteVerbs,
  },
  perfect: {
    title: 'Pretérito perfecto compuesto',
    description: 'Spanish present perfect',
    families: perfectFamilies,
    verbs: perfectVerbs,
  },
} as const
export type GrammarTopic = keyof typeof grammarTopics

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
  topic: GrammarTopic = 'preterite',
): string {
  return `grammar:${topic}:${verb}:${person}`
}
