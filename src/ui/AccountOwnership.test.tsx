import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { App } from '../jolito'
import { createTestServices } from '../test/services'
import { LocalStorageCardRepository } from '../infrastructure/browser/card-repository'
import { createStudyCards } from '../domain/card'
import type { SyncResult } from '../application/ports'

const a = { id: 'A', email: 'a@example.com' }
const b = { id: 'B', email: 'b@example.com' }
const cards = (id: string) =>
  createStudyCards(
    { spanish: id, english: id, context: '', bidirectional: false },
    id,
    0,
  )
beforeEach(() => {
  localStorage.clear()
  window.history.replaceState({}, '', '#/deck')
})

it('fences held sync through A → B → signed out → A and reload without mixing outgoing or persisted decks', async () => {
  const repo = new LocalStorageCardRepository(localStorage, a.id)
  repo.forOwner(a.id).save(cards('A-private'))
  repo.forOwner(b.id).save(cards('B-private'))
  const services = createTestServices({ user: a })
  services.cards = repo
  let resolve!: (result: SyncResult) => void
  const original = services.mockSync.syncDeck.bind(services.mockSync)
  const sync = vi
    .spyOn(services.mockSync, 'syncDeck')
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    .mockImplementation(original)
  const mounted = render(<App services={services} />)
  expect(screen.getByRole('row', { name: /card: A-private,/i })).toBeVisible()
  await act(async () => {
    services.mockAuth.setUser(b)
    await Promise.resolve()
  })
  expect(screen.getByRole('row', { name: /card: B-private,/i })).toBeVisible()
  expect(sync.mock.calls[1]?.[0]).toEqual(cards('B-private'))
  await act(async () => {
    services.mockAuth.setUser(null)
    await Promise.resolve()
  })
  expect(screen.queryByRole('row', { name: /private/ })).not.toBeInTheDocument()
  await act(async () => {
    services.mockAuth.setUser(a)
    await Promise.resolve()
  })
  await act(async () => {
    resolve({ success: true, cards: cards('obsolete-cloud-response') })
    await Promise.resolve()
  })
  expect(screen.getByRole('row', { name: /card: A-private,/i })).toBeVisible()
  expect(repo.forOwner(a.id).load([]).cards).toEqual(cards('A-private'))
  expect(repo.forOwner(b.id).load([]).cards).toEqual(cards('B-private'))
  expect(services.mockSync.decks.get(b.id)?.cards).toEqual(cards('B-private'))
  mounted.unmount()
  render(<App services={services} />)
  expect(screen.getByRole('row', { name: /card: A-private,/i })).toBeVisible()
})

it('retains the visible answer and queue across same-account token updates and background events', async () => {
  window.history.replaceState({}, '', '#/review')
  const services = createTestServices({ user: a, cards: cards('A-prompt') })
  render(<App services={services} />)
  const user = userEvent.setup()
  await user.type(screen.getByRole('textbox'), 'unfinished answer')
  const calls = services.mockSync.syncedCount
  act(() => {
    services.mockAuth.setUser({ ...a, email: 'updated@example.com' })
  })
  expect(screen.getByRole('textbox')).toHaveValue('unfinished answer')
  expect(services.mockSync.syncedCount).toBe(calls)
  act(() => {
    fireEvent(document, new Event('visibilitychange'))
  })
  expect(screen.getByRole('textbox')).toHaveValue('unfinished answer')
  await user.keyboard('{Enter}')
  await user.keyboard('4')
  expect(
    services.cards.forOwner(a.id).load([]).cards[0]?.schedule.reviews,
  ).toBe(1)
})

it('keeps local deletion failure visible after auth unmount, then retries only the captured account', async () => {
  const repo = new LocalStorageCardRepository(localStorage, a.id)
  repo.save(cards('A-private'))
  repo.forOwner(b.id).save(cards('B-private'))
  const services = createTestServices({ user: a })
  services.cards = repo
  const mounted = render(<App services={services} />)
  const user = userEvent.setup()
  await user.click(
    await screen.findByRole('button', { name: /deck synced with cloud/i }),
  )
  await user.click(
    screen.getByRole('button', { name: /delete cloud account & data/i }),
  )
  await user.click(
    screen.getByRole('checkbox', { name: /download an offline backup/i }),
  )
  await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE')
  vi.spyOn(repo, 'forget').mockImplementationOnce(() => {
    throw new Error('Storage denied')
  })
  await user.click(
    screen.getByRole('button', { name: /yes, delete cloud data/i }),
  )
  expect(services.auth.getCurrentUser()).toBeNull()
  expect(
    screen.getByText(/cloud account was deleted, but its copy/i),
  ).toBeVisible()
  mounted.unmount()
  const reloaded = createTestServices({ user: b })
  reloaded.cards = new LocalStorageCardRepository(localStorage, b.id)
  render(<App services={reloaded} />)
  expect(
    screen.getByText(/cloud account was deleted, but its copy/i),
  ).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  expect(repo.forOwner(a.id).load([]).cards).toEqual([])
  expect(repo.forOwner(b.id).load([]).cards).toEqual(cards('B-private'))
  expect(screen.getByRole('row', { name: /card: B-private,/i })).toBeVisible()
})

it('does not contact the cloud without a durable request, and keeps unknown outcomes recoverable without deleting local cards', async () => {
  const repo = new LocalStorageCardRepository(localStorage, a.id)
  repo.save(cards('A-private'))
  const services = createTestServices({ user: a })
  services.cards = repo
  const remove = vi.spyOn(services.mockAuth, 'deleteAccount')
  const mounted = render(<App services={services} />)
  const user = userEvent.setup()
  await user.click(
    await screen.findByRole('button', { name: /deck synced with cloud/i }),
  )
  await user.click(
    screen.getByRole('button', { name: /delete cloud account & data/i }),
  )
  await user.click(
    screen.getByRole('checkbox', { name: /download an offline backup/i }),
  )
  await user.type(screen.getByPlaceholderText('DELETE'), 'DELETE')
  vi.spyOn(repo, 'setPendingDeletion').mockImplementationOnce(() => {
    throw new Error('Storage denied')
  })
  await user.click(
    screen.getByRole('button', { name: /yes, delete cloud data/i }),
  )
  expect(screen.getByText(/deletion request could not be saved/i)).toBeVisible()
  expect(remove).not.toHaveBeenCalled()
  expect(repo.load([]).cards).toEqual(cards('A-private'))
  mounted.unmount()
  repo.setPendingDeletion('requested')
  const reloaded = createTestServices({ user: b })
  reloaded.cards = new LocalStorageCardRepository(localStorage, b.id)
  render(<App services={reloaded} />)
  expect(
    screen.getByText(/deletion hasn’t finished on this device/i),
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Retry cloud deletion' }),
  ).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Keep local deck' }))
  expect(repo.forOwner(a.id).load([]).cards).toEqual(cards('A-private'))
  expect(repo.getPendingDeletion()).toBeNull()
})
