import { z } from 'zod'

export const grades = ['again', 'hard', 'good', 'easy'] as const
export const directions = ['es-en', 'en-es'] as const
export const scenes = ['conversation', 'metro', 'takeaway'] as const

export const gradeSchema = z.enum(grades)
export const directionSchema = z.enum(directions)
export const sceneSchema = z.enum(scenes)

export const reviewScheduleSchema = z.object({
  dueAt: z.number(),
  intervalDays: z.number(),
  reviews: z.number(),
  lapses: z.number(),
})

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
  reversePrompt: z.string().optional(),
  reverseAnswer: z.string().optional(),
})

export type Grade = z.infer<typeof gradeSchema>
export type Direction = z.infer<typeof directionSchema>
export type Scene = z.infer<typeof sceneSchema>
export type ReviewSchedule = z.infer<typeof reviewScheduleSchema>
export type StudyCard = z.infer<typeof studyCardSchema>
export type StudyCardCollection = z.infer<typeof studyCardCollectionSchema>
export type NewNote = z.infer<typeof newNoteSchema>

const DAY = 24 * 60 * 60 * 1000

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
