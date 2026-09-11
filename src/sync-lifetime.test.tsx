import { StrictMode } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { App } from './jolito'
import type { SyncResult, SyncService } from './application/ports'
import { createStudyCards } from './domain/card'
import { createTestServices } from './test/services'

it('effect cleanup aborts its captured sync while a fresh setup remains usable and final teardown stays immobile', async () => {
  window.location.hash = '#/deck'
  const cards = createStudyCards(
    {
      spanish: 'Current card',
      english: 'Current',
      context: '',
      bidirectional: false,
    },
    'current',
    0,
  )
  const services = createTestServices({
    cards,
    user: { id: 'A', email: 'a@example.com' },
  })
  let release!: (result: SyncResult) => void
  const oldResult = new Promise<SyncResult>((resolve) => {
    release = resolve
  })
  const signals: AbortSignal[] = []
  const syncDeck = vi.fn<SyncService['syncDeck']>(
    (_cards, _owner, _deleted, signal) => {
      expect(signal).toBeDefined()
      signals.push(signal!)
      return signals.length === 1
        ? oldResult
        : Promise.resolve({ success: true, cards })
    },
  )
  const sync: SyncService = {
    ...services.sync,
    getStatus: () => 'idle',
    pushDeck: () => Promise.resolve({ success: true }),
    pullDeck: () => Promise.resolve({ success: true, cards }),
    syncDeck,
  }
  const app = render(
    <StrictMode>
      <App services={{ ...services, sync }} />
    </StrictMode>,
  )
  await waitFor(() => expect(signals).toHaveLength(2))
  expect(signals[0]!.aborted).toBe(true)
  expect(signals[1]!.aborted).toBe(false)
  await act(async () => {
    release({
      success: true,
      cards: createStudyCards(
        {
          spanish: 'Disposed card',
          english: 'Disposed',
          context: '',
          bidirectional: false,
        },
        'disposed',
        0,
      ),
    })
    await oldResult
  })
  expect(
    screen.queryByRole('row', { name: /card: Disposed card,/i }),
  ).toBeNull()
  expect(
    screen.getByRole('row', { name: /card: Current card,/i }),
  ).toBeInTheDocument()
  app.unmount()
  expect(signals.every((signal) => signal.aborted)).toBe(true)
  act(() => {
    window.dispatchEvent(new Event('focus'))
    window.dispatchEvent(new Event('online'))
    document.dispatchEvent(new Event('visibilitychange'))
  })
  expect(syncDeck).toHaveBeenCalledTimes(2)
})
