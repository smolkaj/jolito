import type { GrammarVerb } from './grammar-catalog-types'

export const imperfectFamilies = [
  {
    id: 'ar',
    title: '-ar endings',
    example: 'hablaba · cantaba · trabajaba',
    rule: 'Add -aba, -abas, -aba, -ábamos, -aban to the -ar stem. Note the written accent on nosotros: -ábamos.',
  },
  {
    id: 'er-ir',
    title: '-er and -ir endings',
    example: 'comía · vivía · tenía',
    rule: 'Add -ía, -ías, -ía, -íamos, -ían to the -er or -ir stem. Every form carries a written accent on the í.',
  },
  {
    id: 'irregular',
    title: 'Irregular verbs',
    example: 'era · iba · veía',
    rule: 'Only ser, ir, and ver are irregular in the imperfect tense. All other Spanish verbs are completely regular.',
  },
] as const

type Verb = GrammarVerb & { family: (typeof imperfectFamilies)[number]['id'] }

export const imperfectVerbs: Record<string, Verb> = {
  // --- Regular -ar endings ---
  hablar: {
    family: 'ar',
    forms: ['hablaba', 'hablabas', 'hablaba', 'hablábamos', 'hablaban'],
    contexts: [
      [
        'En la infancia {subject} siempre ___ con los abuelos por teléfono.',
        'In childhood, {subject} always [talked] with grandparents on the phone.',
      ],
      [
        'En la escuela {subject} ___ en español durante el recreo.',
        'At school, {subject} [spoke] in Spanish during recess.',
      ],
    ],
  },
  trabajar: {
    family: 'ar',
    forms: [
      'trabajaba',
      'trabajabas',
      'trabajaba',
      'trabajábamos',
      'trabajaban',
    ],
    contexts: [
      [
        'En esos años {subject} ___ en una librería del centro.',
        'In those years, {subject} [worked] at a downtown bookstore.',
      ],
      [
        'Antes de la pandemia {subject} ___ todos los días en la oficina.',
        'Before the pandemic, {subject} [worked] every day at the office.',
      ],
    ],
  },
  estudiar: {
    family: 'ar',
    forms: [
      'estudiaba',
      'estudiabas',
      'estudiaba',
      'estudiábamos',
      'estudiaban',
    ],
    contexts: [
      [
        'Por las noches {subject} ___ hasta tarde en la biblioteca.',
        'At night, {subject} [studied] late in the library.',
      ],
      [
        'En la universidad {subject} ___ historia del arte.',
        'At university, {subject} [studied] art history.',
      ],
    ],
  },
  caminar: {
    family: 'ar',
    forms: ['caminaba', 'caminabas', 'caminaba', 'caminábamos', 'caminaban'],
    contexts: [
      [
        'Por las mañanas {subject} ___ por el parque México.',
        'In the mornings, {subject} [walked] through Parque México.',
      ],
      [
        'Todos los días {subject} ___ hacia el trabajo para hacer ejercicio.',
        'Every day, {subject} [walked] to work to get exercise.',
      ],
    ],
  },
  comprar: {
    family: 'ar',
    forms: ['compraba', 'comprabas', 'compraba', 'comprábamos', 'compraban'],
    contexts: [
      [
        'Los sábados {subject} ___ fruta fresca en el mercado.',
        'On Saturdays, {subject} [bought] fresh fruit at the market.',
      ],
      [
        'En aquella panadería {subject} ___ conchas recién horneadas.',
        'At that bakery, {subject} [bought] freshly baked pan dulce.',
      ],
    ],
  },
  viajar: {
    family: 'ar',
    forms: ['viajaba', 'viajabas', 'viajaba', 'viajábamos', 'viajaban'],
    contexts: [
      [
        'Cada verano {subject} ___ a Oaxaca con la familia.',
        'Every summer, {subject} [traveled] to Oaxaca with family.',
      ],
      [
        'En vacaciones {subject} ___ en camión por todo el país.',
        'On vacation, {subject} [traveled] by bus throughout the country.',
      ],
    ],
  },
  jugar: {
    family: 'ar',
    forms: ['jugaba', 'jugabas', 'jugaba', 'jugábamos', 'jugaban'],
    contexts: [
      [
        'Por las tardes {subject} ___ fútbol con amigos en la calle.',
        'In the afternoons, {subject} [played] soccer with friends in the street.',
      ],
      [
        'En la infancia {subject} ___ con carritos en el patio.',
        'In childhood, {subject} [played] with toy cars on the patio.',
      ],
    ],
  },
  escuchar: {
    family: 'ar',
    forms: [
      'escuchaba',
      'escuchabas',
      'escuchaba',
      'escuchábamos',
      'escuchaban',
    ],
    contexts: [
      [
        'En la sala {subject} ___ música clásica en la radio.',
        'In the living room, {subject} [listened] to classical music on the radio.',
      ],
      [
        'Mientras cocinaba, {subject} ___ noticias en el teléfono.',
        'While cooking, {subject} [listened] to news on the phone.',
      ],
    ],
  },

  // --- Regular -er and -ir endings ---
  comer: {
    family: 'er-ir',
    forms: ['comía', 'comías', 'comía', 'comíamos', 'comían'],
    contexts: [
      [
        'A mediodía {subject} ___ en la fonda de la esquina.',
        'At noon, {subject} [ate] at the corner eatery.',
      ],
      [
        'Los domingos {subject} ___ barbacoa con la familia.',
        'On Sundays, {subject} [ate] barbacoa with family.',
      ],
    ],
  },
  vivir: {
    family: 'er-ir',
    forms: ['vivía', 'vivías', 'vivía', 'vivíamos', 'vivían'],
    contexts: [
      [
        'De joven {subject} ___ en un departamento en Coyoacán.',
        'When young, {subject} [lived] in an apartment in Coyoacán.',
      ],
      [
        'Antes de mudarse, {subject} ___ cerca del centro histórico.',
        'Before moving, {subject} [lived] near the historic center.',
      ],
    ],
  },
  tener: {
    family: 'er-ir',
    forms: ['tenía', 'tenías', 'tenía', 'teníamos', 'tenían'],
    contexts: [
      [
        'En aquella época {subject} ___ más tiempo libre por las tardes.',
        'In those times, {subject} [had] more free time in the afternoons.',
      ],
      [
        'En la escuela {subject} ___ muchos amigos en el salón.',
        'At school, {subject} [had] many friends in class.',
      ],
    ],
  },
  aprender: {
    family: 'er-ir',
    forms: ['aprendía', 'aprendías', 'aprendía', 'aprendíamos', 'aprendían'],
    contexts: [
      [
        'En las clases de la tarde {subject} ___ recetas tradicionales.',
        'In afternoon classes, {subject} [learned] traditional recipes.',
      ],
      [
        'Poco a poco {subject} ___ a tocar la guitarra.',
        'Little by little, {subject} [learned] to play the guitar.',
      ],
    ],
  },
  escribir: {
    family: 'er-ir',
    forms: ['escribía', 'escribías', 'escribía', 'escribíamos', 'escribían'],
    contexts: [
      [
        'En un cuaderno azul {subject} ___ notas todos los días.',
        'In a blue notebook, {subject} [wrote] notes every day.',
      ],
      [
        'Por las noches {subject} ___ cartas para amigos lejanos.',
        'At night, {subject} [wrote] letters to faraway friends.',
      ],
    ],
  },
  dormir: {
    family: 'er-ir',
    forms: ['dormía', 'dormías', 'dormía', 'dormíamos', 'dormían'],
    contexts: [
      [
        'Los fines de semana {subject} ___ hasta tarde.',
        'On weekends, {subject} [slept] until late.',
      ],
      [
        'En aquel cuarto silencioso {subject} ___ profundamente.',
        'In that quiet room, {subject} [slept] deeply.',
      ],
    ],
  },
  querer: {
    family: 'er-ir',
    forms: ['quería', 'querías', 'quería', 'queríamos', 'querían'],
    contexts: [
      [
        'Desde la infancia {subject} ___ tener una mascota propia.',
        'Since childhood, {subject} [wanted] to have a pet of their own.',
      ],
      [
        'En esos momentos {subject} ___ descansar un poco más.',
        'In those moments, {subject} [wanted] to rest a little more.',
      ],
    ],
  },
  leer: {
    family: 'er-ir',
    forms: ['leía', 'leías', 'leía', 'leíamos', 'leían'],
    contexts: [
      [
        'Antes de dormir {subject} ___ cuentos en la cama.',
        'Before sleeping, {subject} [read] stories in bed.',
      ],
      [
        'En el café {subject} ___ el periódico todas las mañanas.',
        'In the café, {subject} [read] the newspaper every morning.',
      ],
    ],
  },
  pedir: {
    family: 'er-ir',
    forms: ['pedía', 'pedías', 'pedía', 'pedíamos', 'pedían'],
    contexts: [
      [
        'En el restaurante {subject} ___ siempre el mismo platillo.',
        'At the restaurant, {subject} [ordered] the same dish every time.',
      ],
      [
        'En la taquería {subject} ___ tacos de pastor con piña.',
        'At the taco stand, {subject} [ordered] al pastor tacos with pineapple.',
      ],
    ],
  },

  // --- Irregular verbs ---
  ser: {
    family: 'irregular',
    forms: ['era', 'eras', 'era', 'éramos', 'eran'],
    contexts: [
      [
        'En aquellos años {subject} ___ parte de la comunidad escolar.',
        'In those years, {subject} [{was}] part of the school community.',
      ],
      [
        'En ese proyecto {subject} ___ parte fundamental del equipo.',
        'In that project, {subject} [{was}] a fundamental part of the team.',
      ],
    ],
  },
  ir: {
    family: 'irregular',
    forms: ['iba', 'ibas', 'iba', 'íbamos', 'iban'],
    contexts: [
      [
        'Los domingos {subject} ___ al mercado sobre ruedas.',
        'On Sundays, {subject} [went] to the street market.',
      ],
      [
        'Cada mañana {subject} ___ a la escuela caminando.',
        'Every morning, {subject} [went] to school walking.',
      ],
    ],
  },
  ver: {
    family: 'irregular',
    forms: ['veía', 'veías', 'veía', 'veíamos', 'veían'],
    contexts: [
      [
        'Por las tardes {subject} ___ películas mexicanas en la televisión.',
        'In the afternoons, {subject} [watched] Mexican movies on TV.',
      ],
      [
        'Desde el balcón {subject} ___ el atardecer sobre los volcanes.',
        'From the balcony, {subject} [saw] the sunset over the volcanoes.',
      ],
    ],
  },
}
