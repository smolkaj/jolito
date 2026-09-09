import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { SyncResult } from '../application/ports'
import { App } from '../jolito'
import { createTestServices } from '../test/services'
import { createGrammarCards, isGrammarCard } from '../domain/grammar'
import { scheduleReview, DAY } from '../domain/card'

async function begin() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Practice pretérito' }))
  return user
}

describe('grammar practice in Jolito', () => {
  it('keeps vocabulary primary and grammar separate through practice, navigation, and reload', async () => {
    window.history.replaceState({}, '', '#/')
    const services = createTestServices()
    const app = render(<App services={services} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('link', { name: 'Practice grammar' }))
    await begin()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Ayer yo',
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Your conjugation' }),
      'hable{Enter}',
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'Almost — keep the accent.',
    )
    await user.keyboard('4')
    expect(services.memoryCards.saved?.filter(isGrammarCard)).toHaveLength(1)
    const heading = screen.getByRole('heading', { level: 1 }).textContent
    await user.type(screen.getByRole('textbox'), 'unfinished')
    await user.click(screen.getByRole('button', { name: 'Vocabulary' }))
    await user.click(screen.getByRole('link', { name: 'Practice grammar' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading)
    expect(screen.getByRole('textbox')).toHaveValue('unfinished')
    await user.click(screen.getByRole('button', { name: 'Vocabulary' }))
    await user.click(screen.getByRole('button', { name: 'Practice' }))
    expect(screen.getByRole('textbox', { name: 'Your answer' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent(
      'Ayer',
    )
    app.unmount()
    window.history.replaceState({}, '', '#/grammar')
    render(<App services={services} />)
    await begin()
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent(
      'Ayer yo … con la vecina.',
    )
  })

  it('preserves an active answer through cloud reconciliation, token refresh and visibility interruptions', async () => {
    window.history.replaceState({}, '', '#/grammar')
    const services = createTestServices({
      user: { id: 'learner', email: 'learner@example.com' },
    })
    render(<App services={services} />)
    const user = await begin()
    await user.type(screen.getByRole('textbox'), 'habl')
    const prompt = screen.getByRole('heading', { level: 1 }).textContent
    services.mockSync.remoteCards = [
      scheduleReview(createGrammarCards(0)[0]!, 'easy', services.clock.now()),
    ]
    act(() => {
      fireEvent(window, new Event('focus'))
      fireEvent(document, new Event('visibilitychange'))
    })
    await waitFor(() =>
      expect(services.mockSync.syncedCount).toBeGreaterThan(1),
    )
    await act(async () => {
      await services.mockAuth.verifyOtp('learner@example.com', '123456')
    })
    expect(screen.getByRole('textbox')).toHaveValue('habl')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(prompt)
    await user.type(screen.getByRole('textbox'), 'é{Enter}')
    await user.keyboard('4')
    const saved = services.memoryCards.saved!.find(
      (c) => c.id === 'grammar:preterite:hablar:0',
    )!
    expect(saved.schedule.reviews).toBe(2)
    expect(saved.schedule.dueAt).toBeGreaterThan(services.clock.now() + DAY)
  })

  it('keeps grammar progress but removes demo vocabulary on ordinary sign-in without a pending card', async () => {
    window.history.replaceState({}, '', '#/grammar')
    const services = createTestServices()
    render(<App services={services} />)
    const user = await begin()
    await user.keyboard('{Enter}4')
    await act(async () => {
      await services.mockAuth.verifyOtp('learner@example.com', '123456')
    })
    await waitFor(() =>
      expect(
        services.memoryCards.saved!.some((card) =>
          card.id.startsWith('starter-'),
        ),
      ).toBe(false),
    )
    expect(services.memoryCards.saved!.filter(isGrammarCard)).toHaveLength(1)
    expect(
      services.memoryCards.saved!.find(isGrammarCard)!.schedule.reviews,
    ).toBe(1)
  })

  it('retains a just-saved review when initial sign-in sync returns an older snapshot', async () => {
    window.history.replaceState({}, '', '#/grammar')
    const services = createTestServices({
      user: { id: 'learner', email: 'learner@example.com' },
    })
    let finish!: (result: SyncResult) => void
    vi.spyOn(services.sync, 'syncDeck').mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    render(<App services={services} />)
    const user = await begin()
    await user.keyboard('{Enter}4')
    await act(async () => {
      finish({ success: true, cards: createGrammarCards(0).slice(0, 1) })
      await Promise.resolve()
    })
    expect(
      services.memoryCards.saved!.find(
        (c) => c.id === 'grammar:preterite:hablar:0',
      )!.schedule.reviews,
    ).toBe(1)
  })

  it('requeues weak forms with new context, completes a round, and has inert shortcuts after leaving', async () => {
    window.history.replaceState({}, '', '#/grammar')
    const services = createTestServices()
    const app = render(<App services={services} />)
    const user = await begin()
    await user.keyboard('{Enter}1')
    for (let index = 0; index < 5; index++) await user.keyboard('{Enter}4')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'El sábado yo',
    )
    await user.keyboard('{Enter}4')
    for (let index = 0; index < 2; index++) await user.keyboard('{Enter}4')
    expect(
      screen.getByRole('heading', { name: 'A little more natural.' }),
    ).toBeVisible()
    expect(screen.getByText(/8 forms practiced/)).toBeVisible()
    const snapshot = JSON.stringify(services.memoryCards.saved)
    app.unmount()
    fireEvent.keyDown(window, { key: '1' })
    fireEvent(window, new Event('focus'))
    expect(JSON.stringify(services.memoryCards.saved)).toBe(snapshot)
  })

  it('respects remote removal during a round and clears the active round on sign-out', async () => {
    window.history.replaceState({}, '', '#/grammar')
    const services = createTestServices({
      user: { id: 'learner', email: 'learner@example.com' },
    })
    render(<App services={services} />)
    const user = await begin()
    await user.keyboard('{Enter}')
    services.mockSync.remoteDeletedCardIds = ['grammar:preterite:hablar:0']
    act(() => {
      fireEvent(window, new Event('focus'))
    })
    await waitFor(() =>
      expect(services.memoryCards.deletedCardIds).toContain(
        'grammar:preterite:hablar:0',
      ),
    )
    await user.keyboard('4')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'removed on another device',
    )
    expect(
      services.memoryCards.saved!.some(
        (c) => c.id === 'grammar:preterite:hablar:0',
      ),
    ).toBe(false)
    await act(async () => {
      await services.mockAuth.signOut()
    })
    expect(
      screen.getByRole('heading', { name: 'Make the past click.' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /Resume your unfinished/ }),
    ).not.toBeInTheDocument()
  })

  it('keeps failed saves reviewable and retries without advancing or double-grading', async () => {
    window.history.replaceState({}, '', '#/grammar')
    const services = createTestServices()
    render(<App services={services} />)
    const user = await begin()
    await user.keyboard('{Enter}')
    const save = vi.spyOn(services.cards, 'save').mockImplementationOnce(() => {
      throw new Error('quota')
    })
    await user.keyboard('4')
    expect(screen.getByRole('alert')).toHaveTextContent('couldn’t be saved')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('hablé')
    await user.keyboard('4')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(
      services.memoryCards.saved!.filter(isGrammarCard)[0]!.schedule.reviews,
    ).toBe(1)
    save.mockRestore()
  })
})
