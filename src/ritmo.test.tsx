import { render, screen } from '@testing-library/react'
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
    expect(
      screen.getByRole('img', { name: /metro train/i }),
    ).toBeInTheDocument()

    const response = screen.getByLabelText('Your answer')
    await user.type(response, 'Where is metro')
    await user.keyboard('{Enter}')

    expect(response).toHaveValue('Where is metro')
    expect(response).toHaveAttribute('readonly')
    expect(screen.getByText('the')).toHaveClass('missing')
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
    await user.click(screen.getByRole('button', { name: /^save & practice$/i }))

    expect(screen.getByRole('status')).toHaveTextContent(
      /audio isn’t available/i,
    )
    await user.type(screen.getByLabelText('Your answer'), 'How cool')
    await user.keyboard('{Enter}')
    expect(screen.getByText('Exact match')).toBeInTheDocument()
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
    expect(
      screen.getByRole('heading', { name: '¿Me lo puede poner para llevar?' }),
    ).toBeInTheDocument()

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
    await user.click(screen.getByRole('button', { name: /^save & practice$/i }))

    // Type with missing inverted question mark, missing accents, and typo in restaurante
    await user.type(
      screen.getByLabelText('Your answer'),
      'Where is the restuarant?',
    )
    await user.keyboard('{Enter}')

    expect(screen.getByText('Close')).toBeInTheDocument()
    expect(document.querySelector('.diff-token.typo')).toBeInTheDocument()
    expect(document.querySelector('.diff-seg-missing')).toHaveTextContent('u')
  })

  it('works with default browser services without explicitly passing props', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /practice 4 due/i }))
    expect(screen.getByLabelText('Your answer')).toBeInTheDocument()
  })
})
