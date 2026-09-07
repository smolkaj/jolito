import { act, renderHook } from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest'
import type { HapticsPlayer, SoundPlayer, Speaker } from '../application/ports'
import type { StudyCard } from '../domain/card'
import { useStudyAudio } from './useStudyAudio'

const mockCard: StudyCard = {
  id: 'card-1',
  noteId: 'note-1',
  prompt: 'hola',
  answer: 'hello',
  direction: 'es-en',
  context: 'greeting',
  scene: 'conversation',
  createdAt: 0,
  schedule: {
    state: 'review',
    dueAt: 1000,
    intervalDays: 1,
    easeFactor: 2.5,
    reviews: 3,
    lapses: 0,
  },
}

describe('useStudyAudio', () => {
  let speakMock: Mock<Speaker['speak']>
  let supportedMock: Mock<Speaker['supported']>
  let stopMock: Mock<NonNullable<Speaker['stop']>>
  let soundPlayMock: Mock<SoundPlayer['play']>
  let hapticTriggerMock: Mock<HapticsPlayer['trigger']>

  let mockSpeaker: Speaker
  let mockSounds: SoundPlayer
  let mockHaptics: HapticsPlayer

  beforeEach(() => {
    vi.useFakeTimers()
    speakMock = vi.fn<Speaker['speak']>().mockReturnValue(true)
    supportedMock = vi.fn<Speaker['supported']>().mockReturnValue(true)
    stopMock = vi.fn<NonNullable<Speaker['stop']>>()
    soundPlayMock = vi.fn<SoundPlayer['play']>()
    hapticTriggerMock = vi.fn<HapticsPlayer['trigger']>()

    mockSpeaker = {
      supported: supportedMock,
      speak: speakMock,
      stop: stopMock,
    }
    mockSounds = {
      play: soundPlayMock,
    }
    mockHaptics = {
      trigger: hapticTriggerMock,
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initializes audioUnavailable to false when speaker is supported', () => {
    const { result } = renderHook(() =>
      useStudyAudio({
        speaker: mockSpeaker,
        sounds: mockSounds,
        haptics: mockHaptics,
      }),
    )
    expect(result.current.audioUnavailable).toBe(false)
  })

  it('initializes audioUnavailable to true when speaker is not supported', () => {
    supportedMock.mockReturnValue(false)
    const { result } = renderHook(() =>
      useStudyAudio({
        speaker: mockSpeaker,
        sounds: mockSounds,
        haptics: mockHaptics,
      }),
    )
    expect(result.current.audioUnavailable).toBe(true)
  })

  it('autoplays prompt audio with turn seed when view is review', () => {
    renderHook(() =>
      useStudyAudio({
        speaker: mockSpeaker,
        sounds: mockSounds,
        haptics: mockHaptics,
        currentCard: mockCard,
        view: 'review',
      }),
    )

    expect(speakMock).toHaveBeenCalledWith('hola', 'es-MX', {
      cardSeed: 'card-1:turn3',
      explicit: false,
    })
  })

  it('does not autoplay when view is not review or autoplayPrompt is false', () => {
    renderHook(() =>
      useStudyAudio({
        speaker: mockSpeaker,
        sounds: mockSounds,
        haptics: mockHaptics,
        currentCard: mockCard,
        view: 'home',
      }),
    )
    expect(speakMock).not.toHaveBeenCalled()

    renderHook(() =>
      useStudyAudio({
        speaker: mockSpeaker,
        sounds: mockSounds,
        haptics: mockHaptics,
        currentCard: mockCard,
        view: 'review',
        autoplayPrompt: false,
      }),
    )
    expect(speakMock).not.toHaveBeenCalled()
  })

  it('does not re-autoplay when card object reference changes but content and turn seed remain identical', () => {
    const { rerender } = renderHook(
      ({ card }) =>
        useStudyAudio({
          speaker: mockSpeaker,
          sounds: mockSounds,
          haptics: mockHaptics,
          currentCard: card,
          view: 'review',
        }),
      { initialProps: { card: mockCard } },
    )

    expect(speakMock).toHaveBeenCalledTimes(1)

    // New object reference with identical primitive fields (e.g. background sync)
    rerender({ card: { ...mockCard } })
    expect(speakMock).toHaveBeenCalledTimes(1)

    // Changed review count (turn seed change)
    rerender({
      card: {
        ...mockCard,
        schedule: { ...mockCard.schedule, reviews: 4 },
      },
    })
    expect(speakMock).toHaveBeenCalledTimes(2)
    expect(speakMock).toHaveBeenLastCalledWith('hola', 'es-MX', {
      cardSeed: 'card-1:turn4',
      explicit: false,
    })
  })

  it('plays prompt audio on demand via playPromptAudio', () => {
    const { result } = renderHook(() =>
      useStudyAudio({
        speaker: mockSpeaker,
        sounds: mockSounds,
        haptics: mockHaptics,
        currentCard: mockCard,
        view: 'review',
        autoplayPrompt: false,
      }),
    )

    act(() => {
      result.current.playPromptAudio()
    })

    expect(speakMock).toHaveBeenCalledWith('hola', 'es-MX', {
      cardSeed: 'card-1:turn3',
      explicit: true,
    })
  })

  it('plays answer audio on demand via playAnswerAudio', () => {
    const { result } = renderHook(() =>
      useStudyAudio({
        speaker: mockSpeaker,
        sounds: mockSounds,
        haptics: mockHaptics,
        currentCard: mockCard,
        view: 'review',
        autoplayPrompt: false,
      }),
    )

    act(() => {
      result.current.playAnswerAudio()
    })

    expect(speakMock).toHaveBeenCalledWith('hello', 'en-US', {
      cardSeed: 'card-1:turn3',
      explicit: true,
    })
  })

  it('supports passing custom card and options to playPromptAudio and playAnswerAudio', () => {
    const otherCard: StudyCard = {
      ...mockCard,
      id: 'card-2',
      direction: 'en-es',
      prompt: 'dog',
      answer: 'perro',
      schedule: { ...mockCard.schedule, reviews: 1 },
    }

    const { result } = renderHook(() =>
      useStudyAudio({
        speaker: mockSpeaker,
        sounds: mockSounds,
        haptics: mockHaptics,
        currentCard: mockCard,
        view: 'review',
        autoplayPrompt: false,
      }),
    )

    act(() => {
      result.current.playPromptAudio(otherCard, { dualVoice: false })
    })
    expect(speakMock).toHaveBeenCalledWith('dog', 'en-US', {
      cardSeed: 'card-2:turn1',
      dualVoice: false,
      explicit: true,
    })

    act(() => {
      result.current.playAnswerAudio(otherCard)
    })
    expect(speakMock).toHaveBeenCalledWith('perro', 'es-MX', {
      cardSeed: 'card-2:turn1',
      explicit: true,
    })
  })

  it('returns false from playPromptAudio and playAnswerAudio if no card is provided or currentCard is undefined', () => {
    const { result } = renderHook(() =>
      useStudyAudio({
        speaker: mockSpeaker,
        sounds: mockSounds,
        haptics: mockHaptics,
        view: 'review',
        autoplayPrompt: false,
      }),
    )

    expect(result.current.playPromptAudio()).toBe(false)
    expect(result.current.playAnswerAudio()).toBe(false)
  })

  it('handles playRevealSensory with sound, haptics, and staggered audio speech', () => {
    const { result } = renderHook(() =>
      useStudyAudio({
        speaker: mockSpeaker,
        sounds: mockSounds,
        haptics: mockHaptics,
        currentCard: mockCard,
        view: 'review',
        autoplayPrompt: false,
        staggerMs: 120,
      }),
    )

    act(() => {
      result.current.playRevealSensory()
    })

    expect(stopMock).toHaveBeenCalled()
    expect(soundPlayMock).toHaveBeenCalledWith('reveal')
    expect(hapticTriggerMock).toHaveBeenCalledWith('selection')
    expect(speakMock).not.toHaveBeenCalled()

    // Fast-forward stagger timer
    act(() => {
      vi.advanceTimersByTime(120)
    })

    expect(speakMock).toHaveBeenCalledWith('hello', 'en-US', {
      cardSeed: 'card-1:turn3',
      explicit: false,
    })
  })

  it('cancels pending staggered reveal audio if cancelPendingAudio is called', () => {
    const { result } = renderHook(() =>
      useStudyAudio({
        speaker: mockSpeaker,
        sounds: mockSounds,
        haptics: mockHaptics,
        currentCard: mockCard,
        view: 'review',
        autoplayPrompt: false,
        staggerMs: 120,
      }),
    )

    act(() => {
      result.current.playRevealSensory()
    })

    act(() => {
      result.current.cancelPendingAudio()
      vi.advanceTimersByTime(120)
    })

    expect(speakMock).not.toHaveBeenCalled()
  })

  it('cancels pending audio on card or view change', () => {
    const { result, rerender } = renderHook(
      ({ card, view }) =>
        useStudyAudio({
          speaker: mockSpeaker,
          sounds: mockSounds,
          haptics: mockHaptics,
          currentCard: card,
          view,
          autoplayPrompt: false,
          staggerMs: 120,
        }),
      { initialProps: { card: mockCard, view: 'review' } },
    )

    act(() => {
      result.current.playRevealSensory()
    })

    // Advance card
    const nextCard = { ...mockCard, id: 'card-2' }
    rerender({ card: nextCard, view: 'review' })

    act(() => {
      vi.advanceTimersByTime(120)
    })

    expect(speakMock).not.toHaveBeenCalled()
  })

  it('handles playGradeSensory with sound, haptics, and completion cues', () => {
    const { result } = renderHook(() =>
      useStudyAudio({
        speaker: mockSpeaker,
        sounds: mockSounds,
        haptics: mockHaptics,
        currentCard: mockCard,
        view: 'review',
        autoplayPrompt: false,
      }),
    )

    act(() => {
      result.current.playGradeSensory('good', false)
    })

    expect(stopMock).toHaveBeenCalled()
    expect(soundPlayMock).toHaveBeenCalledWith('good')
    expect(hapticTriggerMock).toHaveBeenCalledWith('good')
    expect(soundPlayMock).not.toHaveBeenCalledWith('complete')

    // When session is complete, complete cue supersedes individual grade
    soundPlayMock.mockClear()
    hapticTriggerMock.mockClear()
    act(() => {
      result.current.playGradeSensory('easy', true)
    })

    expect(soundPlayMock).not.toHaveBeenCalledWith('easy')
    expect(hapticTriggerMock).not.toHaveBeenCalledWith('easy')
    expect(soundPlayMock).toHaveBeenCalledWith('complete')
    expect(hapticTriggerMock).toHaveBeenCalledWith('complete')
  })

  it('updates audioUnavailable when manual playAudio returns false', () => {
    speakMock.mockReturnValue(false)

    const { result } = renderHook(() =>
      useStudyAudio({
        speaker: mockSpeaker,
        sounds: mockSounds,
        haptics: mockHaptics,
        currentCard: mockCard,
        view: 'review',
        autoplayPrompt: false,
      }),
    )

    expect(result.current.audioUnavailable).toBe(false)

    act(() => {
      result.current.playAudio('hola', 'es-MX')
    })

    expect(speakMock).toHaveBeenCalledWith('hola', 'es-MX', {
      explicit: true,
    })
    expect(result.current.audioUnavailable).toBe(true)
  })

  it('preserves options and allows overriding explicit in playAudio', () => {
    const { result } = renderHook(() =>
      useStudyAudio({
        speaker: mockSpeaker,
        sounds: mockSounds,
        haptics: mockHaptics,
      }),
    )

    act(() => {
      result.current.playAudio('hola', 'es-MX', 'seed-1', {
        dualVoice: false,
        explicit: false,
      })
    })

    expect(speakMock).toHaveBeenCalledWith('hola', 'es-MX', {
      cardSeed: 'seed-1',
      dualVoice: false,
      explicit: false,
    })
  })

  it('cleans up pending timer on unmount', () => {
    const { result, unmount } = renderHook(() =>
      useStudyAudio({
        speaker: mockSpeaker,
        sounds: mockSounds,
        haptics: mockHaptics,
        currentCard: mockCard,
        view: 'review',
        autoplayPrompt: false,
        staggerMs: 120,
      }),
    )

    act(() => {
      result.current.playRevealSensory()
    })

    unmount()

    act(() => {
      vi.advanceTimersByTime(120)
    })

    expect(speakMock).not.toHaveBeenCalled()
  })
})
