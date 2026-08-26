import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './jolito'
import { createStudyCards } from './domain/card'
import { starterCards } from './application/starter-cards'
import { createTestServices } from './test/services'

class SpeechSynthesisUtteranceMock {
  lang = ''
  rate = 1

  constructor(public text: string) {}
}

const speech = { cancel: vi.fn(), speak: vi.fn() }

beforeEach(() => {
  window.location.hash = ''
  localStorage.clear()
  vi.clearAllMocks()
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: speech,
  })
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    value: SpeechSynthesisUtteranceMock,
  })
})

describe('Jolito', () => {
  it('creates asymmetric bidirectional cards and supports a keyboard review flow with injected services', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices({
      cards: [],
      user: { id: 'usr-1', email: 'learner@example.com' },
    })
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    await user.type(screen.getByLabelText(/spanish/i), '¿Dónde está el metro?')
    await user.type(screen.getByLabelText(/english/i), 'Where is the metro?')
    await user.click(
      screen.getByText('Customize reverse card', { selector: 'summary' }),
    )
    await user.type(
      screen.getByLabelText(/prompt/i),
      'Where can I find the metro?',
    )
    await user.type(
      screen.getByLabelText(/answer/i),
      '¿Por dónde queda el metro?',
    )
    await user.type(
      screen.getByLabelText(/context/i),
      'Useful when getting around CDMX.',
    )
    await user.click(screen.getByRole('button', { name: /save card/i }))
    await user.click(screen.getByRole('button', { name: /^practice$/i }))

    expect(
      screen.getByRole('heading', { name: '¿Dónde está el metro?' }),
    ).toBeInTheDocument()

    const response = screen.getByLabelText('Your answer')
    await user.type(response, 'Where is metro')
    await user.keyboard('{Enter}')

    expect(screen.getByText('You wrote')).toBeInTheDocument()
    expect(document.querySelector('.diff-seg-missing')).toHaveTextContent('the')
    expect(screen.getByText('Additional Context')).toBeInTheDocument()

    await user.keyboard('4')
    expect(
      screen.getByRole('heading', { name: 'Where can I find the metro?' }),
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText('Your answer'), 'No recuerdo')
    await user.keyboard('{Enter}')
    await user.keyboard('1') // Again -> requeues card 2

    expect(
      screen.getByRole('heading', { name: 'Where can I find the metro?' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: '¡Hecho!' }),
    ).not.toBeInTheDocument()

    // Pass the requeued card on next attempt
    await user.type(
      screen.getByLabelText('Your answer'),
      '¿Por dónde queda el metro?',
    )
    await user.keyboard('{Enter}')
    await user.keyboard('4') // Easy -> graduates

    expect(screen.getByRole('heading', { name: '¡Hecho!' })).toBeInTheDocument()
    expect(screen.getByText(/3 cards practiced/i)).toBeInTheDocument()
    expect(document.querySelector('.complete-mascot-frame')).toBeInTheDocument()
    expect(document.querySelector('.complete-mascot-img')).toBeInTheDocument()

    expect(services.mockSounds.played).toEqual([
      'reveal',
      'easy',
      'reveal',
      'again',
      'reveal',
      'easy',
      'complete',
    ])
    expect(services.memoryCards.saved).toHaveLength(2)
    expect(services.memoryCards.saved?.[0]?.prompt).toBe(
      '¿Dónde está el metro?',
    )
  })

  it('supports a one-way card and keeps review usable without speech synthesis', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices({
      cards: [],
      speakerSupported: false,
      user: { id: 'usr-1', email: 'learner@example.com' },
    })
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    await user.type(screen.getByLabelText(/spanish/i), 'qué padre')
    await user.type(screen.getByLabelText(/english/i), 'how cool')
    await user.click(screen.getByLabelText(/practice both directions/i))
    await user.click(screen.getByRole('button', { name: /save card/i }))
    await user.click(screen.getByRole('button', { name: /^practice$/i }))

    expect(screen.getByRole('status')).toHaveTextContent(
      /audio isn’t available/i,
    )
    await user.type(screen.getByLabelText('Your answer'), 'how cool')
    await user.keyboard('{Enter}')
    expect(screen.getByText('how cool')).toBeInTheDocument()
    expect(document.querySelector('.diff-exact-card')).toBeInTheDocument()
    await user.keyboard('4')
    expect(screen.getByText(/1 card practiced/i)).toBeInTheDocument()
  })

  it('circulates failed cards to the end of the session queue until all cards are graduated', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /^practice$/i }))

    // Card 1: fail with Again
    await user.keyboard('{Enter}')
    await user.keyboard('1')

    // Advances to Card 2: pass with Easy
    await user.keyboard('{Enter}')
    await user.keyboard('4')

    // Advances to Card 3: pass with Easy
    await user.keyboard('{Enter}')
    await user.keyboard('4')

    // Advances to Card 4: pass with Easy
    await user.keyboard('{Enter}')
    await user.keyboard('4')

    // Session is NOT complete yet — Card 1 was re-queued and appears now!
    expect(
      screen.queryByRole('heading', { name: '¡Hecho!' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'aguacate' }),
    ).toBeInTheDocument()

    // Finally pass Card 1 with Easy
    await user.keyboard('{Enter}')
    await user.keyboard('4')

    expect(screen.getByRole('heading', { name: '¡Hecho!' })).toBeInTheDocument()
    expect(screen.getByText(/5 cards practiced/i)).toBeInTheDocument()
  })

  it('displays soft accent highlights and sub-word typo diffs on reveal', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices({
      cards: [],
      user: { id: 'usr-1', email: 'learner@example.com' },
    })
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    await user.type(
      screen.getByLabelText(/spanish/i),
      '¿Dónde está el restaurante?',
    )
    await user.type(
      screen.getByLabelText(/english/i),
      'Where is the restaurant?',
    )
    await user.click(screen.getByLabelText(/practice both directions/i))
    await user.click(screen.getByRole('button', { name: /save card/i }))
    await user.click(screen.getByRole('button', { name: /^practice$/i }))

    // Type with missing inverted question mark, missing accents, and typo in restaurante
    await user.type(
      screen.getByLabelText('Your answer'),
      'Where is the restuarant?',
    )
    await user.keyboard('{Enter}')

    expect(screen.getByText('You wrote')).toBeInTheDocument()
    expect(document.querySelector('.diff-seg-extra')).toHaveTextContent('u')
    expect(document.querySelector('.diff-seg-missing')).toHaveTextContent('u')
  })

  it('renders refined landing page copy and plays audio when clicking the sample cards', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    expect(
      screen.getByRole('heading', { name: /make the words you meet stick/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Jolito')).toBeInTheDocument()
    expect(
      screen.getByText('Create beautiful, spoken flashcards.', {
        exact: false,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Practice them at your rhythm.', { exact: false }),
    ).toBeInTheDocument()

    // Spanish card is foreground initially
    const spanishCard = screen.getByRole('button', {
      name: /play pronunciation for mexican spanish card: aguacate/i,
    })
    expect(spanishCard).toBeInTheDocument()
    expect(spanishCard).toHaveTextContent('aguacate')
    await user.click(spanishCard)

    expect(services.mockSpeaker.spoken).toContainEqual({
      text: 'aguacate',
      locale: 'es-MX',
    })

    // English card in background
    const englishCard = screen.getByRole('button', {
      name: /show english card: avocado/i,
    })
    expect(englishCard).toBeInTheDocument()
    expect(englishCard).toHaveTextContent('avocado')
    await user.click(englishCard)

    expect(services.mockSpeaker.spoken).toContainEqual({
      text: 'avocado',
      locale: 'en-US',
    })
  })

  it('works with default browser services without explicitly passing props', async () => {
    const user = userEvent.setup({ delay: null })
    render(<App />)

    await user.click(screen.getByRole('button', { name: /^practice$/i }))
    expect(screen.getByLabelText('Your answer')).toBeInTheDocument()
  })

  it('navigates backwards and forwards with browser history and popstate events', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    window.location.hash = ''
    render(<App services={services} />)

    expect(
      screen.getByRole('heading', { name: /make the words you meet stick/i }),
    ).toBeInTheDocument()

    // Navigate to create card
    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    expect(
      screen.getByRole('heading', { name: 'New flashcard' }),
    ).toBeInTheDocument()
    expect(window.location.hash).toBe('#/create')

    // Simulate browser Back button
    act(() => {
      window.location.hash = '#/'
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(
      screen.getByRole('heading', { name: /make the words you meet stick/i }),
    ).toBeInTheDocument()

    // Simulate browser Forward button
    act(() => {
      window.location.hash = '#/create'
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(
      screen.getByRole('heading', { name: 'New flashcard' }),
    ).toBeInTheDocument()
  })

  it('renders complete screen without blank page on direct load of #/study with 0 cards due', () => {
    const services = createTestServices({
      cards: [
        {
          id: 'card-1',
          noteId: 'note-1',
          prompt: 'Tal vez',
          answer: 'Maybe',
          direction: 'es-en',
          context: '',
          scene: 'conversation',
          schedule: {
            dueAt: 100000,
            intervalDays: 1,
            easeFactor: 2.5,
            state: 'review',
            reviews: 1,
            lapses: 0,
          },
        },
      ],
      clockTime: 0,
    })
    window.location.hash = '#/study'
    render(<App services={services} />)

    expect(
      screen.getByRole('heading', { name: 'You’re caught up.' }),
    ).toBeInTheDocument()
    expect(document.querySelector('.complete-mascot-frame')).toBeInTheDocument()
    expect(document.querySelector('.complete-mascot-img')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('resumes an in-progress review queue when navigating back and forward', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    window.location.hash = ''
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /^practice$/i }))
    expect(
      screen.getByRole('heading', { name: 'aguacate' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Session progress')).toHaveTextContent(
      /4\s*new.*0\s*learn.*0\s*due/,
    )

    // Navigate back to welcome
    act(() => {
      window.location.hash = '#/'
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(
      screen.getByRole('heading', { name: /make the words you meet stick/i }),
    ).toBeInTheDocument()

    // Navigate forward to study -> resumes active session!
    act(() => {
      window.location.hash = '#/study'
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(
      screen.getByRole('heading', { name: 'aguacate' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Session progress')).toHaveTextContent(
      /4\s*new.*0\s*learn.*0\s*due/,
    )
  })

  it('suggests Mexican Spanish expressions and auto-fills translation and context on selection', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    const spanishInput = screen.getByLabelText(/spanish/i)
    await user.type(spanishInput, 'ahor')

    expect(
      screen.getByRole('listbox', { name: /spanish suggestions/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('ahorita')).toBeInTheDocument()

    // Click suggestion item
    await user.click(screen.getByText('ahorita'))

    // Verifies auto-fill of Spanish, English, and context!
    expect(spanishInput).toHaveValue('ahorita')
    expect(screen.getByLabelText(/english/i)).toHaveValue(
      'right now / in a bit',
    )
    expect(screen.getByLabelText(/context/i)).toHaveValue(
      'Iconic Mexican time nuance: right now, soon, or never.',
    )
    expect(
      screen.queryByRole('listbox', { name: /spanish suggestions/i }),
    ).not.toBeInTheDocument()
  })

  it('detects typos in Spanish input and offers "Did you mean" suggestion chip', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    const spanishInput = screen.getByLabelText(/spanish/i)
    await user.type(spanishInput, 'aguacatte')

    expect(screen.getByText(/did you mean/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /aguacate/i }),
    ).toBeInTheDocument()

    // Click typo chip
    await user.click(screen.getByRole('button', { name: /aguacate/i }))

    expect(spanishInput).toHaveValue('aguacate')
    expect(screen.getByLabelText(/english/i)).toHaveValue('avocado')
    expect(screen.queryByText(/did you mean/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('listbox', { name: /spanish suggestions/i }),
    ).not.toBeInTheDocument()
  })

  it('supports keyboard navigation (ArrowDown + Enter) to select suggestions and closes overlay', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    const spanishInput = screen.getByLabelText(/spanish/i)
    await user.type(spanishInput, 'que pad')

    expect(
      screen.getByRole('listbox', { name: /spanish suggestions/i }),
    ).toBeInTheDocument()

    // Navigate with ArrowDown and select with Enter
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')

    expect(spanishInput).toHaveValue('qué padre')
    expect(screen.getByLabelText(/english/i)).toHaveValue(
      'how cool / fantastic',
    )
    expect(
      screen.queryByRole('listbox', { name: /spanish suggestions/i }),
    ).not.toBeInTheDocument()
  })

  it('supports selecting suggestions with Tab key and closes overlay', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    const spanishInput = screen.getByLabelText(/spanish/i)
    await user.type(spanishInput, 'no man')

    expect(
      screen.getByRole('listbox', { name: /spanish suggestions/i }),
    ).toBeInTheDocument()

    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Tab}')

    expect(spanishInput).toHaveValue('no manches')
    expect(screen.getByLabelText(/english/i)).toHaveValue(
      'no way / you are kidding',
    )
    expect(
      screen.queryByRole('listbox', { name: /spanish suggestions/i }),
    ).not.toBeInTheDocument()
  })

  it('closes suggestion overlay on Escape key without modifying input', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    const spanishInput = screen.getByLabelText(/spanish/i)
    await user.type(spanishInput, 'ahor')

    expect(
      screen.getByRole('listbox', { name: /spanish suggestions/i }),
    ).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(
      screen.queryByRole('listbox', { name: /spanish suggestions/i }),
    ).not.toBeInTheDocument()
    expect(spanishInput).toHaveValue('ahor')
  })

  it('selects existing text when tabbing between fields in the card creation view', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    const spanishInput = screen.getByLabelText<HTMLTextAreaElement>(/spanish/i)
    const englishInput =
      screen.getByLabelText<HTMLTextAreaElement>(/^english$/i)
    const contextInput =
      screen.getByLabelText<HTMLTextAreaElement>(/additional context/i)

    // 1. Select an autocomplete suggestion
    await user.type(spanishInput, 'ahor')
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')

    expect(spanishInput).toHaveValue('ahorita')
    expect(englishInput).toHaveValue('right now / in a bit')

    // 2. Tab into English field -> all text is selected and overwritten on typing
    await user.tab()
    expect(englishInput).toHaveFocus()
    expect(englishInput.selectionStart).toBe(0)
    expect(englishInput.selectionEnd).toBe('right now / in a bit'.length)

    await user.keyboard('soon')
    expect(englishInput).toHaveValue('soon')

    // 3. Tab directly into Context field -> all text is selected
    await user.tab()
    expect(contextInput).toHaveFocus()
    expect(contextInput.selectionStart).toBe(0)
    expect(contextInput.selectionEnd).toBe(
      'Iconic Mexican time nuance: right now, soon, or never.'.length,
    )
  })

  it('selects existing text when focusing fields in the deck edit card modal', async () => {
    const user = userEvent.setup({ delay: null })
    const cards = createStudyCards(
      {
        spanish: 'el aguacate',
        english: 'the avocado',
        context: 'culinary nuance',
        bidirectional: false,
      },
      'note-1',
      1000,
    )
    const services = createTestServices({ cards })
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /manage deck/i }))
    await user.click(screen.getByRole('row', { name: /card: el aguacate/i }))

    const promptInput = screen.getByLabelText<HTMLTextAreaElement>(
      /mexican spanish \(prompt\)/i,
    )
    const answerInput =
      screen.getByLabelText<HTMLTextAreaElement>(/english \(answer\)/i)

    expect(promptInput).toHaveFocus()
    expect(promptInput.selectionStart).toBe(0)
    expect(promptInput.selectionEnd).toBe('el aguacate'.length)

    await user.tab()
    if (!answerInput.matches(':focus')) {
      await user.tab()
    }
    expect(answerInput).toHaveFocus()
    expect(answerInput.selectionStart).toBe(0)
    expect(answerInput.selectionEnd).toBe('the avocado'.length)
  })

  it('renders clean study view without pictures, positions prompt audio beside prompt, and replays expected answer after reveal', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /^practice$/i }))

    // Prompt wrap contains heading and prompt audio button side by side
    const promptHeading = screen.getByRole('heading', { name: 'aguacate' })
    const promptAudioButton = screen.getByRole('button', {
      name: /play prompt audio/i,
    })
    expect(promptHeading).toBeInTheDocument()
    expect(promptAudioButton).toBeInTheDocument()
    expect(promptHeading.parentElement).toContainElement(promptAudioButton)
    expect(promptHeading.parentElement).toHaveClass('study-prompt-wrap')

    // Direction line sits below prompt with Mexican Spanish
    expect(screen.getByText(/MEXICAN SPANISH →.*ENGLISH/)).toBeInTheDocument()

    // No picture / sticker images in study section
    expect(
      screen.queryByRole('img', { name: 'Card illustration' }),
    ).not.toBeInTheDocument()

    // Replay audio shortcut before reveal replays the prompt
    services.mockSpeaker.spoken = []
    fireEvent.keyDown(window, { code: 'Space', ctrlKey: true })
    expect(services.mockSpeaker.spoken).toEqual([
      { text: 'aguacate', locale: 'es-MX' },
    ])

    // Reveal answer
    await user.keyboard('{Enter}')

    // No picture on reveal screen either
    expect(
      screen.queryByRole('img', { name: 'Card illustration' }),
    ).not.toBeInTheDocument()

    // Replay audio shortcut after reveal replays the EXPECTED ANSWER!
    services.mockSpeaker.spoken = []
    fireEvent.keyDown(window, { code: 'Space' })
    expect(services.mockSpeaker.spoken).toEqual([
      { text: 'avocado', locale: 'en-US' },
    ])

    // Rating fieldset has visually-hidden legend
    const legend = document.querySelector('.grade-fieldset legend')
    expect(legend).toHaveClass('sr-only')
  })

  it('plays prompt audio exactly once when starting practice with an authenticated user and does not loop', async () => {
    const user = userEvent.setup({ delay: null })
    const customCards = createStudyCards(
      {
        spanish: 'aguacate',
        english: 'avocado',
        context: '',
        bidirectional: false,
      },
      'custom-aguacate',
      0,
    )
    const services = createTestServices({
      user: { id: 'usr-1', email: 'learner@example.com' },
      cards: customCards,
    })

    // Simulate realistic async network sync returning parsed cards from remote JSON
    services.mockSync.syncDeck = async (cards) => {
      await new Promise((resolve) => setTimeout(resolve, 30))
      return {
        success: true,
        cards: cards.map((c) => ({ ...c })),
        syncedAt: Date.now(),
      }
    }

    render(<App services={services} />)

    // Wait for initial mount sync to complete
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Reset spoken list before starting review
    services.mockSpeaker.spoken = []

    await user.click(screen.getByRole('button', { name: /^practice$/i }))

    expect(
      screen.getByRole('heading', { name: 'aguacate' }),
    ).toBeInTheDocument()

    // Wait 100ms for any background sync or effects to run
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Prompt audio should have been played exactly once for 'aguacate'
    expect(services.mockSpeaker.spoken).toEqual([
      { text: 'aguacate', locale: 'es-MX' },
    ])
  })

  it('does not restart prompt audio when cards are updated in the background during active review', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /^practice$/i }))

    expect(
      screen.getByRole('heading', { name: 'aguacate' }),
    ).toBeInTheDocument()
    expect(services.mockSpeaker.spoken).toEqual([
      { text: 'aguacate', locale: 'es-MX' },
    ])

    // Clear spoken list
    services.mockSpeaker.spoken = []

    // Simulate an external background save / card update
    act(() => {
      services.cards.save([
        ...services.memoryCards.saved!.map((c) => ({ ...c })),
      ])
    })

    // Speaker should not have re-spoken 'aguacate'
    expect(services.mockSpeaker.spoken).toEqual([])
  })

  it('exports backup JSON and downloads file from deck manager', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()

    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /manage deck/i }))
    expect(
      screen.getByRole('heading', { name: /manage deck/i }),
    ).toBeInTheDocument()

    // Open Backup & Import modal
    await user.click(screen.getByRole('button', { name: /backup & import/i }))

    expect(
      screen.getByRole('heading', { name: /deck import & offline backup/i }),
    ).toBeInTheDocument()

    const exportBtn = screen.getByRole('button', {
      name: /export backup \(json\)/i,
    })
    await user.click(exportBtn)

    expect(screen.getByRole('status')).toHaveTextContent(/deck exported/i)
  })

  it('imports backup JSON in replace mode and updates cards and storage', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /manage deck/i }))

    // Open Backup & Import modal
    await user.click(screen.getByRole('button', { name: /backup & import/i }))

    const backupFile = new File(
      [
        JSON.stringify({
          version: 1,
          cards: [
            {
              id: 'restored-card-1',
              noteId: 'note-1',
              prompt: 'Buenos días',
              answer: 'Good morning',
              direction: 'es-en',
              context: 'Morning greeting',
              scene: 'conversation',
              schedule: {
                state: 'new',
                dueAt: 0,
                intervalDays: 0,
                easeFactor: 2.5,
                reviews: 0,
                lapses: 0,
              },
            },
          ],
        }),
      ],
      'my-backup.json',
      { type: 'application/json' },
    )

    const fileInput = screen.getByLabelText(/choose anki deck or backup file/i)
    await user.upload(fileInput, backupFile)

    expect(
      await screen.findByText(/found 1 cards.*ready to import/i),
    ).toBeInTheDocument()

    const restoreBtn = screen.getByRole('button', {
      name: /import deck \(replace current\)/i,
    })
    await user.click(restoreBtn)

    expect(
      await screen.findByText(/successfully imported 1 cards/i),
    ).toBeInTheDocument()
    expect(services.memoryCards.saved).toHaveLength(1)
    expect(services.memoryCards.saved?.[0]?.prompt).toBe('Buenos días')
  })

  it('imports backup JSON in merge mode and preserves existing cards', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /manage deck/i }))

    // Open Backup & Import modal
    await user.click(screen.getByRole('button', { name: /backup & import/i }))

    const mergeRadio = screen.getByLabelText(/merge/i)
    await user.click(mergeRadio)

    const backupFile = new File(
      [
        JSON.stringify({
          version: 1,
          cards: [
            {
              id: 'merged-card-1',
              noteId: 'note-m',
              prompt: 'Buenas noches',
              answer: 'Good night',
              direction: 'es-en',
              context: 'Evening greeting',
              scene: 'conversation',
              schedule: {
                state: 'new',
                dueAt: 0,
                intervalDays: 0,
                easeFactor: 2.5,
                reviews: 0,
                lapses: 0,
              },
            },
          ],
        }),
      ],
      'merge-backup.json',
      { type: 'application/json' },
    )

    const fileInput = screen.getByLabelText(/choose anki deck or backup file/i)
    await user.upload(fileInput, backupFile)

    expect(
      await screen.findByText(/found 1 cards.*ready to import/i),
    ).toBeInTheDocument()

    const mergeBtn = screen.getByRole('button', {
      name: /merge deck with library/i,
    })
    await user.click(mergeBtn)

    expect(
      await screen.findByText(/successfully imported 1 cards/i),
    ).toBeInTheDocument()
    expect(services.memoryCards.saved?.length).toBeGreaterThan(1)
    expect(
      services.memoryCards.saved?.some((c) => c.prompt === 'Buenas noches'),
    ).toBe(true)
  })

  it('imports Anki text export (TSV) via deck manager', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()

    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /manage deck/i }))

    // Open Backup & Import modal
    await user.click(screen.getByRole('button', { name: /backup & import/i }))

    const ankiText = `#separator:tab\n#html:true\nel perro\tthe dog\nla casa\tthe house`
    const ankiFile = new File([ankiText], 'anki-spanish.txt', {
      type: 'text/plain',
    })

    const fileInput = screen.getByLabelText(/choose anki deck or backup file/i)
    await user.upload(fileInput, ankiFile)

    expect(
      await screen.findByText(/found 2 cards.*ready to import/i),
    ).toBeInTheDocument()

    const importBtn = screen.getByRole('button', {
      name: /import deck \(replace current\)/i,
    })
    await user.click(importBtn)

    expect(
      await screen.findByText(/successfully imported 2 cards/i),
    ).toBeInTheDocument()
    expect(services.memoryCards.saved).toHaveLength(2)
  })

  it('displays error message when importing invalid file', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /manage deck/i }))

    // Open Backup & Import modal
    await user.click(screen.getByRole('button', { name: /backup & import/i }))

    const corruptFile = new File([''], 'bad.txt', {
      type: 'text/plain',
    })

    const fileInput = screen.getByLabelText(/choose anki deck or backup file/i)
    await user.upload(fileInput, corruptFile)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /no flashcards found/i,
    )
  })

  it('opens sync modal, sends magic link, verifies OTP, and signs in', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /tap to sync/i }))
    expect(
      screen.getByRole('heading', {
        name: /^cloud sync$/i,
      }),
    ).toBeInTheDocument()

    // Enter email
    const emailInput = screen.getByLabelText(/email address/i)
    await user.type(emailInput, 'learner@example.com')
    await user.click(screen.getByRole('button', { name: /send sign-in link/i }))

    expect(await screen.findByText(/sign-in link sent/i)).toBeInTheDocument()

    // Enter OTP
    const otpInput = screen.getByLabelText(/verification code/i)
    await user.type(otpInput, '123456')
    await user.click(screen.getByRole('button', { name: /verify & sync/i }))

    expect(
      await screen.findByText(/deck synchronized with cloud/i),
    ).toBeInTheDocument()
    expect(screen.getByText('Signed in')).toBeInTheDocument()
    expect(screen.getByText('learner@example.com')).toBeInTheDocument()
  })

  it('allows signed in user to manually trigger sync now', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices({
      user: { id: 'usr-1', email: 'sync-user@example.com' },
    })
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /cloud synced/i }))
    expect(screen.getByText('sync-user@example.com')).toBeInTheDocument()

    const syncNowBtn = screen.getByRole('button', { name: /sync now/i })
    await user.click(syncNowBtn)

    expect(
      await screen.findByText(/deck successfully synchronized with cloud/i),
    ).toBeInTheDocument()
    expect(services.mockSync.syncedCount).toBeGreaterThan(0)
  })

  it('allows signed in user to sign out and returns to auth form', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices({
      user: { id: 'usr-1', email: 'sync-user@example.com' },
    })
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /cloud synced/i }))
    expect(screen.getByText('sync-user@example.com')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /sign out/i }))

    expect(await screen.findByLabelText(/email address/i)).toBeInTheDocument()
  })

  it('closes sync modal via close button and Escape key', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /tap to sync/i }))
    expect(
      screen.getByRole('heading', {
        name: /^cloud sync$/i,
      }),
    ).toBeInTheDocument()

    // Close via close button
    await user.click(screen.getByRole('button', { name: /close dialog/i }))
    expect(
      screen.queryByRole('heading', {
        name: /^cloud sync$/i,
      }),
    ).not.toBeInTheDocument()

    // Open again and close via Escape
    await user.click(screen.getByRole('button', { name: /tap to sync/i }))
    expect(
      screen.getByRole('heading', {
        name: /^cloud sync$/i,
      }),
    ).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(
      screen.queryByRole('heading', {
        name: /^cloud sync$/i,
      }),
    ).not.toBeInTheDocument()
  })

  it('updates connection pill when network goes offline and recovers online', async () => {
    const services = createTestServices()
    render(<App services={services} />)

    expect(
      screen.getByRole('button', { name: /local deck only/i }),
    ).toBeInTheDocument()

    // Trigger offline event
    window.dispatchEvent(new Event('offline'))
    expect(
      await screen.findByRole('button', {
        name: /offline\. changes saved locally/i,
      }),
    ).toBeInTheDocument()

    // Trigger online event
    window.dispatchEvent(new Event('online'))
    expect(
      await screen.findByRole('button', { name: /local deck only/i }),
    ).toBeInTheDocument()
  })

  it('displays friendly notice when cloud sync is not enabled for preview', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    services.mockAuth.configured = false
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /tap to sync/i }))
    expect(
      screen.getByRole('heading', {
        name: /cloud sync is disabled in this preview/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', {
        name: /deck import & offline backup/i,
      }),
    ).not.toBeInTheDocument()
  })

  it('dynamically updates new, learn, and due queue counters during study and retries', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /^practice$/i }))

    // Initial state: 4 new cards in queue with tactile beads
    const badge = screen.getByLabelText('Session progress')
    expect(badge).toHaveTextContent(/4\s*cards left/)
    expect(badge).toHaveTextContent(/4\s*new.*0\s*learn.*0\s*due/)
    const initialBeads = badge.querySelectorAll('.queue-bead')
    expect(initialBeads).toHaveLength(4)
    expect(initialBeads[0]).toHaveClass('is-new', 'is-current')
    expect(initialBeads[1]).toHaveClass('is-new')

    // Card 1: fail with Again (1) -> moves to learn queue (requeued at end)
    await user.keyboard('{Enter}')
    await user.keyboard('1')
    expect(badge).toHaveTextContent(/4\s*cards left/)
    expect(badge.querySelector('.queue-retry-chip')).toBeNull()
    expect(badge).toHaveTextContent(/3\s*new.*1\s*learn.*0\s*due/)
    const requeuedBeads = badge.querySelectorAll('.queue-bead')
    expect(requeuedBeads).toHaveLength(4)
    expect(requeuedBeads[0]).toHaveClass('is-new', 'is-current')
    expect(requeuedBeads[3]).toHaveClass('is-learn')

    // Card 2: pass with Easy (4) -> graduates out of session
    await user.keyboard('{Enter}')
    await user.keyboard('4')
    expect(badge).toHaveTextContent(/3\s*cards left/)
    expect(badge).toHaveTextContent(/2\s*new.*1\s*learn.*0\s*due/)
    expect(badge.querySelectorAll('.queue-bead')).toHaveLength(3)

    // Card 3: pass with Easy (4) -> graduates out of session
    await user.keyboard('{Enter}')
    await user.keyboard('4')
    expect(badge).toHaveTextContent(/2\s*cards left/)
    expect(badge).toHaveTextContent(/1\s*new.*1\s*learn.*0\s*due/)
    expect(badge.querySelectorAll('.queue-bead')).toHaveLength(2)

    // Card 4: pass with Easy (4) -> graduates out of session
    await user.keyboard('{Enter}')
    await user.keyboard('4')
    // Now only Card 1 (learning retry) remains
    expect(badge).toHaveTextContent(/1\s*card left/)
    expect(badge).toHaveTextContent(/0\s*new.*1\s*learn.*0\s*due/)
    const remainingBeads = badge.querySelectorAll('.queue-bead')
    expect(remainingBeads).toHaveLength(1)
    expect(remainingBeads[0]).toHaveClass('is-learn', 'is-current')

    // Card 1 retry: pass with Good (3) -> graduates learning card
    await user.keyboard('{Enter}')
    await user.keyboard('3')

    // Session completes
    expect(
      await screen.findByRole('heading', { name: '¡Hecho!' }),
    ).toBeInTheDocument()
  })

  it('renders compact summary pill when review queue exceeds 6 cards', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    // Populate 12 due cards
    const extraCards = Array.from({ length: 12 }, (_, i) => ({
      id: `bulk-card-${i}`,
      noteId: `bulk-note-${i}`,
      prompt: `prompt-${i}`,
      answer: `answer-${i}`,
      direction: 'es-en' as const,
      context: '',
      scene: 'conversation' as const,
      schedule: {
        state: 'new' as const,
        dueAt: 0,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      },
    }))
    services.cards.save(extraCards)
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /^practice$/i }))

    const badge = screen.getByLabelText('Session progress')
    expect(badge.querySelector('.queue-compact-pill')).toBeInTheDocument()
    expect(badge.querySelector('.queue-beads-track')).not.toBeInTheDocument()
    expect(badge).toHaveTextContent(/12\s*cards left/)
    expect(badge).toHaveTextContent(/12\s*new/)
  })

  it('renders the Jolito brand vector mark in the header', () => {
    const services = createTestServices()
    render(<App services={services} />)

    const brandElement = screen.getByText('Jolito', { selector: 'span' })
    expect(brandElement).toBeInTheDocument()

    const brandLogo =
      brandElement.parentElement?.querySelector('svg.brand-mark')
    expect(brandLogo).toBeInTheDocument()
    expect(brandLogo).toHaveAttribute('aria-hidden', 'true')
  })

  it('updates live flashcard preview interactively on the create screen', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /create a card/i }))

    expect(
      screen.getByRole('heading', { name: /new flashcard/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Palabra o frase…')).toBeInTheDocument()
    expect(screen.getByText('English translation…')).toBeInTheDocument()

    // Type Spanish phrase
    await user.type(screen.getByLabelText(/mexican spanish/i), '¿Qué onda?')
    expect(
      document.querySelector('.create-visual .sample-card-es .sample-phrase'),
    ).toHaveTextContent('¿Qué onda?')

    // Type English translation
    await user.type(screen.getByLabelText(/^english$/i), "What's up?")
    expect(
      document.querySelector('.create-visual .sample-card-en .sample-phrase'),
    ).toHaveTextContent("What's up?")

    // Type additional context
    await user.type(
      screen.getByLabelText(/additional context/i),
      'Very common casual greeting across Mexico.',
    )
    expect(
      document.querySelector('.create-card-context-preview'),
    ).toHaveTextContent('Very common casual greeting across Mexico.')

    // Click background English card to swap foreground and play pronunciation
    const enCardBtn = screen.getByRole('button', {
      name: /show translation/i,
    })
    await user.click(enCardBtn)
    expect(enCardBtn).toHaveClass('is-foreground')
  })

  it('remains in create view after saving, resets form inputs, focuses Spanish field, and updates review counter for batch creation', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices({
      cards: [],
      user: { id: 'usr-1', email: 'learner@example.com' },
    })
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    expect(
      screen.queryByRole('button', { name: /^practice$/i }),
    ).not.toBeInTheDocument()

    // 1. Create first card
    const spanishInput = screen.getByLabelText(/mexican spanish/i)
    const englishInput = screen.getByLabelText(/^english$/i)
    const contextInput = screen.getByLabelText(/additional context/i)

    await user.type(spanishInput, 'chido')
    await user.type(englishInput, 'cool')
    await user.type(contextInput, 'Mexican slang')
    await user.click(screen.getByRole('button', { name: /save card/i }))

    // Stays in create view with animated save button confirmation
    expect(
      screen.getByRole('heading', { name: 'New flashcard' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/saved “chido”/i)
    expect(screen.getByRole('button', { name: 'Save card' })).toHaveClass(
      'is-saved',
    )
    expect(
      document.querySelector('.create-save-feedback'),
    ).not.toBeInTheDocument()
    expect(spanishInput).toHaveValue('')
    expect(englishInput).toHaveValue('')
    expect(contextInput).toHaveValue('')
    expect(spanishInput).toHaveFocus()
    // Practice button appears now that due cards exist
    expect(
      screen.getByRole('button', { name: /^practice$/i }),
    ).toBeInTheDocument()

    // 2. Create second card in batch without needing to re-navigate or re-focus
    await user.type(spanishInput, 'popote')
    await user.type(englishInput, 'drinking straw')
    await user.click(screen.getByRole('button', { name: 'Save card' }))

    expect(
      screen.getByRole('heading', { name: 'New flashcard' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/saved “popote”/i)
    expect(screen.getByRole('button', { name: 'Save card' })).toHaveClass(
      'is-saved',
    )
    expect(spanishInput).toHaveValue('')
    expect(englishInput).toHaveValue('')
    expect(spanishInput).toHaveFocus()
    expect(
      screen.getByRole('button', { name: /^practice$/i }),
    ).toBeInTheDocument()

    // 3. Navigate to review and practice all due cards
    await user.click(screen.getByRole('button', { name: /^practice$/i }))
    expect(screen.getByRole('heading', { name: 'popote' })).toBeInTheDocument()
  })

  it('renders vector brandmark in navigation and prominently displays the mascot on the homescreen', () => {
    const services = createTestServices()
    render(<App services={services} />)

    // 1. Verify Brand component renders the vector JolitoMark
    const brandElement = screen.getByText('Jolito').closest('.brand')
    expect(brandElement).toBeInTheDocument()
    const brandMark = brandElement?.querySelector('.brand-mark')
    expect(brandMark).toBeInTheDocument()
    expect(brandMark?.tagName.toLowerCase()).toBe('svg')
    expect(brandMark?.querySelector('.jolito-gills')).toBeInTheDocument()
    expect(brandMark?.querySelector('.jolito-core')).toBeInTheDocument()

    // 2. Verify mascot is prominently displayed on the welcome homescreen
    const mascotImg = document.querySelector('.welcome-mascot-img')
    expect(mascotImg).toBeInTheDocument()
    expect(mascotImg).toHaveAttribute('src', expect.stringContaining('png'))
    expect(mascotImg).toHaveAttribute('aria-hidden', 'true')
  })

  it('allows guest to explore create card screen and prompts sign in when clicking save card', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices({ cards: [] })
    render(<App services={services} />)

    // Guest navigates to Create screen without signing in
    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    const spanishInput = screen.getByLabelText(/mexican spanish/i)
    const englishInput = screen.getByLabelText(/^english$/i)

    // Interacts with create form
    await user.type(spanishInput, 'chela')
    await user.type(englishInput, 'beer')

    // Clicks "Save card" -> gates and opens sign-in modal
    await user.click(screen.getByRole('button', { name: /save card/i }))

    expect(
      screen.getByRole('heading', { name: /save your flashcard/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/free cloud sync across all your devices/i),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()

    // Form inputs remain preserved while modal is displayed
    expect(spanishInput).toHaveValue('chela')
    expect(englishInput).toHaveValue('beer')
  })

  it('automatically saves pending card when guest signs in via OTP in modal', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices({ cards: [] })
    render(<App services={services} />)

    // 1. Guest types card and clicks Save card
    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    const spanishInput = screen.getByLabelText(/mexican spanish/i)
    const englishInput = screen.getByLabelText(/^english$/i)
    await user.type(spanishInput, 'chido')
    await user.type(englishInput, 'cool')
    await user.click(screen.getByRole('button', { name: /save card/i }))

    // 2. Sign-in modal opens with focused save card heading
    expect(
      screen.getByRole('heading', { name: /save your flashcard/i }),
    ).toBeInTheDocument()

    // 3. Guest enters email and requests link
    const emailInput = screen.getByLabelText(/email address/i)
    await user.type(emailInput, 'learner@example.com')
    await user.click(
      screen.getByRole('button', { name: /continue with email/i }),
    )

    // 4. Guest enters OTP code
    const otpInput = screen.getByLabelText(/verification code/i)
    await user.type(otpInput, '123456')
    await user.click(
      screen.getByRole('button', { name: /verify & save card/i }),
    )

    // 5. Verification succeeds -> pending card is automatically saved!
    expect(
      screen.queryByRole('heading', { name: /save your flashcard/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/saved “chido”/i)
    expect(spanishInput).toHaveValue('')
    expect(englishInput).toHaveValue('')
    expect(services.memoryCards.saved).toHaveLength(2)
  })

  it('preserves typed card input in create form if guest closes sign in modal without authenticating', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices({ cards: [] })
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    const spanishInput = screen.getByLabelText(/mexican spanish/i)
    const englishInput = screen.getByLabelText(/^english$/i)
    await user.type(spanishInput, 'popote')
    await user.type(englishInput, 'straw')
    await user.click(screen.getByRole('button', { name: /save card/i }))

    // Modal is open
    expect(
      screen.getByRole('heading', { name: /save your flashcard/i }),
    ).toBeInTheDocument()

    // Guest presses Escape to dismiss modal
    await user.keyboard('{Escape}')

    // Modal is closed, but typed input is preserved in form!
    expect(
      screen.queryByRole('heading', { name: /save your flashcard/i }),
    ).not.toBeInTheDocument()
    expect(spanishInput).toHaveValue('popote')
    expect(englishInput).toHaveValue('straw')
  })

  it('opens modal when auth backend is unconfigured and allows saving card locally in preview mode', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices({ cards: [] })
    services.mockAuth.configured = false // Unconfigured / offline preview mode
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    const spanishInput = screen.getByLabelText(/mexican spanish/i)
    const englishInput = screen.getByLabelText(/^english$/i)
    await user.type(spanishInput, 'orale')
    await user.type(englishInput, 'right on / wow')
    await user.click(screen.getByRole('button', { name: /save card/i }))

    // Modal opens asking to sign in and showing preview notice
    expect(
      screen.getByRole('heading', { name: /save your flashcard/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/cloud sync disabled in preview/i),
    ).toBeInTheDocument()

    // User clicks save locally in preview
    await user.click(
      screen.getByRole('button', { name: /save card to this device/i }),
    )

    expect(
      screen.queryByRole('heading', { name: /save your flashcard/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/saved “orale”/i)
    expect(services.memoryCards.saved).toHaveLength(2)
  })

  it('ensures example starter cards do not end up in the user deck when a guest creates their first card and signs in', async () => {
    const user = userEvent.setup({ delay: null })
    // Start with starter cards loaded by default as fallback
    const services = createTestServices()
    render(<App services={services} />)

    // 1. Guest explores welcome view with starter cards due (4 due)
    expect(
      screen.getByRole('button', { name: /^practice$/i }),
    ).toBeInTheDocument()

    // 2. Guest goes to Create screen and creates their first personal card
    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    const spanishInput = screen.getByLabelText(/mexican spanish/i)
    const englishInput = screen.getByLabelText(/^english$/i)
    await user.type(spanishInput, 'chido')
    await user.type(englishInput, 'cool')
    await user.click(screen.getByRole('button', { name: /save card/i }))

    // 3. Guest signs in
    const emailInput = screen.getByLabelText(/email address/i)
    await user.type(emailInput, 'learner@example.com')
    await user.click(
      screen.getByRole('button', { name: /continue with email/i }),
    )

    const otpInput = screen.getByLabelText(/verification code/i)
    await user.type(otpInput, '123456')
    await user.click(
      screen.getByRole('button', { name: /verify & save card/i }),
    )

    // 4. Modal closes and card is saved
    expect(
      screen.queryByRole('heading', { name: /save your flashcard/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/saved “chido”/i)

    // 5. Verify local storage has ONLY the 2 user cards (zero starter cards!)
    expect(services.memoryCards.saved).toHaveLength(2)
    expect(
      services.memoryCards.saved?.every(
        (card) => !card.noteId.startsWith('starter-'),
      ),
    ).toBe(true)

    // 6. Verify cloud sync has ONLY the 2 user cards (zero starter cards!)
    expect(services.mockSync.remoteCards).toHaveLength(2)
    expect(
      services.mockSync.remoteCards.every(
        (card) => !card.noteId.startsWith('starter-'),
      ),
    ).toBe(true)

    // 7. Review button reflects only the 2 user cards
    expect(
      screen.getByRole('button', { name: /^practice$/i }),
    ).toBeInTheDocument()
  })

  it('navigates to deck manager, displays deck stats, and filters cards by search and state pills', async () => {
    const user = userEvent.setup()
    const services = createTestServices()
    render(<App services={services} />)

    // Navigate to Deck Manager
    await user.click(screen.getByRole('button', { name: /manage deck/i }))

    expect(
      screen.getByRole('heading', { name: /manage deck/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /all \(4\)/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /due \(4\)/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /new \(4\)/i }),
    ).toBeInTheDocument()

    // 4 starter cards are shown
    const cardItems = screen.getAllByRole('row', { name: /card:/i })
    expect(cardItems).toHaveLength(4)

    // Search for "aguacate" (matches 2 bidirectional cards: es-en prompt and en-es answer)
    const searchInput = screen.getByLabelText(/search cards in deck/i)
    await user.type(searchInput, 'aguacate')

    expect(screen.getAllByRole('row', { name: /card:/i })).toHaveLength(2)
    expect(screen.getAllByText('aguacate')).toHaveLength(2)

    // Clear search
    await user.clear(searchInput)
    expect(screen.getAllByRole('row', { name: /card:/i })).toHaveLength(4)

    // Filter by state pill "Review" (0 cards in review state initially)
    await user.click(screen.getByRole('button', { name: /review \(0\)/i }))
    expect(screen.queryAllByRole('row', { name: /card:/i })).toHaveLength(0)
    expect(screen.getByText(/no cards found/i)).toBeInTheDocument()

    // Clear filter
    await user.click(screen.getByRole('button', { name: /all \(4\)/i }))
    expect(screen.getAllByRole('row', { name: /card:/i })).toHaveLength(4)

    // Checkbox selection & batch actions
    const selectAllCheckbox = screen.getByRole('checkbox', {
      name: /select all cards/i,
    })
    await user.click(selectAllCheckbox)
    expect(
      screen.getByRole('button', { name: /delete selected \(4\)/i }),
    ).toBeInTheDocument()

    // Clear selection
    await user.click(screen.getByRole('button', { name: /clear selection/i }))
    expect(
      screen.queryByRole('button', { name: /delete selected/i }),
    ).not.toBeInTheDocument()
  })

  it('modifies card in deck manager by clicking row and persists updates to storage', async () => {
    const user = userEvent.setup()
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /manage deck/i }))

    // Click card row directly to edit "aguacate"
    await user.click(screen.getByRole('row', { name: /card: aguacate,/i }))

    expect(
      screen.getByRole('heading', { name: /edit flashcard/i }),
    ).toBeInTheDocument()
    const promptInput = screen.getByLabelText(/mexican spanish \(prompt\)/i)
    const answerInput = screen.getByLabelText(/english \(answer\)/i)
    const contextInput = screen.getByLabelText(/additional context/i)

    expect(promptInput).toHaveValue('aguacate')
    expect(answerInput).toHaveValue('avocado')

    // Update fields
    await user.clear(promptInput)
    await user.type(promptInput, 'el aguacate')
    await user.clear(answerInput)
    await user.type(answerInput, 'the avocado')
    await user.clear(contextInput)
    await user.type(contextInput, 'Great with lime')

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    // Modal closes and updated card is displayed
    expect(
      screen.queryByRole('heading', { name: /edit flashcard/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('el aguacate')).toBeInTheDocument()
    expect(screen.getByText('the avocado')).toBeInTheDocument()

    // Verify storage update
    expect(
      services.memoryCards.saved?.some(
        (c) =>
          c.prompt === 'el aguacate' &&
          c.answer === 'the avocado' &&
          c.context === 'Great with lime',
      ),
    ).toBe(true)
  })

  it('disables reset learning progress toggle for brand new cards in edit modal', async () => {
    const user = userEvent.setup()
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /manage deck/i }))
    await user.click(screen.getByRole('row', { name: /card: aguacate,/i }))

    expect(
      screen.getByRole('heading', { name: /edit flashcard/i }),
    ).toBeInTheDocument()

    const toggle = screen.getByRole('checkbox', {
      name: /reset learning progress/i,
    })
    expect(toggle).toBeDisabled()
    expect(
      screen.getByText('Card is already brand new (0 reviews)'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cancel/i }))
  })

  it('resets learning history to brand new card when reset progress is toggled in edit modal', async () => {
    const user = userEvent.setup()
    const services = createTestServices({
      cards: [],
      user: { id: 'usr-1', email: 'learner@example.com' },
    })
    const cardWithHistory = {
      ...starterCards[0]!,
      id: 'custom-card-1',
      noteId: 'note-custom-1',
      prompt: 'platicar',
      answer: 'to chat',
      context: 'Informal Mexican Spanish',
      schedule: {
        state: 'review' as const,
        dueAt: services.clock.now() + 86400000 * 14,
        intervalDays: 14,
        easeFactor: 2.6,
        reviews: 6,
        lapses: 1,
      },
    }
    services.cards.save([cardWithHistory])
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /manage deck/i }))

    // Initially shows Review state pill in filter and Due in 14d chip in table
    expect(
      screen.getByRole('button', { name: /review \(1\)/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Due in 14d')).toBeInTheDocument()

    // Click card row to edit
    await user.click(screen.getByRole('row', { name: /card: platicar,/i }))

    expect(
      screen.getByRole('heading', { name: /edit flashcard/i }),
    ).toBeInTheDocument()

    const toggle = screen.getByRole('checkbox', {
      name: /reset learning progress/i,
    })
    expect(toggle).not.toBeDisabled()
    expect(toggle).not.toBeChecked()
    expect(
      screen.getByText('Treat as a new card and restart review history'),
    ).toBeInTheDocument()

    // Toggle reset progress
    await user.click(toggle)
    expect(toggle).toBeChecked()

    // Save changes
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    // Modal closed
    expect(
      screen.queryByRole('heading', { name: /edit flashcard/i }),
    ).not.toBeInTheDocument()

    // Filter pills reflect New (1) and Review (0)
    expect(
      screen.getByRole('button', { name: /new \(1\)/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /review \(0\)/i }),
    ).toBeInTheDocument()

    // Saved card in storage has reset schedule
    const savedCard = services.memoryCards.saved?.find(
      (c) => c.id === 'custom-card-1',
    )
    expect(savedCard).toBeDefined()
    expect(savedCard!.schedule).toEqual({
      state: 'new',
      dueAt: services.clock.now(),
      intervalDays: 0,
      easeFactor: 2.5,
      reviews: 0,
      lapses: 0,
    })
  })

  it('preserves learning schedule when saving edit without toggling reset progress', async () => {
    const user = userEvent.setup()
    const services = createTestServices({
      cards: [],
      user: { id: 'usr-1', email: 'learner@example.com' },
    })
    const initialDueAt = services.clock.now() + 86400000 * 14
    const cardWithHistory = {
      ...starterCards[0]!,
      id: 'custom-card-2',
      noteId: 'note-custom-2',
      prompt: 'platicar',
      answer: 'to chat',
      context: 'Informal Mexican Spanish',
      schedule: {
        state: 'review' as const,
        dueAt: initialDueAt,
        intervalDays: 14,
        easeFactor: 2.6,
        reviews: 6,
        lapses: 1,
      },
    }
    services.cards.save([cardWithHistory])
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /manage deck/i }))
    await user.click(screen.getByRole('row', { name: /card: platicar,/i }))

    const promptInput = screen.getByLabelText(/mexican spanish \(prompt\)/i)
    await user.clear(promptInput)
    await user.type(promptInput, 'charlar')

    // Don't toggle reset progress - just save
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    const savedCard = services.memoryCards.saved?.find(
      (c) => c.id === 'custom-card-2',
    )
    expect(savedCard).toBeDefined()
    expect(savedCard!.prompt).toBe('charlar')
    expect(savedCard!.schedule).toEqual(cardWithHistory.schedule)
  })

  it('deletes card in deck manager after checkbox selection and confirmation modal', async () => {
    const user = userEvent.setup()
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /manage deck/i }))

    // Select checkbox on "aguacate" card
    const checkbox = screen.getByRole('checkbox', {
      name: /select card aguacate/i,
    })
    await user.click(checkbox)

    const batchDeleteBtn = screen.getByRole('button', {
      name: /delete selected \(1\)/i,
    })
    await user.click(batchDeleteBtn)

    expect(
      screen.getByRole('heading', { name: /delete flashcard\?/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/this card will be removed from your deck/i),
    ).toBeInTheDocument()

    // Cancel first
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(
      screen.queryByRole('heading', { name: /delete flashcard\?/i }),
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole('row', { name: /card:/i })).toHaveLength(4)

    // Delete again and confirm
    await user.click(
      screen.getByRole('button', { name: /delete selected \(1\)/i }),
    )
    await user.click(screen.getByRole('button', { name: /^delete card$/i }))

    // Modal closes, card is deleted
    expect(
      screen.queryByRole('heading', { name: /delete flashcard\?/i }),
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole('row', { name: /card:/i })).toHaveLength(3)
    expect(
      screen.queryByRole('row', { name: /card: aguacate,/i }),
    ).not.toBeInTheDocument()
    expect(services.memoryCards.saved).toHaveLength(3)
  })

  it('supports batch deletion of multiple selected cards in deck manager', async () => {
    const user = userEvent.setup()
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /manage deck/i }))

    // Select 2 cards
    await user.click(
      screen.getByRole('checkbox', { name: /select card aguacate/i }),
    )
    await user.click(
      screen.getByRole('checkbox', { name: /select card avocado/i }),
    )

    const batchDeleteBtn = screen.getByRole('button', {
      name: /delete selected \(2\)/i,
    })
    await user.click(batchDeleteBtn)

    expect(
      screen.getByRole('heading', { name: /delete 2 flashcards\?/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/these cards will be permanently removed/i),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /delete 2 cards/i }))

    expect(
      screen.queryByRole('heading', { name: /delete 2 flashcards\?/i }),
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole('row', { name: /card:/i })).toHaveLength(2)
    expect(services.memoryCards.saved).toHaveLength(2)
  })

  it('supports keyboard navigation, space to select, and enter to edit card row in deck manager', async () => {
    const user = userEvent.setup()
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /manage deck/i }))

    const rows = screen.getAllByRole('row', { name: /card:/i })
    expect(rows).toHaveLength(4)

    // Focus first row and press Space to toggle selection
    rows[0]!.focus()
    fireEvent.keyDown(rows[0]!, { key: ' ', code: 'Space' })
    expect(rows[0]).toHaveClass('is-selected')

    // Press Enter to open edit modal
    fireEvent.keyDown(rows[0]!, { key: 'Enter' })
    expect(
      screen.getByRole('heading', { name: /edit flashcard/i }),
    ).toBeInTheDocument()

    // Dismiss with Escape
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(
      screen.queryByRole('heading', { name: /edit flashcard/i }),
    ).not.toBeInTheDocument()
  })

  it('allows quick editing and deleting during an active study review session', async () => {
    const user = userEvent.setup()
    const services = createTestServices()
    render(<App services={services} />)

    // Start practice session
    await user.click(screen.getByRole('button', { name: /^practice$/i }))

    expect(
      screen.getByRole('heading', { name: 'aguacate' }),
    ).toBeInTheDocument()

    // In-study quick edit
    const editBtn = screen.getByRole('button', {
      name: /edit card: aguacate/i,
    })
    await user.click(editBtn)

    expect(
      screen.getByRole('heading', { name: /edit flashcard/i }),
    ).toBeInTheDocument()
    const promptInput = screen.getByLabelText(/mexican spanish \(prompt\)/i)
    await user.clear(promptInput)
    await user.type(promptInput, 'palta fresca')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    // Active study card immediately updates its prompt!
    expect(
      screen.getByRole('heading', { name: 'palta fresca' }),
    ).toBeInTheDocument()

    // In-study quick delete
    const deleteBtn = screen.getByRole('button', {
      name: /delete card: palta fresca/i,
    })
    await user.click(deleteBtn)

    expect(
      screen.getByRole('heading', { name: /delete flashcard\?/i }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^delete card$/i }))

    // Queue moves directly to next card in queue ('avocado')
    expect(
      screen.queryByRole('heading', { name: 'palta fresca' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'avocado' })).toBeInTheDocument()
    expect(screen.getByLabelText('Session progress')).toHaveTextContent(
      /3\s*cards left/,
    )
  })

  it('opens edit modal via "e" keyboard shortcut during study session', async () => {
    const user = userEvent.setup()
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /^practice$/i }))
    expect(
      screen.getByRole('heading', { name: 'aguacate' }),
    ).toBeInTheDocument()

    // Blur input or reveal answer to press 'e'
    await user.keyboard('{Enter}')
    await user.keyboard('e')

    expect(
      screen.getByRole('heading', { name: /edit flashcard/i }),
    ).toBeInTheDocument()
  })
})
