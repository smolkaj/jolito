import { beforeEach, expect, it, vi } from 'vitest'
import { LocalStorageCardRepository } from './card-repository'
import { createStudyCards } from '../../domain/card'

const cards = (owner: string) =>
  createStudyCards(
    { spanish: owner, english: owner, context: '', bidirectional: false },
    owner,
    0,
  )
beforeEach(() => localStorage.clear())

it('migrates the legacy deck to its pre-redirect owner, preserves other owners across interleaved writes and reload', () => {
  const raw = JSON.stringify({
    version: 3,
    cards: cards('A'),
    deletedCardIds: ['removed-A'],
  })
  localStorage.setItem('jolito-library-v1', raw)
  const repository = new LocalStorageCardRepository(localStorage, 'A')
  const a = repository.forOwner('A')
  const b = repository.forOwner('B')
  expect(b.load([]).cards).toEqual([])
  expect(a.load([]).cards).toEqual(cards('A'))
  b.save(cards('B'), ['removed-B'])
  a.save(cards('A-new'))
  expect(
    new LocalStorageCardRepository(localStorage, 'B').forOwner('B').load([])
      .cards,
  ).toEqual(cards('B'))
  const reloadedA = new LocalStorageCardRepository(localStorage, 'B').forOwner(
    'A',
  )
  expect(reloadedA.load([]).cards).toEqual(cards('A-new'))
  expect(reloadedA.getDeletedCardIds()).toEqual(['removed-A'])
  expect(localStorage.getItem('jolito-library-v1')).toBe(raw)
})

it('never claims a guest legacy deck for a newly authenticated account', () => {
  localStorage.setItem(
    'jolito-library-v1',
    JSON.stringify({ version: 3, cards: cards('guest') }),
  )
  const repo = new LocalStorageCardRepository(localStorage, null)
  expect(repo.forOwner('new-user').load([]).cards).toEqual([])
  expect(repo.forOwner(null).load([]).cards).toEqual(cards('guest'))
})

it('leaves ownership uncommitted on quota failure and retries using the original owner', () => {
  const raw = JSON.stringify({ version: 3, cards: cards('A') })
  localStorage.setItem('jolito-library-v1', raw)
  const storage = {
    getItem: localStorage.getItem.bind(localStorage),
    setItem: vi.fn(localStorage.setItem.bind(localStorage)),
  }
  storage.setItem.mockImplementationOnce(() => {
    throw new Error('Full')
  })
  const b = new LocalStorageCardRepository(storage, 'A').forOwner('B')
  expect(b.load([])).toMatchObject({
    status: 'recovery',
    reason: 'migration-failed',
    raw,
  })
  expect(() => b.save(cards('B'))).toThrow()
  expect(localStorage.getItem('jolito-library-v1')).toBe(raw)
  expect(b.load([]).cards).toEqual([])
  expect(
    new LocalStorageCardRepository(storage, 'B').forOwner('A').load([]).cards,
  ).toEqual(cards('A'))
})

it('treats prototype-like account IDs as ordinary isolated keys', () => {
  const repo = new LocalStorageCardRepository(localStorage)
  for (const owner of ['__proto__', 'constructor', 'toString']) {
    repo.forOwner(owner).save(cards(owner))
  }
  for (const owner of ['__proto__', 'constructor', 'toString']) {
    expect(repo.forOwner(owner).load([]).cards).toEqual(cards(owner))
  }
  expect(repo.forOwner('other').load([]).cards).toEqual([])
})

it('forgets only its captured owner after another owner writes, and never resurrects legacy bytes', () => {
  localStorage.setItem(
    'jolito-library-v1',
    JSON.stringify({ version: 3, cards: cards('A') }),
  )
  const repo = new LocalStorageCardRepository(localStorage, 'A')
  const a = repo.forOwner('A')
  a.load([])
  repo.forOwner('B').save(cards('B'))
  a.setPendingDeletion('requested')
  a.setPendingDeletion('confirmed')
  a.forget()
  expect(localStorage.getItem('jolito-library-v1')).toBeNull()
  expect(
    new LocalStorageCardRepository(localStorage, 'B').forOwner('A').load([])
      .cards,
  ).toEqual([])
  expect(repo.forOwner('B').load([]).cards).toEqual(cards('B'))
})

it.each(['requested', 'confirmed', 'cleanup'] as const)(
  'preserves the receipt and both owners across failed %s writes, reload and retry',
  (phase) => {
    const storage = {
      getItem: localStorage.getItem.bind(localStorage),
      setItem: vi.fn(localStorage.setItem.bind(localStorage)),
      removeItem: localStorage.removeItem.bind(localStorage),
    }
    const a = new LocalStorageCardRepository(storage, 'A')
    a.save(cards('A'))
    a.forOwner('B').save(cards('B'))
    if (phase !== 'requested') a.setPendingDeletion('requested')
    if (phase === 'cleanup') a.setPendingDeletion('confirmed')
    storage.setItem.mockImplementationOnce(() => {
      throw new DOMException('Quota', 'QuotaExceededError')
    })
    expect(() =>
      phase === 'cleanup' ? a.forget() : a.setPendingDeletion(phase),
    ).toThrow()
    const reloaded = new LocalStorageCardRepository(storage, 'B')
    expect(reloaded.forOwner('A').load([]).cards).toEqual(cards('A'))
    expect(reloaded.load([]).cards).toEqual(cards('B'))
    const receipt = reloaded.getPendingDeletion()
    expect(receipt?.phase ?? null).toBe(
      phase === 'requested'
        ? null
        : phase === 'confirmed'
          ? 'requested'
          : 'confirmed',
    )
    if (receipt)
      expect(() => reloaded.forOwner('A').save(cards('stale-A'))).toThrow()
    if (phase === 'confirmed') {
      expect(() => reloaded.forOwner('A').forget()).toThrow()
      reloaded.forOwner('A').setPendingDeletion(null)
      expect(reloaded.forOwner('A').load([]).cards).toEqual(cards('A'))
    }
    if (phase === 'cleanup') {
      reloaded.save(cards('B-new'))
      reloaded.forOwner('A').forget()
      expect(reloaded.getPendingDeletion()).toBeNull()
      expect(reloaded.forOwner('A').load([]).cards).toEqual([])
      expect(reloaded.load([]).cards).toEqual(cards('B-new'))
    }
  },
)
