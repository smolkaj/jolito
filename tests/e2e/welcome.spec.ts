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
  const brandMark = page.locator('.brand .brand-mark')
  await expect(brandMark).toBeVisible()
  const mascotImg = page.locator('.welcome-mascot-img')
  await expect(mascotImg).toBeVisible()
  await expect
    .poll(async () =>
      mascotImg.evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
    )
    .toBe(true)
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

test('brand mascot logo preserves opaque body fill and transparent negative space', async ({
  page,
}) => {
  await page.goto('/')
  const mascotImg = page.locator('.welcome-mascot-img')
  await expect(mascotImg).toBeVisible()

  await expect
    .poll(async () =>
      mascotImg.evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
    )
    .toBe(true)

  const pixelData = await mascotImg.evaluate((img: HTMLImageElement) => {
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0)
    const scaleX = img.naturalWidth / 878
    const scaleY = img.naturalHeight / 916
    const getPixel = (x: number, y: number) => {
      const p = ctx.getImageData(
        Math.round(x * scaleX),
        Math.round(y * scaleY),
        1,
        1,
      ).data
      return [p[0], p[1], p[2], p[3]]
    }
    return {
      head: getPixel(400, 300),
      body: getPixel(400, 600),
      hole: getPixel(300, 620),
      bg: getPixel(10, 10),
    }
  })

  expect(pixelData).not.toBeNull()
  // Head & body are opaque white
  expect(pixelData!.head[3]).toBe(255)
  expect(pixelData!.head[0]).toBeGreaterThan(200)
  expect(pixelData!.body[3]).toBe(255)
  expect(pixelData!.body[0]).toBeGreaterThan(200)
  // Hole between left arm and left leg is transparent
  expect(pixelData!.hole[3]).toBe(0)
  // Background is transparent
  expect(pixelData!.bg[3]).toBe(0)
})

test('creates and reviews both directions with the keyboard', async ({
  page,
}) => {
  await page.goto('/')
  await page.evaluate(() =>
    localStorage.setItem(
      'jolito-library-v1',
      JSON.stringify({ version: 1, cards: [] }),
    ),
  )
  await page.reload()
  await page.getByRole('button', { name: /^create a card$/i }).click()
  await page.getByLabel(/spanish/i).fill('¿Dónde está el metro?')
  await page.getByLabel(/english/i).fill('Where is the metro?')
  await page.getByRole('button', { name: /save card/i }).click()
  await page.getByRole('button', { name: /review 2/i }).click()

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
  const spanishInput = page.getByRole('combobox', { name: /mexican spanish/i })
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

test('top navigation pills have consistent vertical height across views', async ({
  page,
}) => {
  // 1. Welcome view
  await page.goto('/')
  const welcomePill = await page.locator('.connection-pill').boundingBox()
  expect(welcomePill?.height).toBe(32)

  // 2. Create view
  await page.goto('/#/create')
  const createReviewBtn = await page
    .locator('.nav-actions .text-button')
    .boundingBox()
  const createSyncPill = await page
    .locator('.nav-actions .connection-pill')
    .boundingBox()
  expect(createReviewBtn?.height).toBe(32)
  expect(createSyncPill?.height).toBe(32)

  // 3. Study / Review view
  await page.goto('/#/study')
  const reviewBadge = await page.locator('.review-queue-badge').boundingBox()
  const reviewNewCardBtn = await page
    .locator('.nav-actions .text-button')
    .boundingBox()
  const reviewSyncPill = await page
    .locator('.nav-actions .connection-pill')
    .boundingBox()
  expect(reviewBadge?.height).toBe(32)
  expect(reviewNewCardBtn?.height).toBe(32)
  expect(reviewSyncPill?.height).toBe(32)

  // 4. Accessibility check
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})

test('supports rapid batch card creation while remaining in create view', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: /^create a card$/i }).click()

  await expect(
    page.getByRole('heading', { name: 'New flashcard' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /review 4/i })).toBeVisible()

  const spanishInput = page.getByRole('combobox', { name: /mexican spanish/i })
  const englishInput = page.getByLabel(/english/i)

  // 1. Create first card
  await spanishInput.fill('chido')
  await englishInput.fill('cool / nice')
  await page.getByRole('button', { name: /save card/i }).click()

  await expect(page.getByRole('status')).toContainText(/saved “chido”/i)
  await expect(
    page.getByRole('heading', { name: 'New flashcard' }),
  ).toBeVisible()
  await expect(spanishInput).toHaveValue('')
  await expect(englishInput).toHaveValue('')
  await expect(spanishInput).toBeFocused()
  await expect(page.getByRole('button', { name: /review 6/i })).toBeVisible()

  // 2. Create second card immediately in batch
  await spanishInput.fill('popote')
  await englishInput.fill('straw')
  await page.getByRole('button', { name: /save card/i }).click()

  await expect(page.getByRole('status')).toContainText(/saved “popote”/i)
  await expect(
    page.getByRole('heading', { name: 'New flashcard' }),
  ).toBeVisible()
  await expect(spanishInput).toHaveValue('')
  await expect(spanishInput).toBeFocused()
  await expect(page.getByRole('button', { name: /review 8/i })).toBeVisible()

  // 3. Start review from top navbar
  await page.getByRole('button', { name: /review 8/i }).click()
  await expect(page.getByRole('heading', { name: 'aguacate' })).toBeVisible()

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})
