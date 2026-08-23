import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './jolito'
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
    const user = userEvent.setup()
    const services = createTestServices()
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

    expect(
      screen.getByRole('heading', { name: '¿Dónde está el metro?' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: /metro train/i }),
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

    expect(services.mockSounds.played).toEqual([
      'reveal',
      'easy',
      'reveal',
      'again',
      'reveal',
      'easy',
      'complete',
    ])
    expect(services.memoryCards.saved).toHaveLength(6)
    expect(services.memoryCards.saved?.[0]?.prompt).toBe(
      '¿Dónde está el metro?',
    )
  })

  it('supports a one-way card and keeps review usable without speech synthesis', async () => {
    const user = userEvent.setup()
    const services = createTestServices({ speakerSupported: false })
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    await user.type(screen.getByLabelText(/spanish/i), 'Qué padre')
    await user.type(screen.getByLabelText(/english/i), 'How cool')
    await user.click(screen.getByLabelText(/practice both directions/i))
    await user.click(screen.getByRole('button', { name: /save card/i }))

    expect(screen.getByRole('status')).toHaveTextContent(
      /audio isn’t available/i,
    )
    await user.type(screen.getByLabelText('Your answer'), 'How cool')
    await user.keyboard('{Enter}')
    expect(screen.getByText('How cool')).toBeInTheDocument()
    expect(document.querySelector('.diff-exact-card')).toBeInTheDocument()
    await user.keyboard('4')
    expect(screen.getByText(/1 card practiced/i)).toBeInTheDocument()
  })

  it('circulates failed cards to the end of the session queue until all cards are graduated', async () => {
    const user = userEvent.setup()
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /practice 4 due/i }))

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
    const user = userEvent.setup()
    const services = createTestServices()
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
    const user = userEvent.setup()
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
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /practice 4 due/i }))
    expect(screen.getByLabelText('Your answer')).toBeInTheDocument()
  })

  it('navigates backwards and forwards with browser history and popstate events', async () => {
    const user = userEvent.setup()
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
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('resumes an in-progress review queue when navigating back and forward', async () => {
    const user = userEvent.setup()
    const services = createTestServices()
    window.location.hash = ''
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /practice 4 due/i }))
    expect(
      screen.getByRole('heading', { name: 'aguacate' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Session progress')).toHaveTextContent('1 / 4')

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
    expect(screen.getByLabelText('Session progress')).toHaveTextContent('1 / 4')
  })

  it('suggests Mexican Spanish expressions and auto-fills translation and context on selection', async () => {
    const user = userEvent.setup()
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
  })

  it('detects typos in Spanish input and offers "Did you mean" suggestion chip', async () => {
    const user = userEvent.setup()
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
  })

  it('supports keyboard navigation (ArrowDown + Enter) to select suggestions', async () => {
    const user = userEvent.setup()
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

    expect(spanishInput).toHaveValue('Qué padre')
    expect(screen.getByLabelText(/english/i)).toHaveValue(
      'How cool / fantastic',
    )
  })

  it('opens deck backup modal, exports backup JSON, and downloads file', async () => {
    const user = userEvent.setup()
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /backup/i }))
    expect(
      screen.getByRole('heading', { name: /deck backup & safety/i }),
    ).toBeInTheDocument()

    const exportBtn = screen.getByRole('button', {
      name: /export backup \(json\)/i,
    })
    await user.click(exportBtn)

    expect(screen.getByRole('status')).toHaveTextContent(/deck exported/i)
  })

  it('imports backup JSON in replace mode and updates cards and storage', async () => {
    const user = userEvent.setup()
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /backup/i }))

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

    const fileInput = screen.getByLabelText(/choose backup json file/i)
    await user.upload(fileInput, backupFile)

    expect(
      await screen.findByText(/found 1 cards ready to import/i),
    ).toBeInTheDocument()

    const restoreBtn = screen.getByRole('button', { name: /restore backup/i })
    await user.click(restoreBtn)

    expect(
      await screen.findByText(/successfully imported 1 cards/i),
    ).toBeInTheDocument()
    expect(services.memoryCards.saved).toHaveLength(1)
    expect(services.memoryCards.saved?.[0]?.prompt).toBe('Buenos días')
  })

  it('imports backup JSON in merge mode and preserves existing cards', async () => {
    const user = userEvent.setup()
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /backup/i }))

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

    const fileInput = screen.getByLabelText(/choose backup json file/i)
    await user.upload(fileInput, backupFile)

    expect(
      await screen.findByText(/found 1 cards ready to import/i),
    ).toBeInTheDocument()

    const mergeBtn = screen.getByRole('button', { name: /merge backup/i })
    await user.click(mergeBtn)

    expect(
      await screen.findByText(/successfully imported 1 cards/i),
    ).toBeInTheDocument()
    expect(services.memoryCards.saved?.length).toBeGreaterThan(1)
    expect(
      services.memoryCards.saved?.some((c) => c.prompt === 'Buenas noches'),
    ).toBe(true)
  })

  it('displays error message when importing invalid file', async () => {
    const user = userEvent.setup()
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /backup/i }))

    const corruptFile = new File(['{ invalid json'], 'bad.json', {
      type: 'application/json',
    })

    const fileInput = screen.getByLabelText(/choose backup json file/i)
    await user.upload(fileInput, corruptFile)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /invalid json format/i,
    )
  })

  it('closes backup modal via close button and Escape key', async () => {
    const user = userEvent.setup()
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /backup/i }))
    expect(
      screen.getByRole('heading', { name: /deck backup & safety/i }),
    ).toBeInTheDocument()

    // Close via close button
    await user.click(screen.getByRole('button', { name: /close dialog/i }))
    expect(
      screen.queryByRole('heading', { name: /deck backup & safety/i }),
    ).not.toBeInTheDocument()

    // Open again and close via Escape
    await user.click(screen.getByRole('button', { name: /backup/i }))
    expect(
      screen.getByRole('heading', { name: /deck backup & safety/i }),
    ).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(
      screen.queryByRole('heading', { name: /deck backup & safety/i }),
    ).not.toBeInTheDocument()
  })
})
