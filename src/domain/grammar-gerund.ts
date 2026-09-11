import type { GrammarVerb } from './grammar-catalog-types'

export const gerundFamilies = [
  {
    id: 'regular',
    title: 'Regular gerunds',
    example: 'hablando · comiendo · viviendo',
    rule: 'Replace -ar with -ando and -er/-ir with -iendo.',
  },
  {
    id: 'stem-e',
    title: 'e → i stem changes',
    example: 'pidiendo · sirviendo · diciendo',
    rule: 'In these -ir verbs, the stem vowel e changes to i.',
  },
  {
    id: 'stem-o',
    title: 'o → u stem changes',
    example: 'durmiendo · muriendo · pudiendo',
    rule: 'The stem vowel o changes to u.',
  },
  {
    id: 'vowel',
    title: 'i → y and irregulars',
    example: 'leyendo · oyendo · yendo',
    rule: 'Between vowels, i becomes y. Ir becomes yendo.',
  },
] as const

// Estar changes with the subject; the gerund is invariant.
const gerundForms = (gerund: string): GrammarVerb['forms'] => [
  `estoy ${gerund}`,
  `estás ${gerund}`,
  `está ${gerund}`,
  `estamos ${gerund}`,
  `están ${gerund}`,
]

export const gerundVerbs = {
  hablar: {
    family: 'regular',
    forms: gerundForms('hablando'),
    contexts: [
      [
        'Ahora mismo {subject} ___ con la vecina.',
        'Right now, {subject} [{be} talking] with the neighbor.',
      ],
      [
        'En la sala, {subject} ___ de la fiesta del sábado.',
        "In the living room, {subject} [{be} talking] about Saturday's party.",
      ],
    ],
  },
  trabajar: {
    family: 'regular',
    forms: gerundForms('trabajando'),
    contexts: [
      [
        'Hoy {subject} ___ desde casa.',
        'Today, {subject} [{be} working] from home.',
      ],
      [
        'En la oficina, {subject} ___ en un proyecto importante.',
        'At the office, {subject} [{be} working] on an important project.',
      ],
    ],
  },
  estudiar: {
    family: 'regular',
    forms: gerundForms('estudiando'),
    contexts: [
      [
        'Esta tarde {subject} ___ para el examen.',
        'This afternoon, {subject} [{be} studying] for the exam.',
      ],
      [
        'En la biblioteca, {subject} ___ español.',
        'In the library, {subject} [{be} studying] Spanish.',
      ],
    ],
  },
  comer: {
    family: 'regular',
    forms: gerundForms('comiendo'),
    contexts: [
      [
        '{llegar} a casa y ya ___ unos tacos al pastor.',
        '{subject} arrived home and [{be}] already [eating] some tacos al pastor.',
      ],
      [
        'En la cocina, {subject} ___ fruta fresca.',
        'In the kitchen, {subject} [{be} eating] fresh fruit.',
      ],
    ],
  },
  vivir: {
    family: 'regular',
    forms: gerundForms('viviendo'),
    contexts: [
      [
        'Este año {subject} ___ en la Ciudad de México.',
        'This year, {subject} [{be} living] in Mexico City.',
      ],
      [
        'Por ahora {subject} ___ muy cerca del centro.',
        'For now, {subject} [{be} living] very close to downtown.',
      ],
    ],
  },
  escribir: {
    family: 'regular',
    forms: gerundForms('escribiendo'),
    contexts: [
      [
        '{llegar} a la oficina y ya ___ un mensaje importante.',
        '{subject} arrived at the office and [{be}] already [writing] an important message.',
      ],
      [
        'En su cuaderno, {subject} ___ una carta.',
        'In their notebook, {subject} [{be} writing] a letter.',
      ],
    ],
  },
  decir: {
    family: 'stem-e',
    forms: gerundForms('diciendo'),
    contexts: [
      [
        'Siempre {subject} ___ la verdad sobre lo que pasó.',
        'Always, {subject} [{be} telling] the truth about what happened.',
      ],
      [
        '{subject} ___ cosas muy interesantes.',
        '{subject} [{be} saying] very interesting things.',
      ],
    ],
  },
  pedir: {
    family: 'stem-e',
    forms: gerundForms('pidiendo'),
    contexts: [
      [
        'En el restaurante {subject} ___ la cuenta.',
        'At the restaurant, {subject} [{be} asking for] the bill.',
      ],
      [
        '{subject} ___ ayuda con la mudanza.',
        '{subject} [{be} asking for] help with the move.',
      ],
    ],
  },
  servir: {
    family: 'stem-e',
    forms: gerundForms('sirviendo'),
    contexts: [
      [
        'En el comedor, {subject} ___ la comida caliente.',
        'In the dining room, {subject} [{be} serving] hot food.',
      ],
      [
        'En la fonda {subject} ___ agua fresca de horchata.',
        'At the fonda, {subject} [{be} serving] fresh horchata water.',
      ],
    ],
  },
  seguir: {
    family: 'stem-e',
    forms: gerundForms('siguiendo'),
    contexts: [
      [
        'En la cocina {subject} ___ la receta paso a paso.',
        'In the kitchen, {subject} [{be} following] the recipe step by step.',
      ],
      [
        '{subject} ___ las instrucciones del maestro.',
        "{subject} [{be} following] the teacher's instructions.",
      ],
    ],
  },
  sentir: {
    family: 'stem-e',
    forms: gerundForms('sintiendo'),
    contexts: [
      [
        'Con este frío {subject} ___ la necesidad de un café.',
        'With this cold, {subject} [{be} feeling] the need for a coffee.',
      ],
      [
        'Hoy {subject} ___ un poco de cansancio.',
        'Today, {subject} [{be} feeling] a bit tired.',
      ],
    ],
  },
  venir: {
    family: 'stem-e',
    forms: gerundForms('viniendo'),
    contexts: [
      [
        'Ya {subject} ___ en camino hacia acá.',
        'Already, {subject} [{be} coming] on the way here.',
      ],
      [
        '{subject} ___ en metro desde el centro.',
        '{subject} [{be} coming] by subway from downtown.',
      ],
    ],
  },
  vestir: {
    family: 'stem-e',
    forms: gerundForms('vistiendo'),
    contexts: [
      [
        'Para la fiesta {subject} ___ ropa muy elegante.',
        'For the party, {subject} [{be} wearing] very elegant clothes.',
      ],
      [
        '{subject} ___ al niño para la escuela.',
        '{subject} [{be} dressing] the child for school.',
      ],
    ],
  },
  repetir: {
    family: 'stem-e',
    forms: gerundForms('repitiendo'),
    contexts: [
      [
        'En clase {subject} ___ las palabras en voz alta.',
        'In class, {subject} [{be} repeating] the words out loud.',
      ],
      [
        '{subject} ___ la pregunta para entenderla mejor.',
        '{subject} [{be} repeating] the question to understand it better.',
      ],
    ],
  },
  dormir: {
    family: 'stem-o',
    forms: gerundForms('durmiendo'),
    contexts: [
      [
        'En su cuarto {subject} ___ profundamente.',
        'In their room, {subject} [{be} sleeping] deeply.',
      ],
      [
        'En el sillón {subject} ___ plácidamente.',
        'On the couch, {subject} [{be} sleeping] peacefully.',
      ],
    ],
  },
  morir: {
    family: 'stem-o',
    forms: gerundForms('muriendo'),
    contexts: [
      [
        'Con este calor {subject} ___ de sed.',
        'In this heat, {subject} [{be} dying] of thirst.',
      ],
      [
        'Con ese chiste {subject} ___ de risa.',
        'From that joke, {subject} [{be} dying] of laughter.',
      ],
    ],
  },
  poder: {
    family: 'stem-o',
    forms: gerundForms('pudiendo'),
    contexts: [
      [
        'Por fin {subject} ___ descansar un poco.',
        'At last, {subject} [{be} able to] rest a bit.',
      ],
      [
        'Esta semana {subject} ___ concentrarse mejor.',
        'This week, {subject} [{be} able to] concentrate better.',
      ],
    ],
  },
  leer: {
    family: 'vowel',
    forms: gerundForms('leyendo'),
    contexts: [
      [
        '{llegar} del trabajo y ya ___ un libro nuevo.',
        '{subject} arrived from work and [{be}] already [reading] a new book.',
      ],
      [
        'En el metro {subject} ___ las noticias del día.',
        'On the subway, {subject} [{be} reading] the daily news.',
      ],
    ],
  },
  creer: {
    family: 'vowel',
    forms: gerundForms('creyendo'),
    contexts: [
      [
        'Por fin {subject} ___ en esa posibilidad.',
        'At last, {subject} [{be} believing] in that possibility.',
      ],
      [
        '{subject} ___ todo lo que dice la noticia.',
        '{subject} [{be} believing] everything the news says.',
      ],
    ],
  },
  traer: {
    family: 'vowel',
    forms: gerundForms('trayendo'),
    contexts: [
      [
        'En la bolsa {subject} ___ el pan dulce.',
        'In the bag, {subject} [{be} bringing] sweet bread.',
      ],
      [
        '{subject} ___ los refrescos para la comida.',
        '{subject} [{be} bringing] the sodas for lunch.',
      ],
    ],
  },
  caer: {
    family: 'vowel',
    forms: gerundForms('cayendo'),
    contexts: [
      [
        'Cuidado, que {subject} ___ en la misma trampa.',
        'Watch out, {subject} [{be} falling] into the same trap.',
      ],
      [
        'Poco a poco {subject} ___ en un sueño profundo.',
        'Slowly, {subject} [{be} falling] into a deep sleep.',
      ],
    ],
  },
  oír: {
    family: 'vowel',
    forms: gerundForms('oyendo'),
    contexts: [
      [
        'Desde la ventana {subject} ___ los pájaros cantar.',
        'From the window, {subject} [{be} hearing] the birds sing.',
      ],
      [
        'En la sala {subject} ___ la música del vecino.',
        "In the living room, {subject} [{be} hearing] the neighbor's music.",
      ],
    ],
  },
  ir: {
    family: 'vowel',
    forms: gerundForms('yendo'),
    contexts: [
      [
        'Ahora mismo {subject} ___ hacia el mercado.',
        'Right now, {subject} [{be} going] toward the market.',
      ],
      [
        'En este momento {subject} ___ a la estación de autobuses.',
        'At this moment, {subject} [{be} going] to the bus station.',
      ],
    ],
  },
  construir: {
    family: 'vowel',
    forms: gerundForms('construyendo'),
    contexts: [
      [
        'En el taller {subject} ___ una mesa de madera.',
        'In the workshop, {subject} [{be} building] a wooden table.',
      ],
      [
        'Juntos {subject} ___ un proyecto muy especial.',
        'Together, {subject} [{be} building] a very special project.',
      ],
    ],
  },
  huir: {
    family: 'vowel',
    forms: gerundForms('huyendo'),
    contexts: [
      [
        'Del ruido de la ciudad {subject} ___ hacia el campo.',
        'From the city noise, {subject} [{be} fleeing] toward the countryside.',
      ],
      [
        'De la lluvia fuerte {subject} ___ bajo un techo.',
        'From the heavy rain, {subject} [{be} fleeing] under a roof.',
      ],
    ],
  },
} as const
