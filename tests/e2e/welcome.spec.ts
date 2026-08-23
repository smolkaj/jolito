import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('welcomes learners without automatically detectable WCAG A/AA violations', async ({
  page,
}) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: /make the words you meet stick/i }),
  ).toBeVisible()
  await expect(page.getByText(/mexican spanish · local-first/i)).toBeVisible()
  await expect(page.getByText('Jolito')).toBeVisible()
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
  await expect(
    page.locator('.diff-seg-missing', { hasText: 'the' }),
  ).toBeVisible()
  await expect(page.getByText('You wrote')).toBeVisible()

  await page.keyboard.press('3')
  await expect(
    page.getByRole('heading', { name: 'Where is the metro?' }),
  ).toBeVisible()

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})

test('supports browser back and forward navigation across views', async ({
  page,
}) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: /make the words you meet stick/i }),
  ).toBeVisible()

  // Navigate to Create Card
  await page.getByRole('button', { name: /^create a card$/i }).click()
  await expect(
    page.getByRole('heading', { name: 'What do you want to remember?' }),
  ).toBeVisible()
  expect(page.url()).toContain('#/create')

  // Browser Back button -> returns to Welcome
  await page.goBack()
  await expect(
    page.getByRole('heading', { name: /make the words you meet stick/i }),
  ).toBeVisible()

  // Browser Forward button -> returns to Create Card
  await page.goForward()
  await expect(
    page.getByRole('heading', { name: 'What do you want to remember?' }),
  ).toBeVisible()

  // Navigate to Study from Welcome
  await page.goBack()
  await page.getByRole('button', { name: /practice 4 due/i }).click()
  await expect(page.getByLabel('Your answer')).toBeVisible()
  expect(page.url()).toContain('#/study')

  // Browser Back button -> returns to Welcome
  await page.goBack()
  await expect(
    page.getByRole('heading', { name: /make the words you meet stick/i }),
  ).toBeVisible()

  // Browser Forward button -> resumes Study
  await page.goForward()
  await expect(page.getByLabel('Your answer')).toBeVisible()
})

test('transitions sample card from background to foreground smoothly and remains accessible', async ({
  page,
}) => {
  await page.goto('/')

  const spanishCard = page.getByRole('button', {
    name: /play pronunciation for mexican spanish card: aguacate/i,
  })
  const englishCard = page.getByRole('button', {
    name: /show english card: avocado/i,
  })

  await expect(spanishCard).toHaveClass(/is-foreground/)
  await expect(englishCard).toHaveClass(/is-background/)

  // Click exposed badge on background English card to bring to foreground
  await englishCard.getByText('ENGLISH').click()

  const foregroundEnglish = page.getByRole('button', {
    name: /play pronunciation for english card: avocado/i,
  })
  const backgroundSpanish = page.getByRole('button', {
    name: /show mexican spanish card: aguacate/i,
  })

  await expect(foregroundEnglish).toHaveClass(/is-foreground/)
  await expect(backgroundSpanish).toHaveClass(/is-background/)

  // Click exposed badge on background Spanish card to return it to foreground
  await backgroundSpanish.getByText('MEXICAN SPANISH').click()

  await expect(spanishCard).toHaveClass(/is-foreground/)
  await expect(englishCard).toHaveClass(/is-background/)

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})
