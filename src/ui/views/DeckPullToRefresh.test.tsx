import { fireEvent, render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createStudyCards } from '../../domain/card'
import { DeckManagerView } from './DeckManagerView'
import type { HapticsPlayer } from '../../application/ports'

function createMockHaptics() {
  const trigger = vi.fn()
  const haptics: HapticsPlayer = {
    trigger,
  }
  return { trigger, haptics }
}

const mockCards = createStudyCards(
  {
    spanish: 'café',
    english: 'coffee',
    context: '',
    bidirectional: false,
  },
  'batch-1',
  0,
)

describe('DeckManagerView Pull-to-Refresh (Milestone 3)', () => {
  it('triggers onRefreshSync and haptic feedback when pulled down past threshold', async () => {
    const onRefreshSync = vi.fn().mockResolvedValue(undefined)
    const { trigger, haptics } = createMockHaptics()

    const { container } = render(
      <DeckManagerView
        cards={mockCards}
        vocabularyCards={mockCards}
        referenceTime={1000}
        saveError={null}
        deletedCardIds={[]}
        queue={[]}
        dueCount={0}
        authUser={{ id: 'u1', email: 'test@example.com' }}
        syncStatus="idle"
        isOnline={true}
        accountNotice={null}
        redirectAuthBanner={null}
        onDismissAccountNotice={vi.fn()}
        onDismissRedirectBanner={vi.fn()}
        onGoHome={vi.fn()}
        onNavigateToCreate={vi.fn()}
        onPractice={vi.fn()}
        onOpenSync={vi.fn()}
        onOpenFeedback={vi.fn()}
        onOpenPrivacy={vi.fn()}
        onEditCard={vi.fn()}
        onDeleteCards={vi.fn()}
        onUpdateCards={vi.fn()}
        onAddStarterPack={vi.fn()}
        onAddStarterNote={vi.fn()}
        clock={{ now: () => 1000 }}
        onRefreshSync={onRefreshSync}
        haptics={haptics}
      />,
    )

    const mainElement = container.querySelector('main.deck-page')!

    // Initiate pull-down at top (deltaY = 150px -> pull distance > 55px)
    fireEvent.pointerDown(mainElement, {
      clientY: 100,
      button: 0,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(mainElement, { clientY: 250, pointerType: 'touch' })

    expect(trigger).toHaveBeenCalledWith('selection')

    fireEvent.pointerUp(mainElement)

    await waitFor(() => {
      expect(onRefreshSync).toHaveBeenCalledTimes(1)
    })
  })

  it('ignores mouse pointers for pull-to-refresh', () => {
    const onRefreshSync = vi.fn()
    const { trigger, haptics } = createMockHaptics()

    const { container } = render(
      <DeckManagerView
        cards={mockCards}
        vocabularyCards={mockCards}
        referenceTime={1000}
        saveError={null}
        deletedCardIds={[]}
        queue={[]}
        dueCount={0}
        authUser={{ id: 'u1', email: 'test@example.com' }}
        syncStatus="idle"
        isOnline={true}
        accountNotice={null}
        redirectAuthBanner={null}
        onDismissAccountNotice={vi.fn()}
        onDismissRedirectBanner={vi.fn()}
        onGoHome={vi.fn()}
        onNavigateToCreate={vi.fn()}
        onPractice={vi.fn()}
        onOpenSync={vi.fn()}
        onOpenFeedback={vi.fn()}
        onOpenPrivacy={vi.fn()}
        onEditCard={vi.fn()}
        onDeleteCards={vi.fn()}
        onUpdateCards={vi.fn()}
        onAddStarterPack={vi.fn()}
        onAddStarterNote={vi.fn()}
        clock={{ now: () => 1000 }}
        onRefreshSync={onRefreshSync}
        haptics={haptics}
      />,
    )

    const mainElement = container.querySelector('main.deck-page')!

    // Mouse drag down (pointerType: 'mouse')
    fireEvent.pointerDown(mainElement, {
      clientY: 100,
      button: 0,
      pointerType: 'mouse',
    })
    fireEvent.pointerMove(mainElement, { clientY: 250, pointerType: 'mouse' })
    fireEvent.pointerUp(mainElement, { pointerType: 'mouse' })

    expect(onRefreshSync).not.toHaveBeenCalled()
    expect(trigger).not.toHaveBeenCalled()
  })

  it('does not trigger onRefreshSync when pull is below threshold', () => {
    const onRefreshSync = vi.fn()
    const haptics = createMockHaptics()

    const { container } = render(
      <DeckManagerView
        cards={mockCards}
        vocabularyCards={mockCards}
        referenceTime={1000}
        saveError={null}
        deletedCardIds={[]}
        queue={[]}
        dueCount={0}
        authUser={{ id: 'u1', email: 'test@example.com' }}
        syncStatus="idle"
        isOnline={true}
        accountNotice={null}
        redirectAuthBanner={null}
        onDismissAccountNotice={vi.fn()}
        onDismissRedirectBanner={vi.fn()}
        onGoHome={vi.fn()}
        onNavigateToCreate={vi.fn()}
        onPractice={vi.fn()}
        onOpenSync={vi.fn()}
        onOpenFeedback={vi.fn()}
        onOpenPrivacy={vi.fn()}
        onEditCard={vi.fn()}
        onDeleteCards={vi.fn()}
        onUpdateCards={vi.fn()}
        onAddStarterPack={vi.fn()}
        onAddStarterNote={vi.fn()}
        clock={{ now: () => 1000 }}
        onRefreshSync={onRefreshSync}
        haptics={haptics}
      />,
    )

    const mainElement = container.querySelector('main.deck-page')!

    // Pull down only slightly (deltaY = 30px)
    fireEvent.pointerDown(mainElement, {
      clientY: 100,
      button: 0,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(mainElement, { clientY: 130, pointerType: 'touch' })
    fireEvent.pointerUp(mainElement)

    expect(onRefreshSync).not.toHaveBeenCalled()
  })

  it('ignores secondary button (right click) on pull-to-refresh', () => {
    const onRefreshSync = vi.fn()
    const { trigger, haptics } = createMockHaptics()

    const { container } = render(
      <DeckManagerView
        cards={mockCards}
        vocabularyCards={mockCards}
        referenceTime={1000}
        saveError={null}
        deletedCardIds={[]}
        queue={[]}
        dueCount={0}
        authUser={{ id: 'u1', email: 'test@example.com' }}
        syncStatus="idle"
        isOnline={true}
        accountNotice={null}
        redirectAuthBanner={null}
        onDismissAccountNotice={vi.fn()}
        onDismissRedirectBanner={vi.fn()}
        onGoHome={vi.fn()}
        onNavigateToCreate={vi.fn()}
        onPractice={vi.fn()}
        onOpenSync={vi.fn()}
        onOpenFeedback={vi.fn()}
        onOpenPrivacy={vi.fn()}
        onEditCard={vi.fn()}
        onDeleteCards={vi.fn()}
        onUpdateCards={vi.fn()}
        onAddStarterPack={vi.fn()}
        onAddStarterNote={vi.fn()}
        clock={{ now: () => 1000 }}
        onRefreshSync={onRefreshSync}
        haptics={haptics}
      />,
    )

    const mainElement = container.querySelector('main.deck-page')!

    fireEvent.pointerDown(mainElement, {
      clientY: 100,
      button: 2,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(mainElement, { clientY: 250, pointerType: 'touch' })
    fireEvent.pointerUp(mainElement)

    expect(onRefreshSync).not.toHaveBeenCalled()
    expect(trigger).not.toHaveBeenCalled()
  })

  it('resets pull distance on pointer cancel without triggering sync', () => {
    const onRefreshSync = vi.fn()
    const { trigger, haptics } = createMockHaptics()

    const { container } = render(
      <DeckManagerView
        cards={mockCards}
        vocabularyCards={mockCards}
        referenceTime={1000}
        saveError={null}
        deletedCardIds={[]}
        queue={[]}
        dueCount={0}
        authUser={{ id: 'u1', email: 'test@example.com' }}
        syncStatus="idle"
        isOnline={true}
        accountNotice={null}
        redirectAuthBanner={null}
        onDismissAccountNotice={vi.fn()}
        onDismissRedirectBanner={vi.fn()}
        onGoHome={vi.fn()}
        onNavigateToCreate={vi.fn()}
        onPractice={vi.fn()}
        onOpenSync={vi.fn()}
        onOpenFeedback={vi.fn()}
        onOpenPrivacy={vi.fn()}
        onEditCard={vi.fn()}
        onDeleteCards={vi.fn()}
        onUpdateCards={vi.fn()}
        onAddStarterPack={vi.fn()}
        onAddStarterNote={vi.fn()}
        clock={{ now: () => 1000 }}
        onRefreshSync={onRefreshSync}
        haptics={haptics}
      />,
    )

    const mainElement = container.querySelector('main.deck-page')!

    fireEvent.pointerDown(mainElement, {
      clientY: 100,
      button: 0,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(mainElement, { clientY: 250, pointerType: 'touch' })
    expect(trigger).toHaveBeenCalledWith('selection')

    fireEvent.pointerCancel(mainElement)

    expect(onRefreshSync).not.toHaveBeenCalled()
  })
})
