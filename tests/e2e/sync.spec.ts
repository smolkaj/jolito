import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('opens cloud sync modal without automatically detectable WCAG violations and allows interaction', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('button', { name: /tap to sync/i }).click()
  await expect(
    page.getByRole('heading', { name: /cloud sync & multi-device backup/i }),
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
      name: /cloud sync is not enabled for this preview/i,
    }),
  ).toBeVisible()

  // Save screenshot for autonomous visual inspection
  await page.screenshot({ path: 'test-results/sync-modal.png' })

  // Clicking "Backup deck locally →" opens the backup dialog
  await page.getByRole('button', { name: /backup deck locally/i }).click()
  await expect(
    page.getByRole('heading', { name: /deck backup & safety/i }),
  ).toBeVisible()

  // Close modal via Escape
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('heading', { name: /deck backup & safety/i }),
  ).not.toBeVisible()
})
