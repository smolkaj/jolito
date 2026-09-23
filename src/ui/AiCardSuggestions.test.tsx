import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CreateCardView } from './views/CreateCardView'
import { EditCardModal } from './modals/EditCardModal'
import { createStudyCards } from '../domain/card'
import type { AiAssistant } from '../application/ports'
import { appendOrReplaceContext } from './useAiSuggestions'

describe('AI Card Suggestions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const dummyAssistant = {
    suggest: () => [],
    translate: () => null,
  }

  const renderCreateCardView = (mockAi: AiAssistant) => {
    return render(
      <CreateCardView
        vocabularyCards={[]}
        referenceTime={1000}
        saveError={null}
        savedToast={null}
        authUser={null}
        syncStatus="offline"
        isOnline={true}
        accountNotice={null}
        redirectAuthBanner={null}
        onDismissAccountNotice={() => {}}
        onDismissRedirectBanner={() => {}}
        onGoHome={() => {}}
        onNavigateToDeck={() => {}}
        onPractice={() => {}}
        canPractice={false}
        onOpenSync={() => {}}
        onEditCard={() => {}}
        onOpenFeedback={() => {}}
        onSaveCard={() => true}
        onPlayAudio={() => {}}
        assistant={dummyAssistant}
        aiAssistant={mockAi}
      />,
    )
  }

  it('does not render AI action buttons when aiAssistant is unavailable', async () => {
    const isAvailableSpy = vi.fn().mockResolvedValue(false)
    const generateExampleSpy = vi.fn()
    const generateMnemonicSpy = vi.fn()

    const mockAi: AiAssistant = {
      isAvailable: isAvailableSpy,
      generateExample: generateExampleSpy,
      generateMnemonic: generateMnemonicSpy,
    }

    renderCreateCardView(mockAi)

    await waitFor(() => {
      expect(isAvailableSpy).toHaveBeenCalled()
    })

    expect(
      screen.queryByRole('button', {
        name: /example: generate/i,
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /generate mnemonic hook/i }),
    ).not.toBeInTheDocument()
  })

  it('renders AI buttons in CreateCardView with aria-disabled states and appends generated content', async () => {
    const user = userEvent.setup()
    const isAvailableSpy = vi.fn().mockResolvedValue(true)
    const generateExampleSpy = vi
      .fn()
      .mockResolvedValue(
        '¿Vienes o qué? — O sea, sí. (Are you coming or what? — I mean, yes.)',
      )
    const generateMnemonicSpy = vi
      .fn()
      .mockResolvedValue('💡 Mnemonic: Voice alter')

    const mockAi: AiAssistant = {
      isAvailable: isAvailableSpy,
      generateExample: generateExampleSpy,
      generateMnemonic: generateMnemonicSpy,
    }

    renderCreateCardView(mockAi)

    const exampleBtn = await screen.findByRole('button', {
      name: /example: generate/i,
    })
    const mnemonicBtn = screen.getByRole('button', {
      name: /generate mnemonic hook/i,
    })

    // Initially both aria-disabled because inputs are empty
    expect(exampleBtn).toHaveAttribute('aria-disabled', 'true')
    expect(mnemonicBtn).toHaveAttribute('aria-disabled', 'true')

    // Type Spanish term
    const spanishInput = screen.getByLabelText(/Mexican Spanish/i)
    await user.type(spanishInput, 'o sea')

    // Example button is enabled, mnemonic still disabled (needs English)
    expect(exampleBtn).toHaveAttribute('aria-disabled', 'false')
    expect(mnemonicBtn).toHaveAttribute('aria-disabled', 'true')

    // Click example button before English is typed
    await user.click(exampleBtn)
    expect(generateExampleSpy).toHaveBeenCalledWith(
      'o sea',
      undefined,
      expect.any(AbortSignal),
    )

    const contextInput = screen.getByLabelText(/additional context/i)
    expect(contextInput).toHaveValue(
      '¿Vienes o qué? — O sea, sí. (Are you coming or what? — I mean, yes.)',
    )

    // Type English translation
    const englishInput = screen.getByLabelText(/English/i)
    await user.type(englishInput, 'I mean')

    // Both now enabled
    expect(exampleBtn).toHaveAttribute('aria-disabled', 'false')
    expect(mnemonicBtn).toHaveAttribute('aria-disabled', 'false')

    // Clear context and click example button again with English translation provided
    await user.clear(contextInput)
    await user.click(exampleBtn)
    expect(generateExampleSpy).toHaveBeenCalledWith(
      'o sea',
      'I mean',
      expect.any(AbortSignal),
    )
    expect(contextInput).toHaveValue(
      '¿Vienes o qué? — O sea, sí. (Are you coming or what? — I mean, yes.)',
    )

    // Click mnemonic button: appends to existing context
    await user.click(mnemonicBtn)
    expect(generateMnemonicSpy).toHaveBeenCalledWith(
      'o sea',
      'I mean',
      expect.any(AbortSignal),
    )
    expect(contextInput).toHaveValue(
      '¿Vienes o qué? — O sea, sí. (Are you coming or what? — I mean, yes.)\n\n💡 Mnemonic: Voice alter',
    )
  })

  it('renders AI buttons in EditCardModal and populates context', async () => {
    const user = userEvent.setup()
    const isAvailableSpy = vi.fn().mockResolvedValue(true)
    const generateExampleSpy = vi
      .fn()
      .mockResolvedValue('Habla en voz alta. (Speak out loud.)')
    const generateMnemonicSpy = vi
      .fn()
      .mockResolvedValue('💡 Mnemonic: Voice alter')

    const mockAi: AiAssistant = {
      isAvailable: isAvailableSpy,
      generateExample: generateExampleSpy,
      generateMnemonic: generateMnemonicSpy,
    }

    const card = createStudyCards(
      {
        spanish: 'en voz alta',
        english: 'out loud',
        context: '',
        bidirectional: false,
      },
      'n1',
      1000,
    )[0]!

    render(
      <EditCardModal
        isOpen={true}
        card={card}
        cards={[card]}
        onClose={() => {}}
        onSave={() => {}}
        onPlayAudio={() => {}}
        aiAssistant={mockAi}
        isOnline={true}
      />,
    )

    const exampleBtn = await screen.findByRole('button', {
      name: /example: generate/i,
    })
    const mnemonicBtn = screen.getByRole('button', {
      name: /generate mnemonic hook/i,
    })

    expect(exampleBtn).toHaveAttribute('aria-disabled', 'false')
    expect(mnemonicBtn).toHaveAttribute('aria-disabled', 'false')

    await user.click(exampleBtn)
    expect(generateExampleSpy).toHaveBeenCalledWith(
      'en voz alta',
      'out loud',
      expect.any(AbortSignal),
    )

    const contextInput = screen.getByLabelText(/additional context/i)
    expect(contextInput).toHaveValue('Habla en voz alta. (Speak out loud.)')
  })

  it('displays offline error in EditCardModal when isOnline={false}', async () => {
    const user = userEvent.setup()
    const mockAi: AiAssistant = {
      isAvailable: () => Promise.resolve(true),
      isAvailableSync: () => true,
      generateExample: vi.fn().mockResolvedValue(null),
      generateMnemonic: vi.fn(),
    }

    const card = createStudyCards(
      {
        spanish: 'en voz alta',
        english: 'out loud',
        context: '',
        bidirectional: false,
      },
      'n1',
      1000,
    )[0]!

    render(
      <EditCardModal
        isOpen={true}
        card={card}
        cards={[card]}
        onClose={() => {}}
        onSave={() => {}}
        onPlayAudio={() => {}}
        aiAssistant={mockAi}
        isOnline={false}
      />,
    )

    const exampleBtn = await screen.findByRole('button', {
      name: /example: generate/i,
    })
    await user.click(exampleBtn)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'Offline. Reconnect to generate an example sentence.',
    )
  })

  it('allows local on-device AI to generate content even when offline (isOnline={false})', async () => {
    const user = userEvent.setup()
    const generateExampleSpy = vi
      .fn()
      .mockResolvedValue('Habla en voz alta. (Speak out loud.)')
    const mockAi: AiAssistant = {
      isAvailable: () => Promise.resolve(true),
      isAvailableSync: () => true,
      generateExample: generateExampleSpy,
      generateMnemonic: vi.fn(),
    }

    const card = createStudyCards(
      {
        spanish: 'en voz alta',
        english: 'out loud',
        context: '',
        bidirectional: false,
      },
      'n1',
      1000,
    )[0]!

    render(
      <EditCardModal
        isOpen={true}
        card={card}
        cards={[card]}
        onClose={() => {}}
        onSave={() => {}}
        onPlayAudio={() => {}}
        aiAssistant={mockAi}
        isOnline={false}
      />,
    )

    const exampleBtn = await screen.findByRole('button', {
      name: /example: generate/i,
    })
    await user.click(exampleBtn)

    expect(generateExampleSpy).toHaveBeenCalledWith(
      'en voz alta',
      'out loud',
      expect.any(AbortSignal),
    )
    const contextInput = screen.getByLabelText(/additional context/i)
    expect(contextInput).toHaveValue('Habla en voz alta. (Speak out loud.)')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('preserves keyboard focus and ignores clicks when aria-disabled="true"', async () => {
    const user = userEvent.setup()
    const generateExampleSpy = vi.fn()

    const mockAi: AiAssistant = {
      isAvailable: () => Promise.resolve(true),
      isAvailableSync: () => true,
      generateExample: generateExampleSpy,
      generateMnemonic: vi.fn(),
    }

    renderCreateCardView(mockAi)

    const exampleBtn = screen.getByRole('button', {
      name: /example: generate/i,
    })

    expect(exampleBtn).toHaveAttribute('aria-disabled', 'true')
    exampleBtn.focus()
    expect(document.activeElement).toBe(exampleBtn)

    await user.click(exampleBtn)
    expect(generateExampleSpy).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(exampleBtn)
  })

  it('handles race conditions: ignores late response if input term was changed while in flight', async () => {
    const user = userEvent.setup()
    let resolveExample: (val: string) => void = () => {}
    const deferredPromise = new Promise<string>((resolve) => {
      resolveExample = resolve
    })

    const mockAi: AiAssistant = {
      isAvailable: () => Promise.resolve(true),
      isAvailableSync: () => true,
      generateExample: vi.fn().mockImplementation(() => deferredPromise),
      generateMnemonic: vi.fn(),
    }

    renderCreateCardView(mockAi)

    const spanishInput = screen.getByLabelText(/Mexican Spanish/i)
    await user.type(spanishInput, 'o sea')

    const exampleBtn = screen.getByRole('button', {
      name: /example: generate/i,
    })
    await user.click(exampleBtn)

    // While in flight, user modifies input to something else
    await user.clear(spanishInput)
    await user.type(spanishInput, 'ahorita')

    // AI resolves old result
    resolveExample('¿Vienes o qué? — O sea, sí.')
    await waitFor(() => {
      expect(exampleBtn).toHaveAttribute('aria-busy', 'false')
    })

    const contextInput = screen.getByLabelText(/additional context/i)
    // Context should NOT have been updated with the old term's example
    expect(contextInput).toHaveValue('')
  })

  it('handles race conditions: ignores late example response if English definition was modified while in flight', async () => {
    const user = userEvent.setup()
    let resolveExample: (val: string) => void = () => {}
    const deferredPromise = new Promise<string>((resolve) => {
      resolveExample = resolve
    })

    const mockAi: AiAssistant = {
      isAvailable: () => Promise.resolve(true),
      isAvailableSync: () => true,
      generateExample: vi.fn().mockImplementation(() => deferredPromise),
      generateMnemonic: vi.fn(),
    }

    renderCreateCardView(mockAi)

    const spanishInput = screen.getByLabelText(/Mexican Spanish/i)
    const englishInput = screen.getByLabelText(/English/i)
    await user.type(spanishInput, 'dar a')
    await user.type(englishInput, 'to face')

    const exampleBtn = screen.getByRole('button', {
      name: /example: generate/i,
    })
    await user.click(exampleBtn)

    // While in flight, user modifies english input
    await user.clear(englishInput)
    await user.type(englishInput, 'to overlook')

    // AI resolves old result
    resolveExample('La ventana da a la calle. (The window faces the street.)')
    await waitFor(() => {
      expect(exampleBtn).toHaveAttribute('aria-busy', 'false')
    })

    const contextInput = screen.getByLabelText(/additional context/i)
    expect(contextInput).toHaveValue('')
  })

  it('handles race conditions: ignores unanchored example response if English definition was added while in flight', async () => {
    const user = userEvent.setup()
    let resolveExample: (val: string) => void = () => {}
    const deferredPromise = new Promise<string>((resolve) => {
      resolveExample = resolve
    })

    const mockAi: AiAssistant = {
      isAvailable: () => Promise.resolve(true),
      isAvailableSync: () => true,
      generateExample: vi.fn().mockImplementation(() => deferredPromise),
      generateMnemonic: vi.fn(),
    }

    renderCreateCardView(mockAi)

    const spanishInput = screen.getByLabelText(/Mexican Spanish/i)
    const englishInput = screen.getByLabelText(/English/i)
    await user.type(spanishInput, 'dar a')

    const exampleBtn = screen.getByRole('button', {
      name: /example: generate/i,
    })
    await user.click(exampleBtn)

    // While in flight, user enters definition
    await user.type(englishInput, 'to face')

    // AI resolves old unanchored result
    resolveExample('Doy un regalo. (I give a gift.)')
    await waitFor(() => {
      expect(exampleBtn).toHaveAttribute('aria-busy', 'false')
    })

    const contextInput = screen.getByLabelText(/additional context/i)
    expect(contextInput).toHaveValue('')
  })

  it('generates example sentence for phrasal verb with preposition like "dar a" (to face)', async () => {
    const user = userEvent.setup()
    const generateExampleSpy = vi
      .fn()
      .mockResolvedValue(
        'El balcón da al parque. (The balcony faces the park.)',
      )

    const mockAi: AiAssistant = {
      isAvailable: () => Promise.resolve(true),
      isAvailableSync: () => true,
      generateExample: generateExampleSpy,
      generateMnemonic: vi.fn(),
    }

    renderCreateCardView(mockAi)

    const spanishInput = screen.getByLabelText(/Mexican Spanish/i)
    const englishInput = screen.getByLabelText(/English/i)
    await user.type(spanishInput, 'dar a')
    await user.type(englishInput, 'to face')

    const exampleBtn = screen.getByRole('button', {
      name: /example: generate/i,
    })
    await user.click(exampleBtn)

    expect(generateExampleSpy).toHaveBeenCalledWith(
      'dar a',
      'to face',
      expect.any(AbortSignal),
    )

    const contextInput = screen.getByLabelText(/additional context/i)
    expect(contextInput).toHaveValue(
      'El balcón da al parque. (The balcony faces the park.)',
    )
  })

  it('displays calm inline error and live region when generation fails', async () => {
    const user = userEvent.setup()
    const mockAi: AiAssistant = {
      isAvailable: () => Promise.resolve(true),
      isAvailableSync: () => true,
      generateExample: vi.fn().mockResolvedValue(null),
      generateMnemonic: vi.fn(),
    }

    renderCreateCardView(mockAi)

    const spanishInput = screen.getByLabelText(/Mexican Spanish/i)
    await user.type(spanishInput, 'palabra')

    const exampleBtn = screen.getByRole('button', {
      name: /example: generate/i,
    })
    await user.click(exampleBtn)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'Couldn’t generate an example sentence right now. Please try again.',
    )

    // Verify dual announcement collision is prevented: status region is not rendered when alert is active
    const statusLiveRegion = document.querySelector(
      '.ai-context-actions .sr-only[role="status"]',
    )
    expect(statusLiveRegion).toBeNull()

    // Verify typing into input immediately clears the error notification
    await user.type(spanishInput, 's')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('cancels in-flight generation when card is saved so late resolution does not inject into context', async () => {
    const user = userEvent.setup()
    let resolveExample: (val: string) => void = () => {}
    const deferredPromise = new Promise<string>((resolve) => {
      resolveExample = resolve
    })

    const mockAi: AiAssistant = {
      isAvailable: () => Promise.resolve(true),
      isAvailableSync: () => true,
      generateExample: vi.fn().mockImplementation(() => deferredPromise),
      generateMnemonic: vi.fn(),
    }

    renderCreateCardView(mockAi)

    const spanishInput = screen.getByLabelText(/Mexican Spanish/i)
    const englishInput = screen.getByLabelText(/English/i)
    await user.type(spanishInput, 'o sea')
    await user.type(englishInput, 'I mean')

    const exampleBtn = screen.getByRole('button', {
      name: /example: generate/i,
    })
    await user.click(exampleBtn)

    // Save card while request is in flight
    const saveButton = screen.getByRole('button', { name: /save card/i })
    await user.click(saveButton)

    // Now resolve AI result
    resolveExample('¿Vienes o qué? — O sea, sí.')
    await waitFor(() => {
      expect(exampleBtn).toHaveAttribute('aria-busy', 'false')
    })

    const contextInput = screen.getByLabelText(/additional context/i)
    expect(contextInput).toHaveValue('')
  })

  it('replaces existing mnemonic hook when regenerating without stacking duplicates', async () => {
    const user = userEvent.setup()
    let mnemonicCounter = 1
    const mockAi: AiAssistant = {
      isAvailable: () => Promise.resolve(true),
      isAvailableSync: () => true,
      generateExample: vi.fn(),
      generateMnemonic: vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(`💡 Mnemonic: Hook variant ${mnemonicCounter++}`),
        ),
    }

    renderCreateCardView(mockAi)

    const spanishInput = screen.getByLabelText(/Mexican Spanish/i)
    const englishInput = screen.getByLabelText(/English/i)
    await user.type(spanishInput, 'ojalá')
    await user.type(englishInput, 'hopefully')

    const mnemonicBtn = screen.getByRole('button', {
      name: /generate mnemonic hook/i,
    })

    await user.click(mnemonicBtn)
    const contextInput = screen.getByLabelText(/additional context/i)
    expect(contextInput).toHaveValue('💡 Mnemonic: Hook variant 1')

    // Click again to regenerate: replaces the mnemonic hook instead of appending another
    await user.click(mnemonicBtn)
    expect(contextInput).toHaveValue('💡 Mnemonic: Hook variant 2')
  })

  describe('appendOrReplaceContext', () => {
    it('returns newText when previous text is empty or whitespace', () => {
      expect(appendOrReplaceContext('', '💡 Mnemonic: Hook')).toBe(
        '💡 Mnemonic: Hook',
      )
      expect(appendOrReplaceContext('   ', 'Example sentence.')).toBe(
        'Example sentence.',
      )
    })

    it('replaces existing mnemonic separated by double newlines', () => {
      const prev = 'Example sentence.\n\n💡 Mnemonic: Old hook'
      const next = appendOrReplaceContext(prev, '💡 Mnemonic: New hook')
      expect(next).toBe('Example sentence.\n\n💡 Mnemonic: New hook')
    })

    it('replaces existing mnemonic separated by a single newline', () => {
      const prev = 'Example sentence.\n💡 Mnemonic: Old hook'
      const next = appendOrReplaceContext(prev, '💡 Mnemonic: New hook')
      expect(next).toBe('Example sentence.\n💡 Mnemonic: New hook')
    })

    it('replaces mnemonic without emoji prefix', () => {
      const prev = 'Example sentence.\n\nMnemonic: Old hook'
      const next = appendOrReplaceContext(prev, '💡 Mnemonic: New hook')
      expect(next).toBe('Example sentence.\n\n💡 Mnemonic: New hook')
    })

    it('replaces lowercase mnemonic prefix case-insensitively', () => {
      const prev = 'mnemonic: old hook'
      const next = appendOrReplaceContext(prev, '💡 Mnemonic: New hook')
      expect(next).toBe('💡 Mnemonic: New hook')
    })

    it('appends mnemonic when no existing mnemonic is present', () => {
      const prev = 'Example sentence.'
      const next = appendOrReplaceContext(prev, '💡 Mnemonic: New hook')
      expect(next).toBe('Example sentence.\n\n💡 Mnemonic: New hook')
    })

    it('does not duplicate identical text', () => {
      const prev = 'Example sentence.'
      expect(appendOrReplaceContext(prev, 'Example sentence.')).toBe(
        'Example sentence.',
      )
    })
  })
})
