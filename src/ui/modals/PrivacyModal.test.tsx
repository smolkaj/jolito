import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PrivacyModal } from './PrivacyModal'

describe('PrivacyModal', () => {
  it('does not render when isOpen is false', () => {
    render(<PrivacyModal isOpen={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders privacy disclosures when isOpen is true', () => {
    render(<PrivacyModal isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /privacy policy/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /the demo vs\. your account/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /what we collect/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: /data export & account deletion/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: /open source & contact/i,
      }),
    ).toBeInTheDocument()
  })

  it('calls onClose when clicking close button or Got it button', () => {
    const onClose = vi.fn()
    render(<PrivacyModal isOpen={true} onClose={onClose} />)

    fireEvent.click(
      screen.getByRole('button', { name: /close privacy policy/i }),
    )
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /got it/i }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('calls onClose on Escape key press', () => {
    const onClose = vi.fn()
    render(<PrivacyModal isOpen={true} onClose={onClose} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders open-source GitHub link and author link', () => {
    render(<PrivacyModal isOpen={true} onClose={vi.fn()} />)

    const repoLink = screen.getByRole('link', { name: 'open-source' })
    expect(repoLink).toHaveAttribute(
      'href',
      'https://github.com/smolkaj/jolito',
    )

    const authorLink = screen.getByRole('link', { name: 'Steffen Smolka' })
    expect(authorLink).toHaveAttribute('href', 'https://smolka.st')
  })

  it('renders official contact email mailto link to a@joli.to', () => {
    render(<PrivacyModal isOpen={true} onClose={vi.fn()} />)

    const emailLink = screen.getByRole('link', {
      name: 'a@joli.to',
    })
    expect(emailLink).toBeInTheDocument()
    expect(emailLink).toHaveAttribute('href', 'mailto:a@joli.to')
  })
})
