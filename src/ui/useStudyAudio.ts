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
  autoplayPrompt?: boolean | undefined
  staggerMs?: number | undefined
}

export function useStudyAudio({
  speaker,
  sounds,
  haptics,
  currentCard,
  view,
  autoplayPrompt = true,
  staggerMs = DEFAULT_REVEAL_AUDIO_STAGGER_MS,
}: UseStudyAudioOptions) {
  const [audioUnavailable, setAudioUnavailable] = useState(
    () => !speaker.supported(),
  )
  const revealAudioTimerRef = useRef<number | null>(null)

  const cancelPendingAudio = useCallback(() => {
    if (revealAudioTimerRef.current !== null) {
      window.clearTimeout(revealAudioTimerRef.current)
      revealAudioTimerRef.current = null
    }
  }, [])

  const playAudio = useCallback(
    (
      text: string,
      locale: string,
      cardSeed?: string,
      options?: SpeakerOptions,
    ) => {
      cancelPendingAudio()
      const speakOptions = cardSeed ? { ...options, cardSeed } : options
      const played = speaker.speak(text, locale, speakOptions)
      setAudioUnavailable(!played)
      return played
    },
    [cancelPendingAudio, speaker],
  )

  const playPromptAudio = useCallback(
    (card?: StudyCard, options?: SpeakerOptions) => {
      const targetCard = card ?? currentCard
      if (!targetCard) return false
      return playAudio(
        targetCard.prompt,
        localeForPrompt(targetCard),
        cardReviewSeed(targetCard),
        options,
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
        options,
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
          playAudio(
            targetCard.answer,
            localeForAnswer(targetCard),
            cardReviewSeed(targetCard),
          )
          revealAudioTimerRef.current = null
        }, staggerMs)
      }
    },
    [
      cancelPendingAudio,
      currentCard,
      haptics,
      playAudio,
      sounds,
      speaker,
      staggerMs,
    ],
  )

  const playGradeSensory = useCallback(
    (grade: Grade, isComplete: boolean) => {
      cancelPendingAudio()
      speaker.stop?.()
      sounds.play(grade)
      haptics?.trigger(grade)
      if (isComplete) {
        sounds.play('complete')
        haptics?.trigger('complete')
      }
    },
    [cancelPendingAudio, haptics, sounds, speaker],
  )

  // Autoplay prompt audio when entering/advancing in review view
  const currentCardId = currentCard?.id
  const currentPrompt = currentCard?.prompt
  const currentPromptLocale = currentCard ? localeForPrompt(currentCard) : ''
  const currentReviews = currentCard?.schedule.reviews ?? 0

  useEffect(() => {
    if (
      view !== 'review' ||
      !autoplayPrompt ||
      !currentCardId ||
      !currentPrompt
    ) {
      return
    }
    speaker.speak(currentPrompt, currentPromptLocale, {
      cardSeed: `${currentCardId}:turn${currentReviews}`,
    })
  }, [
    autoplayPrompt,
    currentCardId,
    currentPrompt,
    currentPromptLocale,
    currentReviews,
    speaker,
    view,
  ])

  // Automatically cancel pending audio on view or card transition
  useEffect(() => {
    cancelPendingAudio()
  }, [cancelPendingAudio, currentCardId, view])

  // Cleanup pending timer on unmount
  useEffect(() => {
    return () => {
      if (revealAudioTimerRef.current !== null) {
        window.clearTimeout(revealAudioTimerRef.current)
        revealAudioTimerRef.current = null
      }
    }
  }, [])

  return {
    audioUnavailable,
    cancelPendingAudio,
    playAudio,
    playPromptAudio,
    playAnswerAudio,
    playRevealSensory,
    playGradeSensory,
  }
}
