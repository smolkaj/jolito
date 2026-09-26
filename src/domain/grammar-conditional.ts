import type { GrammarVerb } from './grammar-catalog-types'

export const conditionalFamilies = [
  {
    id: 'regular',
    title: 'Regular endings',
    example: 'hablaría · comería · viviría',
    rule: 'Add -ía, -ías, -ía, -íamos, -ían directly to the full infinitive for all regular -ar, -er, and -ir verbs.',
  },
  {
    id: 'irregular-d',
    title: 'Stems with -dr-',
    example: 'tendría · pondría · vendría',
    rule: 'Replace the infinitive ending vowel with d (tendr-, pondr-, saldr-, vendr-) and add conditional endings.',
  },
  {
    id: 'irregular-drop',
    title: 'Vowel-dropping stems',
    example: 'podría · sabría · habría',
    rule: 'Drop the vowel in the infinitive ending to form the stem (podr-, sabr-, habr-, querr-) and add conditional endings.',
  },
  {
    id: 'irregular-short',
    title: 'Shortened stems',
    example: 'haría · diría',
    rule: 'Hacer and decir use shortened stems (har-, dir-) with regular conditional endings.',
  },
] as const

type Verb = GrammarVerb & {
  family: (typeof conditionalFamilies)[number]['id']
}

export const conditionalVerbs: Record<string, Verb> = {
  // --- Regular endings ---
  hablar: {
    family: 'regular',
    forms: ['hablaría', 'hablarías', 'hablaría', 'hablaríamos', 'hablarían'],
    contexts: [
      [
        'Con más tiempo {subject} ___ con el gerente hoy.',
        'With more time, {subject} [would speak] with the manager today.',
      ],
      [
        'En esa situación {subject} ___ con mucha calma.',
        'In that situation, {subject} [would speak] very calmly.',
      ],
    ],
  },
  comer: {
    family: 'regular',
    forms: ['comería', 'comerías', 'comería', 'comeríamos', 'comerían'],
    contexts: [
      [
        'Con más hambre {subject} ___ dos órdenes de tacos.',
        'With more appetite, {subject} [would eat] two orders of tacos.',
      ],
      [
        'Si fuera posible, {subject} ___ comida mexicana todos los días.',
        'If possible, {subject} [would eat] Mexican food every day.',
      ],
    ],
  },
  vivir: {
    family: 'regular',
    forms: ['viviría', 'vivirías', 'viviría', 'viviríamos', 'vivirían'],
    contexts: [
      [
        'De ser posible, {subject} ___ cerca de la playa.',
        'If possible, {subject} [would live] near the beach.',
      ],
      [
        'En una ciudad tranquila {subject} ___ con menos estrés.',
        'In a quiet city, {subject} [would live] with less stress.',
      ],
    ],
  },
  trabajar: {
    family: 'regular',
    forms: [
      'trabajaría',
      'trabajarías',
      'trabajaría',
      'trabajaríamos',
      'trabajarían',
    ],
    contexts: [
      [
        'Con un mejor horario {subject} ___ con mucho gusto.',
        'With better hours, {subject} [would work] gladly.',
      ],
      [
        'Por ese sueldo {subject} ___ tiempo completo.',
        'For that salary, {subject} [would work] full time.',
      ],
    ],
  },
  viajar: {
    family: 'regular',
    forms: ['viajaría', 'viajarías', 'viajaría', 'viajaríamos', 'viajarían'],
    contexts: [
      [
        'Con más dinero {subject} ___ por todo el mundo.',
        'With more money, {subject} [would travel] all around the world.',
      ],
      [
        'En las vacaciones {subject} ___ a Japón este otoño.',
        'On vacation, {subject} [would travel] to Japan this fall.',
      ],
    ],
  },
  aprender: {
    family: 'regular',
    forms: [
      'aprendería',
      'aprenderías',
      'aprendería',
      'aprenderíamos',
      'aprenderían',
    ],
    contexts: [
      [
        'Con un buen curso {subject} ___ a programar rápido.',
        'With a good course, {subject} [would learn] to code quickly.',
      ],
      [
        'En poco tiempo {subject} ___ a preparar pan dulce.',
        'In a short time, {subject} [would learn] to make pan dulce.',
      ],
    ],
  },
  escribir: {
    family: 'regular',
    forms: [
      'escribiría',
      'escribirías',
      'escribiría',
      'escribiríamos',
      'escribirían',
    ],
    contexts: [
      [
        'Con suficiente tiempo {subject} ___ una novela corta.',
        'With enough time, {subject} [would write] a short novel.',
      ],
      [
        'Con calma {subject} ___ una carta detallada.',
        'With calm, {subject} [would write] a detailed letter.',
      ],
    ],
  },
  comprar: {
    family: 'regular',
    forms: [
      'compraría',
      'comprarías',
      'compraría',
      'compraríamos',
      'comprarían',
    ],
    contexts: [
      [
        'Con un descuento {subject} ___ esa chamarra azul.',
        'With a discount, {subject} [would buy] that blue jacket.',
      ],
      [
        'En esa tienda {subject} ___ muebles de madera.',
        'At that shop, {subject} [would buy] wooden furniture.',
      ],
    ],
  },

  // --- Stems with -dr- ---
  tener: {
    family: 'irregular-d',
    forms: ['tendría', 'tendrías', 'tendría', 'tendríamos', 'tendrían'],
    contexts: [
      [
        'Con un auto {subject} ___ más facilidad para moverse.',
        'With a car, {subject} [would have] an easier time getting around.',
      ],
      [
        'En esa colonia {subject} ___ una vista increíble del parque.',
        'In that neighborhood, {subject} [would have] an incredible view of the park.',
      ],
    ],
  },
  poner: {
    family: 'irregular-d',
    forms: ['pondría', 'pondrías', 'pondría', 'pondríamos', 'pondrían'],
    contexts: [
      [
        'En la sala {subject} ___ unas plantas para dar luz.',
        'In the living room, {subject} [would put] some plants for brightness.',
      ],
      [
        'Para esa ocasión {subject} ___ música mexicana alegre.',
        'For that occasion, {subject} [would put on] cheerful Mexican music.',
      ],
    ],
  },
  salir: {
    family: 'irregular-d',
    forms: ['saldría', 'saldrías', 'saldría', 'saldríamos', 'saldrían'],
    contexts: [
      [
        'Si no lloviera, {subject} ___ a caminar por la alameda.',
        "If it weren't raining, {subject} [would go out] to walk around the park.",
      ],
      [
        'Este fin de semana {subject} ___ a cenar con amigos.',
        'This weekend, {subject} [would go out] to dinner with friends.',
      ],
    ],
  },
  venir: {
    family: 'irregular-d',
    forms: ['vendría', 'vendrías', 'vendría', 'vendríamos', 'vendrían'],
    contexts: [
      [
        'Con una invitación {subject} ___ con mucho gusto a la fiesta.',
        'With an invitation, {subject} [would come] gladly to the party.',
      ],
      [
        'El fin de semana {subject} ___ con gusto a la fiesta.',
        'Over the weekend, {subject} [would come] gladly to the party.',
      ],
    ],
  },

  // --- Vowel-dropping stems ---
  poder: {
    family: 'irregular-drop',
    forms: ['podría', 'podrías', 'podría', 'podríamos', 'podrían'],
    contexts: [
      [
        'Con un poco de ayuda, {subject} ___ terminar a tiempo.',
        'With a little help, {subject} [could] finish on time.',
      ],
      [
        'Mañana por la tarde {subject} ___ revisar los documentos.',
        'Tomorrow afternoon, {subject} [could] review the documents.',
      ],
    ],
  },
  saber: {
    family: 'irregular-drop',
    forms: ['sabría', 'sabrías', 'sabría', 'sabríamos', 'sabrían'],
    contexts: [
      [
        'Con esa pista {subject} ___ qué camino tomar.',
        'With that clue, {subject} [would know] which path to take.',
      ],
      [
        'En ese caso {subject} ___ exactamente qué responder.',
        'In that case, {subject} [would know] exactly what to answer.',
      ],
    ],
  },
  haber: {
    family: 'irregular-drop',
    forms: ['habría', 'habrías', 'habría', 'habríamos', 'habrían'],
    contexts: [
      [
        'En otra época {subject} ___ actuado de forma diferente.',
        'In another era, {subject} [would have] acted differently.',
      ],
      [
        'Con más aviso {subject} ___ llegado antes a la cita.',
        'With more notice, {subject} [would have] arrived earlier to the appointment.',
      ],
    ],
  },
  querer: {
    family: 'irregular-drop',
    forms: ['querría', 'querrías', 'querría', 'querríamos', 'querrían'],
    contexts: [
      [
        'En este calor {subject} ___ un agua fresca de horchata.',
        'In this heat, {subject} [would like] a fresh horchata water.',
      ],
      [
        'Para las vacaciones {subject} ___ viajar a algún pueblo mágico.',
        'For vacation, {subject} [would like] to travel to a magical town.',
      ],
    ],
  },

  // --- Shortened stems ---
  hacer: {
    family: 'irregular-short',
    forms: ['haría', 'harías', 'haría', 'haríamos', 'harían'],
    contexts: [
      [
        'Con los ingredientes correctos {subject} ___ chiles en nogada.',
        'With the right ingredients, {subject} [would make] chiles en nogada.',
      ],
      [
        'Con más tiempo {subject} ___ ejercicio todos los días.',
        'With more time, {subject} [would do] exercise every day.',
      ],
    ],
  },
  decir: {
    family: 'irregular-short',
    forms: ['diría', 'dirías', 'diría', 'diríamos', 'dirían'],
    contexts: [
      [
        'En esa situación {subject} ___ que lo mejor es esperar.',
        'In that situation, {subject} [would say] it is best to wait.',
      ],
      [
        'Sinceramente {subject} ___ toda la verdad sin dudar.',
        'Honestly, {subject} [would tell] the whole truth without hesitating.',
      ],
    ],
  },
}
