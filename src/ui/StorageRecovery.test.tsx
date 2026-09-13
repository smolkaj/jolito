import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { App } from '../jolito'
import { createTestServices } from '../test/services'
import {
  ACCOUNT_STORAGE_KEY,
  LocalStorageCardRepository,
} from '../infrastructure/browser/card-repository'
import { createStudyCards } from '../domain/card'

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState({}, '', '#/')
})

it.each(['{invalid', JSON.stringify({ version: 999, cards: [] })])(
  'preserves recovery data through auth, online, visibility, unmount and reload: %s',
  async (raw) => {
    localStorage.setItem('jolito-library-v1', raw)
    const services = createTestServices({
      user: { id: 'learner', email: 'learner@example.com' },
    })
    services.cards = new LocalStorageCardRepository(localStorage)
    const sync = vi.spyOn(services.sync, 'syncDeck')
    const save = vi.spyOn(services.cards, 'save')
    const mounted = render(<App services={services} />)
    expect(
      screen.getByRole('heading', { name: 'Let’s protect your saved deck' }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Download saved data' }),
    ).toBeVisible()
    await act(async () => {
      await services.auth.verifyOtp('another@example.com', '123456')
      fireEvent(window, new Event('online'))
      fireEvent(document, new Event('visibilitychange'))
    })
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(save).not.toHaveBeenCalled()
    expect(sync).not.toHaveBeenCalled()
    expect(localStorage.getItem('jolito-library-v1')).toBe(raw)
    mounted.unmount()
    fireEvent(window, new Event('online'))
    fireEvent(document, new Event('visibilitychange'))
    render(<App services={services} />)
    expect(
      screen.getByRole('heading', { name: 'Let’s protect your saved deck' }),
    ).toBeVisible()
    expect(localStorage.getItem('jolito-library-v1')).toBe(raw)
  },
)

it.each(['vocabulary', 'grammar'] as const)(
  'keeps %s ratings unsaved during quota failure and background interruptions, then retries and reloads',
  async (mode) => {
    const cards = createStudyCards(
      { spanish: 'hola', english: 'hello', context: '', bidirectional: false },
      'personal',
      0,
    )
    const repository = new LocalStorageCardRepository(localStorage)
    repository.save(cards)
    const committed = localStorage.getItem(ACCOUNT_STORAGE_KEY)
    window.history.replaceState(
      {},
      '',
      mode === 'grammar' ? '#/grammar' : '#/review',
    )
    const services = createTestServices({ cards })
    services.cards = repository
    const mounted = render(<App services={services} />)
    const user = userEvent.setup()
    if (mode === 'grammar')
      await user.click(screen.getByRole('button', { name: 'Start practice' }))
    await user.type(screen.getByRole('textbox'), 'my answer')
    await user.keyboard('{Enter}')
    const prompt = screen.getByRole('heading', { level: 1 }).textContent
    const sounds = [...services.mockSounds.played]
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('Full', 'QuotaExceededError')
      })
    await user.keyboard('4')
    expect(
      screen
        .getAllByRole('alert')
        .some((alert) => alert.textContent?.includes('saved')),
    ).toBe(true)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(prompt)
    expect(
      screen.getByRole('status', { name: 'Answer feedback' }),
    ).toHaveTextContent('my answer')
    fireEvent(window, new Event('online'))
    fireEvent(document, new Event('visibilitychange'))
    expect(services.mockSounds.played).toEqual(sounds)
    expect(localStorage.getItem(ACCOUNT_STORAGE_KEY)).toBe(committed)
    expect(new LocalStorageCardRepository(localStorage).load([]).cards).toEqual(
      cards,
    )
    setItem.mockRestore()
    await user.keyboard('4')
    const saved = new LocalStorageCardRepository(localStorage).load([]).cards
    expect(saved.filter((card) => card.schedule.reviews === 1)).toHaveLength(1)
    mounted.unmount()
    const savedRaw = localStorage.getItem(ACCOUNT_STORAGE_KEY)
    fireEvent(window, new Event('online'))
    fireEvent(document, new Event('visibilitychange'))
    expect(localStorage.getItem(ACCOUNT_STORAGE_KEY)).toBe(savedRaw)
    render(<App services={services} />)
    expect(new LocalStorageCardRepository(localStorage).load([]).cards).toEqual(
      saved,
    )
  },
)

it('retains an edit draft and deletion selection across failed commits and retry without leaking tombstones', async () => {
  const cards = createStudyCards(
    { spanish: 'hola', english: 'hello', context: '', bidirectional: false },
    'personal',
    0,
  )
  const repository = new LocalStorageCardRepository(localStorage)
  repository.save(cards)
  window.history.replaceState({}, '', '#/deck')
  const services = createTestServices({ cards })
  services.cards = repository
  render(<App services={services} />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Explore demo deck' }))
  await user.click(screen.getByRole('row', { name: /card: hola,/i }))
  const prompt = screen.getByLabelText(/mexican spanish \(prompt\)/i)
  await user.clear(prompt)
  await user.type(prompt, 'adiós')
  const save = vi.spyOn(repository, 'save').mockImplementationOnce(() => {
    throw new Error('Full')
  })
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('couldn’t be saved')
  expect(prompt).toHaveValue('adiós')
  expect(repository.load([]).cards[0]?.prompt).toBe('hola')
  fireEvent(document, new Event('visibilitychange'))
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(repository.load([]).cards[0]?.prompt).toBe('adiós')
  await user.click(screen.getByRole('checkbox', { name: /select card adiós/i }))
  await user.click(screen.getByRole('button', { name: /delete selected/i }))
  save.mockImplementationOnce(() => {
    throw new Error('Full')
  })
  await user.click(screen.getByRole('button', { name: /^delete card$/i }))
  expect(screen.getByRole('dialog')).toHaveTextContent('couldn’t be saved')
  expect(repository.getDeletedCardIds()).toEqual([])
  expect(repository.load([]).cards).toHaveLength(1)
  fireEvent(window, new Event('online'))
  await user.click(screen.getByRole('button', { name: /^delete card$/i }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  const reloaded = new LocalStorageCardRepository(localStorage)
  expect(reloaded.load([]).cards).toEqual([])
  expect(reloaded.getDeletedCardIds()).toEqual([cards[0]!.id])
})
