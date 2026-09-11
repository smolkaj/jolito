import { expect, it, vi } from 'vitest'
import { createStudyCards, updateStudyCard } from '../domain/card'
import type { ReconciledDeck, SyncStatus } from '../domain/sync'
import type { SyncResult } from './ports'
import { DeckSyncCoordinator } from './sync-coordinator'

const user = { id: 'a', email: 'a@example.com' }
const card = createStudyCards(
  { spanish: 'hola', english: 'hello', context: '', bidirectional: false },
  'note',
  0,
)[0]!
function harness() {
  let local: ReconciledDeck = { cards: [card], deletedCardIds: [] }
  const releases: Array<(result: SyncResult) => void> = []
  const syncDeck = vi.fn(
    () => new Promise<SyncResult>((resolve) => releases.push(resolve)),
  )
  const status = vi.fn<(value: SyncStatus) => void>()
  const save = vi.fn((deck: ReconciledDeck) => {
    local = deck
    return true
  })
  const coordinator = new DeckSyncCoordinator(
    user,
    { syncDeck, pullDeck: vi.fn() },
    () => local,
    save,
    status,
  )
  return {
    coordinator,
    syncDeck,
    status,
    save,
    local: () => local,
    change: (deck: ReconciledDeck) => {
      local = deck
    },
    release: (index: number, result: SyncResult) => releases[index]!(result),
  }
}
const success = (deck: ReconciledDeck): SyncResult => ({
  success: true,
  ...deck,
  revision: 1,
})
const tick = () => new Promise<void>((resolve) => queueMicrotask(resolve))

it('serializes manual, lifecycle and mutation triggers and confirms changes made during the request', async () => {
  const h = harness()
  const first = h.coordinator.request()
  const concurrent = h.coordinator.request()
  const edited = updateStudyCard(card, {
    prompt: 'buenas',
    answer: 'hi',
    context: '',
  })
  h.change({ cards: [edited], deletedCardIds: [] })
  const mutation = h.coordinator.request()
  expect(h.syncDeck).toHaveBeenCalledTimes(1)
  h.release(0, success({ cards: [card], deletedCardIds: [] }))
  await tick()
  expect(h.local().cards).toEqual([edited])
  expect(h.status).not.toHaveBeenCalledWith('synced')
  expect(h.syncDeck).toHaveBeenCalledTimes(2)
  expect(h.syncDeck.mock.calls[1]).toEqual([
    [edited],
    user,
    [],
    expect.any(AbortSignal),
  ])
  h.release(1, success(h.local()))
  expect(
    (await Promise.all([first, concurrent, mutation])).every((r) => r.success),
  ).toBe(true)
  expect(h.status.mock.calls).toEqual([['syncing'], ['synced']])
})

it('drains an in-flight local deletion before its debounce trigger fires', async () => {
  const h = harness()
  const done = h.coordinator.request()
  h.change({ cards: [], deletedCardIds: [card.id] })
  h.release(0, success({ cards: [card], deletedCardIds: [] }))
  await tick()
  expect(h.local()).toEqual({ cards: [], deletedCardIds: [card.id] })
  expect(h.syncDeck).toHaveBeenCalledTimes(2)
  h.release(1, success(h.local()))
  expect((await done).success).toBe(true)
})

it('merges remote additions into local persistence before reporting success', async () => {
  const h = harness()
  const remote = { ...card, id: 'remote' }
  const done = h.coordinator.request()
  h.release(0, success({ cards: [card, remote], deletedCardIds: [] }))
  expect((await done).cards).toEqual([card, remote])
  expect(h.local().cards).toEqual([card, remote])
  expect(h.syncDeck).toHaveBeenCalledTimes(1)
})

it('preserves local changes across an offline failure and explicit wake/retry', async () => {
  const h = harness()
  const first = h.coordinator.request()
  h.release(0, { success: false, error: 'Offline' })
  expect((await first).success).toBe(false)
  expect(h.local().cards).toEqual([card])
  expect(h.save).not.toHaveBeenCalled()
  const resumed = h.coordinator.request()
  h.release(1, success(h.local()))
  expect((await resumed).success).toBe(true)
  expect(h.status.mock.calls).toEqual([
    ['syncing'],
    ['error'],
    ['syncing'],
    ['synced'],
  ])
})

it.each([
  success({ cards: [card], deletedCardIds: [] }),
  { success: false, error: 'late error' },
])(
  'has no persistence, status, or network activity after disposal, even when transport ignores cancellation',
  async (result) => {
    const h = harness()
    const done = h.coordinator.request()
    void h.coordinator.request()
    h.coordinator.dispose()
    const signal = (
      h.syncDeck.mock.calls[0] as unknown as [
        unknown,
        unknown,
        unknown,
        AbortSignal,
      ]
    )[3]
    expect(signal.aborted).toBe(true)
    h.release(0, result)
    expect((await done).success).toBe(false)
    expect((await h.coordinator.request()).success).toBe(false)
    expect(h.save).not.toHaveBeenCalled()
    expect(h.status.mock.calls).toEqual([['syncing']])
    expect(h.syncDeck).toHaveBeenCalledTimes(1)
  },
)

it('does not report success when local persistence rejects a confirmed cloud snapshot', async () => {
  const h = harness()
  h.save.mockReturnValueOnce(false)
  const done = h.coordinator.request()
  h.release(0, success(h.local()))
  expect(await done).toMatchObject({
    success: false,
    error: expect.stringContaining('could not be saved') as string,
  })
  expect(h.status).toHaveBeenLastCalledWith('error')
})

it('rejects incomplete successful responses without discarding local data', async () => {
  const h = harness()
  const done = h.coordinator.request()
  h.release(0, { success: true, cards: [] })
  expect((await done).success).toBe(false)
  expect(h.save).not.toHaveBeenCalled()
})
