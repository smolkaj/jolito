import { describe, expect, it } from 'vitest'
import type { StudyCard } from '../domain/card'
import { createDeckBackup, restoreDeckFromBackup } from './deck-backup'
import type { Clock } from './ports'

const mockClock: Clock = {
  now: () => new Date('2026-08-23T14:30:00.000Z').getTime(),
}

const cardA: StudyCard = {
  id: 'card-a',
  noteId: 'note-a',
  prompt: 'Hola',
  answer: 'Hello',
  direction: 'es-en',
  context: '',
  scene: 'conversation',
  schedule: {
    state: 'new',
    dueAt: 1000,
    intervalDays: 0,
    easeFactor: 2.5,
    reviews: 0,
    lapses: 0,
  },
  createdAt: 1000,
}

const cardB: StudyCard = {
  id: 'card-b',
  noteId: 'note-b',
  prompt: 'Adiós',
  answer: 'Goodbye',
  direction: 'es-en',
  context: '',
  scene: 'conversation',
  schedule: {
    state: 'review',
    dueAt: 2000,
    intervalDays: 5,
    easeFactor: 2.6,
    reviews: 3,
    lapses: 0,
  },
  createdAt: 2000,
}

describe('createDeckBackup', () => {
  it('creates structured backup JSON with timestamp and date-based filename', () => {
    const backup = createDeckBackup([cardA, cardB], mockClock)
    expect(backup.filename).toBe('jolito-deck-2026-08-23.json')

    const parsed = JSON.parse(backup.json) as {
      version: number
      app: string
      exportedAt: string
      cards: StudyCard[]
    }
    expect(parsed.version).toBe(1)
    expect(parsed.app).toBe('jolito')
    expect(parsed.exportedAt).toBe('2026-08-23T14:30:00.000Z')
    expect(parsed.cards).toHaveLength(2)
    expect(parsed.cards[0]?.id).toBe('card-a')
  })
})

describe('restoreDeckFromBackup', () => {
  it('replaces entire current deck when mode is replace', () => {
    const backupJson = JSON.stringify({
      version: 1,
      cards: [cardB],
    })

    const result = restoreDeckFromBackup([cardA], backupJson, 'replace')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.cards).toHaveLength(1)
      expect(result.cards[0]?.id).toBe('card-b')
      expect(result.importedCount).toBe(1)
    }
  })

  it('merges with existing deck when mode is merge', () => {
    const backupJson = JSON.stringify({
      version: 1,
      cards: [cardB],
    })

    const result = restoreDeckFromBackup([cardA], backupJson, 'merge')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.cards).toHaveLength(2)
      expect(result.cards.map((c) => c.id)).toEqual(['card-a', 'card-b'])
      expect(result.importedCount).toBe(1)
    }
  })

  it('returns failure when backup JSON is invalid', () => {
    const result = restoreDeckFromBackup([cardA], 'invalid json', 'replace')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('Invalid JSON format')
    }
  })
})
