import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { App } from '../jolito'
import { createTestServices } from '../test/services'
import { LocalStorageCardRepository } from '../infrastructure/browser/card-repository'
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
    const committed = localStorage.getItem('jolito-library-v1')
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
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(prompt!)
    expect(
      screen.getByRole('status', { name: 'Answer feedback' }),
    ).toHaveTextContent('my answer')
    fireEvent(window, new Event('online'))
    fireEvent(document, new Event('visibilitychange'))
    expect(services.mockSounds.played).toEqual(sounds)
    expect(localStorage.getItem('jolito-library-v1')).toBe(committed)
    expect(new LocalStorageCardRepository(localStorage).load([]).cards).toEqual(
      cards,
    )
    setItem.mockRestore()
    await user.keyboard('4')
    const saved = new LocalStorageCardRepository(localStorage).load([]).cards
    expect(saved.filter((card) => card.schedule.reviews === 1)).toHaveLength(1)
    mounted.unmount()
    const savedRaw = localStorage.getItem('jolito-library-v1')
    fireEvent(window, new Event('online'))
    fireEvent(document, new Event('visibilitychange'))
    expect(localStorage.getItem('jolito-library-v1')).toBe(savedRaw)
    render(<App services={services} />)
    expect(new LocalStorageCardRepository(localStorage).load([]).cards).toEqual(
      saved,
    )
  },
)
