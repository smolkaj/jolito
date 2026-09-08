import { beforeEach, expect, it } from 'vitest'
import { LocalPendingCardRepository } from './pending-card'

beforeEach(() => localStorage.clear())

it('restores the same card identity across tabs and reloads until saved or cancelled', () => {
  const card = {
    id: 'draft-1',
    createdAt: 123,
    spanish: 'buen provecho',
    english: 'Enjoy your meal',
    context: '',
    bidirectional: true,
  }
  new LocalPendingCardRepository(localStorage).save(card)
  const anotherTab = new LocalPendingCardRepository(localStorage)
  expect(anotherTab.load()).toEqual(card)
  anotherTab.clear()
  expect(anotherTab.load()).toBeNull()
})

it('reports corrupt or unsupported drafts without overwriting them', () => {
  localStorage.setItem('jolito-pending-card-v1', '{broken')
  expect(() => new LocalPendingCardRepository(localStorage).load()).toThrow()
  expect(localStorage.getItem('jolito-pending-card-v1')).toBe('{broken')
  localStorage.setItem('jolito-pending-card-v1', JSON.stringify({ version: 2 }))
  expect(() => new LocalPendingCardRepository(localStorage).load()).toThrow()
})
