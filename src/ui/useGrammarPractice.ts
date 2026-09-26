import { useCallback, useMemo, useRef, useState } from 'react'
import type { Clock } from '../application/ports'
import {
  grammarTopicSchema,
  scheduleReview,
  type Grade,
  type StudyCard,
} from '../domain/card'
import { reconcileStudyCards } from '../domain/sync'
import { createStudySession } from '../domain/study-session'
import {
  availableGrammarCards,
  grammarQueue,
  type GrammarCard,
} from '../domain/grammar'
import type { GrammarTopic, GrammarFocus } from '../domain/grammar-catalog'
import { useStudySession } from './useStudySession'

export const GRAMMAR_TOPIC_STORAGE_KEY = 'jolito-grammar-topic-v1'

export type GrammarTopicStorage = Pick<Storage, 'getItem' | 'setItem'>

function readPersistedTopic(storage?: GrammarTopicStorage): GrammarTopic {
  try {
    const raw = storage?.getItem(GRAMMAR_TOPIC_STORAGE_KEY)
    const result = grammarTopicSchema.safeParse(raw)
    if (result.success) return result.data
  } catch {
    // Storage access may throw in restricted sandboxes or private browsing
  }
  return 'preterite'
}

function persistTopic(topic: GrammarTopic, storage?: GrammarTopicStorage) {
  try {
    storage?.setItem(GRAMMAR_TOPIC_STORAGE_KEY, topic)
  } catch {
    // Ignore storage write failures in restricted environments
  }
}

export function useGrammarPractice({
  cards,
  deletedCardIds,
  clock,
  save,
  storage = typeof localStorage !== 'undefined' ? localStorage : undefined,
  onSessionStart,
}: {
  cards: StudyCard[]
  deletedCardIds: string[]
  clock: Clock
  save: (card: GrammarCard) => void
  storage?: GrammarTopicStorage
  onSessionStart?: () => void
}) {
  const [topic, setSelectedTopic] = useState<GrammarTopic>(() =>
    readPersistedTopic(storage),
  )
  const [focus, setFocus] = useState<GrammarFocus>('mixed')
  const setTopic = (topic: GrammarTopic) => {
    setSelectedTopic(topic)
    setFocus('mixed')
    persistTopic(topic, storage)
  }
  const [mode, setMode] = useState<'choose' | 'practice' | 'complete'>('choose')
  const [snapshots, setSnapshots] = useState<GrammarCard[]>([])
  const [error, setError] = useState<string | null>(null)
  const session = useStudySession(createStudySession([]))
  const gradeLock = useRef(false)
  const available = useMemo(
    () => availableGrammarCards(cards, deletedCardIds),
    [cards, deletedCardIds],
  )
  const audioCards = useMemo(() => {
    if (mode === 'choose')
      return grammarQueue(available, clock.now(), focus, topic)
    return mode === 'practice' ? snapshots : []
  }, [available, clock, focus, mode, snapshots, topic])
  const current = snapshots.find((c) => c.id === session.currentCardId)

  const start = () => {
    onSessionStart?.()
    const selected = grammarQueue(available, clock.now(), focus, topic)
    setSnapshots(selected)
    session.startSession(selected.map((c) => c.id))
    setMode(selected.length ? 'practice' : 'complete')
    setError(null)
    gradeLock.current = false
  }

  const grade = (value: Grade) => {
    if (!current || !session.revealed || gradeLock.current) return undefined
    if (deletedCardIds.includes(current.id)) {
      setError(
        'This form was removed on another device. Choose a pattern to start a fresh round.',
      )
      return undefined
    }
    gradeLock.current = true
    const now = clock.now()
    // Reconcile a newer stored schedule without changing the visible prompt.
    const stored = cards.find((c) => c.id === current.id)
    const base = reconcileStudyCards([current], stored ? [stored] : [])
      .cards[0]!
    const reviewed = {
      ...scheduleReview(base, value, now),
      grammar: current.grammar,
      createdAt: base.createdAt || now,
    }
    try {
      save(reviewed)
    } catch {
      setError(
        'Your progress couldn’t be saved. Free up device storage, then try rating again.',
      )
      gradeLock.current = false
      return undefined
    }
    setError(null)
    setSnapshots((previous) =>
      previous.map((c) => (c.id === reviewed.id ? reviewed : c)),
    )
    const result = session.advanceOnGrade(current.id, reviewed.schedule, [])
    if (result.isComplete) setMode('complete')
    // Reveal is the next explicit user action that unlocks grading.
    return result
  }

  const reveal = () => {
    gradeLock.current = false
    session.reveal()
  }
  const choose = () => setMode('choose')
  const resume = () => setMode('practice')
  const startSession = session.startSession
  const reset = useCallback(() => {
    setMode('choose')
    setSnapshots([])
    startSession([])
  }, [startSession])
  return {
    topic,
    setTopic,
    canResume:
      session.queue.length > 0 && snapshots[0]?.grammar.topic === topic,
    focus,
    setFocus,
    mode,
    current,
    available,
    audioCards,
    session,
    error,
    start,
    grade,
    reveal,
    choose,
    resume,
    reset,
  }
}

export type GrammarPracticeState = ReturnType<typeof useGrammarPractice>
