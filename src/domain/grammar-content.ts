export const grammarFamilies = [
  {
    id: 'regular',
    title: 'Regular endings',
    example: 'hablé · comí · viví',
    rule: 'Replace -ar with -é, -aste, -ó, -amos, -aron. Replace -er or -ir with -í, -iste, -ió, -imos, -ieron.',
  },
  {
    id: 'essential',
    title: 'Common irregulars',
    example: 'fui · di · vi',
    rule: 'Ser and ir share all preterite forms; context determines the meaning. Dar and ver have no written accents.',
  },
  {
    id: 'irregular',
    title: 'Irregular stems',
    example: 'tuve · hice · dije',
    rule: 'Add -e, -iste, -o, -imos, -ieron to the irregular stem, without accents. After j, use -eron instead of -ieron.',
  },
  {
    id: 'spelling',
    title: 'Spelling changes',
    example: 'busqué · llegué · empecé',
    rule: 'In yo: -car → -qué, -gar → -gué, -zar → -cé, preserving the consonant sound. Other forms are regular.',
  },
  {
    id: 'stem',
    title: 'Third-person changes',
    example: 'pidió · durmieron',
    rule: 'These -ir verbs change e → i or o → u only in the third person: él/ella/usted and ellos/ellas/ustedes.',
  },
  {
    id: 'vowel',
    title: 'i → y',
    example: 'leyó · oyeron',
    rule: 'After these vowel stems, i becomes y in the third person: -yó and -yeron.',
  },
] as const

export type GrammarFocus = 'mixed' | (typeof grammarFamilies)[number]['id']
export const grammarPeople = [
  'yo',
  'tú',
  'él / ella / usted',
  'nosotros/as',
  'ellos / ellas / ustedes',
] as const

type Verb = {
  family: Exclude<GrammarFocus, 'mixed'>
  forms: readonly [string, string, string, string, string]
  contexts: readonly [readonly [string, string], readonly [string, string]]
  note?: string
}

// Full authored sentences own their word order and time context. {ir}/{llegar}
// establish the same subject before an omitted pronoun; they reuse canonical forms.
// The schedule belongs to verb/person, not to a sentence.
export const preteriteVerbs = {
  hablar: {
    family: 'regular',
    forms: ['hablé', 'hablaste', 'habló', 'hablamos', 'hablaron'],
    contexts: [
      [
        'Anoche {subject} ___ con la vecina.',
        'Last night, {subject} spoke with the neighbor.',
      ],
      [
        'Después de cenar, {subject} ___ de la película.',
        'After dinner, {subject} talked about the movie.',
      ],
    ],
  },
  comer: {
    family: 'regular',
    forms: ['comí', 'comiste', 'comió', 'comimos', 'comieron'],
    contexts: [
      [
        '{ir} al mercado y ___ en un puesto de tacos.',
        '{subject} went to the market and ate at a taco stand.',
      ],
      [
        '{subject} ___ tacos de hongos el domingo.',
        '{subject} ate mushroom tacos on Sunday.',
      ],
    ],
  },
  vivir: {
    family: 'regular',
    forms: ['viví', 'viviste', 'vivió', 'vivimos', 'vivieron'],
    contexts: [
      [
        'En ese viaje, {subject} ___ una experiencia increíble.',
        'On that trip, {subject} had an incredible experience.',
      ],
      [
        'Durante la fiesta, {subject} ___ un momento especial.',
        'During the party, {subject} experienced a special moment.',
      ],
    ],
  },
  comprar: {
    family: 'regular',
    forms: ['compré', 'compraste', 'compró', 'compramos', 'compraron'],
    contexts: [
      [
        '{subject} ___ pan en la esquina esta mañana.',
        '{subject} bought bread on the corner this morning.',
      ],
      [
        '{ir} al mercado y ___ fruta para el desayuno.',
        '{subject} went to the market and bought fruit for breakfast.',
      ],
    ],
  },
  aprender: {
    family: 'regular',
    forms: ['aprendí', 'aprendiste', 'aprendió', 'aprendimos', 'aprendieron'],
    contexts: [
      [
        'En clase, {subject} ___ una palabra nueva.',
        'In class, {subject} learned a new word.',
      ],
      [
        '{subject} ___ a preparar salsa el fin de semana.',
        '{subject} learned to make salsa over the weekend.',
      ],
    ],
  },
  escribir: {
    family: 'regular',
    forms: ['escribí', 'escribiste', 'escribió', 'escribimos', 'escribieron'],
    contexts: [
      [
        '{subject} ___ un mensaje antes de salir.',
        '{subject} wrote a message before leaving.',
      ],
      [
        'Al volver a casa, {subject} ___ una carta.',
        'After returning home, {subject} wrote a letter.',
      ],
    ],
  },
  ir: {
    family: 'essential',
    forms: ['fui', 'fuiste', 'fue', 'fuimos', 'fueron'],
    contexts: [
      [
        'El viernes, {subject} ___ al mercado.',
        'On Friday, {subject} went to the market.',
      ],
      [
        '{subject} ___ a Coyoacán después de comer.',
        '{subject} went to Coyoacán after lunch.',
      ],
    ],
    note: 'Ir and ser share all preterite forms. The destination here identifies ir.',
  },
  ser: {
    family: 'essential',
    forms: ['fui', 'fuiste', 'fue', 'fuimos', 'fueron'],
    contexts: [
      [
        'Ese día, {subject} ___ parte del equipo ganador.',
        'That day, {subject} {was} part of the winning team.',
      ],
      [
        '{subject} ___ parte de la solución.',
        '{subject} {was} part of the solution.',
      ],
    ],
    note: 'Ser and ir share all preterite forms. Here, ser describes a role: “was” or “were”.',
  },
  dar: {
    family: 'essential',
    forms: ['di', 'diste', 'dio', 'dimos', 'dieron'],
    contexts: [
      [
        'Después de comer, {subject} ___ un paseo por el parque.',
        'After lunch, {subject} took a walk in the park.',
      ],
      [
        '{subject} ___ las gracias al mesero antes de salir.',
        '{subject} thanked the waiter before leaving.',
      ],
    ],
    note: 'Di and dio have no written accent.',
  },
  ver: {
    family: 'essential',
    forms: ['vi', 'viste', 'vio', 'vimos', 'vieron'],
    contexts: [
      [
        '{subject} ___ una película mexicana anoche.',
        '{subject} watched a Mexican movie last night.',
      ],
      [
        'Desde la azotea, {subject} ___ el atardecer.',
        'From the rooftop, {subject} saw the sunset.',
      ],
    ],
    note: 'Vi and vio have no written accent.',
  },
  tener: {
    family: 'irregular',
    forms: ['tuve', 'tuviste', 'tuvo', 'tuvimos', 'tuvieron'],
    contexts: [
      [
        'En el camino, {subject} ___ una idea.',
        'On the way, {subject} had an idea.',
      ],
      [
        'El domingo, {subject} ___ tiempo para caminar.',
        'On Sunday, {subject} had time for a walk.',
      ],
    ],
    note: 'Tener → tuv-, with irregular endings and no accents.',
  },
  hacer: {
    family: 'irregular',
    forms: ['hice', 'hiciste', 'hizo', 'hicimos', 'hicieron'],
    contexts: [
      ['{llegar} a casa y ___ la cena.', '{subject} got home and made dinner.'],
      [
        '{subject} ___ una reservación por teléfono.',
        '{subject} made a reservation by phone.',
      ],
    ],
    note: 'Hacer → hic-, except hizo: z preserves the consonant sound before o.',
  },
  decir: {
    family: 'irregular',
    forms: ['dije', 'dijiste', 'dijo', 'dijimos', 'dijeron'],
    contexts: [
      [
        'Al final, {subject} ___ la verdad.',
        'In the end, {subject} told the truth.',
      ],
      [
        'Durante la cena, {subject} ___ algo interesante.',
        'During dinner, {subject} said something interesting.',
      ],
    ],
    note: 'Decir → dij-. After j, use -eron: dijeron, not “dijieron”.',
  },
  estar: {
    family: 'irregular',
    forms: ['estuve', 'estuviste', 'estuvo', 'estuvimos', 'estuvieron'],
    contexts: [
      [
        'El lunes, {subject} ___ en casa todo el día.',
        'On Monday, {subject} {was} home all day.',
      ],
      [
        '{subject} ___ en el museo dos horas el sábado.',
        '{subject} spent two hours at the museum on Saturday.',
      ],
    ],
    note: 'Estar → estuv-, with irregular endings and no accents.',
  },
  poder: {
    family: 'irregular',
    forms: ['pude', 'pudiste', 'pudo', 'pudimos', 'pudieron'],
    contexts: [
      [
        'Esta mañana, {subject} ___ conseguir boletos.',
        'This morning, {subject} managed to get tickets.',
      ],
      [
        '{subject} ___ terminar a tiempo.',
        '{subject} managed to finish on time.',
      ],
    ],
    note: 'Poder → pud-. Here it means “managed to”.',
  },
  poner: {
    family: 'irregular',
    forms: ['puse', 'pusiste', 'puso', 'pusimos', 'pusieron'],
    contexts: [
      [
        'Antes de cenar, {subject} ___ la mesa.',
        'Before dinner, {subject} set the table.',
      ],
      [
        '{llegar} a casa y ___ música para cocinar.',
        '{subject} got home and put on music to cook.',
      ],
    ],
    note: 'Poner → pus-, with irregular endings and no accents.',
  },
  venir: {
    family: 'irregular',
    forms: ['vine', 'viniste', 'vino', 'vinimos', 'vinieron'],
    contexts: [
      [
        '{subject} ___ en metro a la reunión.',
        '{subject} came to the meeting by metro.',
      ],
      [
        'El sábado, {subject} ___ a la fiesta.',
        'On Saturday, {subject} came to the party.',
      ],
    ],
    note: 'Venir → vin-. Vino has no accent.',
  },
  querer: {
    family: 'irregular',
    forms: ['quise', 'quisiste', 'quiso', 'quisimos', 'quisieron'],
    contexts: [
      [
        'En el restaurante, {subject} ___ probar algo nuevo.',
        'At the restaurant, {subject} wanted to try something new.',
      ],
      [
        '{subject} ___ ayudar con la cena.',
        '{subject} wanted to help with dinner.',
      ],
    ],
    note: 'Querer → quis-, with irregular endings and no accents.',
  },
  saber: {
    family: 'irregular',
    forms: ['supe', 'supiste', 'supo', 'supimos', 'supieron'],
    contexts: [
      [
        '{subject} ___ la noticia por la radio.',
        '{subject} found out the news on the radio.',
      ],
      [
        'Al terminar el partido, {subject} ___ el resultado.',
        'After the match, {subject} found out the result.',
      ],
    ],
    note: 'Saber → sup-. Here it means “found out”.',
  },
  traer: {
    family: 'irregular',
    forms: ['traje', 'trajiste', 'trajo', 'trajimos', 'trajeron'],
    contexts: [
      [
        '{subject} ___ pan dulce para el desayuno.',
        '{subject} brought sweet bread for breakfast.',
      ],
      [
        'Para la reunión, {subject} ___ algo para compartir.',
        'For the gathering, {subject} brought something to share.',
      ],
    ],
    note: 'Traer → traj-. After j, use -eron: trajeron.',
  },
  andar: {
    family: 'irregular',
    forms: ['anduve', 'anduviste', 'anduvo', 'anduvimos', 'anduvieron'],
    contexts: [
      [
        'El domingo, {subject} ___ por el centro.',
        'On Sunday, {subject} walked around downtown.',
      ],
      [
        '{subject} ___ por el parque después de comer.',
        '{subject} walked around the park after lunch.',
      ],
    ],
    note: 'Andar → anduv-, like tuv- and estuv-.',
  },
  conducir: {
    family: 'irregular',
    forms: ['conduje', 'condujiste', 'condujo', 'condujimos', 'condujeron'],
    contexts: [
      [
        'El viernes, {subject} ___ hasta Puebla.',
        'On Friday, {subject} drove to Puebla.',
      ],
      [
        '{subject} ___ por la ciudad de noche.',
        '{subject} drove through the city at night.',
      ],
    ],
    note: 'Conducir → conduj-. After j, use -eron: condujeron.',
  },
  buscar: {
    family: 'spelling',
    forms: ['busqué', 'buscaste', 'buscó', 'buscamos', 'buscaron'],
    contexts: [
      [
        'Antes de salir, {subject} ___ las llaves.',
        'Before leaving, {subject} looked for the keys.',
      ],
      [
        '{subject} ___ una cafetería cerca de la plaza.',
        '{subject} looked for a café near the square.',
      ],
    ],
  },
  llegar: {
    family: 'spelling',
    forms: ['llegué', 'llegaste', 'llegó', 'llegamos', 'llegaron'],
    contexts: [
      [
        '{subject} ___ a tiempo a la cita.',
        '{subject} arrived on time for the appointment.',
      ],
      [
        '{subject} ___ antes de la lluvia.',
        '{subject} arrived before the rain.',
      ],
    ],
  },
  empezar: {
    family: 'spelling',
    forms: ['empecé', 'empezaste', 'empezó', 'empezamos', 'empezaron'],
    contexts: [
      [
        '{subject} ___ un libro nuevo durante el viaje.',
        '{subject} started a new book during the trip.',
      ],
      [
        'El mes pasado, {subject} ___ a estudiar español.',
        'Last month, {subject} started studying Spanish.',
      ],
    ],
  },
  pagar: {
    family: 'spelling',
    forms: ['pagué', 'pagaste', 'pagó', 'pagamos', 'pagaron'],
    contexts: [
      [
        '{subject} ___ con tarjeta en la tienda.',
        '{subject} paid by card at the store.',
      ],
      [
        'Después de cenar, {subject} ___ la cuenta.',
        'After dinner, {subject} paid the bill.',
      ],
    ],
  },
  pedir: {
    family: 'stem',
    forms: ['pedí', 'pediste', 'pidió', 'pedimos', 'pidieron'],
    contexts: [
      [
        'En la cafetería, {subject} ___ un café de olla.',
        'At the café, {subject} ordered a café de olla.',
      ],
      [
        '{subject} ___ la cuenta al terminar.',
        '{subject} asked for the bill at the end.',
      ],
    ],
  },
  dormir: {
    family: 'stem',
    forms: ['dormí', 'dormiste', 'durmió', 'dormimos', 'durmieron'],
    contexts: [
      [
        'Anoche, {subject} ___ ocho horas.',
        'Last night, {subject} slept for eight hours.',
      ],
      [
        '{subject} ___ muy bien después del viaje.',
        '{subject} slept very well after the trip.',
      ],
    ],
  },
  sentir: {
    family: 'stem',
    forms: ['sentí', 'sentiste', 'sintió', 'sentimos', 'sintieron'],
    contexts: [
      [
        '{subject} ___ el temblor de madrugada.',
        '{subject} felt the earthquake in the early morning.',
      ],
      [
        'Al escuchar la noticia, {subject} ___ mucha alegría.',
        'Upon hearing the news, {subject} felt a lot of joy.',
      ],
    ],
  },
  servir: {
    family: 'stem',
    forms: ['serví', 'serviste', 'sirvió', 'servimos', 'sirvieron'],
    contexts: [
      [
        '{subject} ___ la comida al mediodía.',
        '{subject} served the food at noon.',
      ],
      [
        '{llegar} a casa y ___ el café.',
        '{subject} got home and served the coffee.',
      ],
    ],
  },
  leer: {
    family: 'vowel',
    forms: ['leí', 'leíste', 'leyó', 'leímos', 'leyeron'],
    contexts: [
      [
        '{ir} a un restaurante y ___ el menú.',
        '{subject} went to a restaurant and read the menu.',
      ],
      [
        'Antes de dormir, {subject} ___ un cuento.',
        'Before bed, {subject} read a short story.',
      ],
    ],
  },
  oír: {
    family: 'vowel',
    forms: ['oí', 'oíste', 'oyó', 'oímos', 'oyeron'],
    contexts: [
      [
        '{subject} ___ música en la plaza el domingo.',
        '{subject} heard music in the square on Sunday.',
      ],
      [
        'De pronto, {subject} ___ un ruido en la calle.',
        'Suddenly, {subject} heard a noise in the street.',
      ],
    ],
  },
  creer: {
    family: 'vowel',
    forms: ['creí', 'creíste', 'creyó', 'creímos', 'creyeron'],
    contexts: [
      [
        'Al principio, {subject} ___ la historia.',
        'At first, {subject} believed the story.',
      ],
      ['{subject} ___ que era una broma.', '{subject} thought it was a joke.'],
    ],
  },
  construir: {
    family: 'vowel',
    forms: [
      'construí',
      'construiste',
      'construyó',
      'construimos',
      'construyeron',
    ],
    contexts: [
      [
        'El verano pasado, {subject} ___ una mesa de madera.',
        'Last summer, {subject} built a wooden table.',
      ],
      [
        'En la playa, {subject} ___ un castillo de arena.',
        'At the beach, {subject} built a sandcastle.',
      ],
    ],
    note: 'Construir → construyó, construyeron. Unlike leer, tú and nosotros have no accent: construiste, construimos.',
  },
} as const satisfies Record<string, Verb>

export type PreteriteVerb = keyof typeof preteriteVerbs

export function grammarCardId(verb: PreteriteVerb, person: number): string {
  return `grammar:preterite:${verb}:${person}`
}
