import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('opens cloud sync modal without automatically detectable WCAG violations and allows interaction', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('button', { name: /cloud sync/i }).click()
  await expect(
    page.getByRole('heading', { name: /cloud sync & multi-device backup/i }),
  ).toBeVisible()

  // Verify zero WCAG 2.1 A/AA accessibility violations in sync dialog
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])

  // Check email field is accessible and can receive input
  const emailInput = page.getByLabel(/email address/i)
  await expect(emailInput).toBeVisible()
  await emailInput.fill('learner@example.com')

  // Close modal via Escape
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('heading', { name: /cloud sync & multi-device backup/i }),
  ).not.toBeVisible()
})
