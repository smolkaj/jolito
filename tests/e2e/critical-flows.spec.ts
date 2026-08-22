import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
}

async function waitForOfflineShell(page: Page) {
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return
    await navigator.serviceWorker.ready
  })
}

test('welcome, creation, and review remain accessible', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: /make the words you meet stick/i }),
  ).toBeVisible()
  await expectAccessible(page)

  await page.getByRole('button', { name: /create your first card/i }).click()
  await expect(
    page.getByRole('heading', { name: /what do you want to remember/i }),
  ).toBeVisible()
  await expectAccessible(page)

  await page.getByLabel(/^Spanish/).fill('¿Dónde está el metro?')
  await page.getByLabel(/^English/).fill('Where is the metro?')
  await page.getByRole('button', { name: /save both cards/i }).click()
  await page.getByPlaceholder(/type your answer/i).fill('Where is metro')
  await page.getByRole('button', { name: /reveal answer/i }).click()

  await expect(page.getByText('the')).toHaveClass(/missing/)
  await page.locator('.reveal').evaluate(async (element) => {
    await Promise.all(element.getAnimations().map(({ finished }) => finished))
  })
  await expectAccessible(page)
})

test('a card created online survives an offline reload', async ({
  browserName,
  context,
  page,
}) => {
  test.skip(
    browserName === 'webkit',
    'Playwright WebKit fails navigation internally during offline emulation',
  )

  await page.goto('/')
  await waitForOfflineShell(page)
  await page.getByRole('button', { name: /create your first card/i }).click()
  await page.getByLabel(/^Spanish/).fill('Nos vemos mañana')
  await page.getByLabel(/^English/).fill('See you tomorrow')
  await page.getByRole('button', { name: /save both cards/i }).click()
  await expect(page.getByText('Nos vemos mañana')).toBeVisible()

  await context.setOffline(true)
  await page.reload()
  await page.getByRole('button', { name: 'Review' }).click()

  await expect(page.getByText('Nos vemos mañana')).toBeVisible()
})

test('versioned card storage survives a WebKit-compatible reload', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: /create your first card/i }).click()
  await page.getByLabel(/^Spanish/).fill('Está padrísimo')
  await page.getByLabel(/^English/).fill('It is really cool')
  await page.getByRole('button', { name: /save both cards/i }).click()

  await page.reload()
  await page.getByRole('button', { name: 'Review' }).click()

  await expect(page.getByText('Está padrísimo')).toBeVisible()
})

test('welcome visuals remain intentional on desktop and mobile', async ({
  browserName,
  page,
}) => {
  test.skip(
    browserName !== 'chromium',
    'One stable rendering engine owns baselines',
  )

  await page.goto('/')
  await expect(page).toHaveScreenshot('welcome-desktop.png', {
    fullPage: true,
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await expect(page).toHaveScreenshot('welcome-mobile.png', {
    fullPage: true,
  })
})
