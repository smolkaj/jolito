import type { GrammarVerb } from './grammar-catalog-types'

export const presentFamilies = [
  {
    id: 'regular',
    title: 'Regular endings',
    example: 'hablo · como · vivo',
  },
  {
    id: 'stem-ie',
    title: 'e → ie stem changes',
    example: 'quiero · pienso · entiendo',
    rule: 'Change the stem vowel e → ie in all forms except nosotros/as, which keeps the regular e.',
  },
  {
    id: 'stem-ue',
    title: 'o → ue stem changes',
    example: 'puedo · duermo · vuelvo',
    rule: 'Change the stem vowel o (or u in jugar) → ue in all forms except nosotros/as, which keeps the original vowel.',
  },
  {
    id: 'stem-i',
    title: 'e → i stem changes',
    example: 'pido · sirvo · sigo',
    rule: 'In these -ir verbs, change the stem vowel e → i in all forms except nosotros/as. For seguir, yo uses sigo (dropping u) to keep the hard g.',
  },
  {
    id: 'irregular-yo',
    title: 'Irregular yo forms',
    example: 'hago · pongo · conozco',
    rule: 'Only the yo form is irregular (ending in -go, -zco, or unique like sé, doy, veo). All other forms follow regular rules.',
  },
  {
    id: 'essential',
    title: 'Common irregulars',
    example: 'soy · estoy · voy',
    rule: 'These essential verbs have irregular stems across multiple persons. Note written accents on estar (estás, está, están) and oír (oímos).',
  },
] as const

type Verb = GrammarVerb & { family: (typeof presentFamilies)[number]['id'] }

export const presentVerbs: Record<string, Verb> = {
  // --- Regular endings ---
  hablar: {
    family: 'regular',
    forms: ['hablo', 'hablas', 'habla', 'hablamos', 'hablan'],
    contexts: [
      [
        'Todos los días {subject} ___ con la familia por teléfono.',
        'Every day, {subject} [speak{s}] with family on the phone.',
      ],
      [
        'En el trabajo, {subject} ___ español con los clientes.',
        'At work, {subject} [speak{s}] Spanish with clients.',
      ],
    ],
  },
  comer: {
    family: 'regular',
    forms: ['como', 'comes', 'come', 'comemos', 'comen'],
    contexts: [
      [
        'A mediodía {subject} ___ tacos en el puesto de la esquina.',
        'At noon, {subject} [eat{s}] tacos at the corner stand.',
      ],
      [
        'Los domingos {subject} ___ barbacoa con la familia.',
        'On Sundays, {subject} [eat{s}] barbacoa with family.',
      ],
    ],
  },
  vivir: {
    family: 'regular',
    forms: ['vivo', 'vives', 'vive', 'vivimos', 'viven'],
    contexts: [
      [
        'Actualmente {subject} ___ en la colonia Roma.',
        'Currently, {subject} [live{s}] in the Roma neighborhood.',
      ],
      [
        'Cerca del parque, {subject} ___ en un departamento tranquilo.',
        'Near the park, {subject} [live{s}] in a quiet apartment.',
      ],
    ],
  },
  comprar: {
    family: 'regular',
    forms: ['compro', 'compras', 'compra', 'compramos', 'compran'],
    contexts: [
      [
        'En el mercado, {subject} ___ fruta fresca por la mañana.',
        'At the market, {subject} [buy{s}] fresh fruit in the morning.',
      ],
      [
        'Cada semana {subject} ___ flores en el mercado de Jamaica.',
        'Every week, {subject} [buy{s}] flowers at Jamaica market.',
      ],
    ],
  },
  aprender: {
    family: 'regular',
    forms: ['aprendo', 'aprendes', 'aprende', 'aprendemos', 'aprenden'],
    contexts: [
      [
        'En la escuela de idiomas, {subject} ___ palabras nuevas cada día.',
        'At language school, {subject} [learn{s}] new words every day.',
      ],
      [
        'Con la práctica diaria, {subject} ___ a cocinar comida mexicana.',
        'With daily practice, {subject} [learn{s}] to cook Mexican food.',
      ],
    ],
  },
  escribir: {
    family: 'regular',
    forms: ['escribo', 'escribes', 'escribe', 'escribimos', 'escriben'],
    contexts: [
      [
        'Por las tardes {subject} ___ mensajes a los amigos.',
        'In the afternoons, {subject} [write{s}] messages to friends.',
      ],
      [
        'En la oficina, {subject} ___ correos para el equipo.',
        'At the office, {subject} [write{s}] emails for the team.',
      ],
    ],
  },
  trabajar: {
    family: 'regular',
    forms: ['trabajo', 'trabajas', 'trabaja', 'trabajamos', 'trabajan'],
    contexts: [
      [
        'De lunes a viernes {subject} ___ en una empresa del centro.',
        'From Monday to Friday, {subject} [work{s}] at a downtown company.',
      ],
      [
        'Desde casa, {subject} ___ con clientes internacionales.',
        'From home, {subject} [work{s}] with international clients.',
      ],
    ],
  },
  necesitar: {
    family: 'regular',
    forms: ['necesito', 'necesitas', 'necesita', 'necesitamos', 'necesitan'],
    contexts: [
      [
        'Para preparar guacamole, {subject} ___ aguacates maduros.',
        'To make guacamole, {subject} [need{s}] ripe avocados.',
      ],
      [
        'Antes de salir, {subject} ___ recargar la tarjeta del metro.',
        'Before leaving, {subject} [need{s}] to top up the metro card.',
      ],
    ],
  },

  // --- e → ie stem changes ---
  querer: {
    family: 'stem-ie',
    forms: ['quiero', 'quieres', 'quiere', 'queremos', 'quieren'],
    contexts: [
      [
        'Para el desayuno, {subject} ___ un café de olla caliente.',
        'For breakfast, {subject} [want{s}] a hot café de olla.',
      ],
      [
        'Este fin de semana {subject} ___ ir a pasear por Chapultepec.',
        'This weekend, {subject} [want{s}] to go for a stroll through Chapultepec.',
      ],
    ],
  },
  pensar: {
    family: 'stem-ie',
    forms: ['pienso', 'piensas', 'piensa', 'pensamos', 'piensan'],
    contexts: [
      [
        'A menudo {subject} ___ en viajar a Oaxaca.',
        'Often, {subject} [think{s}] about traveling to Oaxaca.',
      ],
      [
        'Sobre ese problema, {subject} ___ que hay una solución fácil.',
        'About that problem, {subject} [think{s}] that there is an easy solution.',
      ],
    ],
  },
  entender: {
    family: 'stem-ie',
    forms: ['entiendo', 'entiendes', 'entiende', 'entendemos', 'entienden'],
    contexts: [
      [
        'Cuando hablan despacio, {subject} ___ las indicaciones de la calle.',
        'When they speak slowly, {subject} [understand{s}] street directions.',
      ],
      [
        'En clase de español, {subject} ___ muy bien la explicación.',
        'In Spanish class, {subject} [understand{s}] the explanation very well.',
      ],
    ],
  },
  empezar: {
    family: 'stem-ie',
    forms: ['empiezo', 'empiezas', 'empieza', 'empezamos', 'empiezan'],
    contexts: [
      [
        'Por las mañanas {subject} ___ la rutina con una caminata.',
        'In the mornings, {subject} [start{s}] the routine with a walk.',
      ],
      [
        'A las ocho en punto, {subject} ___ a trabajar en el proyecto.',
        'At eight o’clock sharp, {subject} [start{s}] working on the project.',
      ],
    ],
  },
  perder: {
    family: 'stem-ie',
    forms: ['pierdo', 'pierdes', 'pierde', 'perdemos', 'pierden'],
    contexts: [
      [
        'En calles desconocidas, {subject} a veces ___ el camino al metro.',
        'On unfamiliar streets, {subject} sometimes [lose{s}] the way to the metro.',
      ],
      [
        'Con tantas prisas, {subject} ___ las llaves fácilmente.',
        'In such a rush, {subject} easily [lose{s}] keys.',
      ],
    ],
  },
  cerrar: {
    family: 'stem-ie',
    forms: ['cierro', 'cierras', 'cierra', 'cerramos', 'cierran'],
    contexts: [
      [
        'Al salir del departamento, {subject} ___ la puerta con llave.',
        'When leaving the apartment, {subject} [close{s}] the door with a key.',
      ],
      [
        'Por la noche, {subject} ___ las ventanas para aislar el ruido.',
        'At night, {subject} [close{s}] the windows to shut out the noise.',
      ],
    ],
  },

  // --- o → ue stem changes ---
  poder: {
    family: 'stem-ue',
    forms: ['puedo', 'puedes', 'puede', 'podemos', 'pueden'],
    contexts: [
      [
        'Con la tarjeta recargada, {subject} ___ entrar al metrobús rápido.',
        'With the card topped up, {subject} [can] enter the metrobús quickly.',
      ],
      [
        'Hoy por la tarde {subject} ___ ayudar con las compras.',
        'This afternoon, {subject} [can] help with the groceries.',
      ],
    ],
  },
  dormir: {
    family: 'stem-ue',
    forms: ['duermo', 'duermes', 'duerme', 'dormimos', 'duermen'],
    contexts: [
      [
        'Los fines de semana {subject} ___ ocho horas completas.',
        'On weekends, {subject} [sleep{s}] eight full hours.',
      ],
      [
        'Durante el viaje en autobús, {subject} ___ profundamente.',
        'During the bus trip, {subject} [sleep{s}] deeply.',
      ],
    ],
  },
  volver: {
    family: 'stem-ue',
    forms: ['vuelvo', 'vuelves', 'vuelve', 'volvemos', 'vuelven'],
    contexts: [
      [
        'Después del trabajo, {subject} ___ a casa en bicicleta.',
        'After work, {subject} [return{s}] home by bike.',
      ],
      [
        'Siempre que visita Coyoacán, {subject} ___ con churros calientes.',
        'Whenever visiting Coyoacán, {subject} [return{s}] with hot churros.',
      ],
    ],
  },
  almorzar: {
    family: 'stem-ue',
    forms: ['almuerzo', 'almuerzas', 'almuerza', 'almorzamos', 'almuerzan'],
    contexts: [
      [
        'En la fonda cercana, {subject} ___ comida corrida económica.',
        'At the nearby fonda, {subject} [eat{s}] affordable comida corrida.',
      ],
      [
        'Cerca de las dos de la tarde, {subject} ___ con los compañeros.',
        'Around two in the afternoon, {subject} [eat{s}] lunch with coworkers.',
      ],
    ],
  },
  encontrar: {
    family: 'stem-ue',
    forms: [
      'encuentro',
      'encuentras',
      'encuentra',
      'encontramos',
      'encuentran',
    ],
    contexts: [
      [
        'En ese tianguis, {subject} ___ artesanías muy bonitas.',
        'At that street market, {subject} [find{s}] very beautiful handicrafts.',
      ],
      [
        'Al buscar en el mapa, {subject} ___ cafeterías escondidas.',
        'When searching on the map, {subject} [find{s}] hidden coffee shops.',
      ],
    ],
  },
  jugar: {
    family: 'stem-ue',
    forms: ['juego', 'juegas', 'juega', 'jugamos', 'juegan'],
    contexts: [
      [
        'En el parque México, {subject} ___ con el perro cada tarde.',
        'In Parque México, {subject} [play{s}] with the dog every afternoon.',
      ],
      [
        'Los sábados por la mañana, {subject} ___ fútbol con los amigos.',
        'On Saturday mornings, {subject} [play{s}] soccer with friends.',
      ],
    ],
  },

  // --- e → i stem changes ---
  pedir: {
    family: 'stem-i',
    forms: ['pido', 'pides', 'pide', 'pedimos', 'piden'],
    contexts: [
      [
        'En la taquería, {subject} ___ una orden de pastor con cilantro y cebolla.',
        'At the taco stand, {subject} [order{s}] pastor tacos with cilantro and onion.',
      ],
      [
        'Al terminar de cenar, {subject} ___ la cuenta al mesero.',
        'Upon finishing dinner, {subject} [ask{s}] the waiter for the check.',
      ],
    ],
  },
  servir: {
    family: 'stem-i',
    forms: ['sirvo', 'sirves', 'sirve', 'servimos', 'sirven'],
    contexts: [
      [
        'En ese restaurante tradicional, {subject} ___ el pozole bien caliente.',
        'At that traditional restaurant, {subject} [serve{s}] the pozole piping hot.',
      ],
      [
        'Para el desayuno familiar, {subject} ___ fruta con yogur y granola.',
        'For family breakfast, {subject} [serve{s}] fruit with yogurt and granola.',
      ],
    ],
  },
  repetir: {
    family: 'stem-i',
    forms: ['repito', 'repites', 'repite', 'repetimos', 'repiten'],
    contexts: [
      [
        'En la clase de pronunciación, {subject} ___ las frases difíciles en voz alta.',
        'In pronunciation class, {subject} [repeat{s}] difficult phrases out loud.',
      ],
      [
        'Cuando la salsa está buena, {subject} ___ una segunda porción de chilaquiles.',
        'When the salsa is good, {subject} [get{s}] a second helping of chilaquiles.',
      ],
    ],
  },
  seguir: {
    family: 'stem-i',
    forms: ['sigo', 'sigues', 'sigue', 'seguimos', 'siguen'],
    contexts: [
      [
        'Para no perderse en la ciudad, {subject} ___ la ruta del metrobús.',
        'To avoid getting lost in the city, {subject} [follow{s}] the metrobús route.',
      ],
      [
        'A pesar del cansancio, {subject} ___ estudiando vocabulario todas las noches.',
        'Despite fatigue, {subject} [keep{s}] studying vocabulary every night.',
      ],
    ],
  },

  // --- Irregular yo forms ---
  hacer: {
    family: 'irregular-yo',
    forms: ['hago', 'haces', 'hace', 'hacemos', 'hacen'],
    contexts: [
      [
        'Por la mañana {subject} ___ ejercicio en el camellón de Reforma.',
        'In the morning, {subject} [do{es}] exercise along Paseo de la Reforma.',
      ],
      [
        'Cada fin de semana, {subject} ___ la despensa en el mercado local.',
        'Every weekend, {subject} [do{es}] the grocery shopping at the local market.',
      ],
    ],
  },
  poner: {
    family: 'irregular-yo',
    forms: ['pongo', 'pones', 'pone', 'ponemos', 'ponen'],
    contexts: [
      [
        'Antes de comer en familia, {subject} ___ la mesa con salsas caseras.',
        'Before family meals, {subject} [set{s}] the table with homemade salsas.',
      ],
      [
        'Cuando refresca por la tarde, {subject} ___ un suéter ligero.',
        'When it cools down in the evening, {subject} [put{s}] on a light sweater.',
      ],
    ],
  },
  salir: {
    family: 'irregular-yo',
    forms: ['salgo', 'sales', 'sale', 'salimos', 'salen'],
    contexts: [
      [
        'Temprano por la mañana, {subject} ___ de casa para evitar el tráfico.',
        'Early in the morning, {subject} [leave{s}] home to avoid traffic.',
      ],
      [
        'Los viernes por la noche, {subject} ___ a cenar a la plaza principal.',
        'On Friday evenings, {subject} [go{es}] out for dinner to the main plaza.',
      ],
    ],
  },
  traer: {
    family: 'irregular-yo',
    forms: ['traigo', 'traes', 'trae', 'traemos', 'traen'],
    contexts: [
      [
        'De la panadería de la esquina, {subject} ___ conchas recién horneadas.',
        'From the corner bakery, {subject} [bring{s}] freshly baked conchas.',
      ],
      [
        'Siempre que visita a la familia, {subject} ___ fruta o dulces típicos.',
        'Whenever visiting family, {subject} [bring{s}] fruit or traditional sweets.',
      ],
    ],
  },
  conocer: {
    family: 'irregular-yo',
    forms: ['conozco', 'conoces', 'conoce', 'conocemos', 'conocen'],
    contexts: [
      [
        'Por vivir aquí varios años, {subject} ___ muy bien los atajos del barrio.',
        'From living here several years, {subject} [know{s}] the neighborhood shortcuts very well.',
      ],
      [
        'En el intercambio de idiomas, {subject} ___ a personas de muchos países.',
        'At the language exchange, {subject} [meet{s}] people from many countries.',
      ],
    ],
  },
  ver: {
    family: 'irregular-yo',
    forms: ['veo', 'ves', 've', 'vemos', 'ven'],
    contexts: [
      [
        'Desde el balcón del departamento, {subject} ___ los árboles del parque.',
        'From the apartment balcony, {subject} [see{s}] the park trees.',
      ],
      [
        'Por las tardes libres, {subject} ___ documentales sobre historia mexicana.',
        'On free afternoons, {subject} [watch{es}] documentaries about Mexican history.',
      ],
    ],
  },
  dar: {
    family: 'irregular-yo',
    forms: ['doy', 'das', 'da', 'damos', 'dan'],
    contexts: [
      [
        'Al entrar a una tienda de barrio, {subject} ___ los buenos días con una sonrisa.',
        'Upon entering a neighborhood shop, {subject} [give{s}] a morning greeting with a smile.',
      ],
      [
        'Cuando alguien pide ayuda en la calle, {subject} ___ indicaciones amables.',
        'When someone asks for help on the street, {subject} [give{s}] polite directions.',
      ],
    ],
  },
  saber: {
    family: 'irregular-yo',
    forms: ['sé', 'sabes', 'sabe', 'sabemos', 'saben'],
    contexts: [
      [
        'Por experiencia propia, {subject} ___ dónde encontrar los mejores tacos de canasta.',
        'From personal experience, {subject} [know{s}] where to find the best tacos de canasta.',
      ],
      [
        'Al viajar en transporte público, {subject} ___ qué estación conecta con la línea 1.',
        'When traveling on public transit, {subject} [know{s}] which station connects to Line 1.',
      ],
    ],
  },

  // --- Essential irregulars ---
  ser: {
    family: 'essential',
    forms: ['soy', 'eres', 'es', 'somos', 'son'],
    contexts: [
      [
        'Por su actitud alegre, {subject} ___ una persona muy querida en la colonia.',
        'Due to a cheerful demeanor, {subject} [{be}] a well-loved person in the neighborhood.',
      ],
      [
        'Con su formación profesional, {subject} ___ especialista en diseño gráfico.',
        'With professional training, {subject} [{be}] a graphic design specialist.',
      ],
    ],
  },
  estar: {
    family: 'essential',
    forms: ['estoy', 'estás', 'está', 'estamos', 'están'],
    contexts: [
      [
        'A esta hora del día, {subject} ___ en la oficina trabajando concentrado.',
        'At this time of day, {subject} [{be}] at the office working with focus.',
      ],
      [
        'Para la fiesta del sábado, {subject} ___ listo desde muy temprano.',
        'For Saturday’s party, {subject} [{be}] ready very early.',
      ],
    ],
  },
  ir: {
    family: 'essential',
    forms: ['voy', 'vas', 'va', 'vamos', 'van'],
    contexts: [
      [
        'Todos los domingos por la mañana, {subject} ___ al mercado sobre ruedas.',
        'Every Sunday morning, {subject} [go{es}] to the street market.',
      ],
      [
        'Por las tardes, {subject} ___ en metro al centro histórico.',
        'In the afternoons, {subject} [go{es}] by metro to the historic center.',
      ],
    ],
  },
  tener: {
    family: 'essential',
    forms: ['tengo', 'tienes', 'tiene', 'tenemos', 'tienen'],
    contexts: [
      [
        'En este momento del día, {subject} ___ mucha hambre y ganas de unos tacos.',
        'At this time of day, {subject} [{have}] great hunger and a craving for tacos.',
      ],
      [
        'Para el viaje del próximo mes, {subject} ___ todos los boletos listos.',
        'For next month’s trip, {subject} [{have}] all the tickets ready.',
      ],
    ],
  },
  decir: {
    family: 'essential',
    forms: ['digo', 'dices', 'dice', 'decimos', 'dicen'],
    contexts: [
      [
        'Al despedirse de los amigos, {subject} ___ siempre hasta luego con cariño.',
        'When saying goodbye to friends, {subject} always [say{s}] see you later with warmth.',
      ],
      [
        'Cuando le preguntan su opinión, {subject} ___ la verdad con honestidad.',
        'When asked for an opinion, {subject} [tell{s}] the truth with honesty.',
      ],
    ],
  },
  oír: {
    family: 'essential',
    forms: ['oigo', 'oyes', 'oye', 'oímos', 'oyen'],
    contexts: [
      [
        'Por las mañanas temprano, {subject} ___ el silbato característico del afilador.',
        'Early in the morning, {subject} [hear{s}] the knife sharpener’s distinctive whistle.',
      ],
      [
        'Desde la ventana abierta, {subject} ___ el pregón tradicional del panadero con el pan.',
        'From the open window, {subject} [hear{s}] the baker’s traditional call selling bread.',
      ],
    ],
  },
} as const
