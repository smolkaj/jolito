import { AccountDeletionRecovery } from './ui/AccountDeletionRecovery'
import type { AccountDeletion } from './application/ports'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createCards } from './application/create-cards'
import { DeckSyncCoordinator } from './application/sync-coordinator'
import type {
  AppServices,
  CardRepository,
  AuthUser,
  PrefetchItem,
  SyncResult,
} from './application/ports'
import {
  filterOutStarterCards,
  starterCards,
  starterHeroPrefetchItems,
} from './application/starter-cards'
import {
  burySiblingCards,
  isDue,
  localeForAnswer,
  localeForPrompt,
  orderCardsForReview,
  scheduleReview,
  updateStudyCard,
  deleteStudyCard,
  DEFAULT_STUDY_BATCH_SIZE,
  type Grade,
  type StudyCard,
  type UpdateCardParams,
} from './domain/card'
import { createStudySession } from './domain/study-session'
import {
  availableGrammarCards,
  grammarContext,
  isGrammarCard,
  type GrammarCard,
} from './domain/grammar'
import { useGrammarPractice } from './ui/useGrammarPractice'
import { StorageRecovery } from './ui/StorageRecovery'
import { GrammarPractice } from './ui/GrammarPractice'
import { useStudySession } from './ui/useStudySession'
import { useStudyAudio } from './ui/useStudyAudio'
import type { StarterPack } from './domain/starter-decks'
import type { SyncStatus } from './domain/sync'
import { mergeStudyCardsSemantic } from './domain/card-merge'
import { isIOS, isStandalone } from './infrastructure/browser/environment'
import { initializeBrowserServices } from './infrastructure/browser/services'
import { checkOrRequestStoragePersistence } from './infrastructure/browser/storage-persistence'
import {
  type View,
  hashForView,
  isFeedbackHash,
  isPrivacyHash,
  isWhyJolitoHash,
  titleForView,
  viewFromHash,
} from './navigation'
import { MexicoFlag, EnglishBadge } from './ui/icons'
import { AudioButton } from './ui/AudioButton'
import { EditCardModal } from './ui/modals/EditCardModal'
import { SyncModal } from './ui/modals/SyncModal'
import { DeleteCardsModal } from './ui/modals/DeleteCardsModal'
import { FeedbackModal } from './ui/modals/FeedbackModal'
import { PrivacyModal } from './ui/modals/PrivacyModal'
import { PracticeCard } from './ui/PracticeCard'
import { SessionComplete } from './ui/SessionComplete'
import { SessionProgress } from './ui/SessionProgress'
import { Brand } from './ui/Brand'
import { ConnectionPill } from './ui/ConnectionPill'
import { RedirectAuthNotice } from './ui/RedirectAuthNotice'
import { AppFooter } from './ui/AppFooter'
import { WelcomeView } from './ui/views/WelcomeView'
import {
  CreateCardView,
  type CreateCardParams,
} from './ui/views/CreateCardView'
import { DeckManagerView } from './ui/views/DeckManagerView'

function getActiveAudioItems(
  cards: StudyCard[],
): Array<{ text: string; locale: string }> {
  const items: Array<{ text: string; locale: string }> = []
  for (const card of cards) {
    if (isGrammarCard(card)) {
      for (const reviews of [0, 1]) {
        const context = grammarContext({
          ...card,
          schedule: { ...card.schedule, reviews },
        })
        items.push(
          { text: context.spokenPrompt, locale: localeForPrompt(card) },
          { text: context.completed, locale: localeForAnswer(card) },
        )
      }
      continue
    }
    if (card.prompt.trim()) {
      items.push({ text: card.prompt, locale: localeForPrompt(card) })
    }
    if (card.answer.trim()) {
      items.push({ text: card.answer, locale: localeForAnswer(card) })
    }
  }
  return items
}

const STORAGE_SAVE_ERROR =
  'Your changes couldn’t be saved. Free up device storage, then try again.'
const OWNERSHIP_SAVE_ERROR =
  'Your account couldn’t be verified. Allow browser storage access, then try again. Your changes have not been saved.'

export function App({
  services: customServices,
}: {
  services?: AppServices
} = {}) {
  const [initialized, setInitialized] = useState(() =>
    customServices
      ? { status: 'ready' as const, services: customServices }
      : initializeBrowserServices(),
  )
  if (initialized.status === 'recovery') {
    return (
      <StorageRecovery
        recovery={initialized}
        onRetry={() => setInitialized(initializeBrowserServices())}
      />
    )
  }
  return <AppWithServices services={initialized.services} />
}

function AppWithServices({ services }: { services: AppServices }) {
  const [identity, setIdentity] = useState(() => ({
    user: services.auth.getCurrentUser(),
    epoch: 0,
  }))
  const identityRef = useRef(identity)
  const [accountNotice, setAccountNotice] = useState<string | null>(null)
  const [pendingCard, setPendingCard] = useState<CreateCardParams | null>(null)
  const [pendingDeletion, setPendingDeletion] =
    useState<AccountDeletion | null>(() => services.cards.getPendingDeletion())
  const [deletionBusy, setDeletionBusy] = useState(false)
  const [deletionError, setDeletionError] = useState<string | null>(null)

  // The durable receipt and the browser/native lock form one transaction:
  // another tab cannot cancel its only recovery evidence while HTTP is pending.
  const runDeletion = async <T,>(operation: () => T | Promise<T>) => {
    setDeletionBusy(true)
    setDeletionError(null)
    try {
      return await services.deletionLock.run(operation)
    } catch (cause) {
      const error =
        cause instanceof Error
          ? cause.message
          : 'Account deletion could not start. Reload Jolito, then try again.'
      setDeletionError(error)
      return { success: false, error }
    } finally {
      setDeletionBusy(false)
    }
  }

  const finishDeletion = async (
    owner: string,
    repository: CardRepository,
  ): Promise<boolean> => {
    try {
      repository.setPendingDeletion('confirmed')
      if (services.auth.getCurrentUser()?.id === owner)
        await services.auth.signOut()
      repository.forget()
      setPendingDeletion(null)
      return true
    } catch {
      setPendingDeletion({ ownerId: owner, phase: 'confirmed' })
      setDeletionError(
        'The local cleanup could not finish. Allow browser storage access and free some space, then try again.',
      )
      return false
    }
  }

  const deleteAccount = async (
    owner: string | null,
    repository: CardRepository,
  ) => {
    if (
      !owner ||
      !services.auth.isCurrentOwner(owner) ||
      !services.auth.deleteAccount
    )
      return {
        success: false,
        error: 'Sign in to the same account before retrying its deletion.',
      }
    let recoveringUnknownOutcome: boolean
    try {
      const previous = repository.getPendingDeletion()
      recoveringUnknownOutcome =
        previous?.ownerId === owner && previous.phase === 'requested'
      repository.setPendingDeletion('requested')
    } catch {
      const error =
        'The deletion request could not be saved. Allow browser storage access and free some space, then try again.'
      setDeletionError(error)
      return { success: false, error }
    }
    const result = await services.auth.deleteAccount().catch(() => ({
      success: false,
      outcomeUnknown: true,
      error: 'Cloud deletion was interrupted. Your local deck has been kept.',
    }))
    if (!result.success) {
      if (pendingDeletion)
        setAccountNotice(
          result.error ??
            'Cloud deletion failed. Your local deck has been kept.',
        )
      try {
        // A rejected retry cannot establish the original interrupted outcome.
        if (result.outcomeUnknown || recoveringUnknownOutcome)
          setPendingDeletion({ ownerId: owner, phase: 'requested' })
        else {
          repository.setPendingDeletion(null)
          setPendingDeletion(null)
        }
      } catch {
        setPendingDeletion({ ownerId: owner, phase: 'requested' })
      }
      setDeletionError(
        result.error ??
          'Cloud account deletion failed. Your local deck has been kept.',
      )
      return result
    }
    const complete = await finishDeletion(owner, repository)
    if (complete) setAccountNotice('Cloud account and backup data deleted.')
    return {
      success: complete,
      error: complete
        ? undefined
        : 'Your cloud account was deleted, but local cleanup still needs to finish.',
    }
  }
  useEffect(
    () =>
      services.auth.onAuthStateChange((user) => {
        const previous = identityRef.current
        if (previous.user?.id !== user?.id) setAccountNotice(null)
        const next = {
          user,
          epoch: previous.epoch + (previous.user?.id !== user?.id ? 1 : 0),
        }
        identityRef.current = next
        setIdentity(next)
      }),
    [services.auth],
  )
  const ownerId = identity.user?.id ?? null
  const isCurrentOwner = useCallback(
    () =>
      identityRef.current.epoch === identity.epoch &&
      services.auth.isCurrentOwner(ownerId),
    [identity.epoch, ownerId, services.auth],
  )
  const ownedServices = useMemo(
    () => ({ ...services, cards: services.cards.forOwner(ownerId) }),
    [ownerId, services],
  )
  if (pendingDeletion) {
    const repository = services.cards.forOwner(pendingDeletion.ownerId)
    return (
      <AccountDeletionRecovery
        deletion={pendingDeletion}
        canRetryCloud={ownerId === pendingDeletion.ownerId}
        busy={deletionBusy}
        error={deletionError}
        onRetryCloud={() => {
          void runDeletion(() =>
            deleteAccount(pendingDeletion.ownerId, repository),
          )
        }}
        onRetryCleanup={() => {
          void runDeletion(() =>
            finishDeletion(pendingDeletion.ownerId, repository),
          )
        }}
        onKeep={() => {
          void runDeletion(() => {
            try {
              repository.setPendingDeletion(null)
              setPendingDeletion(null)
            } catch {
              throw new Error(
                'The pending request could not be cleared. Allow browser storage access, then try again.',
              )
            }
          })
        }}
      />
    )
  }
  return (
    <OwnedApp
      onDeleteAccount={() =>
        runDeletion(() => deleteAccount(ownerId, ownedServices.cards))
      }
      accountNotice={accountNotice}
      onDismissAccountNotice={() => setAccountNotice(null)}
      key={`${ownerId === null ? 'guest' : `user:${ownerId}`}:${identity.epoch}`}
      services={ownedServices}
      authUser={identity.user}
      pendingCard={pendingCard}
      setPendingCard={setPendingCard}
      isCurrentOwner={isCurrentOwner}
    />
  )
}

type OwnedAppProps = {
  accountNotice: string | null
  onDismissAccountNotice: () => void
  onDeleteAccount: () => Promise<{
    success: boolean
    error?: string | undefined
  }>
  services: AppServices
  authUser: AuthUser | null
  pendingCard: CreateCardParams | null
  setPendingCard: (card: CreateCardParams | null) => void
  isCurrentOwner: () => boolean
}

function OwnedApp(props: OwnedAppProps) {
  const fallback = props.authUser ? [] : starterCards
  const [loaded, setLoaded] = useState(() =>
    props.services.cards.load(fallback),
  )
  if (loaded.status === 'recovery') {
    return (
      <StorageRecovery
        recovery={loaded}
        onRetry={() => setLoaded(props.services.cards.load(fallback))}
      />
    )
  }
  return <LoadedApp {...props} initialCards={loaded.cards} />
}

function LoadedApp({
  services,
  accountNotice,
  onDismissAccountNotice,
  onDeleteAccount,
  initialCards,
  authUser,
  pendingCard,
  setPendingCard,
  isCurrentOwner,
}: OwnedAppProps & { initialCards: StudyCard[] }) {
  const lifetime = useRef({ active: true })
  useEffect(() => {
    const current = lifetime.current
    current.active = true
    return () => {
      current.active = false
    }
  }, [])
  const canCommit = useCallback(
    () => lifetime.current.active && isCurrentOwner(),
    [isCurrentOwner],
  )
  const initialResolved = useMemo<{
    view: View
    queue: string[]
  }>(() => {
    if (typeof window === 'undefined') {
      return { view: 'welcome', queue: [] }
    }
    const hash = window.location.hash
    if (hash === '') {
      window.history.replaceState({ view: 'welcome' }, '', '#/')
    }
    const requested = viewFromHash(hash)
    if (requested === 'review') {
      const now = services.clock.now()
      const due = orderCardsForReview(
        initialCards.filter((card) => !isGrammarCard(card)),
        now,
        DEFAULT_STUDY_BATCH_SIZE,
      ).map(({ id }) => id)
      if (due.length === 0) {
        return { view: 'complete', queue: [] }
      }
      return { view: 'review', queue: due }
    }
    return { view: requested, queue: [] }
  }, [initialCards, services.clock])

  const [cards, setCards] = useState<StudyCard[]>(initialCards)
  const [saveError, setSaveError] = useState<string | null>(null)
  const vocabularyCards = useMemo(
    () => cards.filter((card) => !isGrammarCard(card)),
    [cards],
  )
  const [view, setView] = useState<View>(initialResolved.view)

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = titleForView(view)
    }
  }, [view])

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      view !== 'welcome' ||
      !isWhyJolitoHash(window.location.hash)
    ) {
      return undefined
    }
    const timer = window.setTimeout(() => {
      document.getElementById('why-jolito')?.scrollIntoView()
    }, 50)
    return () => window.clearTimeout(timer)
  }, [view])

  const initialSession = useMemo(
    () => createStudySession(initialResolved.queue),
    [initialResolved.queue],
  )
  const studySession = useStudySession(initialSession)
  const {
    queue,
    practicedCount,
    answer,
    setAnswer,
    revealed,
    reveal: revealSession,
    resetPromptState,
    startSession,
    advanceOnGrade,
    filterCards,
    progressPercentage,
    remainingCount,
  } = studySession

  const [savedToast, setSavedToast] = useState<string | null>(null)
  const savedToastTimerRef = useRef<number | null>(null)
  const welcomeRef = useRef<HTMLElement>(null)

  const [isSyncOpen, setIsSyncOpen] = useState(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(() =>
    typeof window !== 'undefined'
      ? isFeedbackHash(window.location.hash)
      : false,
  )
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(() =>
    typeof window !== 'undefined' ? isPrivacyHash(window.location.hash) : false,
  )
  const [redirectAuthBanner, setRedirectAuthBanner] = useState<string | null>(
    () => {
      if (services.auth.consumeRedirectAuth?.()) {
        if (!isStandalone() && isIOS()) {
          return 'Signed in! Using the Home Screen app?'
        }
      }
      return null
    },
  )

  const [editingCard, setEditingCard] = useState<StudyCard | null>(null)
  const [deletingCards, setDeletingCards] = useState<StudyCard[] | null>(null)
  const [deletedCardIds, setDeletedCardIds] = useState<string[]>(() =>
    services.cards.getDeletedCardIds(),
  )

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )

  const [referenceTime, setReferenceTime] = useState(() => services.clock.now())
  const currentCard = cards.find(({ id }) => id === queue[0])
  const dueCount = vocabularyCards.filter((card) =>
    isDue(card, referenceTime),
  ).length

  const paused =
    editingCard !== null ||
    deletingCards !== null ||
    isSyncOpen ||
    isFeedbackOpen ||
    isPrivacyOpen

  const {
    audioUnavailable,
    cancelPendingAudio,
    playAudio,
    playPromptAudio,
    playAnswerAudio,
    playRevealSensory,
    playGradeSensory,
  } = useStudyAudio({
    speaker: services.speaker,
    sounds: services.sounds,
    haptics: services.haptics,
    currentCard: view === 'review' ? currentCard : undefined,
    view,
    paused,
    autoplayPrompt: !revealed,
  })

  const navigateTo = useCallback(
    (nextView: View, replace = false) => {
      cancelPendingAudio()
      setView(nextView)
      if (typeof window === 'undefined') return
      const targetHash = hashForView(nextView)
      if (window.location.hash !== targetHash) {
        if (replace) {
          window.history.replaceState({ view: nextView }, '', targetHash)
        } else {
          window.history.pushState({ view: nextView }, '', targetHash)
        }
      }
    },
    [cancelPendingAudio],
  )

  const cardsRef = useRef(cards)
  const viewRef = useRef(view)
  const authUserRef = useRef(authUser)
  const pendingCardRef = useRef(pendingCard)
  const deletedCardIdsRef = useRef<Set<string>>(new Set(deletedCardIds))
  const queueRef = useRef(queue)

  useEffect(() => {
    cardsRef.current = cards
    viewRef.current = view
    authUserRef.current = authUser
    pendingCardRef.current = pendingCard
    deletedCardIdsRef.current = new Set(deletedCardIds)
    queueRef.current = queue
  })

  const coordinatorRef = useRef<DeckSyncCoordinator | null>(null)
  const requestSync = useCallback((): Promise<SyncResult> => {
    if (!canCommit() || !coordinatorRef.current) {
      return Promise.resolve({
        success: false,
        error: 'Sign in to sync your deck with the cloud.',
      })
    }
    return coordinatorRef.current.request()
  }, [canCommit])

  const onUpdateCards = useCallback(
    (
      newCards: StudyCard[],
      syncToCloud = true,
      newDeletedCardIds?: string[],
    ) => {
      if (!canCommit()) {
        if (lifetime.current.active) setSaveError(OWNERSHIP_SAVE_ERROR)
        return false
      }
      const nextDeletedIds = new Set(
        newDeletedCardIds ?? deletedCardIdsRef.current,
      )
      for (const card of newCards) nextDeletedIds.delete(card.id)
      const deletedIdsArray = Array.from(nextDeletedIds)

      try {
        services.cards.save(newCards, deletedIdsArray)
      } catch {
        setSaveError(STORAGE_SAVE_ERROR)
        return false
      }
      setSaveError(null)
      deletedCardIdsRef.current = nextDeletedIds
      const previousCards = cardsRef.current
      cardsRef.current = newCards
      setCards(newCards)
      setDeletedCardIds(deletedIdsArray)
      const now = services.clock.now()
      setReferenceTime(now)
      const cardIdSet = new Set(newCards.map((c) => c.id))
      const { becameEmpty } = filterCards(cardIdSet)
      if (becameEmpty && viewRef.current === 'review') {
        navigateTo('complete')
      }
      if (syncToCloud) void requestSync()

      if (typeof services.speaker.pruneUnusedAudio === 'function') {
        const nextActiveItems = getActiveAudioItems(newCards)
        const previousActiveKeys = new Set(
          getActiveAudioItems(previousCards).map(
            (i) => `${i.locale}:${i.text}`,
          ),
        )
        const nextActiveKeys = new Set(
          nextActiveItems.map((i) => `${i.locale}:${i.text}`),
        )
        let hasRemovedAudio =
          (newDeletedCardIds !== undefined && newDeletedCardIds.length > 0) ||
          newCards.length < previousCards.length
        if (!hasRemovedAudio) {
          for (const prevKey of previousActiveKeys) {
            if (!nextActiveKeys.has(prevKey)) {
              hasRemovedAudio = true
              break
            }
          }
        }

        if (hasRemovedAudio) {
          // Unpracticed catalog forms are available even before their first save.
          // Keep their warmed audio through deck edits and remote reconciliation.
          void services.speaker.pruneUnusedAudio(
            getActiveAudioItems([
              ...newCards.filter((card) => !isGrammarCard(card)),
              ...availableGrammarCards(newCards, deletedIdsArray),
            ]),
          )
        }
      }
      return true
    },
    [
      filterCards,
      navigateTo,
      canCommit,
      services.cards,
      services.clock,
      services.speaker,
      requestSync,
    ],
  )

  const handleSaveEdit = useCallback(
    (cardId: string, updates: UpdateCardParams) => {
      const current = cardsRef.current.find((card) => card.id === cardId)
      if (!current) {
        setSaveError(
          'This card was removed from your deck. Your draft is still here.',
        )
        return false
      }
      const updated = updateStudyCard(current, updates, services.clock.now())
      const newCards = cardsRef.current.map((card) =>
        card.id === cardId ? updated : card,
      )
      if (!onUpdateCards(newCards)) return false
      setEditingCard(null)
      return true
    },
    [onUpdateCards, services.clock],
  )

  const handleConfirmDelete = useCallback(
    (cardsToDelete: StudyCard[]) => {
      const idsToDelete = new Set(cardsToDelete.map((c) => c.id))
      let updatedCards = cardsRef.current
      for (const id of idsToDelete) {
        updatedCards = deleteStudyCard(updatedCards, id)
      }
      const updatedDeletedIds = Array.from(
        new Set([...deletedCardIdsRef.current, ...idsToDelete]),
      )
      if (!onUpdateCards(updatedCards, true, updatedDeletedIds)) return
      setDeletingCards(null)
    },
    [onUpdateCards],
  )

  const nextBatchCount = useMemo(
    () =>
      orderCardsForReview(
        vocabularyCards,
        referenceTime,
        DEFAULT_STUDY_BATCH_SIZE,
      ).length,
    [vocabularyCards, referenceTime],
  )

  const saveCardFromParams = useCallback(
    (params: CreateCardParams) => {
      const created = createCards(params, {
        clock: services.clock,
        ids: services.ids,
      })
      if (created.length === 0) return false

      const userCards = filterOutStarterCards(cardsRef.current)
      if (!onUpdateCards([...created, ...userCards])) return false
      const savedSpanish = params.spanish.trim()
      setSavedToast(savedSpanish)
      if (savedToastTimerRef.current !== null) {
        window.clearTimeout(savedToastTimerRef.current)
      }
      savedToastTimerRef.current = window.setTimeout(() => {
        setSavedToast(null)
        savedToastTimerRef.current = null
      }, 3000)

      setPendingCard(null)
      pendingCardRef.current = null
      return true
    },
    [onUpdateCards, services.clock, services.ids, setPendingCard],
  )

  const handleSaveCard = useCallback(
    (cardParams: CreateCardParams): boolean => {
      if (!authUserRef.current) {
        setPendingCard(cardParams)
        pendingCardRef.current = cardParams
        setIsSyncOpen(true)
        return false
      }
      return saveCardFromParams(cardParams)
    },
    [saveCardFromParams, setPendingCard],
  )

  const handleAddStarterCards = useCallback(
    (newCards: StudyCard[]) => {
      const userCards = filterOutStarterCards(cardsRef.current)
      const mergeResult = mergeStudyCardsSemantic(userCards, newCards)
      return onUpdateCards(mergeResult.cards, true)
    },
    [onUpdateCards],
  )

  const handleAddStarterPack = useCallback(
    (pack: StarterPack) => {
      const now = services.clock.now()
      return handleAddStarterCards(pack.createCards(now))
    },
    [handleAddStarterCards, services.clock],
  )

  const handleAddStarterNote = useCallback(
    (pack: StarterPack, noteIndex: number) => {
      const now = services.clock.now()
      return handleAddStarterCards(pack.createNoteCards(noteIndex, now))
    },
    [handleAddStarterCards, services.clock],
  )

  const handleCopySessionLink = useCallback(async () => {
    const link = services.auth.getSessionLink?.()
    if (!link || typeof navigator === 'undefined' || !navigator.clipboard) {
      return false
    }
    try {
      await navigator.clipboard.writeText(link)
      return true
    } catch {
      return false
    }
  }, [services.auth])

  const onUpdateCardsRef = useRef(onUpdateCards)
  useEffect(() => {
    onUpdateCardsRef.current = onUpdateCards
  })
  useEffect(() => {
    const user = authUserRef.current
    if (user) {
      let userCards = filterOutStarterCards(cardsRef.current)
      if (pendingCardRef.current) {
        const pending = pendingCardRef.current
        const created = createCards(pending, {
          clock: services.clock,
          ids: services.ids,
        })
        if (created.length > 0) {
          userCards = [...created, ...userCards]
          if (!onUpdateCardsRef.current(userCards, false)) return
          const savedSpanish = pending.spanish.trim()
          setSavedToast(savedSpanish)
          if (savedToastTimerRef.current !== null) {
            window.clearTimeout(savedToastTimerRef.current)
          }
          savedToastTimerRef.current = window.setTimeout(() => {
            setSavedToast(null)
            savedToastTimerRef.current = null
          }, 3000)
        }

        setPendingCard(null)
        pendingCardRef.current = null
        setIsSyncOpen(false)
      }
    }
  }, [services.clock, services.ids, setPendingCard])

  useEffect(() => {
    const user = authUserRef.current
    if (!user) return
    const coordinator = new DeckSyncCoordinator(
      user,
      services.sync,
      () => ({
        cards: filterOutStarterCards(cardsRef.current),
        deletedCardIds: Array.from(deletedCardIdsRef.current),
      }),
      (deck) =>
        canCommit() &&
        onUpdateCardsRef.current(deck.cards, false, deck.deletedCardIds),
      (status) => {
        if (canCommit()) setSyncStatus(status)
      },
    )
    coordinatorRef.current = coordinator
    void coordinator.request()
    return () => {
      coordinator.dispose()
      coordinatorRef.current = null
    }
  }, [services.sync, canCommit])

  const syncDebounceTimerRef = useRef<number | null>(null)

  const flushSync = useCallback(() => {
    if (syncDebounceTimerRef.current !== null) {
      window.clearTimeout(syncDebounceTimerRef.current)
      syncDebounceTimerRef.current = null
    }
    void requestSync()
  }, [requestSync])

  const flushSyncRef = useRef(flushSync)
  useEffect(() => {
    flushSyncRef.current = flushSync
  })

  const scheduleDebouncedSync = useCallback(() => {
    if (!authUserRef.current) return
    if (syncDebounceTimerRef.current !== null) {
      window.clearTimeout(syncDebounceTimerRef.current)
    }
    syncDebounceTimerRef.current = window.setTimeout(() => {
      syncDebounceTimerRef.current = null
      void requestSync()
    }, 1500)
  }, [requestSync])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onOnline = () => {
      setIsOnline(true)
      flushSyncRef.current()
    }
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSyncRef.current()
      } else if (document.visibilityState === 'visible') {
        flushSyncRef.current()
      }
    }

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        flushSyncRef.current()
      }
    }

    const handlePageHide = () => {
      flushSyncRef.current()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('pagehide', handlePageHide)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('pagehide', handlePageHide)
      if (syncDebounceTimerRef.current !== null) {
        window.clearTimeout(syncDebounceTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    void checkOrRequestStoragePersistence()
  }, [])

  useEffect(() => {
    const onPopState = () => {
      cancelPendingAudio()
      const currentHash = window.location.hash
      if (isPrivacyHash(currentHash)) {
        setIsPrivacyOpen(true)
      }
      if (isFeedbackHash(currentHash)) {
        setIsFeedbackOpen(true)
      }
      const nextView = viewFromHash(currentHash)
      setView(nextView)
      if (nextView === 'welcome') {
        resetPromptState()
        if (isWhyJolitoHash(currentHash)) {
          document.getElementById('why-jolito')?.scrollIntoView()
        } else {
          welcomeRef.current?.scrollTo({ top: 0 })
        }
      } else if (nextView === 'review') {
        if (queueRef.current.length === 0) {
          const now = services.clock.now()
          const newQueue = orderCardsForReview(
            cardsRef.current.filter((card) => !isGrammarCard(card)),
            now,
            DEFAULT_STUDY_BATCH_SIZE,
          ).map(({ id }) => id)
          startSession(newQueue)
        }
      }
    }
    window.addEventListener('popstate', onPopState)
    window.addEventListener('hashchange', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('hashchange', onPopState)
    }
  }, [cancelPendingAudio, resetPromptState, services.clock, startSession])

  useEffect(() => {
    return () => {
      if (savedToastTimerRef.current !== null) {
        window.clearTimeout(savedToastTimerRef.current)
      }
    }
  }, [])

  const grade = useCallback(
    (gradeValue: Grade) => {
      if (!currentCard) return
      const now = services.clock.now()
      const reviewed = scheduleReview(currentCard, gradeValue, now)
      const { updatedCards, buriedCardIds } = burySiblingCards(
        cardsRef.current,
        currentCard,
        now,
      )
      const nextCards = updatedCards.map((card) =>
        card.id === reviewed.id ? reviewed : card,
      )
      if (!onUpdateCards(nextCards, false)) return

      const { isComplete } = advanceOnGrade(
        currentCard.id,
        reviewed.schedule,
        buriedCardIds,
      )

      playGradeSensory(gradeValue, isComplete)

      if (isComplete) {
        flushSync()
        navigateTo('complete')
      } else {
        scheduleDebouncedSync()
      }
    },
    [
      advanceOnGrade,
      currentCard,
      onUpdateCards,
      flushSync,
      navigateTo,
      playGradeSensory,
      scheduleDebouncedSync,
      services.clock,
    ],
  )

  function goHome() {
    setReferenceTime(services.clock.now())
    navigateTo('welcome')
    resetPromptState()
  }

  function handlePractice() {
    if (queue.length > 0) {
      navigateTo('review')
    } else {
      beginReview()
    }
  }

  function beginReview(cardIds?: string[]) {
    cancelPendingAudio()
    const now = services.clock.now()
    const nextQueue =
      cardIds ??
      orderCardsForReview(vocabularyCards, now, DEFAULT_STUDY_BATCH_SIZE).map(
        ({ id }) => id,
      )
    startSession(nextQueue)
    setReferenceTime(now)
    navigateTo(nextQueue.length > 0 ? 'review' : 'complete')
  }

  function reveal() {
    if (revealed || !currentCard) return
    revealSession()
    playRevealSensory()
  }

  const openSyncModal = useCallback(() => {
    setIsSyncOpen(true)
  }, [])

  const closeSyncModal = useCallback(() => {
    setIsSyncOpen(false)
    setPendingCard(null)
    pendingCardRef.current = null
  }, [setPendingCard])

  const openFeedbackModal = useCallback(() => {
    setIsFeedbackOpen(true)
  }, [])

  const closeFeedbackModal = useCallback(() => {
    setIsFeedbackOpen(false)
    if (typeof window !== 'undefined' && isFeedbackHash(window.location.hash)) {
      window.history.pushState({ view }, '', hashForView(view))
    }
  }, [view])

  const openPrivacyModal = useCallback(() => {
    setIsPrivacyOpen(true)
  }, [])

  const closePrivacyModal = useCallback(() => {
    setIsPrivacyOpen(false)
    if (typeof window !== 'undefined' && isPrivacyHash(window.location.hash)) {
      window.history.pushState({ view }, '', hashForView(view))
    }
  }, [view])

  const handleSavePendingLocally = useCallback(() => {
    if (pendingCardRef.current) {
      if (!saveCardFromParams(pendingCardRef.current)) return
      pendingCardRef.current = null
      setPendingCard(null)
    }
    setIsSyncOpen(false)
  }, [saveCardFromParams, setPendingCard])

  const saveGrammarCard = (card: GrammarCard) => {
    // Save through the shared repository, preserving edits made during the round.
    const next = [
      ...cardsRef.current.filter((existing) => existing.id !== card.id),
      card,
    ]
    if (!onUpdateCards(next, false))
      throw new Error('Progress could not be saved')
    scheduleDebouncedSync()
  }
  const grammarPractice = useGrammarPractice({
    cards,
    deletedCardIds,
    clock: services.clock,
    save: saveGrammarCard,
  })

  // Prepare the active learning mode first; grammar includes both sentence contexts.
  useEffect(() => {
    if (typeof services.speaker.prefetch !== 'function') {
      return
    }

    const items: PrefetchItem[] = []

    // 1. Prioritize starter screen hero sample audio when on welcome screen
    if (view === 'welcome') {
      items.push(...starterHeroPrefetchItems)
    }

    if (view === 'grammar') {
      items.push(...getActiveAudioItems(grammarPractice.audioCards))
    } else if (vocabularyCards.length > 0) {
      const now = services.clock.now()
      const dueCards = orderCardsForReview(vocabularyCards, now)
      const dueIds = new Set(dueCards.map((c) => c.id))
      const nonDueCards = vocabularyCards.filter((c) => !dueIds.has(c.id))
      const allOrderedCards = [...dueCards, ...nonDueCards]

      // Background prefetching defaults to bothVoices !== false, priming both
      // female and male personas into cache so that any review turn is immediately ready.
      for (const card of allOrderedCards) {
        if (card.prompt.trim()) {
          items.push({
            text: card.prompt,
            locale: localeForPrompt(card),
            cardSeed: card.id,
          })
        }
        if (card.answer.trim()) {
          items.push({
            text: card.answer,
            locale: localeForAnswer(card),
            cardSeed: card.id,
          })
        }
      }
    }

    if (items.length > 0) {
      void services.speaker.prefetch(items)
    }
  }, [
    grammarPractice.audioCards,
    vocabularyCards,
    services.clock,
    services.speaker,
    view,
  ])

  const renderAppModals = () => (
    <>
      <SyncModal
        user={authUser}
        onDeleteAccount={onDeleteAccount}
        isOpen={isSyncOpen}
        onClose={closeSyncModal}
        cards={cards}
        auth={services.auth}
        onSync={requestSync}
        clock={services.clock}
        onSaveLocally={pendingCard ? handleSavePendingLocally : undefined}
        pendingCardPrompt={pendingCard ? pendingCard.spanish.trim() : undefined}
        onOpenPrivacy={openPrivacyModal}
        onOpenFeedback={openFeedbackModal}
      />
      <EditCardModal
        saveError={saveError}
        isOpen={editingCard !== null}
        card={editingCard}
        cards={cards}
        onClose={() => setEditingCard(null)}
        onSave={handleSaveEdit}
        onPlayAudio={playAudio}
      />
      <DeleteCardsModal
        saveError={saveError}
        isOpen={deletingCards !== null}
        cards={deletingCards}
        onClose={() => setDeletingCards(null)}
        onConfirm={handleConfirmDelete}
      />
      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={closeFeedbackModal}
        user={authUser}
        feedbackService={services.feedback}
        currentView={view}
      />
      <PrivacyModal isOpen={isPrivacyOpen} onClose={closePrivacyModal} />
    </>
  )

  if (view === 'welcome') {
    return (
      <>
        <WelcomeView
          authUser={authUser}
          syncStatus={syncStatus}
          isOnline={isOnline}
          saveError={saveError}
          accountNotice={accountNotice}
          redirectAuthBanner={redirectAuthBanner}
          onDismissAccountNotice={onDismissAccountNotice}
          onDismissRedirectBanner={() => setRedirectAuthBanner(null)}
          onCopySessionLink={handleCopySessionLink}
          onNavigateToDeck={() => navigateTo('deck')}
          onNavigateToCreate={() => navigateTo('create')}
          onNavigateToGrammar={() => navigateTo('grammar')}
          onPractice={handlePractice}
          onOpenSync={openSyncModal}
          onOpenFeedback={openFeedbackModal}
          onPlayAudio={playAudio}
          welcomeRef={welcomeRef}
        />
        {renderAppModals()}
      </>
    )
  }

  if (view === 'create') {
    return (
      <>
        <CreateCardView
          vocabularyCards={vocabularyCards}
          referenceTime={referenceTime}
          saveError={saveError}
          savedToast={savedToast}
          pendingCard={pendingCard}
          authUser={authUser}
          syncStatus={syncStatus}
          isOnline={isOnline}
          accountNotice={accountNotice}
          redirectAuthBanner={redirectAuthBanner}
          onDismissAccountNotice={onDismissAccountNotice}
          onDismissRedirectBanner={() => setRedirectAuthBanner(null)}
          onCopySessionLink={handleCopySessionLink}
          onGoHome={goHome}
          onNavigateToDeck={() => navigateTo('deck')}
          onPractice={handlePractice}
          canPractice={queue.length > 0 || dueCount > 0}
          onOpenSync={openSyncModal}
          onEditCard={(card) => setEditingCard(card)}
          onOpenFeedback={openFeedbackModal}
          onOpenPrivacy={openPrivacyModal}
          onSaveCard={handleSaveCard}
          onPlayAudio={playAudio}
          assistant={services.assistant}
        />
        {renderAppModals()}
      </>
    )
  }

  if (view === 'deck') {
    return (
      <>
        <DeckManagerView
          cards={cards}
          vocabularyCards={vocabularyCards}
          referenceTime={referenceTime}
          saveError={saveError}
          deletedCardIds={deletedCardIds}
          queue={queue}
          dueCount={dueCount}
          authUser={authUser}
          syncStatus={syncStatus}
          isOnline={isOnline}
          accountNotice={accountNotice}
          redirectAuthBanner={redirectAuthBanner}
          onDismissAccountNotice={onDismissAccountNotice}
          onDismissRedirectBanner={() => setRedirectAuthBanner(null)}
          onCopySessionLink={handleCopySessionLink}
          onGoHome={goHome}
          onNavigateToCreate={() => navigateTo('create')}
          onPractice={handlePractice}
          onOpenSync={openSyncModal}
          onOpenFeedback={openFeedbackModal}
          onOpenPrivacy={openPrivacyModal}
          onEditCard={(card) => setEditingCard(card)}
          onDeleteCards={(cardsToDelete) => setDeletingCards(cardsToDelete)}
          onUpdateCards={onUpdateCards}
          onAddStarterPack={handleAddStarterPack}
          onAddStarterNote={handleAddStarterNote}
          clock={services.clock}
        />
        {renderAppModals()}
      </>
    )
  }

  const grammar = view === 'grammar'
  const complete = grammar
    ? grammarPractice.mode === 'complete'
    : view === 'complete' || !currentCard
  const practicing = grammar ? grammarPractice.mode === 'practice' : !complete

  return (
    <>
      <main
        className={`app-shell ${complete ? 'complete-page' : practicing ? 'review-page' : 'grammar-page'}`}
      >
        <nav
          className="topbar"
          aria-label={practicing ? 'Review navigation' : 'Session navigation'}
        >
          <Brand onClick={goHome} />
          <div className="nav-actions" data-nosnippet>
            {grammar ? (
              grammarPractice.mode !== 'choose' && (
                <button
                  className="text-button"
                  onClick={grammarPractice.choose}
                >
                  <span aria-hidden="true">←</span> Grammar
                </button>
              )
            ) : (
              <>
                <button
                  className="text-button"
                  onClick={() => navigateTo('deck')}
                >
                  Manage deck
                </button>
                <button
                  className="text-button"
                  onClick={() => navigateTo('create')}
                >
                  + New card
                </button>
              </>
            )}
            <ConnectionPill
              authUser={authUser}
              syncStatus={syncStatus}
              isOnline={isOnline}
              onClick={() => openSyncModal()}
            />
          </div>
        </nav>
        {saveError && !(practicing && !grammar) && !grammarPractice.error && (
          <p className="storage-save-error" role="alert">
            {saveError}
          </p>
        )}
        <RedirectAuthNotice
          message={accountNotice ?? redirectAuthBanner}
          onDismiss={() => {
            onDismissAccountNotice()
            setRedirectAuthBanner(null)
          }}
          onCopySessionLink={handleCopySessionLink}
        />
        {practicing && (
          <SessionProgress
            percentage={
              grammar
                ? grammarPractice.session.progressPercentage
                : progressPercentage
            }
            remaining={
              grammar ? grammarPractice.session.remainingCount : remainingCount
            }
            unit={grammar ? 'form' : 'card'}
          />
        )}
        {grammar ? (
          <GrammarPractice
            saveError={saveError}
            practice={grammarPractice}
            services={services}
            onHome={goHome}
            paused={paused}
            signedIn={Boolean(authUser)}
            onSignIn={() => openSyncModal()}
          />
        ) : complete ? (
          <SessionComplete
            practicedCount={practicedCount}
            unit="card"
            demo={!authUser}
            emptyMessage={
              authUser
                ? 'Nothing is due right now. Add something from your day in CDMX?'
                : 'You’re exploring demo cards.'
            }
            primaryAction={
              nextBatchCount > 0
                ? {
                    label: `Practice next ${nextBatchCount}`,
                    onClick: () => beginReview(),
                  }
                : {
                    label: 'Create a card',
                    onClick: () => navigateTo('create'),
                  }
            }
            onHome={goHome}
          >
            {!authUser && (
              <p className="complete-subtext">
                <button
                  type="button"
                  className="complete-link-button"
                  onClick={() => openSyncModal()}
                >
                  Sign in
                </button>{' '}
                to create and sync your personal deck.
              </p>
            )}
          </SessionComplete>
        ) : (
          currentCard && (
            <PracticeCard
              error={
                saveError === STORAGE_SAVE_ERROR
                  ? 'Your progress couldn’t be saved. Free up device storage, then try rating again.'
                  : saveError
              }
              card={currentCard}
              prompt={
                <>
                  <div className="study-prompt-wrap">
                    <h1
                      lang={localeForPrompt(currentCard)}
                      className={`study-prompt ${currentCard.prompt.trim().length > 100 ? 'is-long' : currentCard.prompt.trim().length > 50 ? 'is-medium' : ''}`.trim()}
                    >
                      {currentCard.prompt}
                    </h1>
                    <AudioButton
                      prompt
                      label="Play prompt audio"
                      onClick={() => playPromptAudio()}
                    />
                  </div>
                  <div className="prompt-meta">
                    <p className="eyebrow direction-eyebrow">
                      {currentCard.direction === 'es-en' ? (
                        <>
                          <MexicoFlag /> MEXICAN SPANISH → <EnglishBadge />{' '}
                          ENGLISH
                        </>
                      ) : (
                        <>
                          <EnglishBadge /> ENGLISH → <MexicoFlag /> MEXICAN
                          SPANISH
                        </>
                      )}
                    </p>
                  </div>
                </>
              }
              answer={answer}
              revealed={revealed}
              onAnswerChange={setAnswer}
              onReveal={reveal}
              onGrade={grade}
              onPlayAnswer={() => playAnswerAudio()}
              onPlayPrompt={() => playPromptAudio()}
              onEdit={() => setEditingCard(currentCard)}
              onDelete={() => setDeletingCards([currentCard])}
              paused={paused}
              audioUnavailable={audioUnavailable}
            >
              {currentCard.context && (
                <div className="reveal-context-block">
                  <span className="context-label">Additional Context</span>
                  <p className="context-text">{currentCard.context}</p>
                </div>
              )}
            </PracticeCard>
          )
        )}
        {!practicing && (
          <AppFooter
            onOpenFeedback={openFeedbackModal}
            onOpenPrivacy={openPrivacyModal}
          />
        )}
      </main>
      {renderAppModals()}
    </>
  )
}
