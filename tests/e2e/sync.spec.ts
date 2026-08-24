import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('opens cloud sync modal without automatically detectable WCAG violations and allows interaction', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('button', { name: /tap to sync/i }).click()
  await expect(
    page.getByRole('heading', { name: /cloud sync & deck backup/i }),
  ).toBeVisible()

  // Verify zero WCAG 2.1 A/AA accessibility violations in sync dialog
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])

  // Verify modal has opaque surface
  const modalContent = page.locator('.modal-content.sync-modal')
  const bgColor = await modalContent.evaluate(
    (el) => window.getComputedStyle(el).backgroundColor,
  )
  expect(bgColor).not.toBe('rgba(0, 0, 0, 0)')
  expect(bgColor).not.toBe('transparent')

  // Check preview notice is displayed when cloud backend is unconfigured
  await expect(
    page.getByRole('heading', {
      name: /cloud sync is disabled in this preview/i,
    }),
  ).toBeVisible()

  // Check export and import section is present
  await expect(
    page.getByRole('heading', {
      name: /offline backup & export \(json\)/i,
    }),
  ).toBeVisible()

  // Save screenshot for autonomous visual inspection
  await page.screenshot({ path: 'test-results/sync-modal.png' })

  // Close modal via Escape
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('heading', { name: /cloud sync & deck backup/i }),
  ).not.toBeVisible()

  // Verify Welcome screen trust link opens modal
  await page.screenshot({
    path: 'test-results/welcome-trust-bar.png',
    fullPage: true,
  })
  await page
    .getByRole('button', { name: /free cloud sync across devices/i })
    .click()
  await expect(
    page.getByRole('heading', { name: /cloud sync & deck backup/i }),
  ).toBeVisible()
  await page.keyboard.press('Escape')

  // Complete study session and verify celebration screen sync nudge
  await page.getByRole('button', { name: /practice 4 due/i }).click()
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Enter')
    await page.keyboard.press('4')
  }

  await expect(page.getByRole('heading', { name: '¡Hecho!' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: /practice on your phone too/i }),
  ).toBeVisible()

  // Save screenshot of celebration screen with sync nudge
  await page.screenshot({
    path: 'test-results/celebration-sync-nudge.png',
    fullPage: true,
  })
})
