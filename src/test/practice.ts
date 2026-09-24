import { screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'

/** Enter card practice from either home’s mode menu or the Cards navigation button. */
export async function practiceCards(user: ReturnType<typeof userEvent.setup>) {
  const menuButtons = screen.queryAllByRole('button', {
    name: /^practice/i,
  })
  const menu = menuButtons.find(
    (btn) => btn.getAttribute('aria-haspopup') === 'menu',
  )
  if (menu) {
    await user.click(menu)
    await user.click(await screen.findByRole('menuitem', { name: 'Cards' }))
    return
  }
  const cardsButtons = screen.queryAllByRole('button', { name: /^cards/i })
  if (cardsButtons.length > 0) {
    await user.click(cardsButtons[0]!)
    return
  }
  const buttons = screen.getAllByRole('button', { name: /^practice/i })
  const entry = buttons[0]
  if (!entry) throw new Error('Cards or Practice button not found')
  await user.click(entry)
  if (entry.getAttribute('aria-haspopup') === 'menu') {
    await user.click(await screen.findByRole('menuitem', { name: 'Cards' }))
  }
}

export async function practiceGrammar(
  user: ReturnType<typeof userEvent.setup>,
) {
  const menuButtons = screen.queryAllByRole('button', {
    name: /^practice/i,
  })
  const menu = menuButtons.find(
    (btn) => btn.getAttribute('aria-haspopup') === 'menu',
  )
  if (menu) {
    await user.click(menu)
    await user.click(await screen.findByRole('menuitem', { name: 'Grammar' }))
    return
  }
  const grammarButtons = screen.queryAllByRole('button', { name: /^grammar/i })
  if (grammarButtons.length > 0) {
    await user.click(grammarButtons[0]!)
    return
  }
  const buttons = screen.getAllByRole('button', { name: /^practice/i })
  const entry = buttons[0]
  if (!entry) throw new Error('Grammar or Practice button not found')
  await user.click(entry)
  await user.click(await screen.findByRole('menuitem', { name: 'Grammar' }))
}
