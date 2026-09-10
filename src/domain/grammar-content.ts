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
  meaning: string
  forms: readonly [string, string, string, string, string]
  contexts: readonly [readonly [string, string], readonly [string, string]]
  note?: string
}

// Authored sentence tails work with all five grammatical people. Context and
// subject rotate together; the schedule belongs to verb/person, not a sentence.
export const preteriteVerbs = {
  hablar: {
    family: 'regular',
    meaning: 'to speak',
    forms: ['hablé', 'hablaste', 'habló', 'hablamos', 'hablaron'],
    contexts: [
      ['con la vecina', 'spoke with the neighbor'],
      ['de la película', 'talked about the movie'],
    ],
  },
  comer: {
    family: 'regular',
    meaning: 'to eat',
    forms: ['comí', 'comiste', 'comió', 'comimos', 'comieron'],
    contexts: [
      ['en el mercado', 'ate at the market'],
      ['tacos de hongos', 'ate mushroom tacos'],
    ],
  },
  vivir: {
    family: 'regular',
    meaning: 'to live',
    forms: ['viví', 'viviste', 'vivió', 'vivimos', 'vivieron'],
    contexts: [
      ['una experiencia increíble', 'had an incredible experience'],
      ['un momento especial', 'experienced a special moment'],
    ],
  },
  comprar: {
    family: 'regular',
    meaning: 'to buy',
    forms: ['compré', 'compraste', 'compró', 'compramos', 'compraron'],
    contexts: [
      ['pan en la esquina', 'bought bread on the corner'],
      ['fruta para el desayuno', 'bought fruit for breakfast'],
    ],
  },
  aprender: {
    family: 'regular',
    meaning: 'to learn',
    forms: ['aprendí', 'aprendiste', 'aprendió', 'aprendimos', 'aprendieron'],
    contexts: [
      ['una palabra nueva', 'learned a new word'],
      ['a preparar salsa', 'learned to make salsa'],
    ],
  },
  escribir: {
    family: 'regular',
    meaning: 'to write',
    forms: ['escribí', 'escribiste', 'escribió', 'escribimos', 'escribieron'],
    contexts: [
      ['un mensaje', 'wrote a message'],
      ['una carta', 'wrote a letter'],
    ],
  },
  ir: {
    family: 'essential',
    meaning: 'to go',
    forms: ['fui', 'fuiste', 'fue', 'fuimos', 'fueron'],
    contexts: [
      ['al mercado', 'went to the market'],
      ['a Coyoacán', 'went to Coyoacán'],
    ],
    note: 'Ir and ser share all preterite forms. The destination here identifies ir.',
  },
  ser: {
    family: 'essential',
    meaning: 'to be',
    forms: ['fui', 'fuiste', 'fue', 'fuimos', 'fueron'],
    contexts: [
      ['parte del equipo ganador', '{was} part of the winning team'],
      ['parte de la solución', '{was} part of the solution'],
    ],
    note: 'Ser and ir share all preterite forms. Here, ser describes a role: “was” or “were”.',
  },
  dar: {
    family: 'essential',
    meaning: 'to give',
    forms: ['di', 'diste', 'dio', 'dimos', 'dieron'],
    contexts: [
      ['un paseo por el parque', 'took a walk in the park'],
      ['las gracias al mesero', 'thanked the waiter'],
    ],
    note: 'Di and dio have no written accent.',
  },
  ver: {
    family: 'essential',
    meaning: 'to see',
    forms: ['vi', 'viste', 'vio', 'vimos', 'vieron'],
    contexts: [
      ['una película mexicana', 'watched a Mexican movie'],
      ['el atardecer', 'saw the sunset'],
    ],
    note: 'Vi and vio have no written accent.',
  },
  tener: {
    family: 'irregular',
    meaning: 'to have',
    forms: ['tuve', 'tuviste', 'tuvo', 'tuvimos', 'tuvieron'],
    contexts: [
      ['una idea', 'had an idea'],
      ['tiempo para caminar', 'had time for a walk'],
    ],
    note: 'Tener → tuv-, with irregular endings and no accents.',
  },
  hacer: {
    family: 'irregular',
    meaning: 'to do / make',
    forms: ['hice', 'hiciste', 'hizo', 'hicimos', 'hicieron'],
    contexts: [
      ['la cena', 'made dinner'],
      ['una reservación', 'made a reservation'],
    ],
    note: 'Hacer → hic-, except hizo: z preserves the consonant sound before o.',
  },
  decir: {
    family: 'irregular',
    meaning: 'to say',
    forms: ['dije', 'dijiste', 'dijo', 'dijimos', 'dijeron'],
    contexts: [
      ['la verdad', 'told the truth'],
      ['algo interesante', 'said something interesting'],
    ],
    note: 'Decir → dij-. After j, use -eron: dijeron, not “dijieron”.',
  },
  estar: {
    family: 'irregular',
    meaning: 'to be',
    forms: ['estuve', 'estuviste', 'estuvo', 'estuvimos', 'estuvieron'],
    contexts: [
      ['en casa todo el día', '{was} home all day'],
      ['en el museo dos horas', 'spent two hours at the museum'],
    ],
    note: 'Estar → estuv-, with irregular endings and no accents.',
  },
  poder: {
    family: 'irregular',
    meaning: 'to be able to',
    forms: ['pude', 'pudiste', 'pudo', 'pudimos', 'pudieron'],
    contexts: [
      ['conseguir boletos', 'managed to get tickets'],
      ['terminar a tiempo', 'managed to finish on time'],
    ],
    note: 'Poder → pud-. Here it means “managed to”.',
  },
  poner: {
    family: 'irregular',
    meaning: 'to put',
    forms: ['puse', 'pusiste', 'puso', 'pusimos', 'pusieron'],
    contexts: [
      ['la mesa', 'set the table'],
      ['música para cocinar', 'put on music to cook'],
    ],
    note: 'Poner → pus-, with irregular endings and no accents.',
  },
  venir: {
    family: 'irregular',
    meaning: 'to come',
    forms: ['vine', 'viniste', 'vino', 'vinimos', 'vinieron'],
    contexts: [
      ['en metro', 'came by metro'],
      ['a la fiesta', 'came to the party'],
    ],
    note: 'Venir → vin-. Vino has no accent.',
  },
  querer: {
    family: 'irregular',
    meaning: 'to want',
    forms: ['quise', 'quisiste', 'quiso', 'quisimos', 'quisieron'],
    contexts: [
      ['probar algo nuevo', 'wanted to try something new'],
      ['ayudar con la cena', 'wanted to help with dinner'],
    ],
    note: 'Querer → quis-, with irregular endings and no accents.',
  },
  saber: {
    family: 'irregular',
    meaning: 'to know / find out',
    forms: ['supe', 'supiste', 'supo', 'supimos', 'supieron'],
    contexts: [
      ['la noticia', 'found out the news'],
      ['el resultado', 'found out the result'],
    ],
    note: 'Saber → sup-. Here it means “found out”.',
  },
  traer: {
    family: 'irregular',
    meaning: 'to bring',
    forms: ['traje', 'trajiste', 'trajo', 'trajimos', 'trajeron'],
    contexts: [
      ['pan dulce', 'brought sweet bread'],
      ['algo para compartir', 'brought something to share'],
    ],
    note: 'Traer → traj-. After j, use -eron: trajeron.',
  },
  andar: {
    family: 'irregular',
    meaning: 'to walk',
    forms: ['anduve', 'anduviste', 'anduvo', 'anduvimos', 'anduvieron'],
    contexts: [
      ['por el centro', 'walked around downtown'],
      ['por el parque', 'walked around the park'],
    ],
    note: 'Andar → anduv-, like tuv- and estuv-.',
  },
  conducir: {
    family: 'irregular',
    meaning: 'to drive',
    forms: ['conduje', 'condujiste', 'condujo', 'condujimos', 'condujeron'],
    contexts: [
      ['hasta Puebla', 'drove to Puebla'],
      ['por la ciudad', 'drove through the city'],
    ],
    note: 'Conducir → conduj-. After j, use -eron: condujeron.',
  },
  buscar: {
    family: 'spelling',
    meaning: 'to look for',
    forms: ['busqué', 'buscaste', 'buscó', 'buscamos', 'buscaron'],
    contexts: [
      ['las llaves', 'looked for the keys'],
      ['una cafetería', 'looked for a café'],
    ],
  },
  llegar: {
    family: 'spelling',
    meaning: 'to arrive',
    forms: ['llegué', 'llegaste', 'llegó', 'llegamos', 'llegaron'],
    contexts: [
      ['a tiempo', 'arrived on time'],
      ['antes de la lluvia', 'arrived before the rain'],
    ],
  },
  empezar: {
    family: 'spelling',
    meaning: 'to begin',
    forms: ['empecé', 'empezaste', 'empezó', 'empezamos', 'empezaron'],
    contexts: [
      ['un libro nuevo', 'started a new book'],
      ['a estudiar español', 'started studying Spanish'],
    ],
  },
  pagar: {
    family: 'spelling',
    meaning: 'to pay',
    forms: ['pagué', 'pagaste', 'pagó', 'pagamos', 'pagaron'],
    contexts: [
      ['con tarjeta', 'paid by card'],
      ['la cuenta', 'paid the bill'],
    ],
  },
  pedir: {
    family: 'stem',
    meaning: 'to ask for / order',
    forms: ['pedí', 'pediste', 'pidió', 'pedimos', 'pidieron'],
    contexts: [
      ['un café de olla', 'ordered a café de olla'],
      ['la cuenta', 'asked for the bill'],
    ],
  },
  dormir: {
    family: 'stem',
    meaning: 'to sleep',
    forms: ['dormí', 'dormiste', 'durmió', 'dormimos', 'durmieron'],
    contexts: [
      ['ocho horas', 'slept for eight hours'],
      ['muy bien', 'slept very well'],
    ],
  },
  sentir: {
    family: 'stem',
    meaning: 'to feel',
    forms: ['sentí', 'sentiste', 'sintió', 'sentimos', 'sintieron'],
    contexts: [
      ['el temblor', 'felt the earthquake'],
      ['mucha alegría', 'felt a lot of joy'],
    ],
  },
  servir: {
    family: 'stem',
    meaning: 'to serve',
    forms: ['serví', 'serviste', 'sirvió', 'servimos', 'sirvieron'],
    contexts: [
      ['la comida', 'served the food'],
      ['el café', 'served the coffee'],
    ],
  },
  leer: {
    family: 'vowel',
    meaning: 'to read',
    forms: ['leí', 'leíste', 'leyó', 'leímos', 'leyeron'],
    contexts: [
      ['el menú', 'read the menu'],
      ['un cuento', 'read a short story'],
    ],
  },
  oír: {
    family: 'vowel',
    meaning: 'to hear',
    forms: ['oí', 'oíste', 'oyó', 'oímos', 'oyeron'],
    contexts: [
      ['música en la plaza', 'heard music in the square'],
      ['un ruido en la calle', 'heard a noise in the street'],
    ],
  },
  creer: {
    family: 'vowel',
    meaning: 'to believe',
    forms: ['creí', 'creíste', 'creyó', 'creímos', 'creyeron'],
    contexts: [
      ['la historia', 'believed the story'],
      ['que era una broma', 'thought it was a joke'],
    ],
  },
  construir: {
    family: 'vowel',
    meaning: 'to build',
    forms: [
      'construí',
      'construiste',
      'construyó',
      'construimos',
      'construyeron',
    ],
    contexts: [
      ['una mesa de madera', 'built a wooden table'],
      ['un castillo de arena', 'built a sandcastle'],
    ],
    note: 'Construir → construyó, construyeron. Unlike leer, tú and nosotros have no accent: construiste, construimos.',
  },
} as const satisfies Record<string, Verb>

export type PreteriteVerb = keyof typeof preteriteVerbs

export function grammarCardId(verb: PreteriteVerb, person: number): string {
  return `grammar:preterite:${verb}:${person}`
}
