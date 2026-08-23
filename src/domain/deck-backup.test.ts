import { describe, expect, it } from 'vitest'
import type { StudyCard } from './card'
import { mergeStudyCards, parseDeckBackup } from './deck-backup'

const sampleCard1: StudyCard = {
  id: 'note-1:es-en',
  noteId: 'note-1',
  prompt: '¿Dónde está el metro?',
  answer: 'Where is the metro?',
  direction: 'es-en',
  context: 'CDMX transit',
  scene: 'metro',
  schedule: {
    state: 'review',
    dueAt: 1700000000000,
    intervalDays: 4,
    easeFactor: 2.5,
    reviews: 2,
    lapses: 0,
  },
}

const sampleCard2: StudyCard = {
  id: 'note-1:en-es',
  noteId: 'note-1',
  prompt: 'Where is the metro?',
  answer: '¿Dónde está el metro?',
  direction: 'en-es',
  context: 'CDMX transit',
  scene: 'metro',
  schedule: {
    state: 'new',
    dueAt: 1700000000000,
    intervalDays: 0,
    easeFactor: 2.5,
    reviews: 0,
    lapses: 0,
  },
}

const sampleCard3: StudyCard = {
  id: 'note-2:es-en',
  noteId: 'note-2',
  prompt: 'Para llevar, por favor',
  answer: 'To go, please',
  direction: 'es-en',
  context: 'Ordering coffee',
  scene: 'takeaway',
  schedule: {
    state: 'review',
    dueAt: 1700500000000,
    intervalDays: 7,
    easeFactor: 2.6,
    reviews: 3,
    lapses: 0,
  },
}

describe('parseDeckBackup', () => {
  it('parses valid v1 deck backup JSON with metadata envelope', () => {
    const backupJson = JSON.stringify({
      version: 1,
      app: 'jolito',
      exportedAt: '2026-08-23T12:00:00.000Z',
      cards: [sampleCard1, sampleCard2],
    })

    const result = parseDeckBackup(backupJson)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.cards).toHaveLength(2)
      expect(result.cards[0]?.prompt).toBe('¿Dónde está el metro?')
      expect(result.cards[1]?.direction).toBe('en-es')
      expect(result.exportedAt).toBe('2026-08-23T12:00:00.000Z')
    }
  })

  it('parses raw array of study cards', () => {
    const backupJson = JSON.stringify([sampleCard1, sampleCard3])

    const result = parseDeckBackup(backupJson)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.cards).toHaveLength(2)
      expect(result.cards[1]?.answer).toBe('To go, please')
    }
  })

  it('migrates legacy ritmo cards format', () => {
    const legacyJson = JSON.stringify([
      {
        id: 'legacy-1',
        prompt: '¡Hola!',
        answer: 'Hello!',
        direction: 'es-en',
      },
    ])

    const result = parseDeckBackup(legacyJson)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.cards).toHaveLength(1)
      expect(result.cards[0]?.prompt).toBe('¡Hola!')
      expect(result.cards[0]?.answer).toBe('Hello!')
      expect(result.cards[0]?.direction).toBe('es-en')
      expect(result.cards[0]?.schedule.state).toBe('new')
    }
  })

  it('fails with structured error when JSON syntax is invalid', () => {
    const invalidJson = '{ not valid json: true'

    const result = parseDeckBackup(invalidJson)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/invalid json/i)
    }
  })

  it('fails with structured error when cards schema is invalid or corrupted in envelope', () => {
    const corruptedJson = JSON.stringify({
      version: 1,
      cards: [
        {
          id: 'card-1',
          // missing prompt, answer, direction
          schedule: { state: 'unknown' },
        },
      ],
    })

    const result = parseDeckBackup(corruptedJson)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/invalid card/i)
      expect(result.details).toBeDefined()
      expect(result.details?.length).toBeGreaterThan(0)
    }
  })

  it('fails with structured error when raw card array contains malformed items', () => {
    const corruptedArray = JSON.stringify([
      {
        id: 'card-1',
        prompt: 123,
      },
    ])

    const result = parseDeckBackup(corruptedArray)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/invalid card/i)
      expect(result.details).toBeDefined()
    }
  })

  it('fails with structured error when input is primitive or non-object JSON', () => {
    const primitiveJson = JSON.stringify('plain string')

    const result = parseDeckBackup(primitiveJson)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/invalid card/i)
    }
  })
})

describe('mergeStudyCards', () => {
  it('combines existing cards and incoming cards without duplicate IDs, favoring incoming card data', () => {
    const existing = [sampleCard1, sampleCard2]
    const updatedCard1: StudyCard = {
      ...sampleCard1,
      prompt: '¿Dónde queda el metro?',
      schedule: {
        ...sampleCard1.schedule,
        reviews: 5,
        intervalDays: 12,
      },
    }
    const incoming = [updatedCard1, sampleCard3]

    const merged = mergeStudyCards(existing, incoming)
    expect(merged).toHaveLength(3)

    const mergedCard1 = merged.find((c) => c.id === sampleCard1.id)
    expect(mergedCard1?.prompt).toBe('¿Dónde queda el metro?')
    expect(mergedCard1?.schedule.reviews).toBe(5)

    const mergedCard2 = merged.find((c) => c.id === sampleCard2.id)
    expect(mergedCard2).toBeDefined()

    const mergedCard3 = merged.find((c) => c.id === sampleCard3.id)
    expect(mergedCard3?.prompt).toBe('Para llevar, por favor')
  })
})
