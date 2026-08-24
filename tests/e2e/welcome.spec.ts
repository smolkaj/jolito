import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('welcomes learners without automatically detectable WCAG A/AA violations', async ({
  page,
}) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: /make the words you meet stick/i }),
  ).toBeVisible()
  await expect(page.getByText('Jolito')).toBeVisible()
  const brandImg = page.locator('.brand img')
  await expect(brandImg).toBeVisible()
  const isLoaded = await brandImg.evaluate(
    (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
  )
  expect(isLoaded).toBe(true)
  await expect(
    page.getByText(/create beautiful, spoken flashcards/i),
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
  await page.getByLabel(/spanish/i).fill('¿Dónde está el metro?')
  await page.getByLabel(/english/i).fill('Where is the metro?')
  await page.getByRole('button', { name: /save card/i }).click()

  await expect(
    page.getByRole('heading', { name: '¿Dónde está el metro?' }),
  ).toBeVisible()
  await page.getByLabel('Your answer').fill('Where is metro')
  await page.getByLabel('Your answer').press('Enter')
  await expect(
    page.locator('.diff-seg-missing', { hasText: 'the' }),
  ).toBeVisible()
  await expect(page.getByText('You wrote')).toBeVisible()

  await page.keyboard.press('4')
  await expect(
    page.getByRole('heading', { name: 'Where is the metro?' }),
  ).toBeVisible()

  // Complete second card to reach celebratory ¡Hecho! completion screen
  await page.getByLabel('Your answer').fill('¿Dónde está el metro?')
  await page.getByLabel('Your answer').press('Enter')
  await page.keyboard.press('4')

  await expect(page.getByRole('heading', { name: '¡Hecho!' })).toBeVisible()
  await expect(page.getByText(/2 cards practiced/i)).toBeVisible()
  await expect(page.locator('.complete-mascot-frame')).toBeVisible()
  await expect(page.locator('.complete-mascot-img')).toBeVisible()

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
    page.getByRole('heading', { name: 'New flashcard' }),
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
    page.getByRole('heading', { name: 'New flashcard' }),
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

test('autocompletes Mexican Spanish phrases and corrects typos on card creation', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: /^create a card$/i }).click()

  // 1. Test Autocomplete
  const spanishInput = page.getByLabel(/spanish/i)
  await spanishInput.fill('ahor')

  await expect(
    page.getByRole('listbox', { name: /spanish suggestions/i }),
  ).toBeVisible()
  await expect(page.getByText('ahorita')).toBeVisible()

  // Verify WCAG accessibility with dropdown open
  const resultsDropdown = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(resultsDropdown.violations).toEqual([])

  // Select suggestion
  await page.getByText('ahorita').click()
  await expect(spanishInput).toHaveValue('ahorita')
  await expect(page.getByLabel(/english/i)).toHaveValue('right now / in a bit')

  // 2. Test Typo / Did You Mean
  await spanishInput.fill('aguacatte')
  await expect(page.getByText(/did you mean/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /aguacate/i })).toBeVisible()

  // Click typo chip to apply
  await page.getByRole('button', { name: /aguacate/i }).click()
  await expect(spanishInput).toHaveValue('aguacate')
  await expect(page.getByLabel(/english/i)).toHaveValue('avocado')

  // Verify WCAG compliance
  const resultsFinal = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(resultsFinal.violations).toEqual([])
})
