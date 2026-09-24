import type { Page } from '@playwright/test'

/** Enter card practice from either home’s mode menu or the Cards navigation button. */
export async function practiceCards(page: Page) {
  const menu = page.locator('button.practice-menu-trigger')
  if (await menu.isVisible().catch(() => false)) {
    await menu.click()
    await page.getByRole('menuitem', { name: 'Cards' }).click()
    return
  }
  const cardsBtn = page.getByRole('button', { name: /^cards/i }).first()
  if (await cardsBtn.isVisible().catch(() => false)) {
    await cardsBtn.click()
    return
  }
  const entry = page.getByRole('button', { name: /^practice/i }).first()
  const hasMenu = (await entry.getAttribute('aria-haspopup')) === 'menu'
  await entry.click()
  if (hasMenu) await page.getByRole('menuitem', { name: 'Cards' }).click()
}

export async function practiceGrammar(page: Page) {
  const menu = page.locator('button.practice-menu-trigger')
  if (await menu.isVisible().catch(() => false)) {
    await menu.click()
    await page.getByRole('menuitem', { name: 'Grammar' }).click()
    return
  }
  const grammarBtn = page.getByRole('button', { name: /^grammar/i }).first()
  if (await grammarBtn.isVisible().catch(() => false)) {
    await grammarBtn.click()
    return
  }
  await page
    .getByRole('button', { name: /^practice/i })
    .first()
    .click()
  await page.getByRole('menuitem', { name: 'Grammar' }).click()
}
