import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppFooter } from './AppFooter'

describe('AppFooter', () => {
  it('renders with data-nosnippet and handles clicks', async () => {
    const user = userEvent.setup()
    const onOpenFeedback = vi.fn()
    const onOpenPrivacy = vi.fn()

    const { container } = render(
      <AppFooter
        onOpenFeedback={onOpenFeedback}
        onOpenPrivacy={onOpenPrivacy}
      />,
    )

    const footerInner = container.querySelector('.app-footer-inner')
    expect(footerInner).toHaveAttribute('data-nosnippet')

    await user.click(screen.getByRole('button', { name: /^feedback$/i }))
    expect(onOpenFeedback).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /^privacy$/i }))
    expect(onOpenPrivacy).toHaveBeenCalledTimes(1)
  })

  it('hides privacy when showPrivacy is false', () => {
    render(<AppFooter onOpenFeedback={() => {}} showPrivacy={false} />)
    expect(screen.queryByRole('button', { name: /^privacy$/i })).toBeNull()
    expect(
      screen.getByRole('button', { name: /^feedback$/i }),
    ).toBeInTheDocument()
  })
})
