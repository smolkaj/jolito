import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './ritmo'

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
  it('creates asymmetric bidirectional cards and supports a keyboard review flow', async () => {
    const user = userEvent.setup()
    render(<App />)

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
    await user.keyboard('1')
    expect(screen.getByRole('heading', { name: '¡Hecho!' })).toBeInTheDocument()
    expect(screen.getByText(/2 cards practiced/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(localStorage.getItem('ritmo-library-v1')).toContain(
        'Where can I find the metro?',
      )
    })
  })

  it('supports a one-way card and keeps review usable without speech synthesis', async () => {
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: undefined,
    })
    const user = userEvent.setup()
    render(<App />)

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
})
