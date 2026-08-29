import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './jolito'
import { createStudyCards, type StudyCard } from './domain/card'
import { starterCards } from './application/starter-cards'
import { OfflineCardAssistant } from './application/card-assistant'
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
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    writable: true,
  })
  Object.defineProperty(navigator, 'standalone', {
    configurable: true,
    value: false,
    writable: true,
  })
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

    // Pass card 1 (es-en) with Easy -> graduates.
    // The reverse card (en-es) is staggered for day 2, so today's session finishes cleanly.
    await user.keyboard('4')

    // Advance clock by 1 day to practice the reverse card on day 2
    services.fixedClock.currentTime += 24 * 60 * 60 * 1000
    await user.click(screen.getByRole('button', { name: /back home/i }))
    await user.click(screen.getByRole('button', { name: /^practice/i }))

    expect(
      screen.getByRole('heading', { name: 'Where can I find the metro?' }),
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText('Your answer'), 'No recuerdo')
    await user.keyboard('{Enter}')
    await user.keyboard('1') // Again -> requeues card 2 in-session

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
    expect(screen.getByText(/2 cards practiced/i)).toBeInTheDocument()
    expect(document.querySelector('.complete-mascot-frame')).toBeInTheDocument()
    expect(document.querySelector('.complete-mascot-img')).toBeInTheDocument()

    expect(services.mockSounds.played).toEqual([
      'reveal',
      'easy',
      'complete',
      'reveal',
      'again',
      'reveal',
      'easy',
      'complete',
    ])
    expect(services.mockHaptics.triggered).toEqual([
      'selection',
      'easy',
      'complete',
      'selection',
      'again',
      'selection',
      'easy',
      'complete',
    ])
    expect(services.memoryCards.saved).toHaveLength(2)
    expect(services.memoryCards.saved?.[0]?.prompt).toBe(
      '¿Dónde está el metro?',
    )
  })

  it('buries same-note sibling cards when reviewing simultaneously due bidirectional cards', async () => {
    const user = userEvent.setup({ delay: null })
    const now = 1771632000000
    // Setup 2 bidirectional notes where all cards are due at now (e.g. imported or overdue)
    const cards = [
      ...createStudyCards(
        { spanish: 'gato', english: 'cat', context: '', bidirectional: true },
        'note-gato',
        now,
      ),
      ...createStudyCards(
        { spanish: 'perro', english: 'dog', context: '', bidirectional: true },
        'note-perro',
        now,
      ),
    ]
    // Force reverse cards to be due at now as well
    cards[1]!.schedule.dueAt = now
    cards[3]!.schedule.dueAt = now

    const services = createTestServices({ cards, clockTime: now })
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /^practice$/i }))

    // First card: gato (es-en)
    expect(screen.getByRole('heading', { name: 'gato' })).toBeInTheDocument()
    await user.keyboard('{Enter}')
    await user.keyboard('4') // Pass with Easy -> buries gato:en-es until tomorrow

    // Next card should be perro (es-en), NOT cat (en-es) or dog (en-es)
    expect(screen.getByRole('heading', { name: 'perro' })).toBeInTheDocument()
    await user.keyboard('{Enter}')
    await user.keyboard('4') // Pass with Easy -> buries perro:en-es until tomorrow

    // Session is complete with 2 cards practiced today (recognition only!)
    expect(screen.getByRole('heading', { name: '¡Hecho!' })).toBeInTheDocument()
    expect(screen.getByText(/2 cards practiced/i)).toBeInTheDocument()

    // On day 2, reverse production cards become due
    services.fixedClock.currentTime += 24 * 60 * 60 * 1000
    await user.click(screen.getByRole('button', { name: /back home/i }))
    await user.click(screen.getByRole('button', { name: /^practice$/i }))

    expect(screen.getByRole('heading', { name: 'cat' })).toBeInTheDocument()
    await user.keyboard('{Enter}')
    await user.keyboard('4')

    expect(screen.getByRole('heading', { name: 'dog' })).toBeInTheDocument()
    await user.keyboard('{Enter}')
    await user.keyboard('4')

    expect(screen.getByRole('heading', { name: '¡Hecho!' })).toBeInTheDocument()
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

    // Card 1 (aguacate): fail with Again -> requeued at end
    await user.keyboard('{Enter}')
    await user.keyboard('1')

    // Advances to Card 2 (qué padre): pass with Easy
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
    expect(screen.getByText(/3 cards practiced/i)).toBeInTheDocument()
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

  it('renders casing differences as case-insensitive matches with no case indicators', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices({
      cards: [],
      user: { id: 'usr-1', email: 'learner@example.com' },
    })
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    await user.type(screen.getByLabelText(/spanish/i), 'Hola')
    await user.type(screen.getByLabelText(/english/i), 'Hello')
    await user.click(screen.getByRole('button', { name: /save card/i }))
    await user.click(screen.getByRole('button', { name: /^practice$/i }))

    // Type with lowercase 'hello' when expected is 'Hello'
    await user.type(screen.getByLabelText('Your answer'), 'hello')
    await user.keyboard('{Enter}')

    expect(screen.getByText('You wrote')).toBeInTheDocument()
    expect(screen.getByText('Expected')).toBeInTheDocument()
    expect(document.querySelector('.diff-seg-case')).toBeNull()
    const matchSegments = Array.from(
      document.querySelectorAll('.diff-seg-match'),
    ).map((el) => el.textContent)
    expect(matchSegments).toEqual(['hello', 'Hello'])
  })

  it('renders refined landing page copy and plays audio when clicking the sample cards', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    expect(
      screen.getByRole('heading', { name: /make the words you meet stick/i }),
    ).toBeInTheDocument()
    expect(document.querySelector('.brand')).toBeInTheDocument()
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
          createdAt: 0,
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

    const actions = document.querySelector('.complete-actions') as HTMLElement
    expect(actions).toBeInTheDocument()
    const createBtn = within(actions).getByRole('button', {
      name: /create a card/i,
    })
    const homeBtn = within(actions).getByRole('button', {
      name: /back home/i,
    })
    expect(createBtn).toHaveClass('primary-button')
    expect(homeBtn).toHaveClass('secondary-button')
    expect(
      within(actions).queryByRole('button', { name: /manage deck/i }),
    ).not.toBeInTheDocument()
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
    expect(
      screen.getByRole('progressbar', { name: 'Session progress' }),
    ).toHaveAttribute('aria-valuetext', '4 cards remaining')

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
    expect(
      screen.getByRole('progressbar', { name: 'Session progress' }),
    ).toHaveAttribute('aria-valuetext', '4 cards remaining')
  })

  it('suggests Mexican Spanish expressions and auto-fills translation without populating context on selection', async () => {
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

    // Verifies auto-fill of Spanish and English while keeping Context blank for user input
    expect(spanishInput).toHaveValue('ahorita')
    expect(screen.getByLabelText(/english/i)).toHaveValue(
      'right now / in a bit',
    )
    expect(screen.getByLabelText(/context/i)).toHaveValue('')
    expect(
      screen.queryByRole('listbox', { name: /spanish suggestions/i }),
    ).not.toBeInTheDocument()
  })

  it('resolves conjugated verb inputs to base lemma suggestions with origin badge', async () => {
    const user = userEvent.setup({ delay: null })
    const assistant = new OfflineCardAssistant(
      [
        {
          spanish: 'tener',
          english: 'to have / to possess',
          context: 'Common verb.',
          tag: 'basics',
        },
      ],
      {
        tuvimos: 'tener',
      },
    )
    const services = createTestServices({ assistant })
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    const spanishInput = screen.getByLabelText(/spanish/i)
    await user.type(spanishInput, 'tuvimos')

    expect(
      screen.getByRole('listbox', { name: /spanish suggestions/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('tener')).toBeInTheDocument()
    expect(screen.getByText(/from/i)).toHaveTextContent('from tuvimos')

    // Click suggestion item
    await user.click(screen.getByText('tener'))

    expect(spanishInput).toHaveValue('tener')
    expect(screen.getByLabelText(/english/i)).toHaveValue(
      'to have / to possess',
    )
    expect(
      screen.queryByRole('listbox', { name: /spanish suggestions/i }),
    ).not.toBeInTheDocument()
  })

  it('renders fuzzy typo matches in autocomplete dropdown with badge and keyboard selection', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    const spanishInput = screen.getByLabelText(/spanish/i)
    await user.type(spanishInput, 'aguacatte')

    const listbox = screen.getByRole('listbox', {
      name: /spanish suggestions/i,
    })
    expect(listbox).toBeInTheDocument()
    expect(within(listbox).getByText('aguacate')).toBeInTheDocument()
    expect(within(listbox).getByText('typo match')).toBeInTheDocument()

    // Navigate with keyboard and select
    await user.keyboard('{ArrowDown}{Enter}')

    expect(spanishInput).toHaveValue('aguacate')
    expect(screen.getByLabelText(/english/i)).toHaveValue('avocado')
    expect(
      screen.queryByRole('listbox', { name: /spanish suggestions/i }),
    ).not.toBeInTheDocument()
  })

  it('preserves existing user-typed additional context when applying an autocomplete suggestion', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    const spanishInput = screen.getByLabelText(/spanish/i)
    const contextInput = screen.getByLabelText(/additional context/i)

    await user.type(contextInput, 'Heard at the market in Coyoacán')
    await user.type(spanishInput, 'ahor')

    await user.click(screen.getByText('ahorita'))

    expect(spanishInput).toHaveValue('ahorita')
    expect(screen.getByLabelText(/english/i)).toHaveValue(
      'right now / in a bit',
    )
    expect(contextInput).toHaveValue('Heard at the market in Coyoacán')
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

  it('closes suggestion overlay when clicking the dismiss button without modifying input', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    const spanishInput = screen.getByLabelText(/spanish/i)
    await user.type(spanishInput, 'ahor')

    expect(
      screen.getByRole('listbox', { name: /spanish suggestions/i }),
    ).toBeInTheDocument()

    // Click the explicit Dismiss button
    await user.click(
      screen.getByRole('button', { name: /dismiss suggestions/i }),
    )

    expect(
      screen.queryByRole('listbox', { name: /spanish suggestions/i }),
    ).not.toBeInTheDocument()
    expect(spanishInput).toHaveValue('ahor')
  })

  it('closes suggestion overlay when tapping outside the input and suggestions container', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    const spanishInput = screen.getByLabelText(/spanish/i)
    await user.type(spanishInput, 'ahor')

    expect(
      screen.getByRole('listbox', { name: /spanish suggestions/i }),
    ).toBeInTheDocument()

    // Tap outside (e.g. on the heading)
    await user.click(screen.getByRole('heading', { name: /new flashcard/i }))

    expect(
      screen.queryByRole('listbox', { name: /spanish suggestions/i }),
    ).not.toBeInTheDocument()
    expect(spanishInput).toHaveValue('ahor')
  })

  it('closes suggestion overlay when focusing or tabbing directly into the English field', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    const spanishInput = screen.getByLabelText(/spanish/i)
    const englishInput = screen.getByLabelText(/^english$/i)
    await user.type(spanishInput, 'ahor')

    expect(
      screen.getByRole('listbox', { name: /spanish suggestions/i }),
    ).toBeInTheDocument()

    // Tab directly into English field without selecting a suggestion
    await user.tab()
    expect(englishInput).toHaveFocus()
    await waitFor(() => {
      expect(
        screen.queryByRole('listbox', { name: /spanish suggestions/i }),
      ).not.toBeInTheDocument()
    })
  })

  it('defers suggestion overlay dismissal on blur to allow uninterrupted focus transitions', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    const spanishInput = screen.getByLabelText(/spanish/i)
    await user.type(spanishInput, 'ahor')

    expect(
      screen.getByRole('listbox', { name: /spanish suggestions/i }),
    ).toBeInTheDocument()

    // Simulate blur event on the Spanish input
    fireEvent.blur(spanishInput)

    // Overlay is still in DOM synchronously during blur event to prevent aborting focus transitions
    expect(
      screen.getByRole('listbox', { name: /spanish suggestions/i }),
    ).toBeInTheDocument()

    // Wait for the deferred blur cleanup timer
    await waitFor(() => {
      expect(
        screen.queryByRole('listbox', { name: /spanish suggestions/i }),
      ).not.toBeInTheDocument()
    })
    expect(spanishInput).toHaveValue('ahor')
  })

  it('allows smooth sequential field focus transitions without synchronous suggestion unmounting', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    const spanishInput = screen.getByLabelText(/spanish/i)
    const englishInput = screen.getByLabelText(/^english$/i)
    const contextInput = screen.getByLabelText(/additional context/i)

    await user.type(spanishInput, 'ahor')
    expect(
      screen.getByRole('listbox', { name: /spanish suggestions/i }),
    ).toBeInTheDocument()

    // Focus English directly (as done by iOS accessory Next arrow)
    englishInput.focus()
    expect(englishInput).toHaveFocus()

    // Overlay is not synchronously torn down during the focus event
    expect(
      screen.getByRole('listbox', { name: /spanish suggestions/i }),
    ).toBeInTheDocument()

    // Focus Context directly
    contextInput.focus()
    expect(contextInput).toHaveFocus()

    // After blur timer completes, suggestions dismiss cleanly
    await waitFor(() => {
      expect(
        screen.queryByRole('listbox', { name: /spanish suggestions/i }),
      ).not.toBeInTheDocument()
    })
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
    expect(contextInput).toHaveValue('')

    // 2. Tab into English field -> all text is selected and overwritten on typing
    await user.tab()
    expect(englishInput).toHaveFocus()
    expect(englishInput.selectionStart).toBe(0)
    expect(englishInput.selectionEnd).toBe('right now / in a bit'.length)

    await user.keyboard('soon')
    expect(englishInput).toHaveValue('soon')

    // 3. Tab directly into Context field -> focus is gained on empty field
    await user.tab()
    expect(contextInput).toHaveFocus()
    expect(contextInput).toHaveValue('')

    await user.keyboard('Mexican concept of time')
    expect(contextInput).toHaveValue('Mexican concept of time')
  })

  it('preserves full keyboard tab navigation including duplicate edit button when duplicate exists', async () => {
    const user = userEvent.setup({ delay: null })
    const cards = createStudyCards(
      {
        spanish: 'aguacate',
        english: 'avocado',
        context: '',
        bidirectional: false,
      },
      'note-1',
      1000,
    )
    const services = createTestServices({ cards })
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    const spanishInput = screen.getByLabelText<HTMLTextAreaElement>(/spanish/i)
    const englishInput =
      screen.getByLabelText<HTMLTextAreaElement>(/^english$/i)
    const contextInput =
      screen.getByLabelText<HTMLTextAreaElement>(/additional context/i)

    await user.type(spanishInput, 'aguacate')
    await user.type(englishInput, 'avocado')

    const editExistingButton = screen.getByRole('button', {
      name: /edit existing card/i,
    })
    expect(editExistingButton).toBeInTheDocument()

    // Spanish -> English -> Edit existing button -> Context
    spanishInput.focus()
    expect(spanishInput).toHaveFocus()

    await user.tab()
    expect(englishInput).toHaveFocus()

    await user.tab()
    expect(editExistingButton).toHaveFocus()

    await user.tab()
    expect(contextInput).toHaveFocus()
  })

  it('disables autocapitalization on card creation and edit text fields for mobile keyboards', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    // 1. Check card creation fields
    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    const spanishInput = screen.getByLabelText(/spanish/i)
    const englishInput = screen.getByLabelText(/^english$/i)
    const contextInput = screen.getByLabelText(/additional context/i)

    expect(spanishInput).toHaveAttribute('autocapitalize', 'none')
    expect(englishInput).toHaveAttribute('autocapitalize', 'none')
    expect(contextInput).toHaveAttribute('autocapitalize', 'none')

    // Check reverse card fields when customized
    await user.click(
      screen.getByText('Customize reverse card', { selector: 'summary' }),
    )
    const reversePrompt = screen.getByLabelText(/reverse prompt/i)
    const reverseAnswer = screen.getByLabelText(/reverse answer/i)
    expect(reversePrompt).toHaveAttribute('autocapitalize', 'none')
    expect(reverseAnswer).toHaveAttribute('autocapitalize', 'none')

    // 2. Check study review answer field
    await user.click(screen.getByRole('button', { name: /^practice$/i }))
    const studyAnswerInput = screen.getByLabelText('Your answer')
    expect(studyAnswerInput).toHaveAttribute('autocapitalize', 'none')

    // 3. Check edit card modal fields
    await user.click(screen.getByRole('button', { name: /manage deck/i }))
    const deckSearchInput = screen.getByLabelText(/search cards in deck/i)
    expect(deckSearchInput).toHaveAttribute('autocapitalize', 'none')

    await user.click(screen.getByRole('row', { name: /card: aguacate/i }))
    const editPrompt = screen.getByLabelText(/mexican spanish \(prompt\)/i)
    const editAnswer = screen.getByLabelText(/english \(answer\)/i)
    const editContext = screen.getByLabelText(/additional context/i)

    expect(editPrompt).toHaveAttribute('autocapitalize', 'none')
    expect(editAnswer).toHaveAttribute('autocapitalize', 'none')
    expect(editContext).toHaveAttribute('autocapitalize', 'none')
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

    await user.click(screen.getByRole('button', { name: /^practice/i }))

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
    expect(exportBtn).toHaveClass('is-exported')
    expect(screen.getByText('Exported backup')).toBeInTheDocument()
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

    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(
      screen.getByRole('heading', {
        name: /^cloud sync$/i,
      }),
    ).toBeInTheDocument()

    // Enter email
    const emailInput = screen.getByLabelText(/email address/i)
    await user.type(emailInput, 'learner@example.com')
    await user.click(screen.getByRole('button', { name: /send sign-in link/i }))

    expect(
      await screen.findByText(/Click the sign-in link sent to/i),
    ).toBeInTheDocument()

    // On standard desktop browser, no paste input is shown by default
    expect(screen.queryByLabelText(/sign-in link/i)).not.toBeInTheDocument()

    // User can manually toggle paste link input if desired
    await user.click(
      screen.getByRole('button', { name: /paste link manually/i }),
    )

    // Enter link / token
    const tokenInput = screen.getByLabelText(/sign-in link/i)
    await user.type(tokenInput, '123456')
    await user.click(screen.getByRole('button', { name: /sign in & sync/i }))

    expect(
      await screen.findByText(/deck synchronized with cloud/i),
    ).toBeInTheDocument()
    expect(screen.getByText('Signed in')).toBeInTheDocument()
    expect(screen.getByText('learner@example.com')).toBeInTheDocument()
  })

  it('displays iOS Home Screen guidance and allows resending link in sync modal in iOS standalone PWA', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()

    // Stub iOS standalone PWA
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      configurable: true,
      writable: true,
    })
    Object.defineProperty(navigator, 'standalone', {
      value: true,
      configurable: true,
      writable: true,
    })

    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /sign in/i }))
    const emailInput = screen.getByLabelText(/email address/i)
    await user.type(emailInput, 'pwa-learner@example.com')
    await user.click(screen.getByRole('button', { name: /send sign-in link/i }))

    // In iOS standalone mode, paste input and hint are directly visible
    expect(
      await screen.findByText(/Open the email in Safari, tap/i),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/sign-in link/i)).toBeInTheDocument()

    const resendBtn = screen.getByRole('button', { name: /resend link/i })
    expect(resendBtn).toBeInTheDocument()
    await user.click(resendBtn)
    expect(resendBtn).toHaveClass('is-sent')
    expect(screen.getByText(/Link sent!/i)).toBeInTheDocument()
  })

  it('displays and dismisses redirect auth notification banner when signed in via email redirect on iOS', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices({
      user: { id: 'usr-redirect', email: 'safari-user@example.com' },
    })
    services.mockAuth.redirectAuthOccurred = true

    // Stub iOS userAgent & clipboard
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      configurable: true,
      writable: true,
    })
    Object.defineProperty(navigator, 'standalone', {
      value: false,
      configurable: true,
      writable: true,
    })
    const writeTextSpy = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      configurable: true,
      writable: true,
    })

    render(<App services={services} />)

    const banner = await screen.findByText(
      /Signed in! Using the Home Screen app\?/i,
    )
    expect(banner).toBeInTheDocument()

    const copyBtn = screen.getByRole('button', {
      name: /copy sign-in link/i,
    })
    expect(copyBtn).toBeInTheDocument()
    await user.click(copyBtn)
    expect(writeTextSpy).toHaveBeenCalledWith(
      expect.stringContaining('access_token='),
    )
    expect(await screen.findByText(/copied ✓/i)).toBeInTheDocument()

    const dismissBtn = screen.getByRole('button', { name: /dismiss message/i })
    await user.click(dismissBtn)
    expect(
      screen.queryByText(/Signed in! Using the Home Screen app\?/i),
    ).not.toBeInTheDocument()
  })

  it('allows signing in by pasting email magic link URL into sync modal', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /sign in/i }))
    const emailInput = screen.getByLabelText(/email address/i)
    await user.type(emailInput, 'pasted-learner@example.com')
    await user.click(screen.getByRole('button', { name: /send sign-in link/i }))

    await user.click(
      screen.getByRole('button', { name: /paste link manually/i }),
    )

    const tokenInput = screen.getByLabelText(/sign-in link/i)
    await user.type(
      tokenInput,
      'https://example.supabase.co/auth/v1/verify?token=pkce_secret123&type=magiclink',
    )
    await user.click(screen.getByRole('button', { name: /sign in & sync/i }))

    expect(
      await screen.findByText(/deck synchronized with cloud/i),
    ).toBeInTheDocument()
    expect(screen.getByText('Signed in')).toBeInTheDocument()
  })

  it('allows pasting full Supabase email verify URL with token parameter into sync modal', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()

    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /sign in/i }))
    const emailInput = screen.getByLabelText(/email address/i)
    await user.type(emailInput, 'pasted-magiclink@example.com')
    await user.click(screen.getByRole('button', { name: /send sign-in link/i }))

    await user.click(
      screen.getByRole('button', { name: /paste link manually/i }),
    )

    const tokenInput = screen.getByLabelText(/sign-in link/i)
    await user.type(
      tokenInput,
      'https://xwqjelkfdcfzyxxblvhp.supabase.co/auth/v1/verify?token=45ae542bee094273c7281342ece45eed55c2289034b7f15ed7a25e6b&type=magiclink&redirect_to=https://joli.to/',
    )
    await user.click(screen.getByRole('button', { name: /sign in & sync/i }))

    expect(
      await screen.findByText(/deck synchronized with cloud/i),
    ).toBeInTheDocument()
    expect(screen.getByText('Signed in')).toBeInTheDocument()
  })

  it('allows filling verification token via paste from clipboard button in sync modal', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()

    // Stub clipboard readText
    const readTextSpy = vi
      .fn()
      .mockResolvedValue(
        'https://example.supabase.co/auth/v1/verify?token=pkce_clipboard123&type=magiclink',
      )
    Object.defineProperty(navigator, 'clipboard', {
      value: { readText: readTextSpy },
      configurable: true,
      writable: true,
    })

    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /sign in/i }))
    const emailInput = screen.getByLabelText(/email address/i)
    await user.type(emailInput, 'clipboard-learner@example.com')
    await user.click(screen.getByRole('button', { name: /send sign-in link/i }))

    await user.click(
      screen.getByRole('button', { name: /paste link manually/i }),
    )

    const pasteBtn = screen.getByRole('button', {
      name: /paste from clipboard/i,
    })
    expect(pasteBtn).toBeInTheDocument()
    await user.click(pasteBtn)

    expect(pasteBtn).toHaveClass('is-pasted')
    expect(screen.getByText('Pasted')).toBeInTheDocument()
    expect(readTextSpy).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: /sign in & sync/i }))

    expect(
      await screen.findByText(/deck synchronized with cloud/i),
    ).toBeInTheDocument()
    expect(screen.getByText('Signed in')).toBeInTheDocument()
  })

  it('allows signed in user to manually trigger sync now', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices({
      user: { id: 'usr-1', email: 'sync-user@example.com' },
    })
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /synced/i }))
    expect(screen.getByText('sync-user@example.com')).toBeInTheDocument()

    const syncNowBtn = screen.getByRole('button', { name: /sync now/i })
    await user.click(syncNowBtn)

    expect(
      await screen.findByText(/deck successfully synchronized with cloud/i),
    ).toBeInTheDocument()
    expect(syncNowBtn).toHaveClass('is-synced')
    expect(screen.getByText('Synced!')).toBeInTheDocument()
    expect(services.mockSync.syncedCount).toBeGreaterThan(0)
  })

  it('does not resurrect deleted cards when deleting and then syncing with cloud', async () => {
    const user = userEvent.setup({ delay: null })
    const cards = [
      ...createStudyCards(
        {
          spanish: 'zapato',
          english: 'shoe',
          context: 'clothing',
          bidirectional: false,
        },
        'note-1',
        1000,
      ),
      ...createStudyCards(
        {
          spanish: 'sombrero',
          english: 'hat',
          context: 'clothing',
          bidirectional: false,
        },
        'note-2',
        1000,
      ),
    ]

    const services = createTestServices({
      cards,
      remoteCards: cards,
      remoteDeletedCardIds: [],
      user: { id: 'usr-1', email: 'learner@example.com' },
    })

    render(<App services={services} />)

    // Navigate to deck manager
    await user.click(screen.getByRole('button', { name: /manage deck/i }))
    expect(screen.getAllByRole('row', { name: /card:/i })).toHaveLength(2)

    // Select and delete "zapato" card
    const checkbox = screen.getByRole('checkbox', {
      name: /select card zapato/i,
    })
    await user.click(checkbox)

    const batchDeleteBtn = screen.getByRole('button', {
      name: /delete selected \(1\)/i,
    })
    await user.click(batchDeleteBtn)
    await user.click(screen.getByRole('button', { name: /^delete card$/i }))

    // Card 1 is deleted locally
    expect(screen.getAllByRole('row', { name: /card:/i })).toHaveLength(1)
    expect(
      screen.queryByRole('row', { name: /card: zapato/i }),
    ).not.toBeInTheDocument()

    // Trigger sync now via SyncModal
    await user.click(screen.getByRole('button', { name: /synced/i }))
    const syncNowBtn = screen.getByRole('button', { name: /sync now/i })
    await user.click(syncNowBtn)

    expect(
      await screen.findByText(/deck successfully synchronized with cloud/i),
    ).toBeInTheDocument()

    // Close sync modal with Escape
    fireEvent.keyDown(window, { key: 'Escape' })

    // Verify deleted card has NOT reappeared in deck manager!
    expect(screen.getAllByRole('row', { name: /card:/i })).toHaveLength(1)
    expect(
      screen.queryByRole('row', { name: /card: zapato/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('row', { name: /card: sombrero/i }),
    ).toBeInTheDocument()

    // Verify remote and local repository states
    expect(services.mockSync.remoteCards).toHaveLength(1)
    expect(services.mockSync.remoteCards[0]?.id).toBe('note-2:es-en')
    expect(services.mockSync.remoteDeletedCardIds).toContain('note-1:es-en')
    expect(services.memoryCards.load([])).toHaveLength(1)
    expect(services.memoryCards.getDeletedCardIds()).toContain('note-1:es-en')
  })

  it('removes cards deleted on another device when syncing', async () => {
    const user = userEvent.setup({ delay: null })
    const cards = [
      ...createStudyCards(
        {
          spanish: 'zapato',
          english: 'shoe',
          context: 'clothing',
          bidirectional: false,
        },
        'note-1',
        1000,
      ),
      ...createStudyCards(
        {
          spanish: 'sombrero',
          english: 'hat',
          context: 'clothing',
          bidirectional: false,
        },
        'note-2',
        1000,
      ),
    ]

    const card2 = cards[1]!
    const services = createTestServices({
      cards,
      remoteCards: [card2],
      remoteDeletedCardIds: ['note-1:es-en'],
      user: { id: 'usr-1', email: 'learner@example.com' },
    })

    render(<App services={services} />)

    // Open sync modal and trigger sync
    await user.click(screen.getByRole('button', { name: /synced/i }))
    const syncNowBtn = screen.getByRole('button', { name: /sync now/i })
    await user.click(syncNowBtn)

    expect(
      await screen.findByText(/deck successfully synchronized with cloud/i),
    ).toBeInTheDocument()

    // Close sync modal
    fireEvent.keyDown(window, { key: 'Escape' })

    // Navigate to deck manager
    await user.click(screen.getByRole('button', { name: /manage deck/i }))

    // Card 1 was deleted on remote, so it must not be in local deck
    expect(screen.getAllByRole('row', { name: /card:/i })).toHaveLength(1)
    expect(
      screen.queryByRole('row', { name: /card: zapato/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('row', { name: /card: sombrero/i }),
    ).toBeInTheDocument()
  })

  it('allows signed in user to sign out, clears local deck, and returns to demo state', async () => {
    const user = userEvent.setup({ delay: null })
    const userCards = createStudyCards(
      {
        spanish: 'zapato',
        english: 'shoe',
        context: 'clothing',
        bidirectional: false,
      },
      'note-user-1',
      1000,
    )
    const services = createTestServices({
      cards: userCards,
      user: { id: 'usr-1', email: 'sync-user@example.com' },
    })
    render(<App services={services} />)

    // Verify user is signed in with custom deck in storage
    expect(services.memoryCards.load([])).toHaveLength(1)
    expect(services.memoryCards.load([])[0]?.prompt).toBe('zapato')

    // Open sync modal and click sign out
    await user.click(screen.getByRole('button', { name: /synced/i }))
    expect(screen.getByText('sync-user@example.com')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /sign out/i }))

    expect(await screen.findByLabelText(/email address/i)).toBeInTheDocument()

    // Local storage has been reset to starter cards and cleared of user cards & tombstones
    const storedCards = services.memoryCards.load([])
    expect(storedCards.every((c) => c.noteId.startsWith('starter-'))).toBe(true)
    expect(storedCards.some((c) => c.prompt === 'zapato')).toBe(false)
    expect(services.memoryCards.getDeletedCardIds()).toEqual([])

    // Close sync modal and verify UI shows starter demo state with Sign in button
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('animates resend link button with checkmark feedback without status banner', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /sign in/i }))
    const emailInput = screen.getByLabelText(/email address/i)
    await user.type(emailInput, 'learner@example.com')
    await user.click(screen.getByRole('button', { name: /send sign-in link/i }))

    expect(
      await screen.findByText(/Click the sign-in link sent to/i),
    ).toBeInTheDocument()

    const resendBtn = screen.getByRole('button', { name: /resend link/i })
    await user.click(resendBtn)

    expect(resendBtn).toHaveClass('is-sent')
    expect(screen.getByText('Link sent!')).toBeInTheDocument()
    expect(
      screen.getByText(/sign-in link sent to learner@example\.com/i),
    ).toBeInTheDocument()
    expect(document.querySelector('.status-banner')).toBeNull()
  })

  it('animates paste button when pasting OTP link from clipboard', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        readText: vi
          .fn()
          .mockResolvedValue('https://joli.to/#access_token=token123'),
      },
      configurable: true,
      writable: true,
    })
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /sign in/i }))
    const emailInput = screen.getByLabelText(/email address/i)
    await user.type(emailInput, 'learner@example.com')
    await user.click(screen.getByRole('button', { name: /send sign-in link/i }))

    await user.click(
      screen.getByRole('button', { name: /paste link manually/i }),
    )

    const pasteBtn = screen.getByRole('button', {
      name: /paste from clipboard/i,
    })
    await user.click(pasteBtn)

    expect(pasteBtn).toHaveClass('is-pasted')
    expect(screen.getByText('Pasted')).toBeInTheDocument()
    expect(screen.getByLabelText(/sign-in link/i)).toHaveValue(
      'https://joli.to/#access_token=token123',
    )
  })

  it('closes sync modal via close button and Escape key', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /sign in/i }))
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
    await user.click(screen.getByRole('button', { name: /sign in/i }))
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
      screen.getByRole('button', { name: /not signed in/i }),
    ).toBeInTheDocument()

    // Trigger offline event
    window.dispatchEvent(new Event('offline'))
    expect(
      await screen.findByRole('button', {
        name: /offline\. card changes are saved to this device/i,
      }),
    ).toBeInTheDocument()

    // Trigger online event
    window.dispatchEvent(new Event('online'))
    expect(
      await screen.findByRole('button', { name: /not signed in/i }),
    ).toBeInTheDocument()
  })

  it('displays friendly notice when cloud sync is not enabled for preview', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices()
    services.mockAuth.configured = false
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /sign in/i }))
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

    // Initial state: 4 cards in queue, 0% progress
    const progress = screen.getByRole('progressbar', {
      name: 'Session progress',
    })
    expect(progress).toHaveAttribute('aria-valuenow', '0')
    expect(progress).toHaveAttribute('aria-valuetext', '4 cards remaining')
    const bar = progress.querySelector('.review-progress-bar') as HTMLElement
    expect(bar).toHaveStyle({ width: '0%' })

    // Card 1: fail with Again (1) -> moves to learn queue (requeued at end), sibling is buried (-1 total)
    await user.keyboard('{Enter}')
    await user.keyboard('1')
    expect(progress).toHaveAttribute('aria-valuenow', '0')
    expect(progress).toHaveAttribute('aria-valuetext', '3 cards remaining')
    expect(bar).toHaveStyle({ width: '0%' })

    // Card 2: pass with Easy (4) -> graduates out of session, sibling is buried (1/2 completed = 50%)
    await user.keyboard('{Enter}')
    await user.keyboard('4')
    expect(progress).toHaveAttribute('aria-valuenow', '50')
    expect(progress).toHaveAttribute('aria-valuetext', '1 card remaining')
    expect(bar).toHaveStyle({ width: '50%' })

    // Card 1 retry: pass with Good (3) -> graduates learning card (2/2 completed = 100%)
    await user.keyboard('{Enter}')
    await user.keyboard('3')

    // Session completes
    expect(
      await screen.findByRole('heading', { name: '¡Hecho!' }),
    ).toBeInTheDocument()
  })

  it('renders the Jolito brand vector mark in the header', () => {
    const services = createTestServices()
    render(<App services={services} />)

    const brandElement = screen.getByText('Jolito', { selector: '.brand span' })
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
    expect(screen.getByRole('heading', { name: 'chido' })).toBeInTheDocument()
  })

  it('renders vector brandmark in navigation and prominently displays the mascot on the homescreen', () => {
    const services = createTestServices()
    render(<App services={services} />)

    // 1. Verify Brand component renders the vector JolitoMark
    const brandElement = document.querySelector('.brand')
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
      screen.getByRole('heading', { name: /^cloud sync$/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/sync your deck across all your devices/i),
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

    // 2. Sign-in modal opens with focused cloud sync heading
    expect(
      screen.getByRole('heading', { name: /^cloud sync$/i }),
    ).toBeInTheDocument()

    // 3. Guest enters email and requests link
    const emailInput = screen.getByLabelText(/email address/i)
    await user.type(emailInput, 'learner@example.com')
    await user.click(screen.getByRole('button', { name: /send sign-in link/i }))

    // 4. Guest toggles paste input and enters link / code
    await user.click(
      screen.getByRole('button', { name: /paste link manually/i }),
    )
    const tokenInput = screen.getByLabelText(/sign-in link/i)
    await user.type(tokenInput, '123456')
    await user.click(screen.getByRole('button', { name: /sign in & sync/i }))

    // 5. Verification succeeds -> pending card is automatically saved!
    expect(
      screen.queryByRole('heading', { name: /^cloud sync$/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/saved “chido”/i)
    expect(spanishInput).toHaveValue('')
    expect(englishInput).toHaveValue('')
    expect(services.memoryCards.saved).toHaveLength(2)
  })

  it('displays iOS Home Screen guidance and allows resending link in save card auth modal in iOS standalone PWA', async () => {
    const user = userEvent.setup({ delay: null })
    const services = createTestServices({ cards: [] })

    // Stub iOS standalone PWA
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      configurable: true,
      writable: true,
    })
    Object.defineProperty(navigator, 'standalone', {
      value: true,
      configurable: true,
      writable: true,
    })

    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    const spanishInput = screen.getByLabelText(/mexican spanish/i)
    const englishInput = screen.getByLabelText(/^english$/i)
    await user.type(spanishInput, 'chido')
    await user.type(englishInput, 'cool')
    await user.click(screen.getByRole('button', { name: /save card/i }))

    const emailInput = screen.getByLabelText(/email address/i)
    await user.type(emailInput, 'pwa-creator@example.com')
    await user.click(screen.getByRole('button', { name: /send sign-in link/i }))

    expect(
      await screen.findByText(/Open the email in Safari, tap/i),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/sign-in link/i)).toBeInTheDocument()

    const resendBtn = screen.getByRole('button', { name: /resend link/i })
    expect(resendBtn).toBeInTheDocument()
    await user.click(resendBtn)
    expect(resendBtn).toHaveClass('is-sent')
    expect(screen.getByText(/Link sent!/i)).toBeInTheDocument()
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
      screen.getByRole('heading', { name: /^cloud sync$/i }),
    ).toBeInTheDocument()

    // Guest presses Escape to dismiss modal
    await user.keyboard('{Escape}')

    // Modal is closed, but typed input is preserved in form!
    expect(
      screen.queryByRole('heading', { name: /^cloud sync$/i }),
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
      screen.getByRole('heading', { name: /^cloud sync$/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/cloud sync is disabled in this preview/i),
    ).toBeInTheDocument()

    // User clicks save locally in preview
    await user.click(
      screen.getByRole('button', { name: /save card to this device/i }),
    )

    expect(
      screen.queryByRole('heading', { name: /^cloud sync$/i }),
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
    await user.click(screen.getByRole('button', { name: /send sign-in link/i }))

    await user.click(
      screen.getByRole('button', { name: /paste link manually/i }),
    )

    const tokenInput = screen.getByLabelText(/sign-in link/i)
    await user.type(tokenInput, '123456')
    await user.click(screen.getByRole('button', { name: /sign in & sync/i }))

    // 4. Modal closes and card is saved
    expect(
      screen.queryByRole('heading', { name: /^cloud sync$/i }),
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
    expect(screen.getByRole('button', { name: /all \(4\)/i })).toHaveAttribute(
      'title',
      'All cards in your deck',
    )
    expect(
      screen.getByRole('button', { name: /due now \(4\)/i }),
    ).toHaveAttribute(
      'title',
      'Cards ready to practice right now (unstudied cards + due reviews)',
    )
    expect(
      screen.getByRole('button', { name: /unstudied \(4\)/i }),
    ).toHaveAttribute('title', "Cards you haven't practiced yet")
    expect(
      screen.getByRole('button', { name: /learning \(0\)/i }),
    ).toHaveAttribute(
      'title',
      'Cards you are currently acquiring in short repetition steps',
    )
    expect(
      screen.getByRole('button', { name: /mastered \(0\)/i }),
    ).toHaveAttribute(
      'title',
      'Graduated cards scheduled for long-term memory retention (1+ days)',
    )

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

    // Filter by state pill "Mastered" (0 cards in review/mastered state initially)
    await user.click(screen.getByRole('button', { name: /mastered \(0\)/i }))
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

  it('sorts deck manager cards by creation date and alphabetically via dropdown and column header', async () => {
    const user = userEvent.setup()
    const now = Date.UTC(2026, 7, 21, 12, 0, 0)
    const customCards: StudyCard[] = [
      {
        id: 'note-1:es-en',
        noteId: 'note-1',
        prompt: 'zapato',
        answer: 'shoe',
        direction: 'es-en',
        context: '',
        scene: 'conversation',
        schedule: {
          state: 'new',
          dueAt: now,
          intervalDays: 0,
          easeFactor: 2.5,
          reviews: 0,
          lapses: 0,
        },
        createdAt: 1000,
      },
      {
        id: 'note-2:es-en',
        noteId: 'note-2',
        prompt: 'árbol',
        answer: 'tree',
        direction: 'es-en',
        context: '',
        scene: 'conversation',
        schedule: {
          state: 'new',
          dueAt: now,
          intervalDays: 0,
          easeFactor: 2.5,
          reviews: 0,
          lapses: 0,
        },
        createdAt: 3000,
      },
      {
        id: 'note-3:es-en',
        noteId: 'note-3',
        prompt: 'bueno',
        answer: 'good',
        direction: 'es-en',
        context: '',
        scene: 'conversation',
        schedule: {
          state: 'new',
          dueAt: now,
          intervalDays: 0,
          easeFactor: 2.5,
          reviews: 0,
          lapses: 0,
        },
        createdAt: 2000,
      },
    ]

    const services = createTestServices({ cards: customCards })
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /manage deck/i }))

    const sortSelect = screen.getByRole('combobox', { name: /sort cards/i })
    expect(sortSelect).toHaveValue('created-desc')

    // Initial order (created-desc): árbol (3000), bueno (2000), zapato (1000)
    let rows = screen.getAllByRole('row', { name: /card:/i })
    expect(
      rows.map(
        (r) =>
          r.querySelector('.col-prompt .deck-phrase-text')?.textContent ?? '',
      ),
    ).toEqual(['árbol', 'bueno', 'zapato'])

    // Change to Oldest first (created-asc)
    await user.selectOptions(sortSelect, 'created-asc')
    rows = screen.getAllByRole('row', { name: /card:/i })
    expect(
      rows.map(
        (r) =>
          r.querySelector('.col-prompt .deck-phrase-text')?.textContent ?? '',
      ),
    ).toEqual(['zapato', 'bueno', 'árbol'])

    // Change to Alphabetical (A–Z)
    await user.selectOptions(sortSelect, 'alpha-asc')
    rows = screen.getAllByRole('row', { name: /card:/i })
    expect(
      rows.map(
        (r) =>
          r.querySelector('.col-prompt .deck-phrase-text')?.textContent ?? '',
      ),
    ).toEqual(['árbol', 'bueno', 'zapato'])

    // Click "Prompt" column header button to toggle to Alphabetical (Z–A)
    const promptHeaderBtn = screen.getByRole('button', {
      name: /sort by prompt/i,
    })
    await user.click(promptHeaderBtn)
    expect(sortSelect).toHaveValue('alpha-desc')
    rows = screen.getAllByRole('row', { name: /card:/i })
    expect(
      rows.map(
        (r) =>
          r.querySelector('.col-prompt .deck-phrase-text')?.textContent ?? '',
      ),
    ).toEqual(['zapato', 'bueno', 'árbol'])

    // Click "Prompt" column header button again to reset to Newest first
    await user.click(promptHeaderBtn)
    expect(sortSelect).toHaveValue('created-desc')
    rows = screen.getAllByRole('row', { name: /card:/i })
    expect(
      rows.map(
        (r) =>
          r.querySelector('.col-prompt .deck-phrase-text')?.textContent ?? '',
      ),
    ).toEqual(['árbol', 'bueno', 'zapato'])
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

    // Initially shows Mastered state pill in filter and Due in 14d chip in table
    expect(
      screen.getByRole('button', { name: /mastered \(1\)/i }),
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

    // Filter pills reflect Unstudied (1) and Mastered (0)
    expect(
      screen.getByRole('button', { name: /unstudied \(1\)/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /mastered \(0\)/i }),
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

    // Queue moves directly to next card in queue ('qué padre')
    expect(
      screen.queryByRole('heading', { name: 'palta fresca' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'qué padre' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('progressbar', { name: 'Session progress' }),
    ).toHaveAttribute('aria-valuetext', '3 cards remaining')
  })

  it('opens edit modal via Ctrl+E when input is active and "e" when revealed during study session', async () => {
    const user = userEvent.setup()
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /^practice$/i }))
    expect(
      screen.getByRole('heading', { name: 'aguacate' }),
    ).toBeInTheDocument()

    // 1. Text input is active. Typing 'e' should type into the field, not open modal
    const answerInput = screen.getByLabelText('Your answer')
    expect(answerInput).toHaveFocus()
    await user.keyboard('e')
    expect(answerInput).toHaveValue('e')
    expect(
      screen.queryByRole('heading', { name: /edit flashcard/i }),
    ).not.toBeInTheDocument()

    // Keyboard hint shows Ctrl+E when unrevealed
    expect(screen.getByText(/⌃ E/i)).toBeInTheDocument()

    // 2. Pressing Ctrl+E while input is focused opens edit modal
    await user.keyboard('{Control>}e{/Control}')
    expect(
      screen.getByRole('heading', { name: /edit flashcard/i }),
    ).toBeInTheDocument()

    // Close edit modal
    await user.keyboard('{Escape}')
    expect(
      screen.queryByRole('heading', { name: /edit flashcard/i }),
    ).not.toBeInTheDocument()

    // 3. Reveal answer
    await user.keyboard('{Enter}')
    expect(screen.getByText('You wrote')).toBeVisible()

    // Keyboard hint updates to simple 'e' when revealed
    expect(screen.getByText(/1–4/i)).toBeInTheDocument()

    // 4. Pressing bare 'e' when revealed opens edit modal
    await user.keyboard('e')
    expect(
      screen.getByRole('heading', { name: /edit flashcard/i }),
    ).toBeInTheDocument()
  })

  it('displays guest DemoDeckModal on deck manager and allows exploring or signing in', async () => {
    const user = userEvent.setup()
    const services = createTestServices()
    render(<App services={services} />)

    // 1. Check Create view as guest
    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    expect(
      screen.getByRole('button', { name: /sign in to save/i }),
    ).toBeInTheDocument()

    // 2. Check Deck Manager as guest -> DemoDeckModal is open
    await user.click(screen.getByRole('button', { name: /manage deck/i }))
    expect(
      screen.getByRole('dialog', { name: /^demo deck$/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/You’re exploring 4 example flashcards/i),
    ).toBeInTheDocument()

    // 3. Dismiss demo modal via 'Explore demo deck'
    await user.click(screen.getByRole('button', { name: /explore demo deck/i }))
    expect(
      screen.queryByRole('dialog', { name: /^demo deck$/i }),
    ).not.toBeInTheDocument()

    // 4. Navigating away and returning to Deck Manager re-shows the modal
    await user.click(screen.getByRole('button', { name: /\+ new card/i }))
    await user.click(screen.getByRole('button', { name: /manage deck/i }))
    expect(
      screen.getByRole('dialog', { name: /^demo deck$/i }),
    ).toBeInTheDocument()

    // 5. Click sign in from demo modal to open sync modal
    await user.click(screen.getByRole('button', { name: /sign in to sync/i }))
    expect(
      screen.getByRole('heading', { name: /^cloud sync$/i }),
    ).toBeInTheDocument()
  })

  it('displays demo session complete banner with inline sign-in link and create action', async () => {
    const user = userEvent.setup()
    const services = createTestServices()
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /^practice$/i }))

    // Finish 4 demo cards
    for (let i = 0; i < 4; i++) {
      await user.keyboard('{Enter}')
      await user.keyboard('4')
    }

    // Complete screen for guest
    expect(screen.getByText('DEMO SESSION COMPLETE')).toBeInTheDocument()
    expect(screen.getByText(/2 cards practiced\./i)).toBeInTheDocument()
    expect(
      screen.getByText(/to create and sync your personal deck\./i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^sign in$/i }),
    ).toBeInTheDocument()

    // Clicking inline Sign in link opens sync modal
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))
    expect(
      screen.getByRole('heading', { name: /^cloud sync$/i }),
    ).toBeInTheDocument()
  })

  it('displays clean Practice button and Save card button when authenticated', async () => {
    const user = userEvent.setup()
    const customCard = createStudyCards(
      {
        spanish: 'chido',
        english: 'cool',
        context: 'slang',
        bidirectional: false,
      },
      'note-1',
      1000,
    )
    const services = createTestServices({
      cards: customCard,
      user: { id: 'usr-123', email: 'learner@example.com' },
    })
    render(<App services={services} />)

    // 1. Welcome view displays clean Practice button
    expect(screen.getByRole('button', { name: 'Practice' })).toBeInTheDocument()

    // 2. Create view displays 'Save card' (not 'Sign in to save')
    await user.click(screen.getByRole('button', { name: 'Create a card' }))
    expect(
      screen.getByRole('button', { name: 'Save card' }),
    ).toBeInTheDocument()

    // 3. Deck Manager does not display demo modal for authenticated user
    await user.click(screen.getByRole('button', { name: /manage deck/i }))
    expect(
      screen.queryByRole('dialog', { name: /^demo deck$/i }),
    ).not.toBeInTheDocument()
  })

  it('applies adaptive font scaling classes to study prompt and create preview based on text length', async () => {
    const user = userEvent.setup()
    const services = createTestServices()

    // Seed with a long prompt card
    const longPrompt =
      'El otro día fui al tianguis de la esquina para comprar unos aguacates bien maduros y limones para preparar un guacamole delicioso.'
    const mediumPrompt =
      '¿Dónde puedo encontrar unos buenos tacos al pastor por aquí cerca?'
    const shortPrompt = 'aguacate'

    const longCard: StudyCard = {
      id: 'test-long:es-en',
      noteId: 'note-long',
      prompt: longPrompt,
      answer: 'Long answer translation',
      direction: 'es-en',
      context: '',
      scene: 'conversation',
      schedule: {
        state: 'new',
        dueAt: 0,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      },
      createdAt: 0,
    }
    const mediumCard: StudyCard = {
      id: 'test-med:es-en',
      noteId: 'note-med',
      prompt: mediumPrompt,
      answer: 'Medium answer translation',
      direction: 'es-en',
      context: '',
      scene: 'conversation',
      schedule: {
        state: 'new',
        dueAt: 0,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      },
      createdAt: 0,
    }
    const shortCard: StudyCard = {
      id: 'test-short:es-en',
      noteId: 'note-short',
      prompt: shortPrompt,
      answer: 'avocado',
      direction: 'es-en',
      context: '',
      scene: 'conversation',
      schedule: {
        state: 'new',
        dueAt: 0,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      },
      createdAt: 0,
    }

    services.cards.load = () => [longCard, mediumCard, shortCard]

    render(<App services={services} />)

    // 1. Study view scaling
    await user.click(screen.getByRole('button', { name: /^practice$/i }))
    const studyHeading = screen.getByRole('heading', { name: longPrompt })
    expect(studyHeading).toHaveClass('study-prompt', 'is-long')

    // Reveal and move to medium card
    await user.keyboard('{Enter}')
    await user.keyboard('4')
    const medHeading = screen.getByRole('heading', { name: mediumPrompt })
    expect(medHeading).toHaveClass('study-prompt', 'is-medium')

    // Reveal and move to short card
    await user.keyboard('{Enter}')
    await user.keyboard('4')
    const shortHeading = screen.getByRole('heading', { name: shortPrompt })
    expect(shortHeading).toHaveClass('study-prompt')
    expect(shortHeading).not.toHaveClass('is-long')
    expect(shortHeading).not.toHaveClass('is-medium')

    // 2. Create view preview scaling
    await user.click(screen.getByRole('button', { name: /manage deck/i }))
    await user.click(screen.getByRole('button', { name: /\+ new card/i }))

    const spanishTextarea = screen.getByLabelText(/mexican spanish/i)
    await user.type(spanishTextarea, 'Hola')
    const previewEs = document.querySelector('.sample-card-es .sample-phrase')
    expect(previewEs).not.toHaveClass('is-medium')
    expect(previewEs).not.toHaveClass('is-long')

    await user.clear(spanishTextarea)
    await user.type(spanishTextarea, mediumPrompt)
    expect(previewEs).toHaveClass('is-medium')

    await user.clear(spanishTextarea)
    await user.type(spanishTextarea, longPrompt)
    expect(previewEs).toHaveClass('is-long')
  })

  describe('duplicate recognition e2e', () => {
    it('displays duplicate notice in create view when entering an existing phrase and allows editing existing card', async () => {
      const user = userEvent.setup({ delay: null })
      const existingCard = createStudyCards(
        {
          spanish: 'aguacate',
          english: 'avocado',
          context: 'En el mercado',
          bidirectional: false,
        },
        'note-existing',
        1700000000000,
      )[0]!

      const services = createTestServices({
        cards: [existingCard],
        user: { id: 'usr-1', email: 'learner@example.com' },
      })
      render(<App services={services} />)

      await user.click(screen.getByRole('button', { name: /create a card/i }))

      // Initially no duplicate banner
      expect(
        document.querySelector('.create-duplicate-notice'),
      ).not.toBeInTheDocument()

      // Type a phrase with punctuation / casing that matches normalized existing card
      const spanishInput = screen.getByLabelText(/mexican spanish/i)
      await user.type(spanishInput, '¡Aguacate!')

      // Duplicate notice appears
      const notice = document.querySelector('.create-duplicate-notice')
      expect(notice).toBeInTheDocument()
      expect(notice).toHaveTextContent(/card exists/i)
      expect(notice).toHaveTextContent(/aguacate/i)
      expect(notice).toHaveTextContent(/avocado/i)

      // Click "Edit existing card"
      const editButton = screen.getByRole('button', {
        name: /edit existing card/i,
      })
      await user.click(editButton)

      // Modal opens
      expect(
        screen.getByRole('heading', { name: /edit flashcard/i }),
      ).toBeInTheDocument()
      expect(screen.getByDisplayValue('aguacate')).toBeInTheDocument()
      expect(screen.getByDisplayValue('avocado')).toBeInTheDocument()
    })

    it('shows duplicate warning inside EditCardModal when editing a prompt to clash with another card', async () => {
      const user = userEvent.setup({ delay: null })
      const card1 = createStudyCards(
        {
          spanish: 'aguacate',
          english: 'avocado',
          context: '',
          bidirectional: false,
        },
        'note-1',
        1700000000000,
      )[0]!
      const card2 = createStudyCards(
        {
          spanish: 'chela',
          english: 'cold beer',
          context: '',
          bidirectional: false,
        },
        'note-2',
        1700000000000,
      )[0]!

      const services = createTestServices({
        cards: [card1, card2],
        user: { id: 'usr-1', email: 'learner@example.com' },
      })
      render(<App services={services} />)

      await user.click(screen.getByRole('button', { name: /manage deck/i }))

      // Click row for 'chela' to edit
      const chelaRow = screen.getByLabelText(/card: chela/i)
      await user.click(chelaRow)

      expect(
        screen.getByRole('heading', { name: /edit flashcard/i }),
      ).toBeInTheDocument()
      expect(
        document.querySelector('.edit-duplicate-notice'),
      ).not.toBeInTheDocument()

      // Change prompt to 'aguacate' (clashing with card1)
      const promptInput = screen.getByDisplayValue('chela')
      await user.clear(promptInput)
      await user.type(promptInput, '¡Aguacate!')

      // Duplicate warning appears inside edit modal
      const editNotice = document.querySelector('.edit-duplicate-notice')
      expect(editNotice).toBeInTheDocument()
      expect(editNotice).toHaveTextContent(/duplicate prompt/i)
      expect(editNotice).toHaveTextContent(/aguacate/i)
      expect(editNotice).toHaveTextContent(/avocado/i)
    })

    it('renders Duplicates filter pill in deck view and filters table to duplicate cards with duplicate badges', async () => {
      const user = userEvent.setup({ delay: null })
      const card1 = createStudyCards(
        {
          spanish: 'aguacate',
          english: 'avocado',
          context: '',
          bidirectional: false,
        },
        'note-1',
        1700000000000,
      )[0]!
      const card2 = createStudyCards(
        {
          spanish: 'Aguacate!',
          english: 'avocado (duplicate)',
          context: '',
          bidirectional: false,
        },
        'note-2',
        1700000000000,
      )[0]!
      const card3 = createStudyCards(
        {
          spanish: 'chido',
          english: 'cool',
          context: '',
          bidirectional: false,
        },
        'note-3',
        1700000000000,
      )[0]!

      const services = createTestServices({
        cards: [card1, card2, card3],
        user: { id: 'usr-1', email: 'learner@example.com' },
      })
      render(<App services={services} />)

      await user.click(screen.getByRole('button', { name: /manage deck/i }))

      // Verify Duplicates (2) pill exists
      const duplicatesPill = screen.getByRole('button', {
        name: /duplicates \(2\)/i,
      })
      expect(duplicatesPill).toBeInTheDocument()

      // Click Duplicates pill
      await user.click(duplicatesPill)

      // Only duplicate cards are shown
      expect(screen.getByText('aguacate')).toBeInTheDocument()
      expect(screen.getByText('Aguacate!')).toBeInTheDocument()
      expect(screen.queryByText('chido')).not.toBeInTheDocument()

      // Badges are present
      const duplicateBadges = document.querySelectorAll(
        '.deck-card-duplicate-pill',
      )
      expect(duplicateBadges).toHaveLength(2)
    })
  })

  it('allows guest user to open feedback modal and submit feedback from footer', async () => {
    const user = userEvent.setup()
    const services = createTestServices({ user: null, cards: [] })
    render(<App services={services} />)

    // 1. Welcome page footer has Feedback button for guests
    const feedbackBtn = screen.getByRole('button', { name: /^feedback$/i })
    expect(feedbackBtn).toBeInTheDocument()
    await user.click(feedbackBtn)

    expect(
      screen.getByRole('heading', { name: /share feedback/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/your note helps us improve jolito\./i),
    ).toBeInTheDocument()

    const messageInput = screen.getByPlaceholderText(/what’s on your mind\?/i)
    await user.type(messageInput, 'Love the Mexican audio pronunciations!')
    await user.click(screen.getByRole('button', { name: /send feedback/i }))

    expect(services.mockFeedback.submissions).toHaveLength(1)
    expect(services.mockFeedback.submissions[0]!.user).toBeNull()
    expect(services.mockFeedback.submissions[0]!.submission.message).toBe(
      'Love the Mexican audio pronunciations!',
    )

    // Close modal with Done button
    await user.click(screen.getByRole('button', { name: /done/i }))
    expect(
      screen.queryByRole('heading', { name: /¡muchas gracias!/i }),
    ).not.toBeInTheDocument()
  })

  it('allows authenticated user to type free-form feedback and submit from footer', async () => {
    const user = userEvent.setup()
    const authUser = {
      id: 'student-123',
      email: 'student@example.com',
    }
    const services = createTestServices({ user: authUser })
    render(<App services={services} />)

    // Open feedback modal from footer
    await user.click(screen.getByRole('button', { name: /^feedback$/i }))

    expect(
      screen.getByRole('heading', { name: /share feedback/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/sending as student@example\.com/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /have an idea, spotted a bug or typo, or want to share a mexican spanish nuance\? we’d love to hear from you!/i,
      ),
    ).toBeInTheDocument()

    const messageInput = screen.getByPlaceholderText(/what’s on your mind\?/i)
    await user.type(
      messageInput,
      'In CDMX, people also say "chido" instead of "padre".',
    )

    // Submit feedback
    const submitBtn = screen.getByRole('button', { name: /send feedback/i })
    await user.click(submitBtn)

    // Verified submission payload recorded in test service
    expect(services.mockFeedback.submissions).toHaveLength(1)
    expect(services.mockFeedback.submissions[0]!.user?.email).toBe(
      'student@example.com',
    )
    expect(services.mockFeedback.submissions[0]!.submission.message).toBe(
      'In CDMX, people also say "chido" instead of "padre".',
    )
    expect(services.mockFeedback.submissions[0]!.submission.context?.view).toBe(
      'welcome',
    )

    // Shows success state
    expect(
      screen.getByRole('heading', { name: /¡muchas gracias!/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/your note has been received/i)).toBeInTheDocument()

    // Close modal with Done button
    await user.click(screen.getByRole('button', { name: /done/i }))
    expect(
      screen.queryByRole('heading', { name: /¡muchas gracias!/i }),
    ).not.toBeInTheDocument()
  })

  it('supports opening feedback modal from sync modal', async () => {
    const user = userEvent.setup()
    const authUser = {
      id: 'student-123',
      email: 'student@example.com',
    }
    const services = createTestServices({ user: authUser })
    render(<App services={services} />)

    // Open sync / account modal via connection pill
    await user.click(
      screen.getByRole('button', { name: /deck synced with cloud/i }),
    )
    expect(
      screen.getByRole('heading', { name: /cloud sync/i }),
    ).toBeInTheDocument()

    // Click feedback link inside account modal
    const syncFeedbackBtn = screen.getByRole('button', {
      name: /have feedback or spotted a nuance\? →/i,
    })
    await user.click(syncFeedbackBtn)

    // Sync modal is closed, feedback modal is open
    expect(
      screen.queryByRole('heading', { name: /cloud sync/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /share feedback/i }),
    ).toBeInTheDocument()
  })

  it('supports closing feedback modal with Escape', async () => {
    const user = userEvent.setup()
    const authUser = {
      id: 'student-123',
      email: 'student@example.com',
    }
    const services = createTestServices({ user: authUser })
    render(<App services={services} />)

    // Open feedback modal
    await user.click(screen.getByRole('button', { name: /^feedback$/i }))
    expect(
      screen.getByRole('heading', { name: /share feedback/i }),
    ).toBeInTheDocument()

    // Escape closes modal
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(
      screen.queryByRole('heading', { name: /share feedback/i }),
    ).not.toBeInTheDocument()
  })

  it('displays error banner when feedback submission fails', async () => {
    const user = userEvent.setup()
    const authUser = {
      id: 'student-123',
      email: 'student@example.com',
    }
    const services = createTestServices({ user: authUser })
    services.mockFeedback.shouldSucceed = false
    services.mockFeedback.errorMessage = 'Network connection timed out.'

    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /^feedback$/i }))
    const messageInput = screen.getByPlaceholderText(/what’s on your mind\?/i)
    await user.type(messageInput, 'Some feedback')
    await user.click(screen.getByRole('button', { name: /send feedback/i }))

    expect(
      screen.getByText(/network connection timed out\./i),
    ).toBeInTheDocument()
  })

  it('provides feedback button in footer on the session complete screen', async () => {
    const user = userEvent.setup()
    const authUser = {
      id: 'student-123',
      email: 'student@example.com',
    }
    const services = createTestServices({ user: authUser, cards: [] })
    render(<App services={services} />)

    // With 0 cards due, practice leads straight to complete view
    await user.click(screen.getByRole('button', { name: /^practice$/i }))
    expect(
      screen.getByRole('heading', { name: /you’re caught up\./i }),
    ).toBeInTheDocument()

    const completeFeedbackBtn = screen.getByRole('button', {
      name: /^feedback$/i,
    })
    expect(completeFeedbackBtn).toBeInTheDocument()
    await user.click(completeFeedbackBtn)

    expect(
      screen.getByRole('heading', { name: /share feedback/i }),
    ).toBeInTheDocument()
  })

  it('pauses and resumes an active study session when navigating to deck management and back', async () => {
    const user = userEvent.setup()
    const services = createTestServices()
    const now = 1_700_000_000_000
    services.clock.now = () => now

    const cardA: StudyCard = {
      id: 'note-1:es-en',
      noteId: 'note-1',
      prompt: 'uno',
      answer: 'one',
      direction: 'es-en',
      context: '',
      scene: 'conversation',
      schedule: {
        state: 'new',
        dueAt: now,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      },
      createdAt: now,
    }
    const cardB: StudyCard = {
      id: 'note-2:es-en',
      noteId: 'note-2',
      prompt: 'dos',
      answer: 'two',
      direction: 'es-en',
      context: '',
      scene: 'conversation',
      schedule: {
        state: 'new',
        dueAt: now,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      },
      createdAt: now,
    }
    const cardC: StudyCard = {
      id: 'note-3:es-en',
      noteId: 'note-3',
      prompt: 'tres',
      answer: 'three',
      direction: 'es-en',
      context: '',
      scene: 'conversation',
      schedule: {
        state: 'new',
        dueAt: now,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      },
      createdAt: now,
    }

    services.cards.load = () => [cardA, cardB, cardC]
    render(<App services={services} />)

    // Start practice session
    await user.click(screen.getByRole('button', { name: /^practice$/i }))
    expect(screen.getByRole('heading', { name: 'uno' })).toBeInTheDocument()

    // Answer first card with Easy (4) to graduate it
    await user.keyboard('{Enter}')
    await user.keyboard('4')
    expect(screen.getByRole('heading', { name: 'dos' })).toBeInTheDocument()

    const progressBar = screen.getByRole('progressbar', {
      name: /session progress/i,
    })
    expect(progressBar).toHaveAttribute('aria-valuenow', '33')
    expect(progressBar).toHaveAttribute('aria-valuetext', '2 cards remaining')

    // Navigate to deck
    await user.click(screen.getByRole('button', { name: /manage deck/i }))
    expect(
      screen.getByRole('heading', { name: /manage deck/i }),
    ).toBeInTheDocument()

    // Topbar in deck should have Practice button
    const practiceButton = screen.getByRole('button', { name: /^practice$/i })
    expect(practiceButton).toBeInTheDocument()

    // Resume review session via Practice button
    await user.click(practiceButton)
    expect(screen.getByRole('heading', { name: 'dos' })).toBeInTheDocument()

    // Progress bar still reflects completed card in session
    const resumedProgressBar = screen.getByRole('progressbar', {
      name: /session progress/i,
    })
    expect(resumedProgressBar).toHaveAttribute('aria-valuenow', '33')
    expect(resumedProgressBar).toHaveAttribute(
      'aria-valuetext',
      '2 cards remaining',
    )
  })

  it('preserves re-queued learning step cards when pausing and resuming a study session', async () => {
    const user = userEvent.setup()
    const services = createTestServices()
    const now = 1_700_000_000_000
    services.clock.now = () => now

    const cardA: StudyCard = {
      id: 'note-1:es-en',
      noteId: 'note-1',
      prompt: 'palabra-a',
      answer: 'word-a',
      direction: 'es-en',
      context: '',
      scene: 'conversation',
      schedule: {
        state: 'new',
        dueAt: now,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      },
      createdAt: now,
    }
    const cardB: StudyCard = {
      id: 'note-2:es-en',
      noteId: 'note-2',
      prompt: 'palabra-b',
      answer: 'word-b',
      direction: 'es-en',
      context: '',
      scene: 'conversation',
      schedule: {
        state: 'new',
        dueAt: now,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      },
      createdAt: now,
    }

    services.cards.load = () => [cardA, cardB]
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /^practice$/i }))
    expect(
      screen.getByRole('heading', { name: 'palabra-a' }),
    ).toBeInTheDocument()

    // Rate Again (1) to requeue at the end of the session
    await user.keyboard('{Enter}')
    await user.keyboard('1')
    expect(
      screen.getByRole('heading', { name: 'palabra-b' }),
    ).toBeInTheDocument()

    // Navigate away to deck and resume
    await user.click(screen.getByRole('button', { name: /manage deck/i }))
    await user.click(screen.getByRole('button', { name: /^practice$/i }))

    // Finish card B
    expect(
      screen.getByRole('heading', { name: 'palabra-b' }),
    ).toBeInTheDocument()
    await user.keyboard('{Enter}')
    await user.keyboard('4')

    // Card A reappears from learning requeue
    expect(
      screen.getByRole('heading', { name: 'palabra-a' }),
    ).toBeInTheDocument()
    await user.keyboard('{Enter}')
    await user.keyboard('4')

    // Session completes
    expect(
      screen.getByRole('heading', { name: /¡hecho!/i }),
    ).toBeInTheDocument()
  })

  it('resumes an active study session when clicking Practice on the home screen', async () => {
    const user = userEvent.setup()
    const services = createTestServices()
    const now = 1_700_000_000_000
    services.clock.now = () => now

    const cardA: StudyCard = {
      id: 'note-1:es-en',
      noteId: 'note-1',
      prompt: 'palabra',
      answer: 'word',
      direction: 'es-en',
      context: '',
      scene: 'conversation',
      schedule: {
        state: 'new',
        dueAt: now,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      },
      createdAt: now,
    }

    services.cards.load = () => [cardA]
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /^practice$/i }))
    expect(screen.getByRole('heading', { name: 'palabra' })).toBeInTheDocument()

    // Click brand logo to go home
    await user.click(screen.getByRole('button', { name: /jolito/i }))
    expect(
      screen.getByRole('heading', { name: /make the words/i }),
    ).toBeInTheDocument()

    // Home screen action displays Practice
    const practiceHeroButton = screen.getByRole('button', {
      name: /^practice$/i,
    })
    expect(practiceHeroButton).toBeInTheDocument()

    // Click Practice to return to active card
    await user.click(practiceHeroButton)
    expect(screen.getByRole('heading', { name: 'palabra' })).toBeInTheDocument()
  })

  it('reflects card edits made in deck view when resuming the active study session', async () => {
    const user = userEvent.setup()
    const services = createTestServices()
    const now = 1_700_000_000_000
    services.clock.now = () => now
    services.auth.getUser = () =>
      Promise.resolve({ id: 'u1', email: 'test@example.com' })

    const cardA: StudyCard = {
      id: 'note-1:es-en',
      noteId: 'note-1',
      prompt: 'palabra original',
      answer: 'original word',
      direction: 'es-en',
      context: '',
      scene: 'conversation',
      schedule: {
        state: 'new',
        dueAt: now,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      },
      createdAt: now,
    }

    services.cards.load = () => [cardA]
    render(<App services={services} />)

    await user.click(screen.getByRole('button', { name: /^practice$/i }))
    expect(
      screen.getByRole('heading', { name: 'palabra original' }),
    ).toBeInTheDocument()

    // Navigate to deck
    await user.click(screen.getByRole('button', { name: /manage deck/i }))

    // Edit the card in deck view
    await user.click(
      screen.getByRole('row', { name: /card: palabra original/i }),
    )
    const promptInput = screen.getByLabelText(/mexican spanish \(prompt\)/i)
    await user.clear(promptInput)
    await user.type(promptInput, 'palabra actualizada')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    // Resume review via Practice button
    await user.click(screen.getByRole('button', { name: /^practice$/i }))
    expect(
      screen.getByRole('heading', { name: 'palabra actualizada' }),
    ).toBeInTheDocument()
  })

  it('adjusts sessionTotal and preserves progress percentage accuracy when deleting cards from deck view during an active study session', async () => {
    const user = userEvent.setup()
    const services = createTestServices()
    const now = 1_700_000_000_000
    services.clock.now = () => now
    services.auth.getUser = () =>
      Promise.resolve({ id: 'u1', email: 'test@example.com' })

    const cardA: StudyCard = {
      id: 'note-1:es-en',
      noteId: 'note-1',
      prompt: 'card-1',
      answer: 'one',
      direction: 'es-en',
      context: '',
      scene: 'conversation',
      schedule: {
        state: 'new',
        dueAt: now,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      },
      createdAt: now,
    }
    const cardB: StudyCard = {
      id: 'note-2:es-en',
      noteId: 'note-2',
      prompt: 'card-2',
      answer: 'two',
      direction: 'es-en',
      context: '',
      scene: 'conversation',
      schedule: {
        state: 'new',
        dueAt: now,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      },
      createdAt: now,
    }
    const cardC: StudyCard = {
      id: 'note-3:es-en',
      noteId: 'note-3',
      prompt: 'card-3',
      answer: 'three',
      direction: 'es-en',
      context: '',
      scene: 'conversation',
      schedule: {
        state: 'new',
        dueAt: now,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      },
      createdAt: now,
    }

    services.cards.load = () => [cardA, cardB, cardC]
    render(<App services={services} />)

    // Start practice with 3 cards
    await user.click(screen.getByRole('button', { name: /^practice$/i }))
    expect(screen.getByRole('heading', { name: 'card-1' })).toBeInTheDocument()

    // Answer card 1 with Easy (4) -> 1 completed out of 3 (33%)
    await user.keyboard('{Enter}')
    await user.keyboard('4')
    expect(screen.getByRole('heading', { name: 'card-2' })).toBeInTheDocument()

    const progressBar = screen.getByRole('progressbar', {
      name: /session progress/i,
    })
    expect(progressBar).toHaveAttribute('aria-valuenow', '33')
    expect(progressBar).toHaveAttribute('aria-valuetext', '2 cards remaining')

    // Navigate to deck and delete card-3 (which is in the queue)
    await user.click(screen.getByRole('button', { name: /manage deck/i }))
    const card3Checkbox = screen.getByRole('checkbox', {
      name: /select card card-3/i,
    })
    await user.click(card3Checkbox)
    await user.click(
      screen.getByRole('button', { name: /delete selected \(1\)/i }),
    )
    // Confirm delete in modal
    await user.click(
      within(document.querySelector('.delete-card-modal')!).getByRole(
        'button',
        {
          name: /^delete card$/i,
        },
      ),
    )

    // Resume review via Practice button
    await user.click(screen.getByRole('button', { name: /^practice$/i }))
    expect(screen.getByRole('heading', { name: 'card-2' })).toBeInTheDocument()

    // 1 completed out of 2 total -> 50%
    const resumedProgressBar = screen.getByRole('progressbar', {
      name: /session progress/i,
    })
    expect(resumedProgressBar).toHaveAttribute('aria-valuenow', '50')
    expect(resumedProgressBar).toHaveAttribute(
      'aria-valuetext',
      '1 card remaining',
    )
  })
})
