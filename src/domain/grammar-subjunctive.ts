import type { GrammarVerb } from './grammar-catalog-types'

export const subjunctiveFamilies = [
  {
    id: 'regular',
    title: 'Regular opposite endings',
    example: 'hable · coma · viva',
    rule: 'Switch the vowel: -ar verbs take -e, -es, -e, -emos, -en; -er and -ir verbs take -a, -as, -a, -amos, -an.',
  },
  {
    id: 'stem-change',
    title: 'Stem changes',
    example: 'piense · pueda · pida',
    rule: 'Stem changes (e→ie, o→ue, e→i) apply in all singular forms and 3rd person plural. Nosotros keeps regular e/o (or u in dormir).',
  },
  {
    id: 'yo-stem',
    title: 'Present yo-stems',
    example: 'haga · tenga · ponga',
    rule: 'Take the stem from the irregular present indicative yo form (hag-, teng-, pong-, dig-, salg-, veng-) and add subjunctive endings.',
  },
  {
    id: 'irregular',
    title: 'Essential irregulars',
    example: 'sea · vaya · esté',
    rule: 'Verbs with unique non-o present yo forms are irregular in the subjunctive: ser (sea), ir (vaya), estar (esté), saber (sepa), dar (dé).',
  },
] as const

type Verb = GrammarVerb & {
  family: (typeof subjunctiveFamilies)[number]['id']
}

export const subjunctiveVerbs: Record<string, Verb> = {
  // --- Regular opposite endings ---
  hablar: {
    family: 'regular',
    forms: ['hable', 'hables', 'hable', 'hablemos', 'hablen'],
    contexts: [
      [
        'Es importante que {subject} ___ con el director hoy.',
        'It is important that {subject} [speak] with the director today.',
      ],
      [
        'Ojalá que {subject} ___ de sus planes con la familia.',
        'Hopefully {subject} [speak{s}] about plans with family.',
      ],
    ],
  },
  trabajar: {
    family: 'regular',
    forms: ['trabaje', 'trabajes', 'trabaje', 'trabajemos', 'trabajen'],
    contexts: [
      [
        'Es necesario que {subject} ___ en equipo para terminar.',
        'It is necessary that {subject} [work] as a team to finish.',
      ],
      [
        'Espero que {subject} ___ con entusiasmo en el proyecto.',
        'I hope {subject} [work{s}] with enthusiasm on the project.',
      ],
    ],
  },
  comprar: {
    family: 'regular',
    forms: ['compre', 'compres', 'compre', 'compremos', 'compren'],
    contexts: [
      [
        'Recomiendo que {subject} ___ fruta fresca en el mercado.',
        'I recommend that {subject} [buy] fresh fruit at the market.',
      ],
      [
        'Es mejor que {subject} ___ los boletos con anticipación.',
        'It is better that {subject} [buy] tickets in advance.',
      ],
    ],
  },
  estudiar: {
    family: 'regular',
    forms: ['estudie', 'estudies', 'estudie', 'estudiemos', 'estudien'],
    contexts: [
      [
        'Es fundamental que {subject} ___ para el examen final.',
        'It is essential that {subject} [study] for the final exam.',
      ],
      [
        'El maestro quiere que {subject} ___ dos horas al día.',
        'The teacher wants that {subject} [study] two hours a day.',
      ],
    ],
  },
  comer: {
    family: 'regular',
    forms: ['coma', 'comas', 'coma', 'comamos', 'coman'],
    contexts: [
      [
        'El médico sugiere que {subject} ___ más verduras frescas.',
        'The doctor suggests that {subject} [eat] more fresh vegetables.',
      ],
      [
        'Espero que {subject} ___ algo ligero antes de salir.',
        'I hope {subject} [eat{s}] something light before leaving.',
      ],
    ],
  },
  aprender: {
    family: 'regular',
    forms: ['aprenda', 'aprendas', 'aprenda', 'aprendamos', 'aprendan'],
    contexts: [
      [
        'Queremos que {subject} ___ a cocinar comida tradicional.',
        'We want that {subject} [learn] to cook traditional food.',
      ],
      [
        'Es bueno que {subject} ___ las reglas desde el principio.',
        'It is good that {subject} [learn] the rules from the start.',
      ],
    ],
  },
  vivir: {
    family: 'regular',
    forms: ['viva', 'vivas', 'viva', 'vivamos', 'vivan'],
    contexts: [
      [
        'Deseo que {subject} ___ con tranquilidad y alegría.',
        'I wish that {subject} [live] peacefully and with joy.',
      ],
      [
        'Es preferible que {subject} ___ cerca de la oficina.',
        'It is preferable that {subject} [live] near the office.',
      ],
    ],
  },
  escribir: {
    family: 'regular',
    forms: ['escriba', 'escribas', 'escriba', 'escribamos', 'escriban'],
    contexts: [
      [
        'Le pido que {subject} ___ un resumen del reporte.',
        'I ask that {subject} [write] a summary of the report.',
      ],
      [
        'Es importante que {subject} ___ las instrucciones claramente.',
        'It is important that {subject} [write] the instructions clearly.',
      ],
    ],
  },

  // --- Stem changes ---
  pensar: {
    family: 'stem-change',
    forms: ['piense', 'pienses', 'piense', 'pensemos', 'piensen'],
    contexts: [
      [
        'Es bueno que {subject} ___ bien las opciones antes.',
        'It is good that {subject} [think] through the options beforehand.',
      ],
      [
        'Espero que {subject} ___ en el futuro de la comunidad.',
        "I hope {subject} [think{s}] about the community's future.",
      ],
    ],
  },
  querer: {
    family: 'stem-change',
    forms: ['quiera', 'quieras', 'quiera', 'queramos', 'quieran'],
    contexts: [
      [
        'Dudo que {subject} ___ salir con esta lluvia fuerte.',
        'I doubt that {subject} [want{s}] to go out in this heavy rain.',
      ],
      [
        'Ojalá que {subject} ___ acompañarnos a la fiesta.',
        'Hopefully {subject} [want{s}] to accompany us to the party.',
      ],
    ],
  },
  poder: {
    family: 'stem-change',
    forms: ['pueda', 'puedas', 'pueda', 'podamos', 'puedan'],
    contexts: [
      [
        'Espero que {subject} ___ llegar a tiempo a la junta.',
        'I hope {subject} [can] arrive on time to the meeting.',
      ],
      [
        'Ojalá que {subject} ___ resolver el problema hoy.',
        'Hopefully {subject} [can] resolve the problem today.',
      ],
    ],
  },
  dormir: {
    family: 'stem-change',
    forms: ['duerma', 'duermas', 'duerma', 'durmamos', 'duerman'],
    contexts: [
      [
        'Es importante que {subject} ___ al menos ocho horas.',
        'It is important that {subject} [sleep] at least eight hours.',
      ],
      [
        'Espero que {subject} ___ bien en este cuarto tranquilo.',
        'I hope {subject} [sleep{s}] well in this quiet room.',
      ],
    ],
  },
  pedir: {
    family: 'stem-change',
    forms: ['pida', 'pidas', 'pida', 'pidamos', 'pidan'],
    contexts: [
      [
        'Recomiendo que {subject} ___ la especialidad de la casa.',
        'I recommend that {subject} [order] the house specialty.',
      ],
      [
        'Es mejor que {subject} ___ ayuda si la necesita.',
        'It is better that {subject} [ask] for help if needed.',
      ],
    ],
  },

  // --- Irregular yo-stems ---
  tener: {
    family: 'yo-stem',
    forms: ['tenga', 'tengas', 'tenga', 'tengamos', 'tengan'],
    contexts: [
      [
        'Ojalá que {subject} ___ un viaje excelente.',
        'Hopefully {subject} [{have}] an excellent trip.',
      ],
      [
        'Es necesario que {subject} ___ paciencia con los trámites.',
        'It is necessary that {subject} [{have}] patience with the paperwork.',
      ],
    ],
  },
  hacer: {
    family: 'yo-stem',
    forms: ['haga', 'hagas', 'haga', 'hagamos', 'hagan'],
    contexts: [
      [
        'Es fundamental que {subject} ___ la tarea con cuidado.',
        'It is essential that {subject} [do] the homework carefully.',
      ],
      [
        'Espero que {subject} ___ una pausa para almorzar.',
        'I hope {subject} [take{s}] a break for lunch.',
      ],
    ],
  },
  poner: {
    family: 'yo-stem',
    forms: ['ponga', 'pongas', 'ponga', 'pongamos', 'pongan'],
    contexts: [
      [
        'Es necesario que {subject} ___ atención a los detalles.',
        'It is necessary that {subject} [pay] attention to details.',
      ],
      [
        'Espero que {subject} ___ las cosas en su lugar.',
        'I hope {subject} [put{s}] things in their place.',
      ],
    ],
  },
  salir: {
    family: 'yo-stem',
    forms: ['salga', 'salgas', 'salga', 'salgamos', 'salgan'],
    contexts: [
      [
        'Es mejor que {subject} ___ temprano para evitar el tráfico.',
        'It is better that {subject} [leave] early to avoid traffic.',
      ],
      [
        'Espero que {subject} ___ con una sonrisa de la reunión.',
        'I hope {subject} [leave{s}] with a smile from the meeting.',
      ],
    ],
  },
  venir: {
    family: 'yo-stem',
    forms: ['venga', 'vengas', 'venga', 'vengamos', 'vengan'],
    contexts: [
      [
        'Queremos que {subject} ___ a la cena de bienvenida.',
        'We want that {subject} [come] to the welcome dinner.',
      ],
      [
        'Espero que {subject} ___ preparado para el taller.',
        'I hope {subject} [come{s}] prepared for the workshop.',
      ],
    ],
  },
  decir: {
    family: 'yo-stem',
    forms: ['diga', 'digas', 'diga', 'digamos', 'digan'],
    contexts: [
      [
        'Es importante que {subject} ___ la verdad en la entrevista.',
        'It is important that {subject} [tell] the truth in the interview.',
      ],
      [
        'Espero que {subject} ___ lo que realmente siente.',
        'I hope {subject} [say{s}] what one really feels.',
      ],
    ],
  },

  // --- Essential irregulars ---
  ser: {
    family: 'irregular',
    forms: ['sea', 'seas', 'sea', 'seamos', 'sean'],
    contexts: [
      [
        'Espero que {subject} ___ muy feliz en su nuevo hogar.',
        'I hope {subject} [{be}] very happy in their new home.',
      ],
      [
        'Es importante que {subject} ___ puntual para la cita.',
        'It is important that {subject} [{be}] punctual for the appointment.',
      ],
    ],
  },
  estar: {
    family: 'irregular',
    forms: ['esté', 'estés', 'esté', 'estemos', 'estén'],
    contexts: [
      [
        'Ojalá que {subject} ___ listo cuando llegue el taxi.',
        'Hopefully {subject} [{be}] ready when the taxi arrives.',
      ],
      [
        'Espero que {subject} ___ muy bien de salud.',
        'I hope {subject} [{be}] in very good health.',
      ],
    ],
  },
  ir: {
    family: 'irregular',
    forms: ['vaya', 'vayas', 'vaya', 'vayamos', 'vayan'],
    contexts: [
      [
        'Es mejor que {subject} ___ en metro para llegar rápido.',
        'It is better that {subject} [go] by metro to arrive quickly.',
      ],
      [
        'Ojalá que {subject} ___ con calma por el camino.',
        'Hopefully {subject} [go] calmly along the way.',
      ],
    ],
  },
  saber: {
    family: 'irregular',
    forms: ['sepa', 'sepas', 'sepa', 'sepamos', 'sepan'],
    contexts: [
      [
        'Es fundamental que {subject} ___ cómo reaccionar en emergencias.',
        'It is essential that {subject} [know] how to react in emergencies.',
      ],
      [
        'Dudo que {subject} ___ toda la historia completa.',
        'I doubt that {subject} [know{s}] the whole complete story.',
      ],
    ],
  },
  dar: {
    family: 'irregular',
    forms: ['dé', 'des', 'dé', 'demos', 'den'],
    contexts: [
      [
        'Es importante que {subject} ___ las gracias por el apoyo.',
        'It is important that {subject} [give] thanks for the support.',
      ],
      [
        'Espero que {subject} ___ lo mejor en esta oportunidad.',
        'I hope {subject} [give{s}] their best in this opportunity.',
      ],
    ],
  },
}
