import { describe, expect, it, vi } from 'vitest'
import type { StudyCard } from '../domain/card'
import type { AuthUser, SyncService } from './ports'
import { syncDeckWithCloud } from './deck-sync'

const mockCard: StudyCard = {
  id: 'card-1:es-en',
  noteId: 'note-1',
  prompt: 'hola',
  answer: 'hello',
  direction: 'es-en',
  context: '',
  scene: 'conversation',
  schedule: {
    state: 'new',
    dueAt: 0,
    intervalDays: 0,
    easeFactor: 2.5,
    reviews: 0,
    lapses: 0,
  },
  createdAt: 0,
}

describe('syncDeckWithCloud', () => {
  const testUser: AuthUser = {
    id: 'user-123',
    email: 'learner@example.com',
  }

  it('fails gracefully when user is unauthenticated', async () => {
    const syncDeckMock = vi.fn()
    const syncService: SyncService = {
      getStatus: () => 'unauthenticated',
      pushDeck: vi.fn(),
      pullDeck: vi.fn(),
      syncDeck: syncDeckMock,
    }
    const onCardsUpdated = vi.fn()

    const result = await syncDeckWithCloud({
      localCards: [mockCard],
      user: null,
      syncService,
      onCardsUpdated,
    })

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/sign in/i)
    expect(syncDeckMock).not.toHaveBeenCalled()
    expect(onCardsUpdated).not.toHaveBeenCalled()
  })

  it('executes sync and notifies when remote deck provides updated cards and deletedCardIds', async () => {
    const updatedCard: StudyCard = {
      ...mockCard,
      prompt: '¡Hola!',
    }
    const syncDeckMock = vi.fn().mockResolvedValue({
      success: true,
      cards: [updatedCard],
      deletedCardIds: ['deleted-id-1'],
      syncedAt: 123456789,
    })
    const syncService: SyncService = {
      getStatus: () => 'synced',
      pushDeck: vi.fn(),
      pullDeck: vi.fn(),
      syncDeck: syncDeckMock,
    }
    const onCardsUpdated = vi.fn()

    const result = await syncDeckWithCloud({
      localCards: [mockCard],
      localDeletedIds: ['deleted-id-1'],
      user: testUser,
      syncService,
      onCardsUpdated,
    })

    expect(result.success).toBe(true)
    expect(syncDeckMock).toHaveBeenCalledWith([mockCard], testUser, [
      'deleted-id-1',
    ])
    expect(onCardsUpdated).toHaveBeenCalledWith([updatedCard], ['deleted-id-1'])
  })

  it('returns failure result without modifying cards when cloud sync fails', async () => {
    const syncService: SyncService = {
      getStatus: () => 'error',
      pushDeck: vi.fn(),
      pullDeck: vi.fn(),
      syncDeck: vi.fn().mockResolvedValue({
        success: false,
        error: 'Network connection lost.',
      }),
    }
    const onCardsUpdated = vi.fn()

    const result = await syncDeckWithCloud({
      localCards: [mockCard],
      user: testUser,
      syncService,
      onCardsUpdated,
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Network connection lost.')
    expect(onCardsUpdated).not.toHaveBeenCalled()
  })
})
