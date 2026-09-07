import { createStudyCards, type StudyCard } from './card'

export interface StarterPackSeed {
  id: string
  title: string
  subtitle: string
  description: string
  badge: string
  notes: Array<{
    spanish: string
    english: string
    context: string
    bidirectional?: boolean
  }>
}

export interface StarterPack {
  id: string
  title: string
  subtitle: string
  description: string
  badge: string
  noteCount: number
  cardCount: number
  createCards: (now?: number) => StudyCard[]
}

export const starterPackSeeds: StarterPackSeed[] = [
  {
    id: 'mexican-street-phrases',
    title: 'Mexican Street Phrases',
    subtitle: 'Everyday Spoken CDMX Spanish',
    description:
      'The essential colloquial phrases and courteous spoken etiquette you hear every day in the streets, cafés, and mercados of Mexico City.',
    badge: '🇲🇽 Essential CDMX',
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
    id: 'common-verbs-1',
    title: 'Top Verbs: 1–50',
    subtitle: 'Core Foundation & Irregulars',
    description:
      'The 50 most essential Spanish verbs: irregular anchors, high-frequency actions, and auxiliary verbs that power everyday conversation.',
    badge: '⚡ Verbs 1–50',
    notes: [
      {
        spanish: 'ser',
        english: 'to be (essential nature/identity)',
        context: 'Inherent qualities, origin, profession, and identity.',
        bidirectional: true,
      },
      {
        spanish: 'estar',
        english: 'to be (temporary state/location)',
        context:
          'Locations, emotional states, conditions, and ongoing progressive actions.',
        bidirectional: true,
      },
      {
        spanish: 'haber',
        english: 'to have (auxiliary) / there is',
        context: 'Used as auxiliary (he comido) or existence (hay).',
        bidirectional: true,
      },
      {
        spanish: 'tener',
        english: 'to have / to possess',
        context:
          'Possession, age (tengo 30 años), and physical sensations (tener hambre).',
        bidirectional: true,
      },
      {
        spanish: 'hacer',
        english: 'to do / to make',
        context:
          'Actions, weather (hace calor), and time elapsed (hace dos años).',
        bidirectional: true,
      },
      {
        spanish: 'ir',
        english: 'to go',
        context: 'Movement and immediate future intention (ir a + infinitive).',
        bidirectional: true,
      },
      {
        spanish: 'poder',
        english: 'to be able to / can',
        context: 'Ability and permission (¿puedo pasar?).',
        bidirectional: true,
      },
      {
        spanish: 'saber',
        english: 'to know (facts / skills)',
        context:
          'Information, facts, and how to do something (saber hablar español).',
        bidirectional: true,
      },
      {
        spanish: 'poner',
        english: 'to put / to place',
        context:
          'Placing items; reflexively ponerse means to become or to put on clothes.',
        bidirectional: true,
      },
      {
        spanish: 'decir',
        english: 'to say / to tell',
        context: 'Reporting words or giving advice (dime la verdad).',
        bidirectional: true,
      },
      {
        spanish: 'ver',
        english: 'to see / to watch',
        context:
          'Visual perception and watching shows or movies (vamos a ver).',
        bidirectional: true,
      },
      {
        spanish: 'dar',
        english: 'to give',
        context:
          'Giving gifts, giving directions (dar la vuelta), and sensations (me da miedo).',
        bidirectional: true,
      },
      {
        spanish: 'querer',
        english: 'to want / to love',
        context: 'Desires and affection for friends/family (te quiero mucho).',
        bidirectional: true,
      },
      {
        spanish: 'pasar',
        english: 'to pass / to happen',
        context: 'Time passing, crossing over, or happening (¿qué pasa?).',
        bidirectional: true,
      },
      {
        spanish: 'deber',
        english: 'to owe / must / should',
        context: 'Obligation (debo estudiar) or debt (te debo diez pesos).',
        bidirectional: true,
      },
      {
        spanish: 'llegar',
        english: 'to arrive',
        context: 'Reaching a physical destination or milestone.',
        bidirectional: true,
      },
      {
        spanish: 'creer',
        english: 'to believe / to think',
        context: 'Personal opinions, beliefs, and assumptions (creo que sí).',
        bidirectional: true,
      },
      {
        spanish: 'encontrar',
        english: 'to find',
        context:
          'Discovering something; reflexively encontrarse means to meet or feel.',
        bidirectional: true,
      },
      {
        spanish: 'parecer',
        english: 'to seem / to appear',
        context:
          'Impressions; reflexively parecerse means to resemble someone.',
        bidirectional: true,
      },
      {
        spanish: 'seguir',
        english: 'to follow / to continue',
        context: 'Following someone or continuing an action (seguir adelante).',
        bidirectional: true,
      },
      {
        spanish: 'quedar',
        english: 'to stay / to remain / to be located',
        context: 'Location of places (queda cerca) and remaining items.',
        bidirectional: true,
      },
      {
        spanish: 'hablar',
        english: 'to speak / to talk',
        context: 'Verbal communication in any setting.',
        bidirectional: true,
      },
      {
        spanish: 'llevar',
        english: 'to carry / to take / to wear',
        context:
          'Transporting items, wearing clothes, or time spent doing something.',
        bidirectional: true,
      },
      {
        spanish: 'dejar',
        english: 'to leave / to allow',
        context:
          'Leaving an item behind or letting someone do something (déjame ver).',
        bidirectional: true,
      },
      {
        spanish: 'pensar',
        english: 'to think',
        context: 'Cognitive reflection and plans (pienso viajar).',
        bidirectional: true,
      },
      {
        spanish: 'sentir',
        english: 'to feel / to regret',
        context:
          'Physical/emotional sensations; reflexively sentirse describes mood.',
        bidirectional: true,
      },
      {
        spanish: 'venir',
        english: 'to come',
        context: 'Movement toward the speaker (¿vienes a la fiesta?).',
        bidirectional: true,
      },
      {
        spanish: 'volver',
        english: 'to return / to go back',
        context:
          'Returning to a place; volver a + infinitive means to do again.',
        bidirectional: true,
      },
      {
        spanish: 'tomar',
        english: 'to take / to drink',
        context:
          'Taking transportation, grabbing something, or drinking a beverage.',
        bidirectional: true,
      },
      {
        spanish: 'conocer',
        english: 'to know / to meet (people/places)',
        context: 'Familiarity with individuals, cities, or cultural works.',
        bidirectional: true,
      },
      {
        spanish: 'vivir',
        english: 'to live',
        context: 'Residing in a home or experiencing life.',
        bidirectional: true,
      },
      {
        spanish: 'mirar',
        english: 'to look at / to watch',
        context: 'Focusing eyes on something specific (mira esto).',
        bidirectional: true,
      },
      {
        spanish: 'pedir',
        english: 'to ask for / to order',
        context:
          'Requesting items, ordering food, or asking for favors (pedir ayuda).',
        bidirectional: true,
      },
      {
        spanish: 'buscar',
        english: 'to look for / to search',
        context: 'Searching for misplaced items, information, or people.',
        bidirectional: true,
      },
      {
        spanish: 'entrar',
        english: 'to enter / to go in',
        context: 'Passing into an enclosed space or building.',
        bidirectional: true,
      },
      {
        spanish: 'recordar',
        english: 'to remember / to remind',
        context: 'Recalling a memory or reminding someone of a commitment.',
        bidirectional: true,
      },
      {
        spanish: 'terminar',
        english: 'to finish / to end',
        context: 'Completing a task, course, day, or relationship.',
        bidirectional: true,
      },
      {
        spanish: 'empezar',
        english: 'to begin / to start',
        context:
          'Commencing an activity or scheduled event (empezar a trabajar).',
        bidirectional: true,
      },
      {
        spanish: 'esperar',
        english: 'to wait / to hope',
        context: 'Waiting for transit/friends or hoping for an outcome.',
        bidirectional: true,
      },
      {
        spanish: 'escribir',
        english: 'to write',
        context: 'Composing text, messages, notes, or letters.',
        bidirectional: true,
      },
      {
        spanish: 'perder',
        english: 'to lose / to miss',
        context:
          'Misplacing an object, losing a match, or missing transport (perder el metro).',
        bidirectional: true,
      },
      {
        spanish: 'aparecer',
        english: 'to appear',
        context: 'Becoming visible or showing up unexpectedly.',
        bidirectional: true,
      },
      {
        spanish: 'conseguir',
        english: 'to obtain / to get',
        context: 'Acquiring something through effort or management.',
        bidirectional: true,
      },
      {
        spanish: 'servir',
        english: 'to serve / to be useful',
        context:
          'Serving food/guests, or functioning (no sirve = it is broken).',
        bidirectional: true,
      },
      {
        spanish: 'sacar',
        english: 'to take out / to extract',
        context:
          'Removing items from a bag, taking photos (sacar una foto), or getting tickets.',
        bidirectional: true,
      },
      {
        spanish: 'necesitar',
        english: 'to need',
        context: 'Expressing practical necessity or requirements.',
        bidirectional: true,
      },
      {
        spanish: 'gustar',
        english: 'to be pleasing (to like)',
        context: 'Used with indirect pronouns: me gusta, nos gusta.',
        bidirectional: true,
      },
      {
        spanish: 'mantener',
        english: 'to maintain / to sustain',
        context: 'Keeping conditions stable or supporting a family.',
        bidirectional: true,
      },
      {
        spanish: 'resultar',
        english: 'to turn out / to result',
        context: 'The outcome of a process or event (resultó muy fácil).',
        bidirectional: true,
      },
      {
        spanish: 'leer',
        english: 'to read',
        context: 'Reading books, menus, signs, or articles.',
        bidirectional: true,
      },
    ],
  },
  {
    id: 'common-verbs-2',
    title: 'Top Verbs: 51–100',
    subtitle: 'Everyday Interaction & Action',
    description:
      'The next 50 most common verbs for daily interactions, practical routines, social exchanges, and active decisions.',
    badge: '⚡ Verbs 51–100',
    notes: [
      {
        spanish: 'caer',
        english: 'to fall',
        context:
          'Physical falling; colloquially caer bien means to like someone.',
        bidirectional: true,
      },
      {
        spanish: 'cambiar',
        english: 'to change',
        context: 'Modifying plans, exchanging currency, or swapping clothes.',
        bidirectional: true,
      },
      {
        spanish: 'presentar',
        english: 'to introduce / to present',
        context: 'Introducing colleagues or presenting work.',
        bidirectional: true,
      },
      {
        spanish: 'crear',
        english: 'to create',
        context: 'Inventing, producing, or bringing something into being.',
        bidirectional: true,
      },
      {
        spanish: 'abrir',
        english: 'to open',
        context: 'Opening doors, accounts, businesses, or conversations.',
        bidirectional: true,
      },
      {
        spanish: 'considerar',
        english: 'to consider',
        context: 'Weighing options or regarding someone with respect.',
        bidirectional: true,
      },
      {
        spanish: 'oír',
        english: 'to hear',
        context: 'Perceiving sounds through your ears (¿me oyes?).',
        bidirectional: true,
      },
      {
        spanish: 'acabar',
        english: 'to finish / to have just done',
        context:
          'Ending something; acabar de + infinitive means having just done it.',
        bidirectional: true,
      },
      {
        spanish: 'ganar',
        english: 'to win / to earn',
        context: 'Winning a contest or earning a salary.',
        bidirectional: true,
      },
      {
        spanish: 'formar',
        english: 'to form / to shape',
        context: 'Constituting groups, forming habits, or queuing up.',
        bidirectional: true,
      },
      {
        spanish: 'partir',
        english: 'to depart / to split',
        context: 'Leaving a station or dividing portions.',
        bidirectional: true,
      },
      {
        spanish: 'morir',
        english: 'to die',
        context: 'Biological death; hyperbolically morirse de risa/hambre.',
        bidirectional: true,
      },
      {
        spanish: 'aceptar',
        english: 'to accept',
        context:
          'Agreeing to terms, receiving payment, or accepting an invitation.',
        bidirectional: true,
      },
      {
        spanish: 'realizar',
        english: 'to carry out / to fulfill',
        context: 'Executing tasks, projects, or fulfilling lifelong dreams.',
        bidirectional: true,
      },
      {
        spanish: 'suponer',
        english: 'to suppose / to assume',
        context: 'Hypothesizing or presupposing something.',
        bidirectional: true,
      },
      {
        spanish: 'comprender',
        english: 'to understand / to comprehend',
        context: 'Grasping meaning or showing empathy.',
        bidirectional: true,
      },
      {
        spanish: 'lograr',
        english: 'to achieve / to manage',
        context: 'Attaining a difficult goal or succeeding in an attempt.',
        bidirectional: true,
      },
      {
        spanish: 'explicar',
        english: 'to explain',
        context: 'Clarifying details, instructions, or viewpoints.',
        bidirectional: true,
      },
      {
        spanish: 'preguntar',
        english: 'to ask (a question)',
        context: 'Inquiring about information or asking someone directions.',
        bidirectional: true,
      },
      {
        spanish: 'tocar',
        english: 'to touch / to play (instrument)',
        context: 'Touching, playing music, or being one’s turn (te toca a ti).',
        bidirectional: true,
      },
      {
        spanish: 'reconocer',
        english: 'to recognize / to admit',
        context: 'Recognizing familiar faces or acknowledging an error.',
        bidirectional: true,
      },
      {
        spanish: 'alcanzar',
        english: 'to reach / to be enough',
        context: 'Reaching high shelves, catching up, or budget being enough.',
        bidirectional: true,
      },
      {
        spanish: 'nacer',
        english: 'to be born',
        context: 'Originating or beginning life.',
        bidirectional: true,
      },
      {
        spanish: 'dirigir',
        english: 'to direct / to lead',
        context:
          'Guiding an organization, directing a project, or heading toward a place.',
        bidirectional: true,
      },
      {
        spanish: 'correr',
        english: 'to run',
        context: 'Running for sport, hurrying, or transit running.',
        bidirectional: true,
      },
      {
        spanish: 'utilizar',
        english: 'to use / to utilize',
        context: 'Employing tools, methods, or resources.',
        bidirectional: true,
      },
      {
        spanish: 'pagar',
        english: 'to pay',
        context:
          'Settling bills, paying for groceries, or compensating someone.',
        bidirectional: true,
      },
      {
        spanish: 'ayudar',
        english: 'to help',
        context: 'Assisting a colleague, friend, or stranger.',
        bidirectional: true,
      },
      {
        spanish: 'cumplir',
        english: 'to fulfill / to turn (age)',
        context: 'Keeping promises or celebrating birthdays (cumplir años).',
        bidirectional: true,
      },
      {
        spanish: 'ofrecer',
        english: 'to offer',
        context: 'Presenting help, food, or commercial services.',
        bidirectional: true,
      },
      {
        spanish: 'descubrir',
        english: 'to discover',
        context: 'Uncovering new neighborhoods, facts, or ideas.',
        bidirectional: true,
      },
      {
        spanish: 'levantar',
        english: 'to raise / to lift',
        context:
          'Lifting objects; reflexively levantarse means getting up in the morning.',
        bidirectional: true,
      },
      {
        spanish: 'intentar',
        english: 'to try / to attempt',
        context: 'Making an effort to do something (voy a intentarlo).',
        bidirectional: true,
      },
      {
        spanish: 'usar',
        english: 'to use / to wear',
        context: 'Using everyday objects or wearing specific clothes.',
        bidirectional: true,
      },
      {
        spanish: 'olvidar',
        english: 'to forget',
        context:
          'Failing to recall; reflexively olvidarse de means to forget about something.',
        bidirectional: true,
      },
      {
        spanish: 'contestar',
        english: 'to answer / to reply',
        context: 'Answering phones, emails, questions, or doors.',
        bidirectional: true,
      },
      {
        spanish: 'trabajar',
        english: 'to work',
        context: 'Professional employment or putting in effort on a project.',
        bidirectional: true,
      },
      {
        spanish: 'decidir',
        english: 'to decide',
        context: 'Making a choice between alternatives.',
        bidirectional: true,
      },
      {
        spanish: 'repetir',
        english: 'to repeat',
        context: 'Saying something again or taking a second helping of food.',
        bidirectional: true,
      },
      {
        spanish: 'producir',
        english: 'to produce',
        context: 'Manufacturing goods, creating art, or generating results.',
        bidirectional: true,
      },
      {
        spanish: 'entender',
        english: 'to understand',
        context: 'Grasping concepts, instructions, or accents (ya entendí).',
        bidirectional: true,
      },
      {
        spanish: 'andar',
        english: 'to walk / to go around',
        context: 'Walking or being in a state (ando ocupado = I am busy).',
        bidirectional: true,
      },
      {
        spanish: 'contar',
        english: 'to count / to tell (a story)',
        context: 'Counting numbers or sharing an anecdote (cuéntame).',
        bidirectional: true,
      },
      {
        spanish: 'mostrar',
        english: 'to show',
        context: 'Displaying items or demonstrating a technique.',
        bidirectional: true,
      },
      {
        spanish: 'bajar',
        english: 'to descend / to get off / to lower',
        context: 'Going down stairs, stepping off a bus, or lowering volume.',
        bidirectional: true,
      },
      {
        spanish: 'subir',
        english: 'to go up / to board / to raise',
        context: 'Climbing stairs, boarding transit, or raising prices.',
        bidirectional: true,
      },
      {
        spanish: 'mover',
        english: 'to move',
        context:
          'Moving physical objects; reflexively moverse means to move one’s body.',
        bidirectional: true,
      },
      {
        spanish: 'parar',
        english: 'to stop / to stand',
        context: 'Halting motion or standing in place.',
        bidirectional: true,
      },
      {
        spanish: 'guardar',
        english: 'to keep / to save / to put away',
        context: 'Storing files, saving money, or keeping secrets.',
        bidirectional: true,
      },
      {
        spanish: 'dormir',
        english: 'to sleep',
        context: 'Resting overnight; dormirse means falling asleep.',
        bidirectional: true,
      },
    ],
  },
  {
    id: 'common-verbs-3',
    title: 'Top Verbs: 101–150',
    subtitle: 'Daily Life, Movement & Nuance',
    description:
      'High-utility verbs for food, transit, household routines, and expressive Mexican social interactions.',
    badge: '⚡ Verbs 101–150',
    notes: [
      {
        spanish: 'jugar',
        english: 'to play (games/sports)',
        context: 'Playing sports, board games, or playing with children.',
        bidirectional: true,
      },
      {
        spanish: 'despertar',
        english: 'to wake up',
        context: 'Waking up in the morning; reflexively despertarse.',
        bidirectional: true,
      },
      {
        spanish: 'desayunar',
        english: 'to have breakfast',
        context: 'Enjoying the morning meal (chilaquiles, café).',
        bidirectional: true,
      },
      {
        spanish: 'almorzar',
        english: 'to have lunch',
        context: 'Midday meal with family or colleagues.',
        bidirectional: true,
      },
      {
        spanish: 'cenar',
        english: 'to have dinner',
        context: 'Evening meal or late tacos.',
        bidirectional: true,
      },
      {
        spanish: 'cocinar',
        english: 'to cook',
        context: 'Preparing food in the kitchen.',
        bidirectional: true,
      },
      {
        spanish: 'comprar',
        english: 'to buy',
        context: 'Purchasing groceries, gifts, or transit passes.',
        bidirectional: true,
      },
      {
        spanish: 'vender',
        english: 'to sell',
        context: 'Commercial sales at shops and markets.',
        bidirectional: true,
      },
      {
        spanish: 'llamar',
        english: 'to call / to name',
        context: 'Phone calls; reflexively llamarse means to be named.',
        bidirectional: true,
      },
      {
        spanish: 'viajar',
        english: 'to travel',
        context: 'Exploring new towns, states, or countries.',
        bidirectional: true,
      },
      {
        spanish: 'caminar',
        english: 'to walk',
        context: 'Strolling through parks, avenues, and alleys.',
        bidirectional: true,
      },
      {
        spanish: 'manejar',
        english: 'to drive (Latin America)',
        context: 'Standard Mexican Spanish verb for operating a vehicle.',
        bidirectional: true,
      },
      {
        spanish: 'descansar',
        english: 'to rest',
        context: 'Taking a break to recover energy.',
        bidirectional: true,
      },
      {
        spanish: 'limpiar',
        english: 'to clean',
        context: 'Cleaning a room, dish, or workstation.',
        bidirectional: true,
      },
      {
        spanish: 'lavar',
        english: 'to wash',
        context: 'Washing dishes, laundry, or hands.',
        bidirectional: true,
      },
      {
        spanish: 'cortar',
        english: 'to cut',
        context: 'Slicing food, hair, or cutting a connection.',
        bidirectional: true,
      },
      {
        spanish: 'cerrar',
        english: 'to close',
        context: 'Closing doors, windows, books, or shops.',
        bidirectional: true,
      },
      {
        spanish: 'apagar',
        english: 'to turn off / to extinguish',
        context: 'Switching off lights, screens, or blowing out candles.',
        bidirectional: true,
      },
      {
        spanish: 'prender',
        english: 'to turn on (Latin America)',
        context:
          'Standard Mexican Spanish for switching on lights or electronics.',
        bidirectional: true,
      },
      {
        spanish: 'arreglar',
        english: 'to fix / to arrange',
        context: 'Repairing a broken appliance or tidying up.',
        bidirectional: true,
      },
      {
        spanish: 'invitar',
        english: 'to invite / to treat someone',
        context:
          'Inviting friends out; also paying for someone’s meal (yo invito).',
        bidirectional: true,
      },
      {
        spanish: 'saludar',
        english: 'to greet',
        context: 'Saying hello to neighbors, colleagues, and acquaintances.',
        bidirectional: true,
      },
      {
        spanish: 'despedir',
        english: 'to say goodbye',
        context: 'Bidding farewell; reflexively despedirse.',
        bidirectional: true,
      },
      {
        spanish: 'agradecer',
        english: 'to thank / to appreciate',
        context: 'Expressing heartfelt gratitude for help or kindness.',
        bidirectional: true,
      },
      {
        spanish: 'disculpar',
        english: 'to excuse / to forgive',
        context: 'Asking pardon (discúlpame) or forgiving a mistake.',
        bidirectional: true,
      },
      {
        spanish: 'cuidar',
        english: 'to take care of',
        context: 'Watching over pets, children, health, or belongings.',
        bidirectional: true,
      },
      {
        spanish: 'avisar',
        english: 'to let know / to notify',
        context: 'Sending an update or advance notice (te aviso al llegar).',
        bidirectional: true,
      },
      {
        spanish: 'checar',
        english: 'to check / to verify (Mexico)',
        context: 'Very common Mexican Spanish verb for checking or verifying.',
        bidirectional: true,
      },
      {
        spanish: 'platicar',
        english: 'to chat / to talk (Mexico)',
        context: 'Standard Mexican Spanish for having a conversation.',
        bidirectional: true,
      },
      {
        spanish: 'cobrar',
        english: 'to charge / to collect payment',
        context: 'Cashier or vendor charging for items.',
        bidirectional: true,
      },
      {
        spanish: 'gastar',
        english: 'to spend (money) / to wear out',
        context: 'Spending cash or using up resources.',
        bidirectional: true,
      },
      {
        spanish: 'ahorrar',
        english: 'to save (money/energy)',
        context: 'Setting aside money for future goals.',
        bidirectional: true,
      },
      {
        spanish: 'prestar',
        english: 'to lend / to borrow',
        context: 'Lending objects or money (¿me prestas una pluma?).',
        bidirectional: true,
      },
      {
        spanish: 'faltar',
        english: 'to be missing / to lack',
        context: 'Missing components or time remaining (falta poco).',
        bidirectional: true,
      },
      {
        spanish: 'importar',
        english: 'to matter / to care',
        context: 'Having importance (no importa = it does not matter).',
        bidirectional: true,
      },
      {
        spanish: 'costar',
        english: 'to cost / to be difficult',
        context: 'Price of items or difficulty (me cuesta trabajo).',
        bidirectional: true,
      },
      {
        spanish: 'doler',
        english: 'to hurt / to ache',
        context: 'Expressing pain (me duele la cabeza).',
        bidirectional: true,
      },
      {
        spanish: 'aprender',
        english: 'to learn',
        context: 'Acquiring knowledge, languages, or practical skills.',
        bidirectional: true,
      },
      {
        spanish: 'representar',
        english: 'to represent',
        context: 'Symbolizing ideas or representing organizations.',
        bidirectional: true,
      },
      {
        spanish: 'desaparecer',
        english: 'to disappear',
        context: 'Vanishing from sight or fading away.',
        bidirectional: true,
      },
      {
        spanish: 'mandar',
        english: 'to send / to command',
        context: 'Sending messages or ordering someone (te mando un mensaje).',
        bidirectional: true,
      },
      {
        spanish: 'fijar',
        english: 'to fix / to notice',
        context:
          'Setting rules; reflexively fijarse means to pay attention (fíjate).',
        bidirectional: true,
      },
      {
        spanish: 'aguantar',
        english: 'to endure / to hold on',
        context: 'Tolerating hardship, holding one’s breath, or waiting.',
        bidirectional: true,
      },
      {
        spanish: 'apurar',
        english: 'to hurry / to worry',
        context: 'Rushing; reflexively apurarse means to hurry up (apúrate).',
        bidirectional: true,
      },
      {
        spanish: 'ubicar',
        english: 'to locate / to know where',
        context: 'Finding locations or knowing someone (¿lo ubicas?).',
        bidirectional: true,
      },
      {
        spanish: 'antojar',
        english: 'to crave',
        context: 'Craving food or experiences (se me antojan unos tacos).',
        bidirectional: true,
      },
      {
        spanish: 'extrañar',
        english: 'to miss someone',
        context: 'Feeling the absence of friends or family.',
        bidirectional: true,
      },
      {
        spanish: 'caber',
        english: 'to fit',
        context: 'Fitting into spaces or garments (no cabe aquí).',
        bidirectional: true,
      },
      {
        spanish: 'valer',
        english: 'to be worth',
        context: 'Value of things; vale la pena means it is worth the effort.',
        bidirectional: true,
      },
      {
        spanish: 'tardar',
        english: 'to take time / to be slow',
        context: 'Duration of an action or running late (no tardes).',
        bidirectional: true,
      },
    ],
  },
  {
    id: 'common-verbs-4',
    title: 'Top Verbs: 151–200',
    subtitle: 'Spoken Proficiency & Idiomatic Verbs',
    description:
      'Expressive, idiomatic verbs that bring natural fluency, conversational confidence, and spoken richness to your Spanish.',
    badge: '⚡ Verbs 151–200',
    notes: [
      {
        spanish: 'convenir',
        english: 'to suit / to be advisable',
        context: 'Being convenient or beneficial (te conviene hacerlo).',
        bidirectional: true,
      },
      {
        spanish: 'bastar',
        english: 'to be enough',
        context: 'Sufficiency (¡basta! = enough!; basta con una palabra).',
        bidirectional: true,
      },
      {
        spanish: 'sobrar',
        english: 'to be leftover / to spare',
        context: 'Remaining surplus food or time (me sobran diez minutos).',
        bidirectional: true,
      },
      {
        spanish: 'meter',
        english: 'to put in / to insert',
        context: 'Placing something inside a container, pocket, or bag.',
        bidirectional: true,
      },
      {
        spanish: 'tirar',
        english: 'to throw away / to drop',
        context: 'Discarding trash or accidentally dropping an item.',
        bidirectional: true,
      },
      {
        spanish: 'botar',
        english: 'to discard / to bounce',
        context: 'Bouncing a ball, or tossing something out.',
        bidirectional: true,
      },
      {
        spanish: 'soltar',
        english: 'to let go / to release',
        context: 'Releasing one’s grip or dropping tension.',
        bidirectional: true,
      },
      {
        spanish: 'agarrar',
        english: 'to grab / to catch',
        context: 'Grabbing an item or catching transit (agarré el metrobús).',
        bidirectional: true,
      },
      {
        spanish: 'jalar',
        english: 'to pull / to work (Mexico)',
        context:
          'Pulling doors; in Mexico jalar also means to work or be game (¿jalas?).',
        bidirectional: true,
      },
      {
        spanish: 'empujar',
        english: 'to push',
        context: 'Pushing doors, carts, or obstacles.',
        bidirectional: true,
      },
      {
        spanish: 'apretar',
        english: 'to squeeze / to tighten',
        context: 'Squeezing citrus, tightening screws, or tight shoes.',
        bidirectional: true,
      },
      {
        spanish: 'quejarse',
        english: 'to complain',
        context: 'Expressing dissatisfaction or annoyance about something.',
        bidirectional: true,
      },
      {
        spanish: 'romper',
        english: 'to break / to tear',
        context: 'Breaking plates, toys, or tearing paper/clothes.',
        bidirectional: true,
      },
      {
        spanish: 'componer',
        english: 'to repair / to compose',
        context: 'Composing music or fixing broken machinery.',
        bidirectional: true,
      },
      {
        spanish: 'encender',
        english: 'to ignite / to turn on',
        context: 'Lighting a candle, stove, or turning on a device.',
        bidirectional: true,
      },
      {
        spanish: 'cruzar',
        english: 'to cross',
        context: 'Crossing streets, intersections, borders, or rooms.',
        bidirectional: true,
      },
      {
        spanish: 'doblar',
        english: 'to turn / to fold',
        context:
          'Folding laundry, or turning at a street corner (dobla a la derecha).',
        bidirectional: true,
      },
      {
        spanish: 'girar',
        english: 'to rotate / to spin',
        context: 'Rotating wheels or turning directions.',
        bidirectional: true,
      },
      {
        spanish: 'arrancar',
        english: 'to start up (engine) / to tear out',
        context: 'Starting a vehicle engine or ripping a page.',
        bidirectional: true,
      },
      {
        spanish: 'frenar',
        english: 'to brake / to slow down',
        context: 'Applying vehicle brakes or restraining momentum.',
        bidirectional: true,
      },
      {
        spanish: 'chocar',
        english: 'to crash / to collide',
        context:
          'Vehicles crashing; colloquially me choca means I hate/detest it.',
        bidirectional: true,
      },
      {
        spanish: 'esquivar',
        english: 'to dodge / to avoid',
        context: 'Evading potholes, obstacles, or awkward encounters.',
        bidirectional: true,
      },
      {
        spanish: 'resistir',
        english: 'to resist / to hold up',
        context: 'Withstanding physical strain or emotional temptation.',
        bidirectional: true,
      },
      {
        spanish: 'soportar',
        english: 'to withstand / to put up with',
        context: 'Tolerating noise, heat, or difficult personalities.',
        bidirectional: true,
      },
      {
        spanish: 'confiar',
        english: 'to trust',
        context:
          'Placing faith in friends, partners, or systems (confío en ti).',
        bidirectional: true,
      },
      {
        spanish: 'dudar',
        english: 'to doubt',
        context: 'Having hesitations or second thoughts (lo dudo mucho).',
        bidirectional: true,
      },
      {
        spanish: 'adivinar',
        english: 'to guess',
        context:
          'Guessing answers, riddles, or future outcomes (a ver, adivina).',
        bidirectional: true,
      },
      {
        spanish: 'mentir',
        english: 'to lie',
        context: 'Speaking falsehoods (no me mientas).',
        bidirectional: true,
      },
      {
        spanish: 'prometer',
        english: 'to promise',
        context: 'Making commitments to others or oneself (te lo prometo).',
        bidirectional: true,
      },
      {
        spanish: 'jurar',
        english: 'to swear',
        context: 'Swearing an oath or assuring truth (te lo juro).',
        bidirectional: true,
      },
      {
        spanish: 'asegurar',
        english: 'to ensure / to claim',
        context: 'Guaranteeing safety or firmly asserting a fact.',
        bidirectional: true,
      },
      {
        spanish: 'aprovechar',
        english: 'to take advantage of / to make the most of',
        context:
          'Making the best use of opportunities, discounts, or sunny weather.',
        bidirectional: true,
      },
      {
        spanish: 'convivir',
        english: 'to live together / to socialize',
        context:
          'Sharing moments, hanging out, and spending quality time with friends.',
        bidirectional: true,
      },
      {
        spanish: 'animar',
        english: 'to cheer up / to encourage',
        context: 'Encouraging someone or cheering up when down (anímate).',
        bidirectional: true,
      },
      {
        spanish: 'acostumbrar',
        english: 'to be accustomed to',
        context:
          'Getting used to local habits, spicy food, or schedules (acostumbrarse).',
        bidirectional: true,
      },
      {
        spanish: 'aburrir',
        english: 'to bore',
        context: 'Feeling bored or uninspired; reflexively aburrirse.',
        bidirectional: true,
      },
      {
        spanish: 'asustar',
        english: 'to scare',
        context: 'Frightening someone or being startled (me asusté).',
        bidirectional: true,
      },
      {
        spanish: 'calmar',
        english: 'to calm down',
        context: 'Soothing nerves or relaxing after stress (cálmate).',
        bidirectional: true,
      },
      {
        spanish: 'apoyar',
        english: 'to support',
        context: 'Backing up a friend, colleague, or social cause.',
        bidirectional: true,
      },
      {
        spanish: 'compartir',
        english: 'to share',
        context: 'Sharing food, ideas, photos, or living spaces.',
        bidirectional: true,
      },
      {
        spanish: 'permitir',
        english: 'to allow / to permit',
        context: 'Allowing actions or permitting entry (permíteme ayudarte).',
        bidirectional: true,
      },
      {
        spanish: 'insistir',
        english: 'to insist',
        context:
          'Politely pressing a point or offering another taco (yo insisto).',
        bidirectional: true,
      },
      {
        spanish: 'evitar',
        english: 'to avoid',
        context: 'Steering clear of traffic jams, mistakes, or arguments.',
        bidirectional: true,
      },
      {
        spanish: 'merecer',
        english: 'to deserve',
        context: 'Being worthy of rest, praise, or reward (te lo mereces).',
        bidirectional: true,
      },
      {
        spanish: 'organizar',
        english: 'to organize',
        context:
          'Planning outings, arranging files, or setting up a study plan.',
        bidirectional: true,
      },
      {
        spanish: 'resolver',
        english: 'to solve / to resolve',
        context:
          'Finding solutions to everyday problems or mathematical equations.',
        bidirectional: true,
      },
      {
        spanish: 'distribuir',
        english: 'to distribute',
        context: 'Sharing resources or spreading tasks across a team.',
        bidirectional: true,
      },
      {
        spanish: 'exigir',
        english: 'to demand',
        context: 'Requiring standards or demanding accountability.',
        bidirectional: true,
      },
      {
        spanish: 'funcionar',
        english: 'to function / to work',
        context: 'Operating properly as designed (ya funciona el wifi).',
        bidirectional: true,
      },
      {
        spanish: 'celebrar',
        english: 'to celebrate',
        context: 'Commemorating milestones, holidays, and personal triumphs.',
        bidirectional: true,
      },
    ],
  },
]

export const starterPacks: StarterPack[] = starterPackSeeds.map((seed) => {
  const noteCount = seed.notes.length
  // Calculate total cards created (bidirectional notes create 2 cards, one-way notes create 1)
  const cardCount = seed.notes.reduce(
    (acc, note) => acc + (note.bidirectional ? 2 : 1),
    0,
  )

  return {
    id: seed.id,
    title: seed.title,
    subtitle: seed.subtitle,
    description: seed.description,
    badge: seed.badge,
    noteCount,
    cardCount,
    createCards: (now = 0) => {
      const cards: StudyCard[] = []
      seed.notes.forEach((note, index) => {
        const noteId = `curated-${seed.id}-${String(index + 1).padStart(3, '0')}`
        const created = createStudyCards(
          {
            spanish: note.spanish,
            english: note.english,
            context: note.context,
            bidirectional: note.bidirectional ?? true,
          },
          noteId,
          now,
        )
        cards.push(...created)
      })
      return cards
    },
  }
})

export function findStarterPack(id: string): StarterPack | undefined {
  return starterPacks.find((p) => p.id === id)
}
