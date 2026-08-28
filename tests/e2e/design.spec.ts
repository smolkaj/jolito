import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('revealed practice has readable supporting text and zero detectable WCAG violations', async ({
  page,
}) => {
  await page.goto('/#/review')
  await page.getByLabel('Your answer').fill('avocado')
  await page.keyboard.press('Enter')

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])

  await expect(page.locator('.context-label')).toHaveCSS('font-size', '12px')
  await expect(page.locator('.grade-again small')).toHaveCSS(
    'font-size',
    '12px',
  )
  await expect(page.locator('.grade-easy small')).toHaveCSS('font-size', '12px')
})

test('dialogs contain keyboard focus and restore it to the invoking control', async ({
  page,
}) => {
  await page.goto('/')
  const signInButton = page.getByRole('button', { name: /not signed in/i })
  await signInButton.focus()
  await signInButton.click()

  const emailInput = page.getByLabel('Email address')
  await expect(emailInput).toBeFocused()
  await emailInput.fill('learner@example.com')

  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('button', { name: 'Close dialog' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(
    page.getByRole('button', { name: /send sign-in link/i }),
  ).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(signInButton).toBeFocused()
})

test('mobile deck rows keep the answer, status, and edit affordance visible', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/deck')

  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByText(/you’re exploring 4 example cards/i),
  ).toBeVisible()
  await expect(page.getByRole('group', { name: 'Card views' })).toBeVisible()
  await expect(page.getByRole('button', { name: /ready now/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^new \(/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /scheduled/i })).toBeVisible()

  const firstRow = page.getByRole('row', { name: /card: aguacate/i })
  await expect(firstRow.locator('.deck-answer-text')).toBeVisible()
  await expect(firstRow.locator('.deck-stat-chip')).toBeVisible()
  await expect(firstRow.locator('.deck-row-chevron')).toBeVisible()
})

test('short landscape practice keeps grading visible and removes management chrome', async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/#/review')
  await page.getByLabel('Your answer').fill('avocado')
  await page.keyboard.press('Enter')

  const gradeBounds = await page.locator('.grade-buttons').boundingBox()
  expect(gradeBounds).not.toBeNull()
  expect(gradeBounds!.y).toBeGreaterThanOrEqual(0)
  expect(gradeBounds!.y + gradeBounds!.height).toBeLessThanOrEqual(390)

  const reviewNavigation = page.getByRole('navigation', {
    name: 'Review navigation',
  })
  await expect(reviewNavigation.getByText('Manage deck')).toHaveCount(0)
  await expect(reviewNavigation.getByText('New card')).toHaveCount(0)
  await expect(reviewNavigation.getByText('Sign in')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /delete card/i })).toHaveCount(
    0,
  )
})

test('mobile keeps the tactile sample and live card preview available', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('.hero-visual')).toBeVisible()

  await page.getByRole('button', { name: /^create a card$/i }).click()
  const emptyCreateResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(emptyCreateResults.violations).toEqual([])

  await page.getByLabel('Mexican Spanish').fill('qué padre')
  await page.getByLabel('English').fill('how cool')
  await expect(page.locator('.create-visual')).toBeVisible()
  await expect(
    page.locator('.create-visual .sample-phrase', { hasText: 'qué padre' }),
  ).toBeVisible()
})

test('long mobile answer comparison stacks labels above readable text', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.setItem(
      'jolito-library-v1',
      JSON.stringify({
        version: 1,
        cards: [
          {
            id: 'long-card:es-en',
            noteId: 'long-card',
            prompt:
              'El otro día fui al tianguis de la esquina para comprar unos aguacates bien maduros y limones para preparar un guacamole delicioso.',
            answer:
              'The other day I went to the street market on the corner to buy some very ripe avocados and limes to prepare a delicious guacamole.',
            direction: 'es-en',
            context: 'Casual storytelling in Mexico City.',
            scene: 'conversation',
            schedule: {
              state: 'new',
              dueAt: 0,
              intervalDays: 0,
              easeFactor: 2.5,
              reviews: 0,
              lapses: 0,
            },
          },
        ],
        deletedCardIds: [],
      }),
    )
  })
  await page.goto('/#/review')
  await page.reload()
  await page.getByLabel('Your answer').fill('I went to the market.')
  await page.keyboard.press('Enter')

  const labelBounds = await page.locator('.diff-label').first().boundingBox()
  const answerBounds = await page.locator('.diff-text').first().boundingBox()
  expect(labelBounds).not.toBeNull()
  expect(answerBounds).not.toBeNull()
  expect(labelBounds!.y + labelBounds!.height).toBeLessThanOrEqual(
    answerBounds!.y,
  )
  expect(answerBounds!.width).toBeGreaterThan(240)
})
