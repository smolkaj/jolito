import { practiceCards, practiceGrammar } from '../test/practice'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { SyncResult } from '../application/ports'
import { App } from '../jolito'
import { createTestServices } from '../test/services'
import {
  createGrammarCards,
  grammarContext,
  grammarQueue,
  isGrammarCard,
} from '../domain/grammar'
import { scheduleReview, DAY } from '../domain/card'

async function begin() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Start practice' }))
  return user
}

describe('grammar practice in Jolito', () => {
  it.each(['preterite', 'perfect'] as const)(
    'keeps one sentence playback control through %s recall, reveal, interruption and next card',
    async (topic) => {
      window.history.replaceState({}, '', '#/grammar')
      const services = createTestServices()
      render(<App services={services} />)
      const user = userEvent.setup()
      await user.selectOptions(
        screen.getByRole('combobox', { name: 'Tense' }),
        topic,
      )
      await user.click(screen.getByRole('button', { name: 'Start practice' }))
      for (const answer of ['', 'wrong', 'exact']) {
        const card = grammarQueue(
          createGrammarCards(0, topic),
          services.clock.now(),
          'mixed',
          topic,
        )[['', 'wrong', 'exact'].indexOf(answer)]!
        const expectedHighlights = grammarContext(card)
          .translationParts.filter((part) => part.isAnswer)
          .map((part) => part.text)
        const translation = document.querySelector('.grammar-translation')!
        const originalTranslation = translation.textContent
        expect(
          Array.from(
            translation.querySelectorAll('.grammar-filled'),
            (part) => part.textContent,
          ),
        ).toEqual(expectedHighlights)
        const sentence = screen.getByRole('heading', { level: 1 })
        const prompt = screen.getByRole('button', { name: 'Play prompt audio' })
        expect(sentence.parentElement).toContainElement(prompt)
        expect(
          sentence.parentElement?.querySelector('.grammar-verb-cue'),
        ).toBeNull()
        expect(document.querySelectorAll('.audio-button')).toHaveLength(1)
        await user.click(prompt)
        expect(services.mockSpeaker.spoken.slice(-1)[0]?.text).toBe(
          sentence.textContent,
        )
        if (answer)
          await user.type(
            screen.getByRole('textbox'),
            answer === 'exact' ? card.answer : answer,
          )
        await user.click(screen.getByRole('button', { name: /Reveal answer/ }))
        await waitFor(() =>
          expect(services.mockSpeaker.spoken.slice(-1)[0]?.text).toBe(
            sentence.textContent,
          ),
        )
        expect(sentence).not.toHaveTextContent('…')
        expect(translation.textContent).toBe(originalTranslation)
        expect(
          Array.from(
            translation.querySelectorAll('.grammar-filled'),
            (part) => part.textContent,
          ),
        ).toEqual(expectedHighlights)
        expect(document.querySelectorAll('.audio-button')).toHaveLength(1)
        expect(sentence.parentElement).toContainElement(
          screen.getByRole('button', { name: 'Play answer audio' }),
        )
        fireEvent(document, new Event('visibilitychange'))
        await user.click(screen.getByRole('button', { name: 'Grammar' }))
        await user.click(
          screen.getByRole('button', { name: 'Resume practice' }),
        )
        const resumed = screen.getByRole('heading', { level: 1 })
        expect(resumed.textContent).toBe(sentence.textContent)
        expect(
          Array.from(
            document.querySelectorAll('.grammar-translation .grammar-filled'),
            (part) => part.textContent,
          ),
        ).toEqual(expectedHighlights)
        expect(document.querySelectorAll('.audio-button')).toHaveLength(1)
        await user.click(
          screen.getByRole('button', { name: 'Play answer audio' }),
        )
        expect(services.mockSpeaker.spoken.slice(-1)[0]?.text).toBe(
          resumed.textContent,
        )
        fireEvent.keyDown(window, { key: ' ', code: 'Space' })
        expect(services.mockSpeaker.spoken.slice(-1)[0]?.text).toBe(
          resumed.textContent,
        )
        await user.keyboard('4')
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('…')
      }
    },
  )

  it('speaks the blank prompt in Spanish, preserves typing through interruption, and stops on exit', async () => {
    window.history.replaceState({}, '', '#/grammar')
    const services = createTestServices()
    const app = render(<App services={services} />)
    const user = await begin()
    const prompt = { text: 'Anoche yo … con la vecina.', locale: 'es-MX' }
    expect(services.mockSpeaker.spoken).toEqual([prompt])
    await user.type(screen.getByRole('textbox'), 'habl')
    expect(services.mockSpeaker.spoken).toEqual([prompt])
    await user.keyboard('{Control>} {/Control}')
    expect(services.mockSpeaker.spoken).toEqual([prompt, prompt])
    const stops = services.mockSpeaker.stopCount
    await user.click(screen.getByRole('button', { name: 'Grammar' }))
    expect(services.mockSpeaker.stopCount).toBeGreaterThan(stops)
    fireEvent(document, new Event('visibilitychange'))
    expect(services.mockSpeaker.spoken).toEqual([prompt, prompt])
    await user.click(screen.getByRole('button', { name: 'Resume practice' }))
    expect(screen.getByRole('textbox')).toHaveValue('habl')
    expect(services.mockSpeaker.spoken).toEqual([prompt, prompt, prompt])
    await user.click(screen.getByRole('button', { name: 'Play prompt audio' }))
    expect(services.mockSpeaker.spoken.slice(-1)[0]).toEqual(prompt)
    expect(
      services.mockSpeaker.spoken.every(({ text }) => text.includes('…')),
    ).toBe(true)
    await user.click(screen.getByRole('button', { name: /Reveal answer/ }))
    await waitFor(() =>
      expect(services.mockSpeaker.spoken.slice(-1)[0]).toEqual({
        text: 'Anoche yo hablé con la vecina.',
        locale: 'es-MX',
      }),
    )
    await user.keyboard('4')
    expect(services.mockSpeaker.spoken.slice(-1)[0]?.text).toContain('…')
    await user.keyboard('{Enter}')
    app.unmount()
    const ended = [...services.mockSpeaker.spoken]
    fireEvent.keyDown(window, { key: ' ', code: 'Space', ctrlKey: true })
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(services.mockSpeaker.spoken).toEqual(ended)
  })

  it('distinguishes resuming an answer from starting a fresh round', async () => {
    window.history.replaceState({}, '', '#/grammar')
    const services = createTestServices()
    render(<App services={services} />)
    expect(
      screen.queryByRole('button', { name: 'Resume practice' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Conjugation reference|8 forms/),
    ).not.toBeInTheDocument()
    const user = await begin()
    await user.type(screen.getByRole('textbox'), 'habl')
    await user.click(screen.getByRole('button', { name: 'Grammar' }))
    await user.click(screen.getByRole('button', { name: 'Resume practice' }))
    expect(screen.getByRole('textbox')).toHaveValue('habl')
    await user.click(screen.getByRole('button', { name: 'Grammar' }))
    await user.click(screen.getByRole('radio', { name: /Irregular stems/ }))
    await user.click(screen.getByRole('button', { name: 'Start new' }))
    expect(screen.getByRole('textbox')).toHaveValue('')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'En el camino, yo … una idea.',
    )
    expect(
      services.memoryCards.saved?.filter(isGrammarCard) ?? [],
    ).toHaveLength(0)
  })

  it('keeps vocabulary primary and grammar separate through practice, navigation, and reload', async () => {
    window.history.replaceState({}, '', '#/')
    const services = createTestServices()
    const app = render(<App services={services} />)
    const user = userEvent.setup()
    await practiceGrammar(user)
    await begin()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Anoche yo',
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Your conjugation' }),
      'hable{Enter}',
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'You wrotehableExpectedhablé',
    )
    await user.keyboard('4')
    expect(services.memoryCards.saved?.filter(isGrammarCard)).toHaveLength(1)
    const heading = screen.getByRole('heading', { level: 1 }).textContent
    await user.type(screen.getByRole('textbox'), 'unfinished')
    await user.click(screen.getByRole('button', { name: 'Jolito home' }))
    await practiceGrammar(user)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading)
    expect(screen.getByRole('textbox')).toHaveValue('unfinished')
    await user.click(screen.getByRole('button', { name: 'Jolito home' }))
    await practiceCards(user)
    expect(screen.getByRole('textbox', { name: 'Your answer' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent(
      'Anoche',
    )
    app.unmount()
    window.history.replaceState({}, '', '#/grammar')
    render(<App services={services} />)
    await begin()
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent(
      'Anoche yo … con la vecina.',
    )
  })

  it('prepares both sentence contexts for upcoming forms without fetching again on typing or after teardown', async () => {
    window.history.replaceState({}, '', '#/grammar')
    const services = createTestServices()
    const prefetch = vi.spyOn(services.speaker, 'prefetch')
    const app = render(<App services={services} />)
    expect(services.mockSpeaker.prefetched).toEqual(
      expect.arrayContaining([
        { text: 'Anoche yo … con la vecina.', locale: 'es-MX' },
        { text: 'Después de cenar, yo … de la película.', locale: 'es-MX' },
        { text: 'Anoche yo hablé con la vecina.', locale: 'es-MX' },
        { text: 'Después de cenar, yo hablé de la película.', locale: 'es-MX' },
      ]),
    )
    const user = await begin()
    const calls = prefetch.mock.calls.length
    await user.type(screen.getByRole('textbox'), 'hable')
    expect(prefetch).toHaveBeenCalledTimes(calls)
    await user.click(screen.getByRole('button', { name: 'Grammar' }))
    await user.click(screen.getByRole('radio', { name: /Irregular stems/ }))
    expect(services.mockSpeaker.prefetched).toEqual(
      expect.arrayContaining([
        { text: 'En el camino, yo tuve una idea.', locale: 'es-MX' },
      ]),
    )
    app.unmount()
    const ended = prefetch.mock.calls.length
    fireEvent(document, new Event('visibilitychange'))
    fireEvent(window, new Event('focus'))
    expect(prefetch).toHaveBeenCalledTimes(ended)
  })

  it.each(['preterite', 'perfect'] as const)(
    'preserves an active %s answer through cloud reconciliation, token refresh and visibility interruptions',
    async (topic) => {
      window.history.replaceState({}, '', '#/grammar')
      const services = createTestServices({
        user: { id: 'learner', email: 'learner@example.com' },
      })
      render(<App services={services} />)
      const user = userEvent.setup()
      await user.selectOptions(
        screen.getByRole('combobox', { name: 'Tense' }),
        topic,
      )
      await user.click(screen.getByRole('button', { name: 'Start practice' }))
      const card = grammarQueue(
        createGrammarCards(0, topic),
        services.clock.now(),
        'mixed',
        topic,
      )[0]!
      await user.type(screen.getByRole('textbox'), 'habl')
      const prompt = screen.getByRole('heading', { level: 1 }).textContent
      services.mockSync.remoteCards = [
        scheduleReview(card, 'easy', services.clock.now()),
      ]
      act(() => {
        fireEvent(window, new Event('focus'))
        fireEvent(document, new Event('visibilitychange'))
      })
      await waitFor(() =>
        expect(services.mockSync.syncedCount).toBeGreaterThan(1),
      )
      act(() => {
        services.mockAuth.setUser({
          id: 'learner',
          email: 'learner@example.com',
        })
      })
      expect(screen.getByRole('textbox')).toHaveValue('habl')
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        prompt,
      )
      await user.clear(screen.getByRole('textbox'))
      await user.type(screen.getByRole('textbox'), card.answer + '{Enter}')
      await user.keyboard('4')
      const saved = services.memoryCards.saved!.find((c) => c.id === card.id)!
      expect(saved.schedule.reviews).toBe(2)
      expect(saved.schedule.dueAt).toBeGreaterThan(services.clock.now() + DAY)
    },
  )

  it('keeps guest grammar progress isolated when a new account signs in', async () => {
    window.history.replaceState({}, '', '#/grammar')
    const services = createTestServices()
    render(<App services={services} />)
    const user = await begin()
    await user.keyboard('{Enter}4')
    await act(async () => {
      await services.mockAuth.verifyOtp('learner@example.com', '123456')
    })
    expect(services.cards.forOwner('mock-user-1').load([]).cards).toEqual([])
    const guest = services.cards.forOwner(null).load([]).cards
    expect(guest.filter(isGrammarCard)).toHaveLength(1)
    expect(guest.find(isGrammarCard)!.schedule.reviews).toBe(1)
    expect(services.mockSync.remoteCards).toEqual([])
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
      'Después de cenar, yo',
    )
    await user.keyboard('{Enter}4')
    for (let index = 0; index < 2; index++) await user.keyboard('{Enter}4')
    expect(screen.getByRole('heading', { name: '¡Hecho!' })).toBeVisible()
    expect(screen.getByText(/8 forms practiced/)).toBeVisible()
    expect(services.mockSounds.played.slice(-1)[0]).toBe('complete')
    expect(services.mockHaptics.triggered.slice(-1)[0]).toBe('complete')
    const snapshot = JSON.stringify(services.memoryCards.saved)
    app.unmount()
    fireEvent.keyDown(window, { key: '1' })
    fireEvent(window, new Event('focus'))
    expect(JSON.stringify(services.memoryCards.saved)).toBe(snapshot)
  })

  it('keeps completion through account and visibility interruptions, then starts the next round', async () => {
    window.history.replaceState({}, '', '#/grammar')
    const services = createTestServices()
    render(<App services={services} />)
    const user = await begin()
    for (let turn = 0; turn < 8; turn++) await user.keyboard('{Enter}4')
    expect(screen.getByRole('heading', { name: '¡Hecho!' })).toHaveFocus()
    expect(screen.getByText('8 forms practiced.')).toBeVisible()
    await user.click(screen.getAllByRole('button', { name: 'Sign in' })[0]!)
    fireEvent(document, new Event('visibilitychange'))
    await user.keyboard('4{Escape}')
    expect(screen.getByText('8 forms practiced.')).toBeVisible()
    expect(services.memoryCards.saved!.filter(isGrammarCard)).toHaveLength(8)
    await user.click(screen.getByRole('button', { name: 'Practice next 8' }))
    expect(screen.getByRole('textbox')).toHaveFocus()
    expect(screen.getByRole('textbox')).toHaveValue('')
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '0',
    )
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent(
      'Anoche yo … con la vecina.',
    )
  })

  it('plays shared rating feedback after interruptions and stays silent after leaving', async () => {
    window.history.replaceState({}, '', '#/grammar')
    const services = createTestServices()
    const app = render(<App services={services} />)
    const user = await begin()
    for (const [index, grade] of ['again', 'hard', 'good', 'easy'].entries()) {
      await user.keyboard('{Enter}')
      const stops = services.mockSpeaker.stopCount
      await user.click(screen.getByRole('button', { name: 'Grammar' }))
      expect(services.mockSpeaker.stopCount).toBeGreaterThan(stops)
      await user.click(screen.getByRole('button', { name: 'Resume practice' }))
      expect(screen.getByRole('status')).toBeVisible()
      await user.click(screen.getByRole('button', { name: 'Jolito home' }))
      await practiceGrammar(user)
      fireEvent(document, new Event('visibilitychange'))
      const played = services.mockSounds.played.length
      await user.keyboard(String(index + 1))
      expect(services.mockSounds.played.slice(played)).toEqual([grade])
      expect(services.mockHaptics.triggered.slice(-1)[0]).toBe(grade)
    }
    app.unmount()
    const played = [...services.mockSounds.played]
    fireEvent.keyDown(window, { key: '1' })
    fireEvent.keyDown(window, { code: 'Space', key: ' ' })
    fireEvent(document, new Event('visibilitychange'))
    expect(services.mockSounds.played).toEqual(played)
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
    expect(
      services.mockSpeaker.prunedCalls[
        services.mockSpeaker.prunedCalls.length - 1
      ],
    ).not.toContainEqual({
      text: 'Anoche yo hablé con la vecina.',
      locale: 'es-MX',
    })
    expect(
      services.mockSpeaker.prunedCalls[
        services.mockSpeaker.prunedCalls.length - 1
      ],
    ).toContainEqual({
      text: 'Anoche tú hablaste con la vecina.',
      locale: 'es-MX',
    })
    const played = [...services.mockSounds.played]
    await user.keyboard('4')
    expect(services.mockSounds.played).toEqual(played)
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
    expect(screen.getByRole('heading', { name: 'Grammar' })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /Resume practice/ }),
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
    const played = [...services.mockSounds.played]
    await user.keyboard('4')
    expect(services.mockSounds.played).toEqual(played)
    expect(screen.getByRole('alert')).toHaveTextContent('couldn’t be saved')
    expect(screen.getByRole('status')).toHaveTextContent('hablé')
    await user.keyboard('4')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(
      services.memoryCards.saved!.filter(isGrammarCard)[0]!.schedule.reviews,
    ).toBe(1)
    save.mockRestore()
  })
})
