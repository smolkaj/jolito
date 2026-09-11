import { afterEach, describe, expect, it, vi } from 'vitest'
import { EnhancedBrowserSpeaker } from './speech'

function deviceSpeech() {
  const events = new EventTarget()
  const synthesis = {
    getVoices: vi.fn(() => []),
    speak: vi.fn(),
    cancel: vi.fn(),
    resume: vi.fn(),
    paused: false,
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  }
  vi.stubGlobal('speechSynthesis', synthesis)
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      constructor(public text: string) {}
    },
  )
  return { synthesis, events }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('device speech lifecycle contract', () => {
  it('can speak the same phrase after repeated background and foreground interruptions', () => {
    const { synthesis } = deviceSpeech()
    const speaker = new EnhancedBrowserSpeaker()
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    for (let round = 0; round < 3; round++) {
      expect(speaker.speak('hola', 'es-MX')).toBe(true)
      expect(synthesis.speak).toHaveBeenCalledTimes(round * 2 + 1)
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
      synthesis.paused = true
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
      document.dispatchEvent(new Event('visibilitychange'))
      expect(synthesis.resume).toHaveBeenCalled()
      expect(speaker.speak('hola', 'es-MX')).toBe(true)
      expect(synthesis.speak).toHaveBeenCalledTimes(round * 2 + 2)
      window.dispatchEvent(new Event('pagehide'))
      window.dispatchEvent(new Event('pageshow'))
    }
    speaker.destroy()
  })

  it('stays inert after teardown despite stale callbacks, voice changes and gestures', () => {
    const { synthesis, events } = deviceSpeech()
    const speaker = new EnhancedBrowserSpeaker()
    const ended = vi.fn()
    speaker.speak('hola', 'es-MX', { onEnded: ended })
    const utterance = synthesis.speak.mock
      .calls[0]?.[0] as SpeechSynthesisUtterance
    const staleEnd = utterance.onend
    speaker.destroy()
    vi.clearAllMocks()
    synthesis.paused = true
    events.dispatchEvent(new Event('voiceschanged'))
    document.dispatchEvent(new Event('visibilitychange'))
    for (const event of [
      'pageshow',
      'pagehide',
      'orientationchange',
      'pointerdown',
      'keydown',
    ]) {
      window.dispatchEvent(new Event(event))
    }
    staleEnd?.call(utterance, {} as SpeechSynthesisEvent)
    expect(speaker.speak('otra vez', 'es-MX')).toBe(false)
    speaker.stop()
    speaker.destroy()
    expect(synthesis.getVoices).not.toHaveBeenCalled()
    expect(synthesis.resume).not.toHaveBeenCalled()
    expect(synthesis.speak).not.toHaveBeenCalled()
    expect(synthesis.cancel).not.toHaveBeenCalled()
    expect(ended).not.toHaveBeenCalled()
  })
})
