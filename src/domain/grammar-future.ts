import type { GrammarVerb } from './grammar-catalog-types'

export const futureFamilies = [
  {
    id: 'regular',
    title: 'Regular endings',
    example: 'hablaré · comeré · viviré',
    rule: 'Add -é, -ás, -á, -emos, -án directly to the full infinitive for all regular -ar, -er, and -ir verbs.',
  },
  {
    id: 'irregular-d',
    title: 'Stems with -dr-',
    example: 'tendré · pondré · vendré',
    rule: 'Replace the infinitive ending vowel with d (tendr-, pondr-, saldr-, vendr-) and add regular future endings.',
  },
  {
    id: 'irregular-drop',
    title: 'Vowel-dropping stems',
    example: 'podré · sabré · habré',
    rule: 'Drop the vowel in the infinitive ending to form the stem (podr-, sabr-, habr-, querr-) and add regular future endings.',
  },
  {
    id: 'irregular-short',
    title: 'Shortened stems',
    example: 'haré · diré',
    rule: 'Hacer and decir use shortened stems (har-, dir-) with regular future endings.',
  },
] as const

type Verb = GrammarVerb & { family: (typeof futureFamilies)[number]['id'] }

export const futureVerbs: Record<string, Verb> = {
  // --- Regular endings ---
  hablar: {
    family: 'regular',
    forms: ['hablaré', 'hablarás', 'hablará', 'hablaremos', 'hablarán'],
    contexts: [
      [
        'Mañana {subject} ___ con el médico sobre los estudios.',
        'Tomorrow, {subject} [will speak] with the doctor about the tests.',
      ],
      [
        'En la junta {subject} ___ de los nuevos proyectos.',
        'At the meeting, {subject} [will speak] about the new projects.',
      ],
    ],
  },
  comer: {
    family: 'regular',
    forms: ['comeré', 'comerás', 'comerá', 'comeremos', 'comerán'],
    contexts: [
      [
        'Más tarde {subject} ___ unos tacos después del cine.',
        'Later, {subject} [will eat] some tacos after the movies.',
      ],
      [
        'El sábado {subject} ___ en casa de los abuelos.',
        "On Saturday, {subject} [will eat] at grandparents' house.",
      ],
    ],
  },
  vivir: {
    family: 'regular',
    forms: ['viviré', 'vivirás', 'vivirá', 'viviremos', 'vivirán'],
    contexts: [
      [
        'El próximo año {subject} ___ en Guadalajara por trabajo.',
        'Next year, {subject} [will live] in Guadalajara for work.',
      ],
      [
        'En unos meses {subject} ___ en un departamento más grande.',
        'In a few months, {subject} [will live] in a bigger apartment.',
      ],
    ],
  },
  trabajar: {
    family: 'regular',
    forms: [
      'trabajaré',
      'trabajarás',
      'trabajará',
      'trabajaremos',
      'trabajarán',
    ],
    contexts: [
      [
        'La próxima semana {subject} ___ desde casa tres días.',
        'Next week, {subject} [will work] from home three days.',
      ],
      [
        'En el nuevo puesto {subject} ___ con un equipo bilingüe.',
        'In the new position, {subject} [will work] with a bilingual team.',
      ],
    ],
  },
  viajar: {
    family: 'regular',
    forms: ['viajaré', 'viajarás', 'viajará', 'viajaremos', 'viajarán'],
    contexts: [
      [
        'En diciembre {subject} ___ a la playa para descansar.',
        'In December, {subject} [will travel] to the beach to rest.',
      ],
      [
        'El próximo mes {subject} ___ a Monterrey por trabajo.',
        'Next month, {subject} [will travel] to Monterrey for work.',
      ],
    ],
  },
  aprender: {
    family: 'regular',
    forms: [
      'aprenderé',
      'aprenderás',
      'aprenderá',
      'aprenderemos',
      'aprenderán',
    ],
    contexts: [
      [
        'En el curso intensivo {subject} ___ vocabulario avanzado.',
        'In the intensive course, {subject} [will learn] advanced vocabulary.',
      ],
      [
        'Con ese maestro {subject} ___ a preparar mole poblano.',
        'With that teacher, {subject} [will learn] to make mole poblano.',
      ],
    ],
  },
  escribir: {
    family: 'regular',
    forms: [
      'escribiré',
      'escribirás',
      'escribirá',
      'escribiremos',
      'escribirán',
    ],
    contexts: [
      [
        'Esta tarde {subject} ___ un correo de confirmación.',
        'This afternoon, {subject} [will write] a confirmation email.',
      ],
      [
        'Durante el viaje {subject} ___ un diario con fotos.',
        'During the trip, {subject} [will write] a journal with photos.',
      ],
    ],
  },
  comprar: {
    family: 'regular',
    forms: ['compraré', 'comprarás', 'comprará', 'compraremos', 'comprarán'],
    contexts: [
      [
        'El fin de semana {subject} ___ los boletos para el concierto.',
        'Over the weekend, {subject} [will buy] tickets for the concert.',
      ],
      [
        'En el mercado {subject} ___ los ingredientes para la cena.',
        'At the market, {subject} [will buy] the ingredients for dinner.',
      ],
    ],
  },

  // --- Stems with -dr- ---
  tener: {
    family: 'irregular-d',
    forms: ['tendré', 'tendrás', 'tendrá', 'tendremos', 'tendrán'],
    contexts: [
      [
        'La próxima semana {subject} ___ una reunión muy importante.',
        'Next week, {subject} [will have] a very important meeting.',
      ],
      [
        'Pronto {subject} ___ los resultados de los análisis.',
        'Soon, {subject} [will have] the test results.',
      ],
    ],
  },
  poner: {
    family: 'irregular-d',
    forms: ['pondré', 'pondrás', 'pondrá', 'pondremos', 'pondrán'],
    contexts: [
      [
        'En un momento {subject} ___ la mesa para la comida.',
        'In a moment, {subject} [will set] the table for lunch.',
      ],
      [
        'Antes de salir {subject} ___ una chamarra por el frío.',
        'Before going out, {subject} [will put on] a jacket because of the cold.',
      ],
    ],
  },
  salir: {
    family: 'irregular-d',
    forms: ['saldré', 'saldrás', 'saldrá', 'saldremos', 'saldrán'],
    contexts: [
      [
        'Mañana {subject} ___ temprano para evitar el tráfico.',
        'Tomorrow, {subject} [will leave] early to avoid traffic.',
      ],
      [
        'El viernes {subject} ___ a cenar con amigos del trabajo.',
        'On Friday, {subject} [will go out] to dinner with coworkers.',
      ],
    ],
  },
  venir: {
    family: 'irregular-d',
    forms: ['vendré', 'vendrás', 'vendrá', 'vendremos', 'vendrán'],
    contexts: [
      [
        'El próximo domingo {subject} ___ a comer en familia.',
        'Next Sunday, {subject} [will come] to eat with the family.',
      ],
      [
        'A la fiesta {subject} ___ con ropa cómoda.',
        'To the party, {subject} [will come] in comfortable clothes.',
      ],
    ],
  },

  // --- Vowel-dropping stems ---
  poder: {
    family: 'irregular-drop',
    forms: ['podré', 'podrás', 'podrá', 'podremos', 'podrán'],
    contexts: [
      [
        'La próxima semana {subject} ___ viajar sin problemas.',
        'Next week, {subject} [will be able to] travel without problems.',
      ],
      [
        'Con un poco de descanso {subject} ___ continuar el trabajo.',
        'With a little rest, {subject} [will be able to] continue working.',
      ],
    ],
  },
  saber: {
    family: 'irregular-drop',
    forms: ['sabré', 'sabrás', 'sabrá', 'sabremos', 'sabrán'],
    contexts: [
      [
        'Mañana por la tarde {subject} ___ la respuesta oficial.',
        'Tomorrow afternoon, {subject} [will know] the official answer.',
      ],
      [
        'Muy pronto {subject} ___ si el plan funcionó.',
        'Very soon, {subject} [will know] if the plan worked.',
      ],
    ],
  },
  haber: {
    family: 'irregular-drop',
    forms: ['habré', 'habrás', 'habrá', 'habremos', 'habrán'],
    contexts: [
      [
        'Para mañana {subject} ___ terminado todo el trabajo.',
        'By tomorrow, {subject} [will have] finished all the work.',
      ],
      [
        'En una hora {subject} ___ llegado a la estación.',
        'In an hour, {subject} [will have] arrived at the station.',
      ],
    ],
  },
  querer: {
    family: 'irregular-drop',
    forms: ['querré', 'querrás', 'querrá', 'querremos', 'querrán'],
    contexts: [
      [
        'Después de correr tanto {subject} ___ tomar mucha agua.',
        'After running so much, {subject} [will want] to drink lots of water.',
      ],
      [
        'En las vacaciones {subject} ___ descansar lejos de la ciudad.',
        'On vacation, {subject} [will want] to rest far from the city.',
      ],
    ],
  },

  // --- Shortened stems ---
  hacer: {
    family: 'irregular-short',
    forms: ['haré', 'harás', 'hará', 'haremos', 'harán'],
    contexts: [
      [
        'El fin de semana {subject} ___ una comida para los amigos.',
        'Over the weekend, {subject} [will make] a meal for friends.',
      ],
      [
        'Mañana {subject} ___ una llamada para confirmar la cita.',
        'Tomorrow, {subject} [will make] a phone call to confirm the appointment.',
      ],
    ],
  },
  decir: {
    family: 'irregular-short',
    forms: ['diré', 'dirás', 'dirá', 'diremos', 'dirán'],
    contexts: [
      [
        'En la junta {subject} ___ toda la verdad sobre el proyecto.',
        'At the meeting, {subject} [will tell] the whole truth about the project.',
      ],
      [
        'Cuando llegue el momento {subject} ___ unas palabras de agradecimiento.',
        'When the moment comes, {subject} [will say] a few words of thanks.',
      ],
    ],
  },
}
