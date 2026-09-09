export const grammarFamilies = [
  {
    id: 'regular',
    title: 'Regular endings',
    example: 'hablé · comí · viví',
    rule: 'Drop -ar, -er, or -ir and add the past-tense ending. For -ar: -é, -aste, -ó, -amos, -aron. For -er and -ir: -í, -iste, -ió, -imos, -ieron.',
  },
  {
    id: 'essential',
    title: 'The everyday irregulars',
    example: 'fui · di · vi',
    rule: 'Ser and ir share every preterite form; the sentence tells you which meaning fits. Dar and ver use short forms without written accents.',
  },
  {
    id: 'irregular',
    title: 'Irregular stems',
    example: 'tuve · hice · dije',
    rule: 'Learn the new stem, then reuse -e, -iste, -o, -imos, -ieron. These endings have no written accents. A stem ending in j takes -eron instead of -ieron.',
  },
  {
    id: 'spelling',
    title: 'Keep the sound',
    example: 'busqué · llegué · empecé',
    rule: 'Only the yo form changes spelling: -car → -qué, -gar → -gué, -zar → -cé. This preserves the consonant sound before é; the other forms use regular -ar endings.',
  },
  {
    id: 'stem',
    title: 'Third-person changes',
    example: 'pidió · durmieron',
    rule: 'These -ir verbs change e → i or o → u only with él, ella, usted, ellos, ellas, and ustedes. Yo, tú, and nosotros/as keep the original vowel.',
  },
  {
    id: 'vowel',
    title: 'When i becomes y',
    example: 'leyó · oyeron',
    rule: 'With these vowel stems, i becomes y in the third-person forms: -yó and -yeron. Watch the accents in the other forms, too.',
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
    note: 'Ir and ser share fui, fuiste, fue, fuimos, fueron. A destination makes ir the right meaning here.',
  },
  ser: {
    family: 'essential',
    meaning: 'to be',
    forms: ['fui', 'fuiste', 'fue', 'fuimos', 'fueron'],
    contexts: [
      ['parte del equipo ganador', '{was} part of the winning team'],
      ['parte de la solución', '{was} part of the solution'],
    ],
    note: 'Ser and ir have identical preterite forms. Here the sentence describes a role in a completed event, so the meaning is “was” or “were”.',
  },
  dar: {
    family: 'essential',
    meaning: 'to give',
    forms: ['di', 'diste', 'dio', 'dimos', 'dieron'],
    contexts: [
      ['un paseo por el parque', 'took a walk in the park'],
      ['las gracias al mesero', 'thanked the waiter'],
    ],
    note: 'Dar uses di, diste, dio, dimos, dieron. Di and dio have no written accent.',
  },
  ver: {
    family: 'essential',
    meaning: 'to see',
    forms: ['vi', 'viste', 'vio', 'vimos', 'vieron'],
    contexts: [
      ['una película mexicana', 'watched a Mexican movie'],
      ['el atardecer', 'saw the sunset'],
    ],
    note: 'Ver uses vi, viste, vio, vimos, vieron. Vi and vio have no written accent.',
  },
  tener: {
    family: 'irregular',
    meaning: 'to have',
    forms: ['tuve', 'tuviste', 'tuvo', 'tuvimos', 'tuvieron'],
    contexts: [
      ['una idea', 'had an idea'],
      ['tiempo para caminar', 'had time for a walk'],
    ],
    note: 'Tener changes its stem to tuv-. Add the irregular endings without written accents.',
  },
  hacer: {
    family: 'irregular',
    meaning: 'to do / make',
    forms: ['hice', 'hiciste', 'hizo', 'hicimos', 'hicieron'],
    contexts: [
      ['la cena', 'made dinner'],
      ['una reservación', 'made a reservation'],
    ],
    note: 'Hacer uses hic-, but él/ella/usted takes hizo: z keeps the same consonant sound before o.',
  },
  decir: {
    family: 'irregular',
    meaning: 'to say',
    forms: ['dije', 'dijiste', 'dijo', 'dijimos', 'dijeron'],
    contexts: [
      ['la verdad', 'told the truth'],
      ['algo interesante', 'said something interesting'],
    ],
    note: 'Decir changes to dij-. After j, the plural ending is -eron: dijeron, never “dijieron”.',
  },
  estar: {
    family: 'irregular',
    meaning: 'to be',
    forms: ['estuve', 'estuviste', 'estuvo', 'estuvimos', 'estuvieron'],
    contexts: [
      ['en casa todo el día', '{was} home all day'],
      ['en el museo dos horas', 'spent two hours at the museum'],
    ],
    note: 'Estar changes its stem to estuv-. The sentence bounds the time spent in a place.',
  },
  poder: {
    family: 'irregular',
    meaning: 'to be able to',
    forms: ['pude', 'pudiste', 'pudo', 'pudimos', 'pudieron'],
    contexts: [
      ['conseguir boletos', 'managed to get tickets'],
      ['terminar a tiempo', 'managed to finish on time'],
    ],
    note: 'Poder changes to pud-. In these completed events, it means “managed to”.',
  },
  poner: {
    family: 'irregular',
    meaning: 'to put',
    forms: ['puse', 'pusiste', 'puso', 'pusimos', 'pusieron'],
    contexts: [
      ['la mesa', 'set the table'],
      ['música para cocinar', 'put on music to cook'],
    ],
    note: 'Poner changes to pus-, then takes the irregular endings without written accents.',
  },
  venir: {
    family: 'irregular',
    meaning: 'to come',
    forms: ['vine', 'viniste', 'vino', 'vinimos', 'vinieron'],
    contexts: [
      ['en metro', 'came by metro'],
      ['a la fiesta', 'came to the party'],
    ],
    note: 'Venir changes to vin-. The third-person singular is vino, with no accent.',
  },
  querer: {
    family: 'irregular',
    meaning: 'to want',
    forms: ['quise', 'quisiste', 'quiso', 'quisimos', 'quisieron'],
    contexts: [
      ['probar algo nuevo', 'wanted to try something new'],
      ['ayudar con la cena', 'wanted to help with dinner'],
    ],
    note: 'Querer changes to quis-. These completed occasions call for the preterite forms.',
  },
  saber: {
    family: 'irregular',
    meaning: 'to know / find out',
    forms: ['supe', 'supiste', 'supo', 'supimos', 'supieron'],
    contexts: [
      ['la noticia', 'found out the news'],
      ['el resultado', 'found out the result'],
    ],
    note: 'Saber changes to sup-. In the preterite it often means “found out”, a completed discovery.',
  },
  traer: {
    family: 'irregular',
    meaning: 'to bring',
    forms: ['traje', 'trajiste', 'trajo', 'trajimos', 'trajeron'],
    contexts: [
      ['pan dulce', 'brought sweet bread'],
      ['algo para compartir', 'brought something to share'],
    ],
    note: 'Traer changes to traj-. As with decir, use -eron after j: trajeron.',
  },
  andar: {
    family: 'irregular',
    meaning: 'to walk',
    forms: ['anduve', 'anduviste', 'anduvo', 'anduvimos', 'anduvieron'],
    contexts: [
      ['por el centro', 'walked around downtown'],
      ['por el parque', 'walked around the park'],
    ],
    note: 'Andar changes to anduv-, like the uv in tuve and estuve.',
  },
  conducir: {
    family: 'irregular',
    meaning: 'to drive',
    forms: ['conduje', 'condujiste', 'condujo', 'condujimos', 'condujeron'],
    contexts: [
      ['hasta Puebla', 'drove to Puebla'],
      ['por la ciudad', 'drove through the city'],
    ],
    note: 'Verbs ending in -ducir take a j stem. Conducir becomes conduj- and the plural ends in -eron.',
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
    note: 'Construir takes construyó and construyeron. Unlike leer, -uir verbs have no accent in tú or nosotros: construiste, construimos.',
  },
} as const satisfies Record<string, Verb>

export type PreteriteVerb = keyof typeof preteriteVerbs

export function grammarCardId(verb: PreteriteVerb, person: number): string {
  return `grammar:preterite:${verb}:${person}`
}
