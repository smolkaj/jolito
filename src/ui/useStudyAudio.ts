import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  HapticsPlayer,
  SoundPlayer,
  Speaker,
  SpeakerOptions,
} from '../application/ports'
import {
  localeForAnswer,
  localeForPrompt,
  type Grade,
  type StudyCard,
} from '../domain/card'

export const DEFAULT_REVEAL_AUDIO_STAGGER_MS = 120

export function cardReviewSeed(card: StudyCard): string {
  return `${card.id}:turn${card.schedule.reviews}`
}

export interface UseStudyAudioOptions {
  speaker: Speaker
  sounds: SoundPlayer
  haptics?: HapticsPlayer | undefined
  currentCard?: StudyCard | undefined
  view?: string | undefined
  paused?: boolean | undefined
  autoplayPrompt?: boolean | undefined
  staggerMs?: number | undefined
}

export function useStudyAudio({
  speaker,
  sounds,
  haptics,
  currentCard,
  view,
  paused = false,
  autoplayPrompt = true,
  staggerMs = DEFAULT_REVEAL_AUDIO_STAGGER_MS,
}: UseStudyAudioOptions) {
  const [audioUnavailable, setAudioUnavailable] = useState(
    () => !speaker.supported(),
  )

  const [activeTarget, setActiveTarget] = useState<'prompt' | 'answer' | null>(
    null,
  )
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const playGenerationRef = useRef(0)
  const revealAudioTimerRef = useRef<number | null>(null)

  const clearPendingTimer = useCallback(() => {
    if (revealAudioTimerRef.current !== null) {
      window.clearTimeout(revealAudioTimerRef.current)
      revealAudioTimerRef.current = null
    }
  }, [])

  const cancelPendingAudio = useCallback(() => {
    clearPendingTimer()
    playGenerationRef.current++
    speaker.stop?.()
    setActiveTarget(null)
    setIsAudioPlaying(false)
  }, [clearPendingTimer, speaker])

  const playAudio = useCallback(
    (
      text: string,
      locale: string,
      cardSeed?: string,
      options?: SpeakerOptions,
      target: 'prompt' | 'answer' | null = null,
    ) => {
      clearPendingTimer()
      const currentPlayGen = ++playGenerationRef.current
      setActiveTarget(target)
      setIsAudioPlaying(true)

      const speakOptions: SpeakerOptions = {
        explicit: true,
        ...options,
        ...(cardSeed ? { cardSeed } : {}),
        onEnded: () => {
          if (playGenerationRef.current === currentPlayGen) {
            setActiveTarget(null)
            setIsAudioPlaying(false)
          }
          options?.onEnded?.()
        },
      }
      const played = speaker.speak(text, locale, speakOptions)
      if (!played) {
        if (playGenerationRef.current === currentPlayGen) {
          setActiveTarget(null)
          setIsAudioPlaying(false)
        }
        setAudioUnavailable(true)
      } else {
        setAudioUnavailable(false)
      }
      return played
    },
    [clearPendingTimer, speaker],
  )

  const playPromptAudio = useCallback(
    (card?: StudyCard, options?: SpeakerOptions) => {
      const targetCard = card ?? currentCard
      if (!targetCard) return false
      return playAudio(
        targetCard.prompt,
        localeForPrompt(targetCard),
        cardReviewSeed(targetCard),
        { explicit: true, ...options },
        'prompt',
      )
    },
    [currentCard, playAudio],
  )

  const playAnswerAudio = useCallback(
    (card?: StudyCard, options?: SpeakerOptions) => {
      const targetCard = card ?? currentCard
      if (!targetCard) return false
      return playAudio(
        targetCard.answer,
        localeForAnswer(targetCard),
        cardReviewSeed(targetCard),
        { explicit: true, ...options },
        'answer',
      )
    },
    [currentCard, playAudio],
  )

  const playRevealSensory = useCallback(
    (card?: StudyCard) => {
      cancelPendingAudio()
      speaker.stop?.()
      sounds.play('reveal')
      haptics?.trigger('selection')
      const targetCard = card ?? currentCard
      if (targetCard && typeof window !== 'undefined') {
        revealAudioTimerRef.current = window.setTimeout(() => {
          playAnswerAudio(targetCard, { explicit: false })
          revealAudioTimerRef.current = null
        }, staggerMs)
      }
    },
    [
      cancelPendingAudio,
      currentCard,
      haptics,
      playAnswerAudio,
      sounds,
      speaker,
      staggerMs,
    ],
  )

  const playGradeSensory = useCallback(
    (grade: Grade, isComplete: boolean) => {
      cancelPendingAudio()
      speaker.stop?.()
      if (isComplete) {
        sounds.play('complete')
        haptics?.trigger('complete')
      } else {
        sounds.play(grade)
        haptics?.trigger(grade)
      }
    },
    [cancelPendingAudio, haptics, sounds, speaker],
  )

  const currentCardId = currentCard?.id
  const currentPrompt = currentCard?.prompt
  const currentPromptLocale = currentCard ? localeForPrompt(currentCard) : ''
  const currentReviews = currentCard?.schedule.reviews ?? 0

  // Autoplay prompt audio when entering/advancing in review view
  useEffect(() => {
    if (
      view !== 'review' ||
      paused ||
      !autoplayPrompt ||
      !currentCardId ||
      !currentPrompt
    ) {
      return
    }
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      playAudio(
        currentPrompt,
        currentPromptLocale,
        `${currentCardId}:turn${currentReviews}`,
        { explicit: false },
        'prompt',
      )
    })
    return () => {
      cancelled = true
    }
  }, [
    paused,
    autoplayPrompt,
    currentCardId,
    currentPrompt,
    currentPromptLocale,
    currentReviews,
    playAudio,
    view,
  ])

  const [prevPaused, setPrevPaused] = useState(paused)
  const [prevCardId, setPrevCardId] = useState(currentCardId)
  if (paused !== prevPaused) {
    setPrevPaused(paused)
    if (paused) {
      setActiveTarget(null)
      setIsAudioPlaying(false)
    }
  }
  if (currentCardId !== prevCardId) {
    setPrevCardId(currentCardId)
    setActiveTarget(null)
    setIsAudioPlaying(false)
  }

  // A dialog interrupts playback; the next interaction can resume normally.
  useEffect(() => {
    if (!paused) return
    clearPendingTimer()
    playGenerationRef.current++
    speaker.stop?.()
  }, [paused, clearPendingTimer, speaker])

  // One lifecycle for both learning modes and manual audio outside practice.
  useEffect(() => {
    return () => {
      cancelPendingAudio()
      speaker.stop?.()
    }
  }, [cancelPendingAudio, currentCardId, view, speaker])

  return {
    audioUnavailable,
    cancelPendingAudio,
    playAudio,
    playPromptAudio,
    playAnswerAudio,
    playRevealSensory,
    playGradeSensory,
    isPlayingPrompt: !paused && activeTarget === 'prompt',
    isPlayingAnswer: !paused && activeTarget === 'answer',
    isAudioPlaying: !paused && isAudioPlaying,
  }
}
