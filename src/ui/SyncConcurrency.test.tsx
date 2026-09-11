import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import type { SyncResult } from '../application/ports'
import { createStudyCards } from '../domain/card'
import {
  LocalStorageCardRepository,
  ACCOUNT_STORAGE_KEY,
} from '../infrastructure/browser/card-repository'
import { App } from '../jolito'
import { createTestServices } from '../test/services'

const owner = { id: 'learner', email: 'learner@example.com' }
const cards = ['hola', 'adiós'].flatMap((prompt) =>
  createStudyCards(
    { spanish: prompt, english: prompt, context: '', bidirectional: false },
    prompt,
    0,
  ),
)
beforeEach(() => {
  localStorage.clear()
  window.history.replaceState({}, '', '#/review')
})

it('serializes automatic and manual sync while confirming an in-flight rating and preserving the next answer', async () => {
  const services = createTestServices({ user: owner, cards })
  const original = services.mockSync.syncDeck.bind(services.mockSync)
  let release!: (result: SyncResult) => void
  const sync = vi
    .spyOn(services.mockSync, 'syncDeck')
    .mockImplementation(original)
  render(<App services={services} />)
  await screen.findByRole('button', { name: /deck synced with cloud/i })
  sync.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve
      }),
  )
  await act(async () => {
    fireEvent(window, new Event('focus'))
    await Promise.resolve()
  })
  const user = userEvent.setup()
  const gradedPrompt = screen.getByRole('heading', { level: 1 }).textContent
  await user.type(screen.getByRole('textbox'), 'first answer')
  await user.keyboard('{Enter}4')
  await user.type(screen.getByRole('textbox'), 'unfinished next answer')
  await user.click(screen.getByRole('button', { name: /synchronizing deck/i }))
  await user.click(screen.getByRole('button', { name: /sync now/i }))
  await act(async () => {
    fireEvent(window, new Event('focus'))
    fireEvent(document, new Event('visibilitychange'))
    await Promise.resolve()
  })
  expect(sync).toHaveBeenCalledTimes(2)
  await act(async () => {
    release({ success: true, cards, deletedCardIds: [] })
    await Promise.resolve()
  })
  await screen.findByText('Synced!')
  expect(sync).toHaveBeenCalledTimes(3)
  expect(
    services.mockSync.decks
      .get(owner.id)
      ?.cards.find((card) => card.prompt === gradedPrompt)?.schedule.reviews,
  ).toBe(1)
  expect(
    services.cards
      .forOwner(owner.id)
      .load([])
      .cards.find((card) => card.prompt === gradedPrompt)?.schedule.reviews,
  ).toBe(1)
  await user.click(screen.getByRole('button', { name: 'Close dialog' }))
  expect(screen.getByRole('textbox')).toHaveValue('unfinished next answer')
})

it.each(['vocabulary', 'grammar'])(
  'preserves a failed %s rating through a held authenticated sync, then recovers and remains inert after teardown',
  async (mode) => {
    window.history.replaceState(
      {},
      '',
      mode === 'grammar' ? '#/grammar' : '#/review',
    )
    const repository = new LocalStorageCardRepository(localStorage, owner.id)
    repository.forOwner(owner.id).save(cards)
    const services = createTestServices({ user: owner })
    services.cards = repository
    let release!: (result: SyncResult) => void
    const original = services.mockSync.syncDeck.bind(services.mockSync)
    const sync = vi
      .spyOn(services.mockSync, 'syncDeck')
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve
          }),
      )
      .mockImplementation(original)
    const mounted = render(<App services={services} />)
    const user = userEvent.setup()
    if (mode === 'grammar')
      await user.click(screen.getByRole('button', { name: 'Start practice' }))
    await user.type(screen.getByRole('textbox'), 'my retained answer')
    await user.keyboard('{Enter}')
    const prompt = screen.getByRole('heading', { level: 1 }).textContent
    const before = localStorage.getItem(ACCOUNT_STORAGE_KEY)
    const writes = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('Full', 'QuotaExceededError')
      })
    await user.keyboard('4')
    await act(async () => {
      release({ success: true, cards, deletedCardIds: [] })
      await Promise.resolve()
    })
    expect(screen.getByRole('alert')).toHaveTextContent('saved')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(prompt)
    expect(
      screen.getByRole('status', { name: 'Answer feedback' }),
    ).toHaveTextContent('my retained answer')
    expect(localStorage.getItem(ACCOUNT_STORAGE_KEY)).toBe(before)
    writes.mockRestore()
    await user.keyboard('4')
    await act(async () => {
      fireEvent(window, new Event('online'))
      await Promise.resolve()
    })
    await screen.findByRole('button', { name: /deck synced with cloud/i })
    expect(
      repository
        .forOwner(owner.id)
        .load([])
        .cards.filter((card) => card.schedule.reviews === 1),
    ).toHaveLength(1)
    expect(
      services.mockSync.decks
        .get(owner.id)
        ?.cards.filter((card) => card.schedule.reviews === 1),
    ).toHaveLength(1)
    const count = sync.mock.calls.length
    const saved = localStorage.getItem(ACCOUNT_STORAGE_KEY)
    mounted.unmount()
    fireEvent(window, new Event('online'))
    fireEvent(window, new Event('focus'))
    fireEvent(document, new Event('visibilitychange'))
    expect(sync).toHaveBeenCalledTimes(count)
    expect(localStorage.getItem(ACCOUNT_STORAGE_KEY)).toBe(saved)
  },
)
