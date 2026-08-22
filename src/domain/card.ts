export const grades = ['again', 'hard', 'good', 'easy'] as const

export type Grade = (typeof grades)[number]
export type Direction = 'es-en' | 'en-es'
export type Scene = 'conversation' | 'metro' | 'takeaway'

export type ReviewSchedule = {
  dueAt: number
  intervalDays: number
  reviews: number
  lapses: number
}

export type StudyCard = {
  id: string
  noteId: string
  prompt: string
  answer: string
  direction: Direction
  context: string
  scene: Scene
  schedule: ReviewSchedule
}

export type NewNote = {
  spanish: string
  english: string
  context: string
  bidirectional: boolean
  reversePrompt?: string
  reverseAnswer?: string
}

const DAY = 24 * 60 * 60 * 1000

const sceneMatchers: ReadonlyArray<[Scene, RegExp]> = [
  ['metro', /\b(metro|metrob[uú]s|tren|bus|station|estaci[oó]n)\b/iu],
  [
    'takeaway',
    /\b(caf[eé]|coffee|comida|food|restaurante|restaurant|llevar|takeaway|to go)\b/iu,
  ],
]

export function chooseScene(...text: string[]): Scene {
  const phrase = text.join(' ')
  return (
    sceneMatchers.find(([, matcher]) => matcher.test(phrase))?.[0] ??
    'conversation'
  )
}

export function createStudyCards(
  note: NewNote,
  noteId: string,
  now: number,
): StudyCard[] {
  const spanish = note.spanish.trim()
  const english = note.english.trim()
  if (!spanish || !english) return []

  const context = note.context.trim()
  const scene = chooseScene(spanish, english, context)
  const newSchedule = (): ReviewSchedule => ({
    dueAt: now,
    intervalDays: 0,
    reviews: 0,
    lapses: 0,
  })
  const cards: StudyCard[] = [
    {
      id: `${noteId}:es-en`,
      noteId,
      prompt: spanish,
      answer: english,
      direction: 'es-en',
      context,
      scene,
      schedule: newSchedule(),
    },
  ]

  if (note.bidirectional) {
    cards.push({
      id: `${noteId}:en-es`,
      noteId,
      prompt: note.reversePrompt?.trim() || english,
      answer: note.reverseAnswer?.trim() || spanish,
      direction: 'en-es',
      context,
      scene,
      schedule: newSchedule(),
    })
  }

  return cards
}

export function nextIntervalDays(
  schedule: ReviewSchedule,
  grade: Grade,
): number {
  switch (grade) {
    case 'again':
      return 0
    case 'hard':
      return Math.max(1, Math.round(schedule.intervalDays * 1.2))
    case 'good':
      return Math.max(3, Math.round(schedule.intervalDays * 2.3))
    case 'easy':
      return Math.max(7, Math.round(schedule.intervalDays * 3.2))
  }
}

export function scheduleReview(
  card: StudyCard,
  grade: Grade,
  now: number,
): StudyCard {
  const intervalDays = nextIntervalDays(card.schedule, grade)
  const dueAt = grade === 'again' ? now + 60_000 : now + intervalDays * DAY

  return {
    ...card,
    schedule: {
      dueAt,
      intervalDays,
      reviews: card.schedule.reviews + 1,
      lapses: card.schedule.lapses + (grade === 'again' ? 1 : 0),
    },
  }
}

export function isDue(card: StudyCard, now: number): boolean {
  return card.schedule.dueAt <= now
}

export function intervalLabel(card: StudyCard, grade: Grade): string {
  if (grade === 'again') return '< 1 min'
  const days = nextIntervalDays(card.schedule, grade)
  return days === 1 ? '1 day' : `${days} days`
}
