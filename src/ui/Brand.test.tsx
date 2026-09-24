import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Brand } from './Brand'

describe('Brand header component', () => {
  it('renders .topbar-brand layout slot wrapper with inner .brand element', () => {
    const { container } = render(<Brand />)
    const slot = container.querySelector('.topbar-brand')
    expect(slot).toBeInTheDocument()

    const brand = slot?.querySelector('.brand')
    expect(brand).toBeInTheDocument()
    expect(brand?.tagName.toLowerCase()).toBe('div')
    expect(brand?.querySelector('.brand-mark')).toBeInTheDocument()
    expect(brand?.textContent).toContain('Jolito')
  })

  it('renders interactive button with aria-label="Jolito home" when onClick is provided', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(<Brand onClick={handleClick} />)

    const button = screen.getByRole('button', { name: 'Jolito home' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass('brand')
    expect(button.closest('.topbar-brand')).toBeInTheDocument()

    await user.click(button)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('preserves custom className on the outer .topbar-brand slot', () => {
    const { container } = render(<Brand className="custom-slot-class" />)
    const slot = container.querySelector('.topbar-brand')
    expect(slot).toHaveClass('topbar-brand')
    expect(slot).toHaveClass('custom-slot-class')
  })
})
