import type { Page } from '@playwright/test'

/** Enter card practice from either home’s mode menu or the card editor’s shortcut. */
export async function practiceCards(page: Page) {
  const entry = page.getByRole('button', { name: /^practice$/i })
  const hasMenu = (await entry.getAttribute('aria-haspopup')) === 'menu'
  await entry.click()
  if (hasMenu) await page.getByRole('menuitem', { name: 'Cards' }).click()
}

export async function practiceGrammar(page: Page) {
  await page.getByRole('button', { name: 'Practice', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Grammar' }).click()
}
