import { describe, expect, it } from 'vitest'
import type { Direction, StudyCard } from './card'
import {
  findDuplicateCards,
  findDuplicateNoteCards,
  getDuplicateGroups,
  normalizeCardKey,
} from './duplicate'

function makeCard(params: {
  id: string
  noteId: string
  prompt: string
  answer: string
  direction: Direction
  dueAt?: number
  intervalDays?: number
  reviews?: number
}): StudyCard {
  return {
    id: params.id,
    noteId: params.noteId,
    prompt: params.prompt,
    answer: params.answer,
    direction: params.direction,
    context: '',
    scene: 'conversation',
    schedule: {
      state: params.reviews && params.reviews > 0 ? 'review' : 'new',
      dueAt: params.dueAt ?? 1000,
      intervalDays: params.intervalDays ?? 0,
      easeFactor: 2.5,
      reviews: params.reviews ?? 0,
      lapses: 0,
    },
    createdAt: 0,
  }
}

describe('domain/duplicate', () => {
  describe('normalizeCardKey', () => {
    it('normalizes diacritics, inverted punctuation, whitespace, and case', () => {
      expect(normalizeCardKey('¡Qué padre!', 'es-en')).toBe('es-en:que padre')
      expect(normalizeCardKey('  que padre  ', 'es-en')).toBe('es-en:que padre')
      expect(normalizeCardKey('¿Aguacate?', 'es-en')).toBe('es-en:aguacate')
      expect(normalizeCardKey('Avocado / Butter fruit', 'en-es')).toBe(
        'en-es:avocado butter fruit',
      )
    })
  })

  describe('findDuplicateCards', () => {
    const card1 = makeCard({
      id: 'note-1:es-en',
      noteId: 'note-1',
      prompt: '¡Qué padre!',
      answer: 'How cool',
      direction: 'es-en',
    })
    const card2 = makeCard({
      id: 'note-2:es-en',
      noteId: 'note-2',
      prompt: 'aguacate',
      answer: 'avocado',
      direction: 'es-en',
    })
    const card3 = makeCard({
      id: 'note-1:en-es',
      noteId: 'note-1',
      prompt: 'How cool',
      answer: '¡Qué padre!',
      direction: 'en-es',
    })

    const cards = [card1, card2, card3]

    it('finds exact normalized prompt matches in the same direction', () => {
      const matches = findDuplicateCards(cards, {
        prompt: 'que padre',
        direction: 'es-en',
      })
      expect(matches).toHaveLength(1)
      expect(matches[0]?.id).toBe('note-1:es-en')
    })

    it('does not match cards in a different direction', () => {
      const matches = findDuplicateCards(cards, {
        prompt: 'How cool',
        direction: 'es-en', // card3 is en-es
      })
      expect(matches).toHaveLength(0)
    })

    it('excludes specified card ID (useful when editing)', () => {
      const matches = findDuplicateCards(cards, {
        prompt: '¡Qué padre!',
        direction: 'es-en',
        excludeCardId: 'note-1:es-en',
      })
      expect(matches).toHaveLength(0)
    })

    it('returns empty array when prompt is blank or whitespace', () => {
      expect(
        findDuplicateCards(cards, { prompt: '   ', direction: 'es-en' }),
      ).toEqual([])
    })
  })

  describe('findDuplicateNoteCards', () => {
    const card1 = makeCard({
      id: 'note-1:es-en',
      noteId: 'note-1',
      prompt: 'ahorita',
      answer: 'right now',
      direction: 'es-en',
    })
    const card2 = makeCard({
      id: 'note-1:en-es',
      noteId: 'note-1',
      prompt: 'right now',
      answer: 'ahorita',
      direction: 'en-es',
    })
    const cards = [card1, card2]

    it('identifies duplicate Spanish and English cards for a bidirectional note candidate', () => {
      const result = findDuplicateNoteCards(cards, {
        spanish: '¡Ahorita!',
        english: 'Right now',
        bidirectional: true,
      })
      expect(result.spanishDuplicates).toHaveLength(1)
      expect(result.spanishDuplicates[0]?.id).toBe('note-1:es-en')
      expect(result.englishDuplicates).toHaveLength(1)
      expect(result.englishDuplicates[0]?.id).toBe('note-1:en-es')
    })

    it('does not check English prompt duplicates for unidirectional (es-en only) cards', () => {
      const result = findDuplicateNoteCards(cards, {
        spanish: 'nueva palabra',
        english: 'Right now',
        bidirectional: false,
      })
      expect(result.spanishDuplicates).toHaveLength(0)
      expect(result.englishDuplicates).toHaveLength(0)
    })

    it('excludes matches from the same noteId when editing', () => {
      const result = findDuplicateNoteCards(cards, {
        spanish: 'ahorita',
        english: 'right now',
        bidirectional: true,
        excludeNoteId: 'note-1',
      })
      expect(result.spanishDuplicates).toHaveLength(0)
      expect(result.englishDuplicates).toHaveLength(0)
    })
  })

  describe('getDuplicateGroups', () => {
    it('groups cards that share the same normalized prompt key', () => {
      const c1 = makeCard({
        id: 'c1',
        noteId: 'n1',
        prompt: 'chela',
        answer: 'beer',
        direction: 'es-en',
      })
      const c2 = makeCard({
        id: 'c2',
        noteId: 'n2',
        prompt: 'Chela!',
        answer: 'cold beer',
        direction: 'es-en',
      })
      const c3 = makeCard({
        id: 'c3',
        noteId: 'n3',
        prompt: 'aguacate',
        answer: 'avocado',
        direction: 'es-en',
      })

      const groups = getDuplicateGroups([c1, c2, c3])
      expect(groups.size).toBe(1)
      expect(groups.get('es-en:chela')).toHaveLength(2)
      expect(groups.has('es-en:aguacate')).toBe(false)
    })
  })
})
