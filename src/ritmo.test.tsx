import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { createTestServices, MemoryCardRepository } from './test/services'
import { App } from './ritmo'

beforeEach(() => {
  localStorage.clear()
})

describe('Ritmo', () => {
  it('creates a bidirectional card and supports typed self-evaluation', async () => {
    const user = userEvent.setup()
    const cards = new MemoryCardRepository()
    render(<App services={createTestServices(cards)} />)

    await user.click(
      screen.getByRole('button', { name: /create your first card/i }),
    )
    await user.clear(screen.getByLabelText(/^Spanish/))
    await user.type(screen.getByLabelText(/^Spanish/), '¿Dónde está el metro?')
    await user.clear(screen.getByLabelText(/^English/))
    await user.type(screen.getByLabelText(/^English/), 'Where is the metro?')
    await user.click(screen.getByRole('button', { name: /save both cards/i }))

    expect(screen.getByText('¿Dónde está el metro?')).toBeInTheDocument()
    const response = screen.getByPlaceholderText(/type your answer/i)
    await user.type(response, 'Where is metro')
    await user.click(screen.getByRole('button', { name: /reveal answer/i }))

    expect(screen.getByText('the')).toHaveClass('missing')
    await user.keyboard('3')
    expect(screen.getByText('Where is the metro?')).toBeInTheDocument()
    expect(cards.saved?.[0]).toMatchObject({
      id: 'test-card-1',
      prompt: '¿Dónde está el metro?',
      createdAt: '2026-08-21T12:00:00.000Z',
    })
  })
})
