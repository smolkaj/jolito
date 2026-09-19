import { createStudyCards, type StudyCard } from './card'

export interface StarterPackSeed {
  id: string
  title: string
  subtitle: string
  description: string
  badge: string
  themeColor: 'rosa' | 'maya' | 'turquesa' | 'cempasuchil' | 'tezontle'
  notes: Array<{
    spanish: string
    english: string
    context: string
    bidirectional: boolean
  }>
}

export interface StarterPack {
  id: string
  title: string
  subtitle: string
  description: string
  badge: string
  themeColor: 'rosa' | 'maya' | 'turquesa' | 'cempasuchil' | 'tezontle'
  noteCount: number
  cardCount: number
  notes: Array<{
    spanish: string
    english: string
    context: string
    bidirectional: boolean
  }>
  createCards: (now?: number) => StudyCard[]
  createNoteCards: (noteIndex: number, now?: number) => StudyCard[]
}

export const starterPackSeeds: StarterPackSeed[] = [
  {
    id: 'mexican-street-phrases',
    title: 'Mexican Street Phrases',
    subtitle: 'Everyday Spoken CDMX Spanish',
    description:
      'Authentic street slang and polite spoken etiquette from Mexico City.',
    badge: '🇲🇽 CDMX',
    themeColor: 'rosa',
    notes: [
      {
        spanish: '¿Mande?',
        english: 'Pardon? / What was that?',
        context:
          'Quintessential polite Mexican Spanish response when you did not hear someone or when your name is called.',
        bidirectional: true,
      },
      {
        spanish: 'Ahorita',
        english: 'Right now / In a minute / Later',
        context:
          'Famous Mexican expression of time. Depending on tone, it can mean right this second, shortly, or never.',
        bidirectional: true,
      },
      {
        spanish: 'Qué onda',
        english: "What's up?",
        context:
          'Very common informal greeting between friends and peers throughout Mexico.',
        bidirectional: true,
      },
      {
        spanish: 'No manches',
        english: "No way! / You're kidding!",
        context:
          'Everyday clean exclamation of disbelief, surprise, or humor (the polite family-friendly alternative to "no mames").',
        bidirectional: true,
      },
      {
        spanish: 'Aguas',
        english: 'Watch out! / Heads up!',
        context:
          'Universal Mexican warning shouted to alert someone to oncoming traffic, obstacles, or danger.',
        bidirectional: true,
      },
      {
        spanish: 'Provecho',
        english: 'Enjoy your meal / Bon appétit',
        context:
          'Warm dining courtesy said to anyone eating, even strangers sitting at adjacent tables in a restaurant.',
        bidirectional: true,
      },
      {
        spanish: '¿A poco?',
        english: 'Really? / Seriously?',
        context:
          'Expresses genuine surprise, intrigue, or slight skepticism in everyday conversation.',
        bidirectional: true,
      },
      {
        spanish: 'Chido',
        english: 'Cool / Great',
        context:
          'Iconic Mexican slang adjective for an object, person, place, or situation that is neat or pleasant.',
        bidirectional: true,
      },
      {
        spanish: 'Sale',
        english: 'Alright / OK / Deal',
        context:
          'Standard Mexican conversational confirmation for agreeing, finalizing plans, or parting ("Sale, nos vemos").',
        bidirectional: true,
      },
      {
        spanish: 'Órale',
        english: 'Wow! / Alright! / Come on!',
        context:
          'Versatile Mexican interjection expressing admiration, energetic agreement, or prompting someone to move.',
        bidirectional: true,
      },
      {
        spanish: 'Te encargo...',
        english: 'Could you please bring me... / I would like...',
        context:
          'Gentle, polite phrasing used when ordering food or beverages from a waiter or street vendor.',
        bidirectional: true,
      },
      {
        spanish: 'La cuenta, por favor',
        english: 'The check, please',
        context:
          'Standard courteous request when finishing a meal at any dining establishment.',
        bidirectional: true,
      },
      {
        spanish: 'Con permiso',
        english: 'Excuse me',
        context:
          'Polite phrase used when walking past someone in a tight space, entering a room, or stepping away from a table.',
        bidirectional: true,
      },
      {
        spanish: 'Pásale',
        english: 'Come on in / Go right ahead',
        context:
          'Welcoming phrase offered by shopkeepers, street vendors, or hosts inviting you inside or to step forward.',
        bidirectional: true,
      },
      {
        spanish: '¿Cuánto va a ser?',
        english: 'How much will that be?',
        context:
          'Everyday phrase for asking the total price at a market stall, corner tiendita, or food stand.',
        bidirectional: true,
      },
      {
        spanish: 'Para llevar, por favor',
        english: 'To go, please',
        context:
          'Essential ordering phrase at taquerías, bakeries, and coffee shops.',
        bidirectional: true,
      },
      {
        spanish: '¿Se puede?',
        english: 'May I come in? / Is it okay?',
        context:
          'Respectful knock or vocal check before entering an office, home, or joining a table.',
        bidirectional: true,
      },
      {
        spanish: 'Me da...',
        english: 'May I have... / I will take...',
        context:
          'The most natural and common Mexican way to order street food or items over the counter ("¿Me da dos de pastor?").',
        bidirectional: true,
      },
      {
        spanish: 'Ni modo',
        english: 'Oh well / It is what it is',
        context:
          'Mexican philosophical acceptance of an unfortunate situation outside your control.',
        bidirectional: true,
      },
      {
        spanish: 'Híjole',
        english: 'Oh boy! / Yikes!',
        context:
          'Spontaneous verbal reaction expressing hesitation, complication, sympathy, or surprise.',
        bidirectional: true,
      },
      {
        spanish: 'Qué padre',
        english: 'How cool! / That is great!',
        context:
          'Quintessential Mexican phrase for something wonderful, exciting, or visually appealing.',
        bidirectional: true,
      },
      {
        spanish: 'Está cañón',
        english: "It's tough / It's wild",
        context:
          'Popular idiom indicating that a situation, test, traffic, or challenge is unusually intense or difficult.',
        bidirectional: true,
      },
      {
        spanish: 'Buena onda',
        english: 'Cool / Good vibes / Nice person',
        context:
          'Describes a friendly, easygoing person or positive vibe ("Ella es muy buena onda").',
        bidirectional: true,
      },
      {
        spanish: 'Poco a poco',
        english: 'Little by little / Step by step',
        context:
          'Encouraging reminder to take things at a steady, sustainable pace.',
        bidirectional: true,
      },
      {
        spanish: 'No hay bronca',
        english: 'No problem / No worries',
        context:
          'Casual reassurance that there is no hassle, conflict, or issue ("bronca" means trouble).',
        bidirectional: true,
      },
      {
        spanish: 'Ándale',
        english: 'Exactly! / Hurry up! / Go ahead!',
        context:
          'Flexible interjection confirming an exact point, spurring action, or saying goodbye.',
        bidirectional: true,
      },
      {
        spanish: 'A ver',
        english: "Let's see",
        context:
          'Conversational bridge phrase while thinking, checking options, or examining something closely.',
        bidirectional: true,
      },
      {
        spanish: 'Sin problema',
        english: 'No problem at all',
        context:
          'Friendly affirmative response when helping someone or accepting a request.',
        bidirectional: true,
      },
      {
        spanish: 'Con calma',
        english: 'Take your time / No rush',
        context:
          'Comforting reassurance that there is no urgency and someone should take their time.',
        bidirectional: true,
      },
      {
        spanish: 'Mucho gusto',
        english: 'Nice to meet you',
        context:
          'Warm standard greeting when introduced to someone for the first time.',
        bidirectional: true,
      },
      {
        spanish: '¿Qué pasó?',
        english: "What's going on? / How are you?",
        context:
          'Friendly, informal greeting when meeting a friend or picking up the phone.',
        bidirectional: true,
      },
      {
        spanish: 'Todo bien',
        english: "All good / Everything's fine",
        context: 'Short positive response confirming that things are in order.',
        bidirectional: true,
      },
      {
        spanish: 'Buen día',
        english: 'Good day / Have a good day',
        context:
          'Polite daytime greeting used across shops, transit, and neighborhood encounters.',
        bidirectional: true,
      },
      {
        spanish: 'Hasta luego',
        english: 'See you later',
        context:
          'Polite, standard goodbye suitable for all social and commercial settings.',
        bidirectional: true,
      },
      {
        spanish: 'Nos vemos',
        english: "We'll see each other / See you",
        context:
          'Casual, friendly farewell between friends, colleagues, or classmates.',
        bidirectional: true,
      },
      {
        spanish: 'De nada',
        english: "You're welcome",
        context: 'Universal polite reply to "gracias".',
        bidirectional: true,
      },
    ],
  },
  {
    id: 'founder-condesa-notebook',
    title: "Founder's CDMX Notebook",
    subtitle: "Steffen's Condesa & IH Survival Notes",
    description:
      "Authentic street phrases, classroom talk, and navigation notes curated from Steffen's journey at International House and living in Mexico City.",
    badge: '🥑 Founder',
    themeColor: 'cempasuchil',
    notes: [
      {
        spanish: 'tianguis',
        english: 'street market',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'agente inmobiliario',
        english: 'real estate agent',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'niñera',
        english: 'babysitter',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'crudo',
        english: 'hungover / raw',
        context: '',
        bidirectional: true,
      },
      {
        spanish: '¡Qué fresa!',
        english: 'How fancy! / How posh!',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'wey',
        english: 'dude',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'parada de autobús',
        english: 'bus stop',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'en el trayecto',
        english: 'during the commute',
        context: 'Mnemonic: Think "trajectory".',
        bidirectional: true,
      },
      {
        spanish: 'derecho',
        english: 'straight',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'derecha',
        english: 'right',
        context:
          'Mnemonic: Use your derecha (right) arm to point derecho (straight ahead).',
        bidirectional: true,
      },
      {
        spanish: 'izquierda',
        english: 'left',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'delante de',
        english: 'in front of',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'detrás',
        english: 'behind',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'debajo',
        english: 'below / underneath',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'encima',
        english: 'on top of',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'al lado de',
        english: 'next to',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'enfrente de',
        english: 'across from',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'por supuesto',
        english: 'of course',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'valer la pena',
        english: 'to be worth it',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'sin embargo',
        english: 'however',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'o sea',
        english: 'I mean',
        context:
          'Example: "No quiero ir; o sea, estoy cansadísimo." ("I don\'t want to go; I mean, I\'m exhausted.")',
        bidirectional: true,
      },
      {
        spanish: 'tanto',
        english: 'so much',
        context: "Example: No te preocupes tanto. (Don't worry so much.)",
        bidirectional: true,
      },
      {
        spanish: 'aunque',
        english: 'even though / though',
        context:
          "Example: Me gusta la playa aunque hace calor. (I like the beach even though it's hot.)",
        bidirectional: true,
      },
      {
        spanish: 'recordar',
        english: 'to remember',
        context:
          "Example: No recuerdo dónde dejé las llaves. (I don't remember where I left the keys.)",
        bidirectional: true,
      },
      {
        spanish: 'sonreír',
        english: 'to smile',
        context: 'Mnemonic: The son of the king (son + rey) smiles.',
        bidirectional: true,
      },
      {
        spanish: 'volver',
        english: 'to return',
        context: 'Mnemonic: Revolve → return.',
        bidirectional: true,
      },
      {
        spanish: 'casar',
        english: 'to marry',
        context: 'Mnemonic: From casa (house) → to make a home together.',
        bidirectional: true,
      },
      {
        spanish: 'cuadro',
        english: 'picture / rectangle',
        context: 'Mnemonic: Cuatro (four) corners → cuadro.',
        bidirectional: true,
      },
      {
        spanish: 'en voz alta',
        english: 'out loud',
        context: 'Literal: In high voice.',
        bidirectional: true,
      },
      {
        spanish: 'pizarrón',
        english: 'blackboard / whiteboard',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'Estoy por tu casa',
        english: "I'm near your house",
        context: '',
        bidirectional: true,
      },
      {
        spanish: '¿Puedo decir?',
        english: 'Can I say?',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'darse cuenta',
        english: 'to notice / to realize',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'me cuesta',
        english: 'I struggle with',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'puñito',
        english: 'fist bump',
        context: '',
        bidirectional: true,
      },
    ],
  },
  {
    id: 'common-verbs-1',
    title: 'Top Verbs: 1–50',
    subtitle: 'Core Foundations',
    description:
      'Foundational high-frequency verbs that power everyday conversation.',
    badge: 'Verbs',
    themeColor: 'maya',
    notes: [
      {
        spanish: 'ser',
        english: 'to be (essential nature/identity)',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'estar',
        english: 'to be (temporary state/location)',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'haber',
        english: 'to have (auxiliary) / there is',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'tener',
        english: 'to have / to possess',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'hacer',
        english: 'to do / to make',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'ir',
        english: 'to go',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'poder',
        english: 'to be able to / can',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'saber',
        english: 'to know (facts / skills)',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'poner',
        english: 'to put / to place',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'decir',
        english: 'to say / to tell',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'ver',
        english: 'to see / to watch',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'dar',
        english: 'to give',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'querer',
        english: 'to want / to love',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'pasar',
        english: 'to pass / to happen',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'deber',
        english: 'to owe / must / should',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'llegar',
        english: 'to arrive',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'creer',
        english: 'to believe / to think',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'encontrar',
        english: 'to find',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'parecer',
        english: 'to seem / to appear',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'seguir',
        english: 'to follow / to continue',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'quedar',
        english: 'to stay / to remain / to be located',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'hablar',
        english: 'to speak / to talk',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'llevar',
        english: 'to carry / to take / to wear',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'dejar',
        english: 'to leave / to allow',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'pensar',
        english: 'to think',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'sentir',
        english: 'to feel / to regret',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'venir',
        english: 'to come',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'volver',
        english: 'to return / to go back',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'tomar',
        english: 'to take / to drink',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'conocer',
        english: 'to know / to meet (people/places)',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'vivir',
        english: 'to live',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'mirar',
        english: 'to look at / to watch',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'pedir',
        english: 'to ask for / to order',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'buscar',
        english: 'to look for / to search',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'entrar',
        english: 'to enter / to go in',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'recordar',
        english: 'to remember / to remind',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'terminar',
        english: 'to finish / to end',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'empezar',
        english: 'to begin / to start',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'esperar',
        english: 'to wait / to hope',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'escribir',
        english: 'to write',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'perder',
        english: 'to lose / to miss',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'aparecer',
        english: 'to appear',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'conseguir',
        english: 'to obtain / to get',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'servir',
        english: 'to serve / to be useful',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'sacar',
        english: 'to take out / to extract',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'necesitar',
        english: 'to need',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'gustar',
        english: 'to be pleasing (to like)',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'salir',
        english: 'to leave / to go out',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'comer',
        english: 'to eat',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'leer',
        english: 'to read',
        context: '',
        bidirectional: true,
      },
    ],
  },
  {
    id: 'common-verbs-2',
    title: 'Top Verbs: 51–100',
    subtitle: 'Routines & Interactions',
    description:
      'Essential verbs for daily routines, requests, and social interactions.',
    badge: 'Verbs',
    themeColor: 'turquesa',
    notes: [
      {
        spanish: 'caer',
        english: 'to fall',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'cambiar',
        english: 'to change',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'presentar',
        english: 'to introduce / to present',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'crear',
        english: 'to create',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'abrir',
        english: 'to open',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'quitar',
        english: 'to remove / to take off',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'oír',
        english: 'to hear',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'acabar',
        english: 'to finish / to have just done',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'ganar',
        english: 'to win / to earn',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'enseñar',
        english: 'to teach / to show',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'traer',
        english: 'to bring',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'morir',
        english: 'to die',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'aceptar',
        english: 'to accept',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'realizar',
        english: 'to carry out / to fulfill',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'suponer',
        english: 'to suppose / to assume',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'probar',
        english: 'to try / to taste / to try on',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'lograr',
        english: 'to achieve / to manage',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'explicar',
        english: 'to explain',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'preguntar',
        english: 'to ask (a question)',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'tocar',
        english: 'to touch / to play (instrument)',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'reconocer',
        english: 'to recognize / to admit',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'alcanzar',
        english: 'to reach / to be enough',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'nacer',
        english: 'to be born',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'dirigir',
        english: 'to direct / to lead',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'correr',
        english: 'to run',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'escuchar',
        english: 'to listen to',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'pagar',
        english: 'to pay',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'ayudar',
        english: 'to help',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'cumplir',
        english: 'to fulfill / to turn (age)',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'ofrecer',
        english: 'to offer',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'descubrir',
        english: 'to discover',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'levantar',
        english: 'to raise / to lift',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'intentar',
        english: 'to try / to attempt',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'usar',
        english: 'to use / to wear',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'olvidar',
        english: 'to forget',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'contestar',
        english: 'to answer / to reply',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'trabajar',
        english: 'to work',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'decidir',
        english: 'to decide',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'repetir',
        english: 'to repeat',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'recibir',
        english: 'to receive',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'entender',
        english: 'to understand',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'andar',
        english: 'to walk / to go around',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'contar',
        english: 'to count / to tell (a story)',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'mostrar',
        english: 'to show',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'bajar',
        english: 'to descend / to get off / to lower',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'subir',
        english: 'to go up / to board / to raise',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'mover',
        english: 'to move',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'parar',
        english: 'to stop / to stand',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'guardar',
        english: 'to keep / to save / to put away',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'dormir',
        english: 'to sleep',
        context: '',
        bidirectional: true,
      },
    ],
  },
  {
    id: 'common-verbs-3',
    title: 'Top Verbs: 101–150',
    subtitle: 'Daily Life & Nuance',
    description:
      'Practical verbs for home life, food, travel, and expressing emotion.',
    badge: 'Verbs',
    themeColor: 'cempasuchil',
    notes: [
      {
        spanish: 'jugar',
        english: 'to play (games/sports)',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'despertar',
        english: 'to wake up',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'desayunar',
        english: 'to have breakfast',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'almorzar',
        english: 'to have lunch',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'cenar',
        english: 'to have dinner',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'cocinar',
        english: 'to cook',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'comprar',
        english: 'to buy',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'vender',
        english: 'to sell',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'llamar',
        english: 'to call / to name',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'viajar',
        english: 'to travel',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'caminar',
        english: 'to walk',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'manejar',
        english: 'to drive (Latin America)',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'descansar',
        english: 'to rest',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'limpiar',
        english: 'to clean',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'lavar',
        english: 'to wash',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'cortar',
        english: 'to cut',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'cerrar',
        english: 'to close',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'apagar',
        english: 'to turn off / to extinguish',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'prender',
        english: 'to turn on (Latin America)',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'arreglar',
        english: 'to fix / to arrange',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'invitar',
        english: 'to invite / to treat someone',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'saludar',
        english: 'to greet',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'despedir',
        english: 'to say goodbye',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'agradecer',
        english: 'to thank / to appreciate',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'disculpar',
        english: 'to excuse / to forgive',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'cuidar',
        english: 'to take care of',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'avisar',
        english: 'to let know / to notify',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'checar',
        english: 'to check / to verify (Mexico)',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'platicar',
        english: 'to chat / to talk (Mexico)',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'cobrar',
        english: 'to charge / to collect payment',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'gastar',
        english: 'to spend (money) / to wear out',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'ahorrar',
        english: 'to save (money/energy)',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'prestar',
        english: 'to lend / to borrow',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'faltar',
        english: 'to be missing / to lack',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'importar',
        english: 'to matter / to care',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'costar',
        english: 'to cost / to be difficult',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'doler',
        english: 'to hurt / to ache',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'aprender',
        english: 'to learn',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'sentar',
        english: 'to sit / to seat',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'desaparecer',
        english: 'to disappear',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'mandar',
        english: 'to send / to command',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'preocupar',
        english: 'to worry',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'aguantar',
        english: 'to endure / to hold on',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'apurar',
        english: 'to hurry / to worry',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'ubicar',
        english: 'to locate / to know where',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'antojar',
        english: 'to crave',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'extrañar',
        english: 'to miss someone',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'caber',
        english: 'to fit',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'valer',
        english: 'to be worth',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'tardar',
        english: 'to take time / to be slow',
        context: '',
        bidirectional: true,
      },
    ],
  },
  {
    id: 'common-verbs-4',
    title: 'Top Verbs: 151–200',
    subtitle: 'Spoken Fluency',
    description:
      'Nuanced verbs for lively spoken conversation and natural fluency.',
    badge: 'Verbs',
    themeColor: 'tezontle',
    notes: [
      {
        spanish: 'recomendar',
        english: 'to recommend',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'bastar',
        english: 'to be enough',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'sobrar',
        english: 'to be leftover / to spare',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'meter',
        english: 'to put in / to insert',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'tirar',
        english: 'to throw away / to drop',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'devolver',
        english: 'to return / to give back',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'soltar',
        english: 'to let go / to release',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'agarrar',
        english: 'to grab / to catch',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'jalar',
        english: 'to pull / to work (Mexico)',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'empujar',
        english: 'to push',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'apretar',
        english: 'to squeeze / to tighten',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'quejarse',
        english: 'to complain',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'romper',
        english: 'to break / to tear',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'equivocar',
        english: 'to make a mistake / to be mistaken',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'bailar',
        english: 'to dance',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'cruzar',
        english: 'to cross',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'doblar',
        english: 'to turn / to fold',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'llenar',
        english: 'to fill',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'arrancar',
        english: 'to start up (engine) / to tear out',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'frenar',
        english: 'to brake / to slow down',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'chocar',
        english: 'to crash / to collide',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'esquivar',
        english: 'to dodge / to avoid',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'alegrar',
        english: 'to make happy / to be glad',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'soportar',
        english: 'to withstand / to put up with',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'confiar',
        english: 'to trust',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'dudar',
        english: 'to doubt',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'adivinar',
        english: 'to guess',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'mentir',
        english: 'to lie',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'prometer',
        english: 'to promise',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'jurar',
        english: 'to swear',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'asegurar',
        english: 'to ensure / to claim',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'aprovechar',
        english: 'to take advantage of / to make the most of',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'convivir',
        english: 'to live together / to socialize',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'animar',
        english: 'to cheer up / to encourage',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'acostumbrar',
        english: 'to be accustomed to',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'aburrir',
        english: 'to bore',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'asustar',
        english: 'to scare',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'calmar',
        english: 'to calm down',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'apoyar',
        english: 'to support',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'compartir',
        english: 'to share',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'permitir',
        english: 'to allow / to permit',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'insistir',
        english: 'to insist',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'evitar',
        english: 'to avoid',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'merecer',
        english: 'to deserve',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'organizar',
        english: 'to organize',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'resolver',
        english: 'to solve / to resolve',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'revisar',
        english: 'to check / to review',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'elegir',
        english: 'to choose / to pick',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'funcionar',
        english: 'to function / to work',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'celebrar',
        english: 'to celebrate',
        context: '',
        bidirectional: true,
      },
    ],
  },
]

export const starterPacks: StarterPack[] = starterPackSeeds.map((seed) => {
  const noteCount = seed.notes.length
  const cardCount = seed.notes.length * 2

  const createNoteCards = (noteIndex: number, now = 0): StudyCard[] => {
    const note = seed.notes[noteIndex]
    if (!note) return []
    const noteId = `curated-${seed.id}-${String(noteIndex + 1).padStart(3, '0')}`
    return createStudyCards(
      {
        spanish: note.spanish,
        english: note.english,
        context: note.context,
        bidirectional: note.bidirectional,
      },
      noteId,
      now,
    )
  }

  return {
    id: seed.id,
    title: seed.title,
    subtitle: seed.subtitle,
    description: seed.description,
    badge: seed.badge,
    themeColor: seed.themeColor,
    notes: seed.notes,
    noteCount,
    cardCount,
    createNoteCards,
    createCards: (now = 0) => {
      const cards: StudyCard[] = []
      seed.notes.forEach((_, index) => {
        cards.push(...createNoteCards(index, now))
      })
      return cards
    },
  }
})

export function findStarterPack(id: string): StarterPack | undefined {
  return starterPacks.find((p) => p.id === id)
}
