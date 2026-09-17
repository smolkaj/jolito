import { useCallback, useEffect, useRef, useState } from 'react'
import type { AiAssistant } from '../application/ports'

export function appendOrReplaceContext(prev: string, newText: string): string {
  const trimmedPrev = prev.trim()
  if (!trimmedPrev) return newText

  if (newText.startsWith('💡 Mnemonic:')) {
    const lines = trimmedPrev.split('\n\n')
    const mnemonicIdx = lines.findIndex((l) => l.startsWith('💡 Mnemonic:'))
    if (mnemonicIdx !== -1) {
      lines[mnemonicIdx] = newText
      return lines.join('\n\n')
    }
  }

  if (trimmedPrev === newText || trimmedPrev.includes(newText)) {
    return trimmedPrev
  }

  return `${trimmedPrev}\n\n${newText}`
}

export interface UseAiSuggestionsOptions {
  aiAssistant?: AiAssistant | undefined
  isOnline?: boolean | undefined
  spanish: string
  english?: string | undefined
  onAppendContext: (text: string) => void
}

export function useAiSuggestions({
  aiAssistant,
  isOnline,
  spanish,
  english,
  onAppendContext,
}: UseAiSuggestionsOptions) {
  const [aiAvailable, setAiAvailable] = useState<boolean>(() => {
    if (!aiAssistant) return false
    return aiAssistant.isAvailableSync ? aiAssistant.isAvailableSync() : false
  })
  const [loading, setLoading] = useState<'example' | 'mnemonic' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const aiAbortControllerRef = useRef<AbortController | null>(null)
  const currentTermsRef = useRef({ spanish, english })
  const onAppendContextRef = useRef(onAppendContext)

  useEffect(() => {
    currentTermsRef.current = { spanish, english }
    onAppendContextRef.current = onAppendContext
  })

  // Clear any existing error notification as soon as the user modifies either term
  const prevTermsRef = useRef({ spanish, english })
  useEffect(() => {
    if (
      prevTermsRef.current.spanish !== spanish ||
      prevTermsRef.current.english !== english
    ) {
      prevTermsRef.current = { spanish, english }
      setError(null)
    }
  }, [spanish, english])

  useEffect(() => {
    if (!aiAssistant) return
    let cancelled = false
    void aiAssistant.isAvailable().then((avail) => {
      if (!cancelled) setAiAvailable(avail)
    })
    return () => {
      cancelled = true
    }
  }, [aiAssistant, isOnline])

  useEffect(() => {
    return () => {
      aiAbortControllerRef.current?.abort()
    }
  }, [])

  const abortActiveRequest = useCallback(() => {
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort()
      aiAbortControllerRef.current = null
    }
    setLoading(null)
    setStatusMessage(null)
    setError(null)
  }, [])

  const getErrorMessage = useCallback(
    (kind: 'example' | 'mnemonic') => {
      const noun =
        kind === 'example' ? 'an example sentence' : 'a mnemonic hook'
      if (
        isOnline === false ||
        (typeof navigator !== 'undefined' && navigator.onLine === false)
      ) {
        return `Offline. Reconnect to generate ${noun}.`
      }
      return `Couldn’t generate ${noun} right now. Please try again.`
    },
    [isOnline],
  )

  const generateExample = useCallback(async () => {
    const term = spanish.trim()
    if (!term || !aiAssistant || loading !== null) return

    aiAbortControllerRef.current?.abort()
    const controller = new AbortController()
    aiAbortControllerRef.current = controller

    setLoading('example')
    setError(null)
    setStatusMessage('Generating example sentence…')

    try {
      const result = await aiAssistant.generateExample(term, controller.signal)
      if (controller.signal.aborted) return

      if (currentTermsRef.current.spanish.trim() !== term) {
        setStatusMessage(null)
        return
      }

      if (result) {
        onAppendContextRef.current(result)
        setError(null)
        setStatusMessage('Example sentence added to context.')
      } else {
        const msg = getErrorMessage('example')
        setError(msg)
        setStatusMessage(null)
      }
    } catch {
      if (controller.signal.aborted) return
      const msg = getErrorMessage('example')
      setError(msg)
      setStatusMessage(null)
    } finally {
      if (!controller.signal.aborted) {
        setLoading(null)
      }
    }
  }, [spanish, aiAssistant, loading, getErrorMessage])

  const generateMnemonic = useCallback(async () => {
    const es = spanish.trim()
    const en = (english ?? '').trim()
    if (!es || !en || !aiAssistant || loading !== null) return

    aiAbortControllerRef.current?.abort()
    const controller = new AbortController()
    aiAbortControllerRef.current = controller

    setLoading('mnemonic')
    setError(null)
    setStatusMessage('Generating mnemonic hook…')

    try {
      const result = await aiAssistant.generateMnemonic(
        es,
        en,
        controller.signal,
      )
      if (controller.signal.aborted) return

      if (
        currentTermsRef.current.spanish.trim() !== es ||
        (currentTermsRef.current.english ?? '').trim() !== en
      ) {
        setStatusMessage(null)
        return
      }

      if (result) {
        onAppendContextRef.current(result)
        setError(null)
        setStatusMessage('Mnemonic hook added to context.')
      } else {
        const msg = getErrorMessage('mnemonic')
        setError(msg)
        setStatusMessage(null)
      }
    } catch {
      if (controller.signal.aborted) return
      const msg = getErrorMessage('mnemonic')
      setError(msg)
      setStatusMessage(null)
    } finally {
      if (!controller.signal.aborted) {
        setLoading(null)
      }
    }
  }, [spanish, english, aiAssistant, loading, getErrorMessage])

  return {
    aiAvailable: Boolean(aiAssistant) && aiAvailable,
    loading,
    error,
    statusMessage,
    generateExample,
    generateMnemonic,
    abortActiveRequest,
    clearError: () => setError(null),
  }
}
