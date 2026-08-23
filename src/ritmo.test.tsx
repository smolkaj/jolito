import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './ritmo'
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

describe('Ritmo', () => {
  it('creates asymmetric bidirectional cards and supports a keyboard review flow with injected services', async () => {
    const user = userEvent.setup()
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    await user.type(
      screen.getByLabelText(/^Spanish Mexican Spanish$/),
      '¿Dónde está el metro?',
    )
    await user.type(
      screen.getByLabelText(/^English Concise meaning$/),
      'Where is the metro?',
    )
    await user.click(
      screen.getByText('Customize the reverse card', { selector: 'summary' }),
    )
    await user.type(
      screen.getByLabelText('English prompt'),
      'Where can I find the metro?',
    )
    await user.type(
      screen.getByLabelText('Spanish answer'),
      '¿Por dónde queda el metro?',
    )
    await user.click(screen.getByText('Add context', { selector: 'summary' }))
    await user.type(
      screen.getByLabelText(/note, nuance/i),
      'Useful when getting around CDMX.',
    )
    await user.click(
      screen.getByRole('button', { name: /save & practice both/i }),
    )

    expect(
      screen.getByRole('heading', { name: '¿Dónde está el metro?' }),
    ).toBeInTheDocument()

    const response = screen.getByLabelText('Your answer')
    await user.type(response, 'Where is metro')
    await user.keyboard('{Enter}')

    expect(screen.getByText('You wrote')).toBeInTheDocument()
    expect(document.querySelector('.diff-seg-missing')).toHaveTextContent('the')
    expect(screen.getByText('Meaning & context')).toBeInTheDocument()

    await user.keyboard('3')
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
    await user.keyboard('3') // Good -> graduates

    expect(screen.getByRole('heading', { name: '¡Hecho!' })).toBeInTheDocument()
    expect(screen.getByText(/3 cards practiced/i)).toBeInTheDocument()

    expect(services.mockSounds.played).toEqual([
      'reveal',
      'good',
      'reveal',
      'again',
      'reveal',
      'good',
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
    await user.type(
      screen.getByLabelText(/^Spanish Mexican Spanish$/),
      'Qué padre',
    )
    await user.type(
      screen.getByLabelText(/^English Concise meaning$/),
      'How cool',
    )
    await user.click(screen.getByLabelText(/practice both directions/i))
    await user.click(screen.getByRole('button', { name: /save & practice/i }))

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

    // Advances to Card 2: pass with Good
    await user.keyboard('{Enter}')
    await user.keyboard('3')

    // Advances to Card 3: pass with Good
    await user.keyboard('{Enter}')
    await user.keyboard('3')

    // Advances to Card 4: pass with Good
    await user.keyboard('{Enter}')
    await user.keyboard('3')

    // Session is NOT complete yet — Card 1 was re-queued and appears now!
    expect(
      screen.queryByRole('heading', { name: '¡Hecho!' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tal vez' })).toBeInTheDocument()

    // Finally pass Card 1 with Good
    await user.keyboard('{Enter}')
    await user.keyboard('3')

    expect(screen.getByRole('heading', { name: '¡Hecho!' })).toBeInTheDocument()
    expect(screen.getByText(/5 cards practiced/i)).toBeInTheDocument()
  })

  it('displays soft accent highlights and sub-word typo diffs on reveal', async () => {
    const user = userEvent.setup()
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    await user.type(
      screen.getByLabelText(/^Spanish Mexican Spanish$/),
      '¿Dónde está el restaurante?',
    )
    await user.type(
      screen.getByLabelText(/^English Concise meaning$/),
      'Where is the restaurant?',
    )
    await user.click(screen.getByLabelText(/practice both directions/i))
    await user.click(screen.getByRole('button', { name: /save & practice/i }))

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
    expect(
      screen.getByText('Create beautiful, spoken cards.', { exact: false }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Practice them at your rhythm.', { exact: false }),
    ).toBeInTheDocument()

    // Spanish card is foreground initially
    const spanishCard = screen.getByRole('button', {
      name: /play pronunciation for mexican spanish card: tal vez/i,
    })
    expect(spanishCard).toBeInTheDocument()
    expect(spanishCard).toHaveTextContent('Tal vez')
    await user.click(spanishCard)

    expect(services.mockSpeaker.spoken).toContainEqual({
      text: 'Tal vez',
      locale: 'es-MX',
    })

    // English card in background
    const englishCard = screen.getByRole('button', {
      name: /show english card: maybe/i,
    })
    expect(englishCard).toBeInTheDocument()
    expect(englishCard).toHaveTextContent('Maybe')
    await user.click(englishCard)

    expect(services.mockSpeaker.spoken).toContainEqual({
      text: 'Maybe',
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
      screen.getByRole('heading', { name: 'What do you want to remember?' }),
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
      screen.getByRole('heading', { name: 'What do you want to remember?' }),
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
    expect(screen.getByRole('heading', { name: 'Tal vez' })).toBeInTheDocument()
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
    expect(screen.getByRole('heading', { name: 'Tal vez' })).toBeInTheDocument()
    expect(screen.getByLabelText('Session progress')).toHaveTextContent('1 / 4')
  })

  it('supports rapid card creation with "Save & add another" and diacritics insertion', async () => {
    const user = userEvent.setup()
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: 'Create a card' }))

    // Test diacritics bar insertion
    await user.click(screen.getByRole('button', { name: 'Insert ¿' }))
    const spanishInput = screen.getByLabelText(/^Spanish Mexican Spanish$/)
    expect(spanishInput).toHaveValue('¿')

    await user.clear(spanishInput)
    await user.type(spanishInput, '¿Qué tal?')
    await user.type(
      screen.getByLabelText(/^English Concise meaning$/),
      'How are you?',
    )

    // Click "Save & add another"
    await user.click(
      screen.getByRole('button', { name: /save & add another/i }),
    )

    // Verifies positive audio feedback and toast confirmation
    expect(services.mockSounds.played).toContain('good')
    expect(screen.getByRole('status')).toHaveTextContent(/2 cards saved/i)

    // Verifies inputs are cleared for the next phrase and stay on create page
    expect(screen.getByLabelText(/^Spanish Mexican Spanish$/)).toHaveValue('')
    expect(screen.getByLabelText(/^English Concise meaning$/)).toHaveValue('')
    expect(
      screen.getByRole('heading', { name: 'What do you want to remember?' }),
    ).toBeInTheDocument()

    // Verifies topbar due count increased from 4 to 6
    expect(
      screen.getByRole('button', { name: /review 6/i }),
    ).toBeInTheDocument()
  })

  it('swaps languages and previews Mexican Spanish pronunciation before saving', async () => {
    const user = userEvent.setup()
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: 'Create a card' }))

    await user.type(
      screen.getByLabelText(/^Spanish Mexican Spanish$/),
      'Good morning',
    )
    await user.type(
      screen.getByLabelText(/^English Concise meaning$/),
      'Buenos días',
    )

    // Click swap button
    await user.click(
      screen.getByRole('button', { name: 'Swap Spanish and English fields' }),
    )
    expect(screen.getByLabelText(/^Spanish Mexican Spanish$/)).toHaveValue(
      'Buenos días',
    )
    expect(screen.getByLabelText(/^English Concise meaning$/)).toHaveValue(
      'Good morning',
    )

    // Listen to pronunciation in field header
    await user.click(
      screen.getByRole('button', { name: 'Listen to Spanish pronunciation' }),
    )
    expect(services.mockSpeaker.spoken).toContainEqual({
      text: 'Buenos días',
      locale: 'es-MX',
    })

    // Save with Cmd+Enter keyboard shortcut
    await user.keyboard('{Meta>}{Enter}{/Meta}')

    expect(services.mockSounds.played).toContain('good')
    expect(services.memoryCards.saved?.[0]?.prompt).toBe('Buenos días')
  })
})
