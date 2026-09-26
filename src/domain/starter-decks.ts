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
        context: 'Example: "No te preocupes tanto." ("Don\'t worry so much.")',
        bidirectional: true,
      },
      {
        spanish: 'aunque',
        english: 'even though / though',
        context:
          'Example: "Me gusta la playa aunque hace calor." ("I like the beach even though it\'s hot.")',
        bidirectional: true,
      },
      {
        spanish: 'concuerdo contigo',
        english: 'I agree / I agree with you',
        context: '',
        bidirectional: true,
      },
      {
        spanish: 'sonreír',
        english: 'to smile',
        context: 'Mnemonic: The son of the king (son + rey) smiles.',
        bidirectional: true,
      },
      {
        spanish: 'tener sentido',
        english: 'to make sense',
        context: '',
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
        context: 'Literally: in high voice.',
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
  {
    id: 'common-connectors',
    title: 'Top Connectors: 1–50',
    subtitle: 'Conversational Flow',
    description:
      'Essential connectors and transitions to link thoughts and speak fluidly.',
    badge: 'Connectors',
    themeColor: 'turquesa',
    notes: [
      {
        spanish: 'además',
        english: 'in addition / besides',
        context:
          'Example: "Es barato y, además, de muy buena calidad." ("It\'s inexpensive and, besides, very good quality.")',
        bidirectional: true,
      },
      {
        spanish: 'por lo tanto',
        english: 'therefore / consequently',
        context:
          'Example: "El metro falló; por lo tanto, llegué tarde." ("The metro had issues; therefore, I arrived late.")',
        bidirectional: true,
      },
      {
        spanish: 'por eso',
        english: 'that is why / for that reason',
        context:
          'Example: "Tenía mucho frío, por eso me puse chamarra." ("I was very cold; that is why I put on a jacket.")',
        bidirectional: true,
      },
      {
        spanish: 'así que',
        english: 'so / so then',
        context:
          'Example: "Ya terminamos, así que nos podemos ir." ("We\'re already done, so we can go.")',
        bidirectional: true,
      },
      {
        spanish: 'en cambio',
        english: 'on the other hand / whereas',
        context:
          'Example: "A mí me encanta el café; a ella, en cambio, le gusta el té." ("I love coffee; she, on the other hand, prefers tea.")',
        bidirectional: true,
      },
      {
        spanish: 'de hecho',
        english: 'in fact / actually',
        context:
          'Example: "No tengo hambre; de hecho, acabo de comer." ("I\'m not hungry; in fact, I just ate.")',
        bidirectional: true,
      },
      {
        spanish: 'a pesar de',
        english: 'despite / in spite of',
        context:
          'Example: "Fuimos al parque a pesar de la lluvia." ("We went to the park despite the rain.")',
        bidirectional: true,
      },
      {
        spanish: 'aun así',
        english: 'even so / still',
        context:
          'Example: "Salimos temprano; aun así, había mucho tráfico." ("We left early; even so, there was a lot of traffic.")',
        bidirectional: true,
      },
      {
        spanish: 'no obstante',
        english: 'nevertheless / nonetheless',
        context:
          'Example: "El examen era difícil; no obstante, aprobé." ("The exam was difficult; nevertheless, I passed.")',
        bidirectional: true,
      },
      {
        spanish: 'por el contrario',
        english: 'on the contrary',
        context:
          'Example: "No me molestó; por el contrario, me dio gusto." ("It didn\'t bother me; on the contrary, I was glad.")',
        bidirectional: true,
      },
      {
        spanish: 'es decir',
        english: 'that is to say / meaning',
        context:
          'Example: "Llega el viernes, es decir, pasado mañana." ("He arrives Friday, that is to say, the day after tomorrow.")',
        bidirectional: true,
      },
      {
        spanish: 'en otras palabras',
        english: 'in other words',
        context:
          'Example: "No hay fondos suficientes; en otras palabras, cancelaron el proyecto." ("There aren\'t enough funds; in other words, they cancelled the project.")',
        bidirectional: true,
      },
      {
        spanish: 'por si acaso',
        english: 'just in case',
        context:
          'Example: "Lleva paraguas por si acaso." ("Take an umbrella just in case.")',
        bidirectional: true,
      },
      {
        spanish: 'mientras tanto',
        english: 'meanwhile / in the meantime',
        context:
          'Example: "Prepara la mesa; mientras tanto, yo sirvo los tacos." ("Set the table; meanwhile, I\'ll serve the tacos.")',
        bidirectional: true,
      },
      {
        spanish: 'al fin y al cabo',
        english: 'at the end of the day / after all',
        context:
          'Example: "No te preocupes tanto; al fin y al cabo, todo salió bien." ("Don\'t worry so much; at the end of the day, everything went well.")',
        bidirectional: true,
      },
      {
        spanish: 'de todos modos',
        english: 'anyway / in any case',
        context:
          'Example: "Sé que tienes prisa, pero gracias de todos modos." ("I know you\'re in a hurry, but thanks anyway.")',
        bidirectional: true,
      },
      {
        spanish: 'ya que',
        english: 'since / seeing that',
        context:
          'Example: "Ya que estás aquí, ayúdame tantito." ("Since you\'re here, help me a little bit.")',
        bidirectional: true,
      },
      {
        spanish: 'puesto que',
        english: 'given that / since',
        context:
          'Example: "Puesto que nadie vino, reprogramamos la junta." ("Given that no one came, we rescheduled the meeting.")',
        bidirectional: true,
      },
      {
        spanish: 'debido a',
        english: 'due to',
        context:
          'Example: "El vuelo se retrasó debido a la neblina." ("The flight was delayed due to fog.")',
        bidirectional: true,
      },
      {
        spanish: 'a causa de',
        english: 'because of',
        context:
          'Example: "Cerraron Reforma a causa de una marcha." ("They closed Reforma because of a march.")',
        bidirectional: true,
      },
      {
        spanish: 'gracias a',
        english: 'thanks to',
        context:
          'Example: "Llegamos a tiempo gracias a tu ayuda." ("We arrived on time thanks to your help.")',
        bidirectional: true,
      },
      {
        spanish: 'por culpa de',
        english: 'through the fault of / to blame on',
        context:
          'Example: "Perdimos el tren por culpa de la alarma." ("We missed the train because of the alarm.")',
        bidirectional: true,
      },
      {
        spanish: 'de modo que',
        english: 'so that / in such a way that',
        context:
          'Example: "Acomodé las cosas de modo que cupieran todas." ("I arranged things so that they would all fit.")',
        bidirectional: true,
      },
      {
        spanish: 'por consiguiente',
        english: 'consequently / as a result',
        context:
          'Example: "No hubo quórum; por consiguiente, se suspendió la sesión." ("There was no quorum; consequently, the session was adjourned.")',
        bidirectional: true,
      },
      {
        spanish: 'en consecuencia',
        english: 'as a consequence',
        context:
          'Example: "No revisaron el contrato y, en consecuencia, perdieron el anticipo." ("They didn\'t review the contract and, as a consequence, lost the deposit.")',
        bidirectional: true,
      },
      {
        spanish: 'incluso',
        english: 'even / including',
        context:
          'Example: "Todos fueron a la fiesta, incluso los vecinos." ("Everyone went to the party, even the neighbors.")',
        bidirectional: true,
      },
      {
        spanish: 'es más',
        english: 'what is more / furthermore',
        context:
          'Example: "La comida estuvo riquísima; es más, pedí postre." ("The food was delicious; what is more, I ordered dessert.")',
        bidirectional: true,
      },
      {
        spanish: 'sobre todo',
        english: 'above all / especially',
        context:
          'Example: "Me encanta la Ciudad de México, sobre todo en primavera." ("I love Mexico City, especially in spring.")',
        bidirectional: true,
      },
      {
        spanish: 'asimismo',
        english: 'likewise / also',
        context:
          'Example: "Agradeció a sus colegas; asimismo, felicitó al equipo." ("He thanked his colleagues; likewise, he congratulated the team.")',
        bidirectional: true,
      },
      {
        spanish: 'en realidad',
        english: 'actually / in reality',
        context:
          'Example: "Parece sencillo, pero en realidad requiere mucha práctica." ("It seems simple, but in reality it takes a lot of practice.")',
        bidirectional: true,
      },
      {
        spanish: 'por ejemplo',
        english: 'for example',
        context:
          'Example: "Hay muchas opciones; por ejemplo, podemos pedir sushi." ("There are many options; for example, we can order sushi.")',
        bidirectional: true,
      },
      {
        spanish: 'al principio',
        english: 'at first / at the beginning',
        context:
          'Example: "Al principio fue difícil entender el acento." ("At first it was hard to understand the accent.")',
        bidirectional: true,
      },
      {
        spanish: 'al final',
        english: 'in the end / at last',
        context:
          'Example: "Buscamos por todos lados y al final encontramos las llaves." ("We looked everywhere and in the end found the keys.")',
        bidirectional: true,
      },
      {
        spanish: 'por último',
        english: 'finally / lastly',
        context:
          'Example: "Por último, no olvides apagar las luces." ("Lastly, don\'t forget to turn off the lights.")',
        bidirectional: true,
      },
      {
        spanish: 'en cuanto',
        english: 'as soon as / the moment that',
        context:
          'Example: "Te llamo en cuanto llegue al depa." ("I\'ll call you as soon as I get to the apartment.")',
        bidirectional: true,
      },
      {
        spanish: 'en primer lugar',
        english: 'first of all / in the first place',
        context:
          'Example: "En primer lugar, quiero agradecerles por venir." ("First of all, I want to thank you for coming.")',
        bidirectional: true,
      },
      {
        spanish: 'desde entonces',
        english: 'since then',
        context:
          'Example: "Se mudó en enero y no lo he visto desde entonces." ("He moved in January and I haven\'t seen him since then.")',
        bidirectional: true,
      },
      {
        spanish: 'a partir de',
        english: 'starting from / as of',
        context:
          'Example: "A partir de mañana abren la nueva cafetería." ("Starting tomorrow, the new coffee shop opens.")',
        bidirectional: true,
      },
      {
        spanish: 'al mismo tiempo',
        english: 'at the same time',
        context:
          'Example: "No puedes hablar y comer al mismo tiempo." ("You can\'t talk and eat at the same time.")',
        bidirectional: true,
      },
      {
        spanish: 'pero',
        english: 'but',
        context:
          'Example: "Quería salir a caminar, pero empezó a llover." ("I wanted to go for a walk, but it started raining.")',
        bidirectional: true,
      },
      {
        spanish: 'sino',
        english: 'but rather',
        context:
          'Example: "No pedí agua con gas, sino agua natural." ("I didn\'t order sparkling water, but rather still water.")',
        bidirectional: true,
      },
      {
        spanish: 'por cierto',
        english: 'by the way / incidentally',
        context:
          'Example: "Por cierto, ¿viste el mensaje que te mandé?" ("By the way, did you see the message I sent you?")',
        bidirectional: true,
      },
      {
        spanish: 'de lo contrario',
        english: 'otherwise / or else',
        context:
          'Example: "Date prisa; de lo contrario, no alcanzaremos mesa." ("Hurry up; otherwise, we won\'t get a table.")',
        bidirectional: true,
      },
      {
        spanish: 'para colmo',
        english: 'to top it off / on top of that',
        context:
          'Example: "Perdí la cartera y, para colmo, empezó a granizar." ("I lost my wallet and, to top it off, it started hailing.")',
        bidirectional: true,
      },
      {
        spanish: 'con tal de que',
        english: 'provided that / on the condition that',
        context:
          'Example: "Te presto el coche con tal de que le pongas gasolina." ("I\'ll lend you the car provided that you put gas in it.")',
        bidirectional: true,
      },
      {
        spanish: 'siempre y cuando',
        english: 'as long as / provided that',
        context:
          'Example: "Podemos ir al cine siempre y cuando termines la tarea." ("We can go to the movies as long as you finish your homework.")',
        bidirectional: true,
      },
      {
        spanish: 'a menos que',
        english: 'unless',
        context:
          'Example: "Nos vemos a las ocho, a menos que tengas otro plan." ("See you at eight, unless you have another plan.")',
        bidirectional: true,
      },
      {
        spanish: 'por otra parte',
        english: 'on the other hand / moreover',
        context:
          'Example: "El departamento es amplio; por otra parte, está muy bien ubicado." ("The apartment is spacious; moreover, it\'s very well located.")',
        bidirectional: true,
      },
      {
        spanish: 'en resumen',
        english: 'in summary / in short',
        context:
          'Example: "En resumen, la reunión fue todo un éxito." ("In summary, the meeting was a complete success.")',
        bidirectional: true,
      },
      {
        spanish: 'en conclusión',
        english: 'in conclusion',
        context:
          'Example: "En conclusión, el nuevo horario beneficia a todos." ("In conclusion, the new schedule benefits everyone.")',
        bidirectional: true,
      },
    ],
  },
  {
    id: 'common-adjectives',
    title: 'Top Adjectives: 1–50',
    subtitle: 'Essential Descriptors',
    description:
      'High-frequency descriptive adjectives and pairs for vivid everyday conversation.',
    badge: 'Adjectives',
    themeColor: 'cempasuchil',
    notes: [
      {
        spanish: 'fácil',
        english: 'easy',
        context:
          'Example: "El examen estuvo muy fácil." ("The exam was very easy.")',
        bidirectional: true,
      },
      {
        spanish: 'difícil',
        english: 'difficult / hard',
        context:
          'Example: "Aprender el subjuntivo es difícil pero divertido." ("Learning the subjunctive is difficult but fun.")',
        bidirectional: true,
      },
      {
        spanish: 'bueno',
        english: 'good',
        context:
          'Example: "Este restaurante tiene muy buen servicio." ("This restaurant has very good service.")',
        bidirectional: true,
      },
      {
        spanish: 'malo',
        english: 'bad',
        context:
          'Example: "Hoy fue un mal día en la oficina." ("Today was a bad day at the office.")',
        bidirectional: true,
      },
      {
        spanish: 'grande',
        english: 'big / large',
        context:
          'Example: "Vivimos en una casa bastante grande." ("We live in a fairly big house.")',
        bidirectional: true,
      },
      {
        spanish: 'pequeño',
        english: 'small / little',
        context:
          'Example: "Mi departamento en la Roma es pequeño pero cómodo." ("My apartment in Roma is small but comfortable.")',
        bidirectional: true,
      },
      {
        spanish: 'caro',
        english: 'expensive',
        context:
          'Example: "Ese café en Polanco está carísimo." ("That coffee in Polanco is really expensive.")',
        bidirectional: true,
      },
      {
        spanish: 'barato',
        english: 'cheap / inexpensive',
        context:
          'Example: "Comer en el mercado es rico y barato." ("Eating at the market is delicious and cheap.")',
        bidirectional: true,
      },
      {
        spanish: 'rápido',
        english: 'fast / quick',
        context:
          'Example: "El metrobús suele ser más rápido que el taxi." ("The Metrobus is usually faster than a taxi.")',
        bidirectional: true,
      },
      {
        spanish: 'lento',
        english: 'slow',
        context:
          'Example: "El internet está muy lento esta tarde." ("The internet is very slow this afternoon.")',
        bidirectional: true,
      },
      {
        spanish: 'nuevo',
        english: 'new',
        context:
          'Example: "Compré una chamarra nueva para el frío." ("I bought a new jacket for the cold.")',
        bidirectional: true,
      },
      {
        spanish: 'viejo',
        english: 'old',
        context:
          'Example: "Ese edificio del centro es muy viejo y bonito." ("That downtown building is very old and pretty.")',
        bidirectional: true,
      },
      {
        spanish: 'joven',
        english: 'young',
        context:
          'Example: "La doctora que me atendió es muy joven." ("The doctor who treated me is very young.")',
        bidirectional: true,
      },
      {
        spanish: 'limpio',
        english: 'clean',
        context:
          'Example: "Dejaron el departamento rechinando de limpio." ("They left the apartment squeaky clean.")',
        bidirectional: true,
      },
      {
        spanish: 'sucio',
        english: 'dirty',
        context:
          'Example: "Los zapatos se me quedaron sucios por el lodo." ("My shoes got dirty from the mud.")',
        bidirectional: true,
      },
      {
        spanish: 'lleno',
        english: 'full',
        context:
          'Example: "El vagón del metro venía llenísimo." ("The metro car was completely full.")',
        bidirectional: true,
      },
      {
        spanish: 'vacío',
        english: 'empty',
        context:
          'Example: "La cafetería estaba vacía a las siete de la mañana." ("The coffee shop was empty at seven in the morning.")',
        bidirectional: true,
      },
      {
        spanish: 'caliente',
        english: 'hot / warm',
        context:
          'Example: "Ten cuidado, la sopa está muy caliente." ("Be careful, the soup is very hot.")',
        bidirectional: true,
      },
      {
        spanish: 'frío',
        english: 'cold',
        context:
          'Example: "Pásame un vaso con agua fría, por favor." ("Pass me a glass of cold water, please.")',
        bidirectional: true,
      },
      {
        spanish: 'abierto',
        english: 'open',
        context:
          'Example: "¿La farmacia sigue abierta a esta hora?" ("Is the pharmacy still open at this hour?")',
        bidirectional: true,
      },
      {
        spanish: 'cerrado',
        english: 'closed',
        context:
          'Example: "El museo está cerrado los lunes." ("The museum is closed on Mondays.")',
        bidirectional: true,
      },
      {
        spanish: 'seguro',
        english: 'safe / sure',
        context:
          'Example: "Este barrio es muy tranquilo y seguro para caminar." ("This neighborhood is very calm and safe to walk in.")',
        bidirectional: true,
      },
      {
        spanish: 'peligroso',
        english: 'dangerous',
        context:
          'Example: "Manejar con lluvia fuerte es peligroso." ("Driving in heavy rain is dangerous.")',
        bidirectional: true,
      },
      {
        spanish: 'fuerte',
        english: 'strong',
        context:
          'Example: "El café de olla tiene un sabor muy fuerte." ("Café de olla has a very strong flavor.")',
        bidirectional: true,
      },
      {
        spanish: 'débil',
        english: 'weak',
        context:
          'Example: "Todavía me siento un poco débil por la gripa." ("I still feel a little weak from the flu.")',
        bidirectional: true,
      },
      {
        spanish: 'alto',
        english: 'tall / high',
        context:
          'Example: "Ese edificio moderno en Reforma es altísimo." ("That modern building on Reforma is very tall.")',
        bidirectional: true,
      },
      {
        spanish: 'bajo',
        english: 'short / low',
        context:
          'Example: "El techo de la recámara es un poco bajo." ("The bedroom ceiling is a bit low.")',
        bidirectional: true,
      },
      {
        spanish: 'largo',
        english: 'long',
        context:
          'Example: "Fue un viaje muy largo en carretera." ("It was a very long road trip.")',
        bidirectional: true,
      },
      {
        spanish: 'corto',
        english: 'short [length]',
        context:
          'Example: "La reunión fue bastante corta y productiva." ("The meeting was quite short and productive.")',
        bidirectional: true,
      },
      {
        spanish: 'pesado',
        english: 'heavy / tedious',
        context:
          'Example: "La mochila está muy pesada con tantos libros." ("The backpack is very heavy with so many books.")',
        bidirectional: true,
      },
      {
        spanish: 'ligero',
        english: 'light / lightweight',
        context:
          'Example: "Cené algo ligero para dormir mejor." ("I had something light for dinner to sleep better.")',
        bidirectional: true,
      },
      {
        spanish: 'claro',
        english: 'clear / light [color]',
        context:
          'Example: "La explicación del profesor fue muy clara." ("The teacher\'s explanation was very clear.")',
        bidirectional: true,
      },
      {
        spanish: 'oscuro',
        english: 'dark',
        context:
          'Example: "El callejón estaba muy oscuro de noche." ("The alley was very dark at night.")',
        bidirectional: true,
      },
      {
        spanish: 'listo',
        english: 'ready / clever',
        context:
          'Example: "¿Ya estás listo para salir?" ("Are you ready to leave yet?")',
        bidirectional: true,
      },
      {
        spanish: 'ocupado',
        english: 'busy / occupied',
        context:
          'Example: "El jefe anda muy ocupado hoy con juntas." ("The boss is very busy today with meetings.")',
        bidirectional: true,
      },
      {
        spanish: 'libre',
        english: 'free / available',
        context:
          'Example: "¿Estás libre este fin de semana?" ("Are you free this weekend?")',
        bidirectional: true,
      },
      {
        spanish: 'cansado',
        english: 'tired',
        context:
          'Example: "Llegué muy cansado después del trabajo." ("I arrived very tired after work.")',
        bidirectional: true,
      },
      {
        spanish: 'enfermo',
        english: 'sick / ill',
        context:
          'Example: "No fue a clases porque estaba enfermo del estómago." ("He didn\'t go to class because he was sick to his stomach.")',
        bidirectional: true,
      },
      {
        spanish: 'sano',
        english: 'healthy',
        context:
          'Example: "Come muchas verduras para mantenerte sano." ("Eat lots of vegetables to stay healthy.")',
        bidirectional: true,
      },
      {
        spanish: 'rico',
        english: 'delicious / rich',
        context:
          'Example: "Estos tacos al pastor están riquísimos." ("These tacos al pastor are delicious.")',
        bidirectional: true,
      },
      {
        spanish: 'pobre',
        english: 'poor',
        context:
          'Example: "El suelo de este jardín es pobre en nutrientes." ("The soil in this garden is poor in nutrients.")',
        bidirectional: true,
      },
      {
        spanish: 'amable',
        english: 'kind / friendly',
        context:
          'Example: "El mesero fue muy amable y atento con nosotros." ("The waiter was very kind and attentive to us.")',
        bidirectional: true,
      },
      {
        spanish: 'tranquilo',
        english: 'calm / quiet / relaxed',
        context:
          'Example: "El parque México es un lugar muy tranquilo." ("Parque México is a very quiet and peaceful place.")',
        bidirectional: true,
      },
      {
        spanish: 'ruidoso',
        english: 'noisy / loud',
        context:
          'Example: "Esa avenida es muy ruidosa por el tráfico." ("That avenue is very noisy because of traffic.")',
        bidirectional: true,
      },
      {
        spanish: 'cómodo',
        english: 'comfortable',
        context:
          'Example: "Estos tenis son comodísimos para caminar." ("These sneakers are super comfortable for walking.")',
        bidirectional: true,
      },
      {
        spanish: 'incómodo',
        english: 'uncomfortable',
        context:
          'Example: "El sillón de la sala es algo incómodo." ("The living room armchair is somewhat uncomfortable.")',
        bidirectional: true,
      },
      {
        spanish: 'bonito',
        english: 'pretty / nice',
        context:
          'Example: "Coyoacán es uno de los barrios más bonitos." ("Coyoacán is one of the prettiest neighborhoods.")',
        bidirectional: true,
      },
      {
        spanish: 'feo',
        english: 'ugly',
        context:
          'Example: "El clima se puso feo por la tarde con granizo." ("The weather got ugly in the afternoon with hail.")',
        bidirectional: true,
      },
      {
        spanish: 'igual',
        english: 'same / equal',
        context:
          'Example: "Los dos platillos saben casi igual." ("The two dishes taste almost the same.")',
        bidirectional: true,
      },
      {
        spanish: 'diferente',
        english: 'different',
        context:
          'Example: "Cada colonia de la ciudad tiene un ambiente diferente." ("Each neighborhood in the city has a different vibe.")',
        bidirectional: true,
      },
    ],
  },
  {
    id: 'common-idioms',
    title: 'Top Idioms: 1–30',
    subtitle: 'Essential Building Blocks',
    description:
      'High-frequency conversational chunks and idioms for natural everyday interactions.',
    badge: 'Idioms',
    themeColor: 'tezontle',
    notes: [
      {
        spanish: 'ponerse de acuerdo',
        english: 'to coordinate / to agree on plans',
        context:
          'Example: "Nos pusimos de acuerdo para cenar el viernes." ("We coordinated to have dinner on Friday.")',
        bidirectional: true,
      },
      {
        spanish: 'estar al tanto',
        english: 'to stay in the loop / to be aware',
        context:
          'Example: "Mantenme al tanto de lo que decida el equipo." ("Keep me in the loop on what the team decides.")',
        bidirectional: true,
      },
      {
        spanish: 'hacer falta',
        english: 'to be needed / to be missing',
        context:
          'Example: "Hace falta comprar más café para la oficina." ("We need to buy more coffee for the office.")',
        bidirectional: true,
      },
      {
        spanish: 'tener ganas de',
        english: 'to feel like / to look forward to',
        context:
          'Example: "Tengo muchas ganas de ir a Oaxaca en vacaciones." ("I really feel like going to Oaxaca on vacation.")',
        bidirectional: true,
      },
      {
        spanish: 'hacer caso',
        english: 'to pay attention / to listen to advice',
        context:
          'Example: "Hazle caso a las indicaciones del doctor." ("Pay attention to the doctor\'s instructions.")',
        bidirectional: true,
      },
      {
        spanish: 'echar la mano',
        english: 'to lend a hand / to help out',
        context:
          'Example: "¿Me puedes echar la mano con estas cajas pesadas?" ("Can you lend me a hand with these heavy boxes?")',
        bidirectional: true,
      },
      {
        spanish: 'dar igual',
        english: 'to not matter / to make no difference',
        context:
          'Example: "Me da igual si comemos tacos o quesadillas." ("It makes no difference to me whether we eat tacos or quesadillas.")',
        bidirectional: true,
      },
      {
        spanish: 'estar pendiente',
        english: 'to keep an eye out / to stay tuned',
        context:
          'Example: "Estoy pendiente del teléfono por si me llaman." ("I\'m keeping an eye on the phone in case they call me.")',
        bidirectional: true,
      },
      {
        spanish: 'tener que ver con',
        english: 'to have to do with',
        context:
          'Example: "Ese problema no tiene que ver con nosotros." ("That problem has nothing to do with us.")',
        bidirectional: true,
      },
      {
        spanish: 'estar de acuerdo',
        english: 'to agree / to be in agreement',
        context:
          'Example: "¿Estás de acuerdo con el nuevo horario?" ("Do you agree with the new schedule?")',
        bidirectional: true,
      },
      {
        spanish: 'no pasa nada',
        english: 'no worries / it is all good',
        context:
          'Example: "Se me olvidó la llave, pero no pasa nada." ("I forgot the key, but no worries.")',
        bidirectional: true,
      },
      {
        spanish: 'tomar en cuenta',
        english: 'to take into account / to keep in mind',
        context:
          'Example: "Hay que tomar en cuenta el tráfico de la hora pico." ("We have to take rush hour traffic into account.")',
        bidirectional: true,
      },
      {
        spanish: 'llevar a cabo',
        english: 'to carry out / to execute',
        context:
          'Example: "Van a llevar a cabo la remodelación el próximo mes." ("They are going to carry out the remodel next month.")',
        bidirectional: true,
      },
      {
        spanish: 'echar ganas',
        english: 'to put effort in / to try your best',
        context:
          'Example: "Hay que echarle ganas al proyecto para terminar a tiempo." ("We have to put effort into the project to finish on time.")',
        bidirectional: true,
      },
      {
        spanish: 'dar por hecho',
        english: 'to take for granted / to assume',
        context:
          'Example: "No des por hecho que la tienda estará abierta hoy." ("Don\'t take for granted that the store will be open today.")',
        bidirectional: true,
      },
      {
        spanish: 'hacer el favor',
        english: 'to do the favor',
        context:
          'Example: "¿Me haces el favor de cerrar la ventana?" ("Could you do me the favor of closing the window?")',
        bidirectional: true,
      },
      {
        spanish: 'quedar en',
        english: 'to arrange to / to agree on',
        context:
          'Example: "Quedamos en vernos a las seis en la cafetería." ("We agreed to meet at six at the coffee shop.")',
        bidirectional: true,
      },
      {
        spanish: 'de vez en cuando',
        english: 'from time to time / once in a while',
        context:
          'Example: "Voy a nadar al deportivo de vez en cuando." ("I go swimming at the sports club once in a while.")',
        bidirectional: true,
      },
      {
        spanish: 'estar al día',
        english: 'to be up to date',
        context:
          'Example: "Me gusta leer las noticias para estar al día." ("I like reading the news to stay up to date.")',
        bidirectional: true,
      },
      {
        spanish: 'hacerse bolas',
        english: 'to get confused / to get mixed up',
        context:
          'Example: "Me hice bolas con tantas explicaciones diferentes." ("I got confused with so many different explanations.")',
        bidirectional: true,
      },
      {
        spanish: 'echar un ojo',
        english: 'to take a quick look / to keep an eye on',
        context:
          'Example: "¿Le puedes echar un ojo a mi mochila mientras regreso?" ("Can you keep an eye on my backpack while I get back?")',
        bidirectional: true,
      },
      {
        spanish: 'meter la pata',
        english: "to mess up / to put one's foot in it",
        context:
          'Example: "Metí la pata al mandar el correo equivocado." ("I messed up by sending the wrong email.")',
        bidirectional: true,
      },
      {
        spanish: 'tener la culpa',
        english: 'to be to blame / to be at fault',
        context:
          'Example: "Nadie tiene la culpa de lo que pasó con la lluvia." ("No one is to blame for what happened with the rain.")',
        bidirectional: true,
      },
      {
        spanish: 'caer bien',
        english: 'to make a good impression / to like someone',
        context:
          'Example: "Tus amigos del trabajo me cayeron muy bien." ("I really liked your coworkers.")',
        bidirectional: true,
      },
      {
        spanish: 'caer mal',
        english: 'to make a bad impression / to dislike someone',
        context:
          'Example: "El nuevo vecino me cayó mal desde el primer día." ("The new neighbor made a bad impression on me from day one.")',
        bidirectional: true,
      },
      {
        spanish: 'dar una vuelta',
        english: 'to take a walk / to take a stroll',
        context:
          'Example: "Vamos a dar una vuelta por el parque antes de cenar." ("Let\'s go take a walk around the park before dinner.")',
        bidirectional: true,
      },
      {
        spanish: 'pasar la voz',
        english: 'to spread the word',
        context:
          'Example: "Pasa la voz sobre el concierto de este sábado." ("Spread the word about the concert this Saturday.")',
        bidirectional: true,
      },
      {
        spanish: 'perder de vista',
        english: 'to lose sight of',
        context:
          'Example: "No hay que perder de vista nuestro objetivo principal." ("We must not lose sight of our main goal.")',
        bidirectional: true,
      },
      {
        spanish: 'tener prisa',
        english: 'to be in a hurry',
        context:
          'Example: "Tengo un poco de prisa porque mi cita es a las tres." ("I\'m in a bit of a hurry because my appointment is at three.")',
        bidirectional: true,
      },
      {
        spanish: 'a primera vista',
        english: 'at first glance / at first sight',
        context:
          'Example: "A primera vista el examen parecía muy complicado." ("At first glance the exam seemed very complicated.")',
        bidirectional: true,
      },
    ],
  },
  {
    id: 'common-adverbs',
    title: 'Top Adverbs: 1–50',
    subtitle: 'Time, Place & Manner',
    description:
      'High-frequency temporal, frequency, and manner adverbs for everyday fluency.',
    badge: 'Adverbs',
    themeColor: 'maya',
    notes: [
      {
        spanish: 'siempre',
        english: 'always',
        context:
          'Example: "Siempre llego diez minutos antes a la oficina." ("I always arrive ten minutes early to the office.")',
        bidirectional: true,
      },
      {
        spanish: 'nunca',
        english: 'never',
        context:
          'Example: "Nunca tomo café después de las seis de la tarde." ("I never drink coffee after six in the evening.")',
        bidirectional: true,
      },
      {
        spanish: 'jamás',
        english: 'never ever / never',
        context:
          'Example: "Jamás olvidaré la primera vez que visité Bellas Artes." ("I will never forget the first time I visited Bellas Artes.")',
        bidirectional: true,
      },
      {
        spanish: 'a veces',
        english: 'sometimes',
        context:
          'Example: "A veces prefiero caminar en vez de tomar el metro." ("Sometimes I prefer walking instead of taking the subway.")',
        bidirectional: true,
      },
      {
        spanish: 'todavía',
        english: 'still / yet',
        context:
          'Example: "Todavía no decido qué pedir de cenar." ("I still haven\'t decided what to order for dinner.")',
        bidirectional: true,
      },
      {
        spanish: 'ya',
        english: 'already / now',
        context:
          'Example: "Ya terminamos la reunión con el equipo." ("We already finished the meeting with the team.")',
        bidirectional: true,
      },
      {
        spanish: 'hoy',
        english: 'today',
        context:
          'Example: "Hoy el clima está fresco y agradable en la ciudad." ("Today the weather is cool and pleasant in the city.")',
        bidirectional: true,
      },
      {
        spanish: 'mañana',
        english: 'tomorrow',
        context:
          'Example: "Mañana tenemos una cita importante con el cliente." ("Tomorrow we have an important meeting with the client.")',
        bidirectional: true,
      },
      {
        spanish: 'ayer',
        english: 'yesterday',
        context:
          'Example: "Ayer llovió muy fuerte durante la tarde." ("Yesterday it rained very hard during the afternoon.")',
        bidirectional: true,
      },
      {
        spanish: 'anoche',
        english: 'last night',
        context:
          'Example: "Anoche vimos una película mexicana muy divertida." ("Last night we watched a very funny Mexican movie.")',
        bidirectional: true,
      },
      {
        spanish: 'antier',
        english: 'the day before yesterday',
        context:
          'Example: "Antier recibí el paquete que estaba esperando." ("The day before yesterday I received the package I was waiting for.")',
        bidirectional: true,
      },
      {
        spanish: 'temprano',
        english: 'early',
        context:
          'Example: "Me levanté temprano para salir a correr al parque." ("I woke up early to go for a run in the park.")',
        bidirectional: true,
      },
      {
        spanish: 'tarde',
        english: 'late',
        context:
          'Example: "Llegamos tarde al cine por el tráfico de Reforma." ("We arrived late to the movies because of traffic on Reforma.")',
        bidirectional: true,
      },
      {
        spanish: 'pronto',
        english: 'soon',
        context:
          'Example: "Espero verte pronto para platicar con calma." ("I hope to see you soon to chat at ease.")',
        bidirectional: true,
      },
      {
        spanish: 'luego',
        english: 'then / later',
        context:
          'Example: "Primero desayunamos y luego vamos al supermercado." ("First we eat breakfast and then we go to the supermarket.")',
        bidirectional: true,
      },
      {
        spanish: 'después',
        english: 'afterwards / later',
        context:
          'Example: "Te llamo después cuando salga de la junta." ("I\'ll call you afterwards when I get out of the meeting.")',
        bidirectional: true,
      },
      {
        spanish: 'antes',
        english: 'before / beforehand',
        context:
          'Example: "Lávate las manos antes de sentarte a comer." ("Wash your hands before sitting down to eat.")',
        bidirectional: true,
      },
      {
        spanish: 'entonces',
        english: 'then / at that time',
        context:
          'Example: "Vivía en Guadalajara entonces y estudiaba música." ("I lived in Guadalajara then and studied music.")',
        bidirectional: true,
      },
      {
        spanish: 'ahora',
        english: 'now',
        context:
          'Example: "Ahora vivo en la colonia Roma con mi familia." ("Now I live in the Roma neighborhood with my family.")',
        bidirectional: true,
      },
      {
        spanish: 'enseguida',
        english: 'right away / immediately',
        context:
          'Example: "El mesero nos trae la cuenta enseguida." ("The waiter is bringing us the check right away.")',
        bidirectional: true,
      },
      {
        spanish: 'de repente',
        english: 'suddenly',
        context:
          'Example: "De repente empezó a granizar en medio del paseo." ("Suddenly it began hailing in the middle of our walk.")',
        bidirectional: true,
      },
      {
        spanish: 'a menudo',
        english: 'often',
        context:
          'Example: "Visito a menudo a mis abuelos los domingos." ("I often visit my grandparents on Sundays.")',
        bidirectional: true,
      },
      {
        spanish: 'frecuentemente',
        english: 'frequently',
        context:
          'Example: "Frecuentemente cambiamos la ruta para evitar el tráfico." ("We frequently change the route to avoid traffic.")',
        bidirectional: true,
      },
      {
        spanish: 'rara vez',
        english: 'rarely / seldom',
        context:
          'Example: "Rara vez como postre entre semana." ("I rarely eat dessert during the week.")',
        bidirectional: true,
      },
      {
        spanish: 'apenas',
        english: 'barely / hardly',
        context:
          'Example: "Apenas llegué a tiempo antes de que cerraran la puerta." ("I barely arrived on time before they closed the door.")',
        bidirectional: true,
      },
      {
        spanish: 'finalmente',
        english: 'finally / at last',
        context:
          'Example: "Finalmente conseguí los boletos para el museo." ("I finally got the tickets for the museum.")',
        bidirectional: true,
      },
      {
        spanish: 'actualmente',
        english: 'currently / nowadays',
        context:
          'Example: "Actualmente trabajo como diseñador en una agencia." ("I currently work as a designer at an agency.")',
        bidirectional: true,
      },
      {
        spanish: 'últimamente',
        english: 'lately / recently',
        context:
          'Example: "Últimamente duermo muy bien gracias al ejercicio." ("Lately I have been sleeping very well thanks to exercise.")',
        bidirectional: true,
      },
      {
        spanish: 'mucho',
        english: 'a lot / much',
        context:
          'Example: "Me gustó mucho la comida de esta fondita." ("I liked the food from this little eatery a lot.")',
        bidirectional: true,
      },
      {
        spanish: 'poco',
        english: 'little / a little bit',
        context:
          'Example: "Dormí muy poco anoche por el calor." ("I slept very little last night because of the heat.")',
        bidirectional: true,
      },
      {
        spanish: 'bastante',
        english: 'quite / fairly',
        context:
          'Example: "El departamento es bastante amplio y luminoso." ("The apartment is quite spacious and bright.")',
        bidirectional: true,
      },
      {
        spanish: 'demasiado',
        english: 'too much / overly',
        context:
          'Example: "Ese coche va demasiado rápido por la calle." ("That car is going too fast down the street.")',
        bidirectional: true,
      },
      {
        spanish: 'casi',
        english: 'almost / nearly',
        context:
          'Example: "Casi terminamos de empacar todas las cajas." ("We almost finished packing all the boxes.")',
        bidirectional: true,
      },
      {
        spanish: 'más',
        english: 'more',
        context:
          'Example: "Habla un poco más despacio, por favor." ("Speak a little slower, please.")',
        bidirectional: true,
      },
      {
        spanish: 'menos',
        english: 'less',
        context:
          'Example: "Debes preocuparte menos por esas cosas." ("You should worry less about those things.")',
        bidirectional: true,
      },
      {
        spanish: 'tan',
        english: 'so / as',
        context:
          'Example: "No pensé que el examen fuera tan sencillo." ("I didn\'t think the exam would be so simple.")',
        bidirectional: true,
      },
      {
        spanish: 'aquí',
        english: 'here',
        context:
          'Example: "Aquí preparan el mejor chocolate caliente." ("Here they make the best hot chocolate.")',
        bidirectional: true,
      },
      {
        spanish: 'acá',
        english: 'over here',
        context:
          'Example: "Ven para acá que hay sombra bajo este árbol." ("Come over here because there is shade under this tree.")',
        bidirectional: true,
      },
      {
        spanish: 'allá',
        english: 'over there',
        context:
          'Example: "Allá al fondo están los baños del restaurante." ("Over there in the back are the restaurant restrooms.")',
        bidirectional: true,
      },
      {
        spanish: 'cerca',
        english: 'nearby / close',
        context:
          'Example: "La estación del metrobus queda muy cerca." ("The Metrobus station is very close by.")',
        bidirectional: true,
      },
      {
        spanish: 'lejos',
        english: 'far away / far',
        context:
          'Example: "El aeropuerto queda lejos del centro de la ciudad." ("The airport is far from the city center.")',
        bidirectional: true,
      },
      {
        spanish: 'adentro',
        english: 'inside',
        context:
          'Example: "Hace mucho frío afuera, vamos a esperar adentro." ("It\'s very cold outside, let\'s wait inside.")',
        bidirectional: true,
      },
      {
        spanish: 'afuera',
        english: 'outside',
        context:
          'Example: "Dejé la bicicleta afuera junto a la entrada." ("I left the bicycle outside next to the entrance.")',
        bidirectional: true,
      },
      {
        spanish: 'arriba',
        english: 'up / upstairs',
        context:
          'Example: "Las recámaras están arriba en el segundo piso." ("The bedrooms are upstairs on the second floor.")',
        bidirectional: true,
      },
      {
        spanish: 'abajo',
        english: 'down / downstairs',
        context:
          'Example: "Te espero abajo en la recepción del edificio." ("I\'ll wait for you downstairs in the building lobby.")',
        bidirectional: true,
      },
      {
        spanish: 'así',
        english: 'like this / this way',
        context:
          'Example: "Hazlo así para que no se rompa el papel." ("Do it like this so the paper doesn\'t tear.")',
        bidirectional: true,
      },
      {
        spanish: 'despacio',
        english: 'slowly',
        context:
          'Example: "Maneja despacio porque el pavimento está mojado." ("Drive slowly because the pavement is wet.")',
        bidirectional: true,
      },
      {
        spanish: 'tal vez',
        english: 'maybe / perhaps',
        context:
          'Example: "Tal vez vayamos al cine este fin de semana." ("Maybe we\'ll go to the movies this weekend.")',
        bidirectional: true,
      },
      {
        spanish: 'exactamente',
        english: 'exactly',
        context:
          'Example: "Eso es exactamente lo que quería decir." ("That is exactly what I wanted to say.")',
        bidirectional: true,
      },
      {
        spanish: 'seguramente',
        english: 'surely / probably',
        context:
          'Example: "Seguramente nos veremos mañana en el trabajo." ("We will probably see each other tomorrow at work.")',
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

export function getStarterPackIdFromNoteId(noteId: string): string | null {
  const match = noteId.match(/^curated-(.+)-\d{3}$/)
  return match ? match[1]! : null
}

export function getStarterPackForCard(
  card: StudyCard,
): StarterPack | undefined {
  const packId = getStarterPackIdFromNoteId(card.noteId)
  return packId ? findStarterPack(packId) : undefined
}

export function getStarterPackCardsInDeck(
  cards: StudyCard[],
  packId: string,
): StudyCard[] {
  const prefix = `curated-${packId}-`
  return cards.filter((c) => c.noteId.startsWith(prefix))
}

export function getStarterNoteCardsInDeck(
  cards: StudyCard[],
  packId: string,
  noteIndex: number,
): StudyCard[] {
  const noteId = `curated-${packId}-${String(noteIndex + 1).padStart(3, '0')}`
  return cards.filter((c) => c.noteId === noteId)
}
