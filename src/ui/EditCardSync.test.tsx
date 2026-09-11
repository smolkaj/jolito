import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { App } from '../jolito'
import type { SyncResult } from '../application/ports'
import {
  createStudyCards,
  resetCardProgress,
  scheduleReview,
  updateStudyCard,
  type StudyCard,
} from '../domain/card'
import {
  ACCOUNT_STORAGE_KEY,
  LocalStorageCardRepository,
} from '../infrastructure/browser/card-repository'
import { createTestServices } from '../test/services'

const owner = { id: 'editor', email: 'editor@example.com' }
const initial = scheduleReview(
  createStudyCards(
    {
      spanish: 'hola',
      english: 'hello',
      context: 'Opening context',
      bidirectional: false,
    },
    'note',
    1000,
  )[0]!,
  'easy',
  1000,
)

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState({}, '', '#/deck')
})

async function openEditor(card = initial, now = 1000) {
  const services = createTestServices({
    cards: [card],
    user: owner,
    clockTime: now,
  })
  services.cards = new LocalStorageCardRepository(localStorage, owner.id)
  services.cards.save([card])
  const mounted = render(<App services={services} />)
  const user = userEvent.setup()
  await screen.findByRole('button', { name: /synced/i })
  await user.click(screen.getByRole('row', { name: /card: hola,/i }))
  const saved = () =>
    new LocalStorageCardRepository(localStorage, owner.id).load([]).cards
  const sync = vi.spyOn(services.sync, 'syncDeck')
  async function interrupt(cards: StudyCard[], deletedCardIds: string[] = []) {
    let release!: (result: SyncResult) => void
    sync.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve
        }),
    )
    act(() => {
      fireEvent.focus(window)
    })
    await waitFor(() => expect(release).toBeDefined())
    // The request remains pending while the learner's draft stays on screen.
    expect(screen.getByRole('dialog')).toBeVisible()
    services.mockSync.remoteCards = cards
    services.mockSync.remoteDeletedCardIds = deletedCardIds
    await act(async () => {
      release({ success: true, cards, deletedCardIds })
      await Promise.resolve()
    })
    await waitFor(() => expect(saved()).toEqual(cards))
  }
  async function reloadAndResync(expected: StudyCard[], stale: StudyCard[]) {
    services.mockSync.remoteCards = stale
    await act(async () => {
      fireEvent.focus(window)
      await Promise.resolve()
    })
    expect(saved()).toEqual(expected)
    mounted.unmount()
    services.cards = new LocalStorageCardRepository(localStorage, owner.id)
    render(<App services={services} />)
    await waitFor(() => expect(services.mockSync.remoteCards).toEqual(expected))
    expect(saved()).toEqual(expected)
  }
  return { user, services, saved, interrupt, reloadAndResync, sync }
}

for (const now of [1000, 500]) {
  for (const remoteReset of [false, true]) {
    for (const action of [
      'edit',
      'reset',
      'edit and reset',
      'no-op',
    ] as const) {
      it(`${action} uses the latest card after ${remoteReset ? 'reset and ' : ''}review sync at clock ${now}, then reloads and resyncs`, async () => {
        const { user, saved, interrupt, reloadAndResync } = await openEditor(
          initial,
          now,
        )
        const edit = action.includes('edit')
        const reset = action.includes('reset')
        if (edit)
          await user.clear(screen.getByLabelText(/Mexican Spanish \(Prompt\)/i))
        if (edit)
          await user.type(
            screen.getByLabelText(/Mexican Spanish \(Prompt\)/i),
            'charlar',
          )
        if (reset)
          await user.click(
            screen.getByRole('checkbox', { name: /reset learning progress/i }),
          )
        let remote = updateStudyCard(initial, { answer: 'Remote answer' }, 1000)
        remote = updateStudyCard(remote, { context: 'Remote context' }, 1000)
        if (remoteReset)
          remote = resetCardProgress(resetCardProgress(remote, 1000), 500)
        remote = scheduleReview(remote, 'easy', 5000)
        await interrupt([remote])
        expect(
          screen.getByLabelText(/Mexican Spanish \(Prompt\)/i),
        ).toHaveValue(edit ? 'charlar' : 'hola')
        await user.click(screen.getByRole('button', { name: 'Save changes' }))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        const expected: StudyCard = {
          ...remote,
          prompt: edit ? 'charlar' : remote.prompt,
          contentRevision: remote.contentRevision + (edit ? 1 : 0),
          ...(reset
            ? {
                resetRevision: {
                  generation: remote.resetRevision.generation + 1,
                  at: now,
                },
                schedule: {
                  state: 'new',
                  dueAt: now,
                  intervalDays: 0,
                  easeFactor: 2.5,
                  reviews: 0,
                  lapses: 0,
                },
              }
            : {}),
        }
        expect(saved()).toEqual([expected])
        await reloadAndResync([expected], [remote])
      })
    }
  }
}

it('updates reset availability as practice and resets arrive without replacing the draft', async () => {
  const fresh = createStudyCards(
    { spanish: 'hola', english: 'hello', context: '', bidirectional: false },
    'note',
    1000,
  )[0]!
  const { user, saved, interrupt } = await openEditor(fresh)
  const reset = screen.getByRole('checkbox', {
    name: /reset learning progress/i,
  })
  expect(reset).toBeDisabled()
  await user.type(screen.getByLabelText(/additional context/i), 'My draft')
  const reviewed = scheduleReview(fresh, 'easy', 1000)
  await interrupt([reviewed])
  expect(reset).toBeEnabled()
  await user.click(reset)
  const remotelyReset = resetCardProgress(reviewed, 500)
  await interrupt([remotelyReset])
  expect(reset).toBeDisabled()
  expect(reset).not.toBeChecked()
  expect(screen.getByLabelText(/additional context/i)).toHaveValue('My draft')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(saved()).toEqual([
    { ...remotelyReset, context: 'My draft', contentRevision: 1 },
  ])
})

it.each(['none', 'storage', 'ownership'] as const)(
  'retains a deleted card draft after a prior %s error without saving or resurrecting its identity',
  async (failure) => {
    const { user, services, saved, interrupt, reloadAndResync, sync } =
      await openEditor()
    const prompt = screen.getByLabelText(/Mexican Spanish \(Prompt\)/i)
    await user.clear(prompt)
    await user.type(prompt, 'Keep my unsaved draft')
    if (failure !== 'none') {
      const denied =
        failure === 'storage'
          ? vi.spyOn(services.cards, 'save').mockImplementation(() => {
              throw new Error('Full')
            })
          : vi.spyOn(services.auth, 'isCurrentOwner').mockReturnValue(false)
      await user.click(screen.getByRole('button', { name: 'Save changes' }))
      expect(
        within(screen.getByRole('dialog')).getByRole('alert'),
      ).toHaveTextContent(
        failure === 'storage' ? /storage/i : /account.*verified/i,
      )
      denied.mockRestore()
    }
    await interrupt([], [initial.id])
    const before = localStorage.getItem(ACCOUNT_STORAGE_KEY)
    const calls = sync.mock.calls.length
    for (let attempt = 0; attempt < 2; attempt++) {
      await user.click(screen.getByRole('button', { name: 'Save changes' }))
      expect(
        within(screen.getByRole('dialog')).getByRole('alert'),
      ).toHaveTextContent(/removed.*draft/i)
      expect(prompt).toHaveValue('Keep my unsaved draft')
      expect(localStorage.getItem(ACCOUNT_STORAGE_KEY)).toBe(before)
      expect(sync).toHaveBeenCalledTimes(calls)
    }
    expect(saved()).toEqual([])
    expect(services.cards.getDeletedCardIds()).toEqual([initial.id])
    await reloadAndResync([], [initial])
  },
)
