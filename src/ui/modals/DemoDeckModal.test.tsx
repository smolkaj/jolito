import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DemoDeckModal } from './DemoDeckModal'

describe('DemoDeckModal', () => {
  it('renders modal content and triggers onSignIn, onExploreStarterPacks, and onClose', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onSignIn = vi.fn()
    const onExploreStarterPacks = vi.fn()

    const { rerender } = render(
      <DemoDeckModal
        isOpen={true}
        onClose={onClose}
        onSignIn={onSignIn}
        onExploreStarterPacks={onExploreStarterPacks}
      />,
    )

    expect(
      screen.getByRole('dialog', { name: /^demo deck$/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/you’re exploring 4 example flashcards/i),
    ).toBeInTheDocument()

    // 1. Explore starter packs
    const starterPacksBtn = screen.getByRole('button', {
      name: /explore starter packs/i,
    })
    expect(starterPacksBtn).toBeInTheDocument()
    await user.click(starterPacksBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onExploreStarterPacks).toHaveBeenCalledTimes(1)

    // 2. Sign in
    rerender(
      <DemoDeckModal
        isOpen={true}
        onClose={onClose}
        onSignIn={onSignIn}
        onExploreStarterPacks={onExploreStarterPacks}
      />,
    )
    const signInBtn = screen.getByRole('button', {
      name: /sign in to build your deck/i,
    })
    await user.click(signInBtn)
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(onSignIn).toHaveBeenCalledTimes(1)

    // 3. Explore demo deck
    rerender(
      <DemoDeckModal
        isOpen={true}
        onClose={onClose}
        onSignIn={onSignIn}
        onExploreStarterPacks={onExploreStarterPacks}
      />,
    )
    const exploreBtn = screen.getByRole('button', {
      name: /explore demo deck/i,
    })
    await user.click(exploreBtn)
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('renders without onExploreStarterPacks if omitted', () => {
    render(
      <DemoDeckModal isOpen={true} onClose={() => {}} onSignIn={() => {}} />,
    )
    expect(
      screen.queryByRole('button', { name: /explore starter packs/i }),
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: /explore demo deck/i }),
    ).toBeInTheDocument()
  })

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <DemoDeckModal isOpen={false} onClose={() => {}} onSignIn={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
