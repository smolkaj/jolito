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
  'preterite-vs-imperfect': {
    title: 'Pretérito vs. Imperfecto',
    description: 'Action vs. ongoing background in the past',
    families: [
      {
        id: 'interrupted',
        title: 'Interrupted actions',
        example: 'dormía cuando sonó el teléfono',
      },
      {
        id: 'time-age',
        title: 'Time, date & age',
        example: 'eran las tres · tenía diez años',
      },
      {
        id: 'habitual',
        title: 'Habitual vs. specific',
        example: 'siempre íbamos · ayer fuimos',
      },
      {
        id: 'descriptions',
        title: 'Descriptions vs. events',
        example: 'la casa era grande · salí a las ocho',
      },
    ],
    verbs: preteriteVerbs,
  },
  'ser-vs-estar': {
    title: 'Ser vs. Estar',
    description: 'Essence & identity vs. state, condition & location',
    families: [
      {
        id: 'identity-condition',
        title: 'Identity vs. condition',
        example: 'es amable · está cansado',
      },
      {
        id: 'origin-location',
        title: 'Origin vs. location',
        example: 'es de México · está en Coyoacán',
      },
      {
        id: 'time-state',
        title: 'Time vs. continuous state',
        example: 'son las dos · está lloviendo',
      },
      {
        id: 'inherent-mood',
        title: 'Inherent traits vs. mood',
        example: 'es alegre · está feliz hoy',
      },
    ],
    verbs: preteriteVerbs,
  },
  'por-vs-para': {
    title: 'Por vs. Para',
    description: 'Cause, duration & means vs. purpose, deadline & destination',
    families: [
      {
        id: 'cause-purpose',
        title: 'Cause vs. purpose',
        example: 'por la lluvia · para estudiar',
      },
      {
        id: 'duration-deadline',
        title: 'Duration vs. deadline',
        example: 'por tres días · para el lunes',
      },
      {
        id: 'movement-destination',
        title: 'Through / along vs. destination',
        example: 'por el parque · para la oficina',
      },
      {
        id: 'means-recipient',
        title: 'Means vs. recipient',
        example: 'por teléfono · para ti',
      },
    ],
    verbs: preteriteVerbs,
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
