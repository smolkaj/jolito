import type { GrammarVerb } from './grammar-catalog-types'

export const perfectFamilies = [
  {
    id: 'regular',
    title: 'Regular participles',
    example: 'hablado · comido · vivido',
    rule: 'Use he, has, ha, hemos or han + participle. Replace -ar with -ado and -er/-ir with -ido. The participle does not change with the subject.',
  },
  {
    id: 'irregular',
    title: 'Irregular participles',
    example: 'hecho · escrito · visto',
    rule: 'Use he, has, ha, hemos or han + the irregular participle. The participle stays the same for every person.',
  },
  {
    id: 'vowel',
    title: 'Accented participles',
    example: 'leído · oído · traído',
    rule: 'Use he, has, ha, hemos or han + participle. After a vowel in leer, oír and traer, write -ído with an accent.',
  },
] as const

// Haber changes with the subject; the participle is invariant.
const perfectForms = (participle: string): GrammarVerb['forms'] => [
  `he ${participle}`,
  `has ${participle}`,
  `ha ${participle}`,
  `hemos ${participle}`,
  `han ${participle}`,
]

export const perfectVerbs = {
  hablar: {
    family: 'regular',
    forms: perfectForms('hablado'),
    contexts: [
      [
        'Últimamente {subject} ___ mucho con la vecina.',
        'Lately, {subject} [{have} talked] a lot with the neighbor.',
      ],
      [
        '{subject} nunca ___ de eso con su familia.',
        '{subject} [{have}] never [talked] about that with their family.',
      ],
    ],
  },
  comer: {
    family: 'regular',
    forms: perfectForms('comido'),
    contexts: [
      [
        '{subject} nunca ___ chapulines.',
        '{subject} [{have}] never [eaten] grasshoppers.',
      ],
      [
        'Últimamente {subject} ___ más verduras.',
        'Lately, {subject} [{have} eaten] more vegetables.',
      ],
    ],
  },
  vivir: {
    family: 'regular',
    forms: perfectForms('vivido'),
    contexts: [
      [
        '{subject} ___ en varias ciudades.',
        '{subject} [{have} lived] in several cities.',
      ],
      [
        'Hasta ahora, {subject} ___ muchas experiencias nuevas.',
        'So far, {subject} [{have} had] many new experiences.',
      ],
    ],
  },
  trabajar: {
    family: 'regular',
    forms: perfectForms('trabajado'),
    contexts: [
      [
        '{subject} ___ mucho en este proyecto últimamente.',
        '{subject} [{have} worked] a lot on this project lately.',
      ],
      [
        '{subject} nunca ___ en un restaurante.',
        '{subject} [{have}] never [worked] in a restaurant.',
      ],
    ],
  },
  viajar: {
    family: 'regular',
    forms: perfectForms('viajado'),
    contexts: [
      [
        '{subject} ___ por México varias veces.',
        '{subject} [{have} traveled] around Mexico several times.',
      ],
      [
        '{subject} nunca ___ en avión.',
        '{subject} [{have}] never [traveled] by plane.',
      ],
    ],
  },
  comprar: {
    family: 'regular',
    forms: perfectForms('comprado'),
    contexts: [
      [
        '{subject} nunca ___ ropa por internet.',
        '{subject} [{have}] never [bought] clothes online.',
      ],
      [
        'En estos meses, {subject} ___ varios libros usados.',
        'Over these months, {subject} [{have} bought] several secondhand books.',
      ],
    ],
  },
  aprender: {
    family: 'regular',
    forms: perfectForms('aprendido'),
    contexts: [
      [
        'Desde el inicio del curso, {subject} ___ muchas palabras.',
        'Since the course began, {subject} [{have} learned] many words.',
      ],
      [
        '{subject} ___ mucho de sus errores.',
        '{subject} [{have} learned] a lot from their mistakes.',
      ],
    ],
  },
  visitar: {
    family: 'regular',
    forms: perfectForms('visitado'),
    contexts: [
      [
        '{subject} ___ ese museo varias veces.',
        '{subject} [{have} visited] that museum several times.',
      ],
      [
        '{estar} de vacaciones y ___ varios pueblos de la región.',
        '{subject} {be} on vacation and [{have} visited] several towns in the region.',
      ],
    ],
  },
  terminar: {
    family: 'regular',
    forms: perfectForms('terminado'),
    contexts: [
      [
        '{subject} todavía no ___ el libro.',
        '{subject} [{have}] not [finished] the book yet.',
      ],
      [
        'Hasta ahora, {subject} ___ tres cursos de español.',
        'So far, {subject} [{have} completed] three Spanish courses.',
      ],
    ],
  },
  hacer: {
    family: 'irregular',
    forms: perfectForms('hecho'),
    contexts: [
      [
        'Últimamente {subject} ___ ejercicio todos los días.',
        'Lately, {subject} [{have} exercised] every day.',
      ],
      [
        '{subject} nunca ___ tortillas a mano.',
        '{subject} [{have}] never [made] tortillas by hand.',
      ],
    ],
  },
  decir: {
    family: 'irregular',
    forms: perfectForms('dicho'),
    contexts: [
      [
        '{subject} ___ lo mismo varias veces.',
        '{subject} [{have} said] the same thing several times.',
      ],
      [
        '{subject} todavía no ___ nada del viaje.',
        '{subject} [{have}] not [said] anything about the trip yet.',
      ],
    ],
  },
  ver: {
    family: 'irregular',
    forms: perfectForms('visto'),
    contexts: [
      [
        '{subject} nunca ___ el mar.',
        '{subject} [{have}] never [seen] the sea.',
      ],
      [
        'Últimamente {subject} ___ muchas películas mexicanas.',
        'Lately, {subject} [{have} watched] many Mexican movies.',
      ],
    ],
  },
  poner: {
    family: 'irregular',
    forms: perfectForms('puesto'),
    contexts: [
      [
        '{subject} ___ mucho esfuerzo en este proyecto.',
        '{subject} [{have} put] a lot of effort into this project.',
      ],
      [
        '{subject} todavía no ___ fecha para la reunión.',
        '{subject} [{have}] not [set] a date for the meeting yet.',
      ],
    ],
  },
  escribir: {
    family: 'irregular',
    forms: perfectForms('escrito'),
    contexts: [
      [
        '{subject} ___ varias cartas a sus amigos.',
        '{subject} [{have} written] several letters to their friends.',
      ],
      [
        '{subject} nunca ___ un cuento.',
        '{subject} [{have}] never [written] a short story.',
      ],
    ],
  },
  abrir: {
    family: 'irregular',
    forms: perfectForms('abierto'),
    contexts: [
      [
        '{subject} todavía no ___ el regalo.',
        '{subject} [{have}] not [opened] the gift yet.',
      ],
      [
        '{subject} ___ esa puerta muchas veces.',
        '{subject} [{have} opened] that door many times.',
      ],
    ],
  },
  volver: {
    family: 'irregular',
    forms: perfectForms('vuelto'),
    contexts: [
      [
        '{subject} ___ a ese pueblo varias veces.',
        '{subject} [{have} returned] to that town several times.',
      ],
      [
        '{subject} todavía no ___ de vacaciones.',
        '{subject} [{have}] not [returned] from vacation yet.',
      ],
    ],
  },
  romper: {
    family: 'irregular',
    forms: perfectForms('roto'),
    contexts: [
      [
        '{subject} nunca ___ un vaso en esa casa.',
        '{subject} [{have}] never [broken] a glass in that house.',
      ],
      [
        '{subject} ___ varios platos a lo largo de los años.',
        '{subject} [{have} broken] several plates over the years.',
      ],
    ],
  },
  leer: {
    family: 'vowel',
    forms: perfectForms('leído'),
    contexts: [
      [
        '{subject} ___ varios libros de esa autora.',
        '{subject} [{have} read] several books by that author.',
      ],
      [
        '{subject} todavía no ___ el mensaje.',
        '{subject} [{have}] not [read] the message yet.',
      ],
    ],
  },
  oír: {
    family: 'vowel',
    forms: perfectForms('oído'),
    contexts: [
      [
        '{subject} nunca ___ esa canción.',
        '{subject} [{have}] never [heard] that song.',
      ],
      [
        'Últimamente {subject} ___ mucho ruido en la calle.',
        'Lately, {subject} [{have} heard] a lot of noise in the street.',
      ],
    ],
  },
  traer: {
    family: 'vowel',
    forms: perfectForms('traído'),
    contexts: [
      [
        '{subject} ___ comida para compartir muchas veces.',
        '{subject} [{have} brought] food to share many times.',
      ],
      [
        '{subject} todavía no ___ los documentos.',
        '{subject} [{have}] not [brought] the documents yet.',
      ],
    ],
  },
} as const satisfies Record<
  string,
  GrammarVerb & { family: (typeof perfectFamilies)[number]['id'] }
>
