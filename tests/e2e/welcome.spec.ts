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
    page.getByRole('button', { name: /^create a card$/i }),
  ).toBeVisible()

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})

test('creates and reviews both directions with the keyboard', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: /^create a card$/i }).click()
  await page
    .getByLabel(/^Spanish Mexican Spanish$/)
    .fill('¿Dónde está el metro?')
  await page.getByLabel(/^English Concise meaning$/).fill('Where is the metro?')
  await page.getByRole('button', { name: /save & practice both/i }).click()

  await expect(
    page.getByRole('heading', { name: '¿Dónde está el metro?' }),
  ).toBeVisible()
  await page.getByLabel('Your answer').fill('Where is metro')
  await page.getByLabel('Your answer').press('Enter')
  await expect(page.locator('.missing', { hasText: 'the' })).toBeVisible()
  await expect(page.getByLabel('Your answer')).toHaveValue('Where is metro')

  await page.keyboard.press('3')
  await expect(
    page.getByRole('heading', { name: 'Where is the metro?' }),
  ).toBeVisible()

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})
