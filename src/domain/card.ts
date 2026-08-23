import { z } from 'zod'

export const grades = ['again', 'hard', 'good', 'easy'] as const
export const directions = ['es-en', 'en-es'] as const
export const scenes = ['conversation', 'metro', 'takeaway'] as const
export const cardStates = ['new', 'learning', 'review', 'relearning'] as const

export const gradeSchema = z.enum(grades)
export const directionSchema = z.enum(directions)
export const sceneSchema = z.enum(scenes)
export const cardStateSchema = z.enum(cardStates)

export const reviewScheduleSchema = z.preprocess(
  (val) => {
    if (typeof val === 'object' && val !== null) {
      const raw = val as Record<string, unknown>
      const intervalDays =
        typeof raw.intervalDays === 'number' ? raw.intervalDays : 0
      const reviews = typeof raw.reviews === 'number' ? raw.reviews : 0
      const state =
        raw.state ?? (reviews > 0 && intervalDays > 0 ? 'review' : 'new')
      const easeFactor =
        typeof raw.easeFactor === 'number' ? raw.easeFactor : 2.5
      return {
        ...raw,
        state,
        easeFactor,
      }
    }
    return val
  },
  z.object({
    state: cardStateSchema.default('new'),
    dueAt: z.number(),
    intervalDays: z.number(),
    easeFactor: z.number().default(2.5),
    reviews: z.number(),
    lapses: z.number(),
  }),
)

export const studyCardSchema = z.object({
  id: z.string().min(1),
  noteId: z.string().min(1),
  prompt: z.string().trim().min(1),
  answer: z.string().trim().min(1),
  direction: directionSchema,
  context: z.string(),
  scene: sceneSchema,
  schedule: reviewScheduleSchema,
})

export const studyCardCollectionSchema = z.object({
  version: z.literal(1),
  cards: z.array(studyCardSchema),
})

export const newNoteSchema = z.object({
  spanish: z.string().trim().min(1),
  english: z.string().trim().min(1),
  context: z.string(),
  bidirectional: z.boolean(),
  scene: sceneSchema.optional(),
  reversePrompt: z.string().optional(),
  reverseAnswer: z.string().optional(),
})

export type Grade = z.infer<typeof gradeSchema>
export type Direction = z.infer<typeof directionSchema>
export type Scene = z.infer<typeof sceneSchema>
export type CardState = z.infer<typeof cardStateSchema>
export type ReviewSchedule = z.infer<typeof reviewScheduleSchema>
export type StudyCard = z.infer<typeof studyCardSchema>
export type StudyCardCollection = z.infer<typeof studyCardCollectionSchema>
export type NewNote = z.infer<typeof newNoteSchema>

const DAY = 24 * 60 * 60 * 1000
const MINUTE = 60 * 1000
const MIN_EASE_FACTOR = 1.3
const INITIAL_EASE_FACTOR = 2.5

const sceneMatchers: ReadonlyArray<[Scene, RegExp]> = [
  [
    'metro',
    /(?:^|\P{L})(metro|metrob[uú]s|tren|bus|station|estaci[oó]n)(?:\P{L}|$)/iu,
  ],
  [
    'takeaway',
    /(?:^|\P{L})(caf[eé]|coffee|comida|food|restaurante|restaurant|llevar|takeaway|to go)(?:\P{L}|$)/iu,
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
  const scene = note.scene ?? chooseScene(spanish, english, context)
  const newSchedule = (): ReviewSchedule => ({
    state: 'new',
    dueAt: now,
    intervalDays: 0,
    easeFactor: INITIAL_EASE_FACTOR,
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
  if (grade === 'again') return 0

  if (schedule.state === 'new' || schedule.state === 'learning') {
    switch (grade) {
      case 'hard':
        return 1
      case 'good':
        return 1
      case 'easy':
        return 4
    }
  }

  if (schedule.state === 'relearning') {
    switch (grade) {
      case 'hard':
        return 1
      case 'good':
        return 1
      case 'easy':
        return Math.max(2, Math.round(schedule.intervalDays * 1.5))
    }
  }

  // Graduated review state (Anki SM-2)
  const interval = schedule.intervalDays
  const ease = schedule.easeFactor
  switch (grade) {
    case 'hard':
      return Math.max(interval + 1, Math.round(interval * 1.2))
    case 'good':
      return Math.max(interval + 1, Math.round(interval * ease))
    case 'easy':
      return Math.max(interval + 2, Math.round(interval * ease * 1.3))
  }
}

export function shouldRequeueInSession(
  schedule: ReviewSchedule,
  grade: Grade,
): boolean {
  return (
    grade === 'again' ||
    (schedule.state === 'learning' && nextIntervalDays(schedule, grade) === 0)
  )
}

export function scheduleReview(
  card: StudyCard,
  grade: Grade,
  now: number,
): StudyCard {
  const current = card.schedule
  const reviews = current.reviews + 1

  if (grade === 'again') {
    const isLapse = current.state === 'review'
    const lapses = current.lapses + (isLapse ? 1 : 0)
    const easeFactor = isLapse
      ? Math.max(MIN_EASE_FACTOR, +(current.easeFactor - 0.2).toFixed(2))
      : current.easeFactor

    return {
      ...card,
      schedule: {
        state:
          isLapse || current.state === 'relearning' ? 'relearning' : 'learning',
        dueAt: now + MINUTE,
        intervalDays: 0,
        easeFactor,
        reviews,
        lapses,
      },
    }
  }

  if (
    current.state === 'new' ||
    current.state === 'learning' ||
    current.state === 'relearning'
  ) {
    const intervalDays = nextIntervalDays(current, grade)
    return {
      ...card,
      schedule: {
        state: 'review',
        dueAt: now + intervalDays * DAY,
        intervalDays,
        easeFactor: current.easeFactor,
        reviews,
        lapses: current.lapses,
      },
    }
  }

  // Graduated review card updates
  let easeFactor = current.easeFactor
  if (grade === 'hard') {
    easeFactor = Math.max(
      MIN_EASE_FACTOR,
      +(current.easeFactor - 0.15).toFixed(2),
    )
  } else if (grade === 'easy') {
    easeFactor = +(current.easeFactor + 0.15).toFixed(2)
  }

  const intervalDays = nextIntervalDays(current, grade)
  return {
    ...card,
    schedule: {
      state: 'review',
      dueAt: now + intervalDays * DAY,
      intervalDays,
      easeFactor,
      reviews,
      lapses: current.lapses,
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
