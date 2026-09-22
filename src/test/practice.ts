import { screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'

/** Enter card practice from either home’s mode menu or the card editor’s shortcut. */
export async function practiceCards(user: ReturnType<typeof userEvent.setup>) {
  const [entry] = screen.getAllByRole('button', { name: /^practice$/i })
  if (!entry) throw new Error('Practice button not found')
  await user.click(entry)
  if (entry.getAttribute('aria-haspopup') === 'menu') {
    await user.click(await screen.findByRole('menuitem', { name: 'Cards' }))
  }
}

export async function practiceGrammar(
  user: ReturnType<typeof userEvent.setup>,
) {
  const [entry] = screen.getAllByRole('button', { name: 'Practice' })
  if (!entry) throw new Error('Practice button not found')
  await user.click(entry)
  await user.click(await screen.findByRole('menuitem', { name: 'Grammar' }))
}
