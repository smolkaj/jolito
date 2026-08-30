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
    lastReviewedAt: z.number().optional(),
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
  createdAt: z.number().default(0),
})

export const studyCardCollectionSchema = z.object({
  version: z.literal(1),
  cards: z.array(studyCardSchema),
  deletedCardIds: z.array(z.string()).default([]),
})

export const newNoteSchema = z.object({
  spanish: z.string().trim().min(1),
  english: z.string().trim().min(1),
  context: z.string(),
  bidirectional: z.boolean(),
  reversePrompt: z.string().optional(),
  reverseAnswer: z.string().optional(),
})

export const updateCardSchema = z.object({
  prompt: z.string().trim().min(1).optional(),
  answer: z.string().trim().min(1).optional(),
  context: z.string().optional(),
  resetProgress: z.boolean().optional(),
})

export type Grade = z.infer<typeof gradeSchema>
export type Direction = z.infer<typeof directionSchema>
export type Scene = z.infer<typeof sceneSchema>
export type CardState = z.infer<typeof cardStateSchema>
export type ReviewSchedule = z.infer<typeof reviewScheduleSchema>
export type StudyCard = z.infer<typeof studyCardSchema>
export type StudyCardCollection = z.infer<typeof studyCardCollectionSchema>
export type NewNote = z.infer<typeof newNoteSchema>
export type UpdateCardParams = z.infer<typeof updateCardSchema>

export const DAY = 24 * 60 * 60 * 1000
export const MINUTE = 60 * 1000
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

export function createNewReviewSchedule(
  now: number,
  offsetMs: number = 0,
): ReviewSchedule {
  return {
    state: 'new',
    dueAt: now + offsetMs,
    intervalDays: 0,
    easeFactor: INITIAL_EASE_FACTOR,
    reviews: 0,
    lapses: 0,
  }
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
  const cards: StudyCard[] = [
    {
      id: `${noteId}:es-en`,
      noteId,
      prompt: spanish,
      answer: english,
      direction: 'es-en',
      context,
      scene,
      schedule: createNewReviewSchedule(now),
      createdAt: now,
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
      schedule: createNewReviewSchedule(now, DAY),
      createdAt: now,
    })
  }

  return cards
}

export function nextIntervalDays(
  schedule: ReviewSchedule,
  grade: Grade,
): number {
  if (grade === 'again') return 0

  if (schedule.state === 'new') {
    if (grade === 'easy') return 4
    return 0 // Learning steps (<1m, <6m, <10m) are in-session
  }

  if (schedule.state === 'learning') {
    switch (grade) {
      case 'hard':
        return 0 // Repeats 10m learning step in-session
      case 'good':
        return 1 // Graduates with 1-day interval
      case 'easy':
        return 4 // Graduates with 4-day easy interval
    }
  }

  if (schedule.state === 'relearning') {
    switch (grade) {
      case 'hard':
        return 1
      case 'good':
        return 1
      case 'easy':
        return Math.max(4, Math.round(schedule.intervalDays * 1.5))
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

export function shouldRequeueInSession(schedule: ReviewSchedule): boolean {
  return schedule.state === 'learning' || schedule.state === 'relearning'
}

export function scheduleReview(
  card: StudyCard,
  grade: Grade,
  now: number,
): StudyCard {
  const current = card.schedule
  const reviews = current.reviews + 1

  let updatedSchedule: ReviewSchedule

  if (grade === 'again') {
    const isLapse = current.state === 'review'
    const lapses = current.lapses + (isLapse ? 1 : 0)
    const easeFactor = isLapse
      ? Math.max(MIN_EASE_FACTOR, +(current.easeFactor - 0.2).toFixed(2))
      : current.easeFactor

    updatedSchedule = {
      state:
        isLapse || current.state === 'relearning' ? 'relearning' : 'learning',
      dueAt: now + (isLapse ? 10 * MINUTE : 1 * MINUTE),
      intervalDays: 0,
      easeFactor,
      reviews,
      lapses,
      lastReviewedAt: now,
    }
  } else if (current.state === 'new') {
    if (grade === 'hard') {
      updatedSchedule = {
        state: 'learning',
        dueAt: now + 6 * MINUTE,
        intervalDays: 0,
        easeFactor: current.easeFactor,
        reviews,
        lapses: current.lapses,
        lastReviewedAt: now,
      }
    } else if (grade === 'good') {
      updatedSchedule = {
        state: 'learning',
        dueAt: now + 10 * MINUTE,
        intervalDays: 0,
        easeFactor: current.easeFactor,
        reviews,
        lapses: current.lapses,
        lastReviewedAt: now,
      }
    } else {
      // grade === 'easy'
      updatedSchedule = {
        state: 'review',
        dueAt: now + 4 * DAY,
        intervalDays: 4,
        easeFactor: current.easeFactor,
        reviews,
        lapses: current.lapses,
        lastReviewedAt: now,
      }
    }
  } else if (current.state === 'learning') {
    if (grade === 'hard') {
      updatedSchedule = {
        state: 'learning',
        dueAt: now + 10 * MINUTE,
        intervalDays: 0,
        easeFactor: current.easeFactor,
        reviews,
        lapses: current.lapses,
        lastReviewedAt: now,
      }
    } else {
      const intervalDays = nextIntervalDays(current, grade)
      updatedSchedule = {
        state: 'review',
        dueAt: now + intervalDays * DAY,
        intervalDays,
        easeFactor: current.easeFactor,
        reviews,
        lapses: current.lapses,
        lastReviewedAt: now,
      }
    }
  } else if (current.state === 'relearning') {
    const intervalDays = nextIntervalDays(current, grade)
    updatedSchedule = {
      state: 'review',
      dueAt: now + intervalDays * DAY,
      intervalDays,
      easeFactor: current.easeFactor,
      reviews,
      lapses: current.lapses,
      lastReviewedAt: now,
    }
  } else {
    // Graduated review card updates (SM-2)
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
    updatedSchedule = {
      state: 'review',
      dueAt: now + intervalDays * DAY,
      intervalDays,
      easeFactor,
      reviews,
      lapses: current.lapses,
      lastReviewedAt: now,
    }
  }

  return {
    ...card,
    schedule: updatedSchedule,
  }
}

export function isDue(card: StudyCard, now: number): boolean {
  return card.schedule.dueAt <= now
}

export function burySiblingCards(
  cards: StudyCard[],
  reviewedCard: StudyCard,
  now: number,
): { updatedCards: StudyCard[]; buriedCardIds: string[] } {
  const buriedCardIds: string[] = []
  const updatedCards = cards.map((card) => {
    if (
      card.noteId === reviewedCard.noteId &&
      card.id !== reviewedCard.id &&
      isDue(card, now)
    ) {
      buriedCardIds.push(card.id)
      return {
        ...card,
        schedule: {
          ...card.schedule,
          dueAt: now + DAY,
        },
      }
    }
    return card
  })
  return { updatedCards, buriedCardIds }
}

export const DEFAULT_STUDY_BATCH_SIZE = 10
export const DEFAULT_ROLLOVER_HOUR = 4

export function orderCardsForReview(
  cards: StudyCard[],
  now: number,
  limit?: number,
): StudyCard[] {
  const due = cards
    .filter((card) => isDue(card, now))
    .sort((left, right) => {
      if (left.direction !== right.direction) {
        return left.direction === 'es-en' ? -1 : 1
      }
      if (left.schedule.dueAt !== right.schedule.dueAt) {
        return left.schedule.dueAt - right.schedule.dueAt
      }
      return left.id.localeCompare(right.id)
    })
  if (typeof limit === 'number' && limit > 0) {
    return due.slice(0, limit)
  }
  return due
}

export function getStudyDayStart(
  now: number,
  rolloverHour: number = DEFAULT_ROLLOVER_HOUR,
): number {
  const date = new Date(now)
  const currentHour = date.getHours()
  const start = new Date(date)
  if (currentHour < rolloverHour) {
    start.setDate(start.getDate() - 1)
  }
  start.setHours(rolloverHour, 0, 0, 0)
  return start.getTime()
}

export function isReviewedToday(
  card: StudyCard,
  now: number,
  rolloverHour: number = DEFAULT_ROLLOVER_HOUR,
): boolean {
  if (card.schedule.lastReviewedAt === undefined) {
    return false
  }
  return card.schedule.lastReviewedAt >= getStudyDayStart(now, rolloverHour)
}

export function getCardsStudiedToday(
  cards: StudyCard[],
  now: number,
  rolloverHour: number = DEFAULT_ROLLOVER_HOUR,
): number {
  const dayStart = getStudyDayStart(now, rolloverHour)
  let count = 0
  for (const card of cards) {
    if (
      card.schedule.lastReviewedAt !== undefined &&
      card.schedule.lastReviewedAt >= dayStart
    ) {
      count++
    }
  }
  return count
}

export function intervalLabel(card: StudyCard, grade: Grade): string {
  const schedule = card.schedule
  if (schedule.state === 'new') {
    switch (grade) {
      case 'again':
        return '< 1 min'
      case 'hard':
        return '< 6 min'
      case 'good':
        return '< 10 min'
      case 'easy':
        return '4 days'
    }
  }

  if (schedule.state === 'learning') {
    switch (grade) {
      case 'again':
        return '< 1 min'
      case 'hard':
        return '< 10 min'
      case 'good':
        return '1 day'
      case 'easy':
        return '4 days'
    }
  }

  if (schedule.state === 'relearning') {
    switch (grade) {
      case 'again':
        return '< 10 min'
      case 'hard':
        return '1 day'
      case 'good':
        return '1 day'
      case 'easy': {
        const days = nextIntervalDays(schedule, 'easy')
        return `${days} days`
      }
    }
  }

  if (grade === 'again') return '< 10 min'
  const days = nextIntervalDays(schedule, grade)
  return days === 1 ? '1 day' : `${days} days`
}

export function resetCardProgress(card: StudyCard, now: number): StudyCard {
  return {
    ...card,
    schedule: createNewReviewSchedule(now),
  }
}

export function updateStudyCard(
  existing: StudyCard,
  updates: UpdateCardParams,
  now: number = Date.now(),
): StudyCard {
  const parsed = updateCardSchema.parse(updates)
  const prompt =
    parsed.prompt !== undefined ? parsed.prompt.trim() : existing.prompt
  const answer =
    parsed.answer !== undefined ? parsed.answer.trim() : existing.answer
  const context =
    parsed.context !== undefined ? parsed.context.trim() : existing.context
  const scene = chooseScene(prompt, answer, context)
  const schedule = parsed.resetProgress
    ? createNewReviewSchedule(now)
    : existing.schedule

  return {
    ...existing,
    prompt,
    answer,
    context,
    scene,
    schedule,
  }
}

export function deleteStudyCard(
  cards: StudyCard[],
  cardIdToDelete: string,
): StudyCard[] {
  return cards.filter((card) => card.id !== cardIdToDelete)
}
