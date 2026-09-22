import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AudioButton } from './AudioButton'

describe('AudioButton', () => {
  it('renders default button without playing state', () => {
    const handleClick = vi.fn()
    render(<AudioButton label="Play audio" onClick={handleClick} />)

    const button = screen.getByRole('button', { name: 'Play audio' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass('audio-button')
    expect(button).not.toHaveClass('is-playing')
    expect(button).not.toHaveAttribute('data-playing')
    expect(button).not.toHaveAttribute('aria-pressed')
  })

  it('renders active visual and accessible playing state when playing is true', () => {
    const handleClick = vi.fn()
    render(
      <AudioButton
        label="Play prompt audio"
        playing={true}
        prompt={true}
        onClick={handleClick}
      />,
    )

    const button = screen.getByRole('button', { name: 'Play prompt audio' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass('audio-button')
    expect(button).toHaveClass('is-playing')
    expect(button).toHaveAttribute('data-playing', 'true')
    expect(button).toHaveAttribute('data-prompt-audio', 'true')
    expect(button).not.toHaveAttribute('aria-pressed')
  })

  it('invokes onClick handler when clicked', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(<AudioButton label="Play answer audio" onClick={handleClick} />)

    const button = screen.getByRole('button', { name: 'Play answer audio' })
    await user.click(button)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
