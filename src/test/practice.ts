import { screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'

/** Enter card practice from either home’s mode menu or the card editor’s shortcut. */
export async function practiceCards(user: ReturnType<typeof userEvent.setup>) {
  const entry = screen.getByRole('button', { name: /^practice$/i })
  await user.click(entry)
  if (entry.getAttribute('aria-haspopup') === 'menu') {
    await user.click(screen.getByRole('menuitem', { name: 'Cards' }))
  }
}

export async function practiceGrammar(
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.click(screen.getByRole('button', { name: 'Practice' }))
  await user.click(screen.getByRole('menuitem', { name: 'Grammar' }))
}
