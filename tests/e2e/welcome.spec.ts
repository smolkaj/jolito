import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('welcomes learners without automatically detectable WCAG A/AA violations', async ({
  page,
}) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: /make the words you meet stick/i }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: /create your first card/i }),
  ).toBeVisible()

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})
