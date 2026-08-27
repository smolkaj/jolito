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

test('apple-touch-icon and PWA app icons provide fully opaque brand paper background for iOS and mobile home screens', async ({
  page,
}) => {
  await page.goto('/')

  // Verify apple-touch-icon link element in HTML head
  const appleTouchIconLink = page.locator('link[rel="apple-touch-icon"]')
  await expect(appleTouchIconLink).toHaveAttribute(
    'href',
    '/apple-touch-icon.png',
  )

  // Verify apple-touch-icon image has opaque paper background (#fdf5f8) with no transparent corners
  const iconPixelData = await page.evaluate(async () => {
    const img = new Image()
    img.src = '/apple-touch-icon.png'
    await new Promise((res, rej) => {
      img.onload = res
      img.onerror = rej
    })
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0)

    const getPixel = (x: number, y: number) => {
      const p = ctx.getImageData(x, y, 1, 1).data
      return [p[0], p[1], p[2], p[3]]
    }

    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      topLeft: getPixel(0, 0),
      topRight: getPixel(img.naturalWidth - 1, 0),
      bottomLeft: getPixel(0, img.naturalHeight - 1),
      bottomRight: getPixel(img.naturalWidth - 1, img.naturalHeight - 1),
      center: getPixel(
        Math.floor(img.naturalWidth / 2),
        Math.floor(img.naturalHeight / 2),
      ),
    }
  })

  expect(iconPixelData).not.toBeNull()
  expect(iconPixelData!.width).toBe(180)
  expect(iconPixelData!.height).toBe(180)

  // Corners must be fully opaque #fdf5f8 (R: 253, G: 245, B: 248, A: 255)
  for (const corner of [
    iconPixelData!.topLeft,
    iconPixelData!.topRight,
    iconPixelData!.bottomLeft,
    iconPixelData!.bottomRight,
  ]) {
    expect(corner[3]).toBe(255) // Opaque alpha
    expect(corner[0]).toBe(253) // #fd
    expect(corner[1]).toBe(245) // #f5
    expect(corner[2]).toBe(248) // #f8
  }

  // Center eye must be white (#ffffff)
  expect(iconPixelData!.center[3]).toBe(255)
  expect(iconPixelData!.center[0]).toBeGreaterThan(250)
  expect(iconPixelData!.center[1]).toBeGreaterThan(250)
  expect(iconPixelData!.center[2]).toBeGreaterThan(250)
})

test('creates and reviews both directions with the keyboard', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'jolito-auth-session-v1',
      JSON.stringify({
        accessToken: 'mock-token',
        refreshToken: 'mock-refresh',
        expiresAt: Date.now() + 3600000,
        user: { id: 'usr-1', email: 'creator@example.com' },
      }),
    )
  })
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
  await page.getByRole('button', { name: /^practice$/i }).click()

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
  await page.getByRole('button', { name: /^practice$/i }).click()
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
  await page.screenshot({ path: 'test-results/suggestion-open.png' })

  // Verify WCAG accessibility with dropdown open
  const resultsDropdown = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(resultsDropdown.violations).toEqual([])

  // Select suggestion
  await page.getByText('ahorita').click()
  await expect(spanishInput).toHaveValue('ahorita')
  await expect(page.getByLabel(/english/i)).toHaveValue('right now / in a bit')
  await expect(
    page.getByRole('listbox', { name: /spanish suggestions/i }),
  ).not.toBeVisible()
  await page.screenshot({
    path: 'test-results/suggestion-closed-after-selection.png',
  })

  // 2. Test Typo / Did You Mean
  await spanishInput.fill('aguacatte')
  await expect(page.getByText(/did you mean/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /aguacate/i })).toBeVisible()

  // Click typo chip to apply
  await page.getByRole('button', { name: /aguacate/i }).click()
  await expect(spanishInput).toHaveValue('aguacate')
  await expect(page.getByLabel(/english/i)).toHaveValue('avocado')
  await expect(page.getByText(/did you mean/i)).not.toBeVisible()
  await expect(
    page.getByRole('listbox', { name: /spanish suggestions/i }),
  ).not.toBeVisible()

  // 3. Test keyboard selection (ArrowDown + Enter) closes overlay
  await spanishInput.fill('que pad')
  await expect(
    page.getByRole('listbox', { name: /spanish suggestions/i }),
  ).toBeVisible()
  await spanishInput.press('ArrowDown')
  await spanishInput.press('Enter')
  await expect(spanishInput).toHaveValue('qué padre')
  await expect(page.getByLabel(/english/i)).toHaveValue('how cool / fantastic')
  await expect(
    page.getByRole('listbox', { name: /spanish suggestions/i }),
  ).not.toBeVisible()

  // 4. Tab into English field -> auto-selects text and allows instant overwrite
  await page.keyboard.press('Tab')
  await expect(page.getByLabel(/english/i)).toBeFocused()
  await page.keyboard.type('awesome')
  await expect(page.getByLabel(/english/i)).toHaveValue('awesome')

  // Verify WCAG compliance
  const resultsFinal = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(resultsFinal.violations).toEqual([])
})

test('all pills and badges have consistent heights across views and within the same line', async ({
  page,
}) => {
  // 1. Welcome view: connection pill and sample card listen hint pills
  await page.goto('/')
  const welcomePill = await page.locator('.connection-pill').boundingBox()
  expect(welcomePill?.height).toBeCloseTo(32, 1)

  const sampleListenHints = page.locator('.sample-listen-hint')
  const sampleHintCount = await sampleListenHints.count()
  expect(sampleHintCount).toBeGreaterThan(0)
  for (let i = 0; i < sampleHintCount; i++) {
    const hintHeight = await sampleListenHints.nth(i).evaluate((el) => {
      return (
        (el as HTMLElement).offsetHeight ||
        parseFloat(window.getComputedStyle(el).height)
      )
    })
    expect(hintHeight).toBeCloseTo(24, 1)
  }

  // 2. Create view: top nav text-button and connection-pill (same line)
  await page.goto('/#/create')
  const createReviewBtn = await page
    .locator('.nav-actions .text-button')
    .first()
    .boundingBox()
  const createSyncPill = await page
    .locator('.nav-actions .connection-pill')
    .boundingBox()
  expect(createReviewBtn?.height).toBeCloseTo(32, 1)
  expect(createSyncPill?.height).toBeCloseTo(32, 1)

  // 3. Study / Review view: top nav pills and progress track
  await page.goto('/#/study')
  const reviewProgress = await page
    .locator('.review-progress-track')
    .boundingBox()
  const reviewNewCardBtn = await page
    .locator('.nav-actions .text-button')
    .first()
    .boundingBox()
  const reviewSyncPill = await page
    .locator('.nav-actions .connection-pill')
    .boundingBox()
  expect(reviewProgress?.height).toBeCloseTo(3, 1)
  expect(reviewNewCardBtn?.height).toBeCloseTo(32, 1)
  expect(reviewSyncPill?.height).toBeCloseTo(32, 1)

  // 4. Deck view: header actions, toolbar filter pills, batch actions, and table row pills
  await page.goto('/#/deck')
  const deckNewCardBtn = await page
    .locator('.nav-actions .text-button')
    .first()
    .boundingBox()
  const deckSyncPill = await page
    .locator('.nav-actions .connection-pill')
    .boundingBox()
  const deckFilterPills = page.locator('.deck-filter-pills .deck-filter-pill')
  const deckBackupBtn = await page
    .locator('.deck-header-actions .secondary-button')
    .boundingBox()

  expect(deckNewCardBtn?.height).toBeCloseTo(32, 1)
  expect(deckSyncPill?.height).toBeCloseTo(32, 1)
  expect(deckBackupBtn?.height).toBeCloseTo(32, 1)

  // Verify all filter pills have identical 32px height on the toolbar line
  const filterCount = await deckFilterPills.count()
  expect(filterCount).toBe(5)
  for (let i = 0; i < filterCount; i++) {
    const filterBox = await deckFilterPills.nth(i).boundingBox()
    expect(filterBox?.height).toBeCloseTo(32, 1)
  }

  // Select all cards to reveal batch action pills on the same toolbar line
  await page.getByRole('checkbox', { name: /select all cards/i }).click()
  const batchDeleteBtn = await page.locator('.batch-delete-btn').boundingBox()
  const clearSelectionBtn = await page
    .locator('.deck-clear-selection-btn')
    .boundingBox()
  const firstFilterPill = await deckFilterPills.first().boundingBox()

  expect(batchDeleteBtn?.height).toBeCloseTo(32, 1)
  expect(clearSelectionBtn?.height).toBeCloseTo(32, 1)
  expect(batchDeleteBtn?.height).toBe(firstFilterPill?.height)
  expect(clearSelectionBtn?.height).toBe(firstFilterPill?.height)

  // Verify table rows: Direction badge and Status chip in the SAME row/line have identical 24px height
  const cardRows = page.locator('.deck-card-row')
  const cardRowCount = await cardRows.count()
  expect(cardRowCount).toBeGreaterThan(0)
  for (let i = 0; i < cardRowCount; i++) {
    const row = cardRows.nth(i)
    const dirBadge = await row.locator('.deck-direction-badge').boundingBox()
    const statusChip = await row
      .locator('.deck-stat-chip.is-mini')
      .boundingBox()
    expect(dirBadge?.height).toBeCloseTo(24, 1)
    expect(statusChip?.height).toBeCloseTo(24, 1)
    expect(dirBadge?.height).toBe(statusChip?.height)
  }

  // 5. Complete view action pills (consistently sized 50px pills: Create card & Back home)
  await page.goto('/#/complete')
  const completeButtons = page.locator('.complete-actions button')
  await expect(completeButtons).toHaveCount(2)
  const completeCreateBtn = await completeButtons.nth(0).boundingBox()
  const completeHomeBtn = await completeButtons.nth(1).boundingBox()
  expect(completeCreateBtn?.height).toBeGreaterThanOrEqual(48)
  expect(completeHomeBtn?.height).toBe(completeCreateBtn?.height)

  // 6. Accessibility check
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})

test('enforces universal geometric invariants across all pill, chip, and badge elements in all views', async ({
  page,
}) => {
  const views = [
    { name: 'Welcome', path: '/' },
    { name: 'Create', path: '/#/create' },
    { name: 'Study', path: '/#/study' },
    { name: 'Deck', path: '/#/deck' },
    { name: 'Complete', path: '/#/complete' },
  ]

  for (const v of views) {
    await page.goto(v.path)

    // If on deck view, select cards to test batch actions as well
    if (v.name === 'Deck') {
      const selectAll = page.getByRole('checkbox', {
        name: /select all cards/i,
      })
      if (await selectAll.isVisible()) {
        await selectAll.click()
      }
    }

    // Evaluate all pill/chip elements rendered in this view
    const pillMeasurements = await page.evaluate(() => {
      const pillSelectors = [
        '.connection-pill',
        '.text-button',
        '.deck-filter-pill',
        '.deck-stat-chip',
        '.deck-direction-badge',
        '.stat-pill',
        '.sample-listen-hint',
        '.diff-badge',
        '.deck-header-pill',
        '.deck-header-actions .secondary-button',
        '.batch-delete-btn',
        '.deck-clear-selection-btn',
      ]
      const elements = Array.from(
        document.querySelectorAll<HTMLElement>(pillSelectors.join(', ')),
      )

      return elements.map((el) => {
        const computed = window.getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        const height =
          el.offsetHeight || parseFloat(computed.height) || rect.height
        return {
          className: el.className,
          tagName: el.tagName,
          height: Math.round(height * 10) / 10,
          boxSizing: computed.boxSizing,
        }
      })
    })

    for (const pill of pillMeasurements) {
      // Every pill must match either 32px (standard) or 24px (compact)
      const isStandardPill = Math.abs(pill.height - 32) <= 1
      const isCompactPill = Math.abs(pill.height - 24) <= 1
      expect(
        isStandardPill || isCompactPill,
        `Pill <${pill.tagName} class="${pill.className}"> on ${v.name} view must be either 32px or 24px, got ${pill.height}px`,
      ).toBe(true)

      expect(
        pill.boxSizing,
        `Pill <${pill.tagName} class="${pill.className}"> on ${v.name} view must have box-sizing: border-box`,
      ).toBe('border-box')
    }

    // Check sibling alignment in flex rows
    const flexRowInvariants = await page.evaluate(() => {
      const containerSelectors = [
        '.nav-actions',
        '.deck-filter-pills',
        '.deck-batch-actions',
        '.deck-card-row',
        '.sync-actions-row',
      ]
      const results: { container: string; heights: number[] }[] = []

      for (const sel of containerSelectors) {
        const containers = Array.from(document.querySelectorAll(sel))
        for (const container of containers) {
          const pills = Array.from(
            container.querySelectorAll<HTMLElement>(
              '.connection-pill, .text-button, .deck-filter-pill, .deck-stat-chip, .deck-direction-badge, .batch-delete-btn, .deck-clear-selection-btn, .sync-now-button, .sign-out-button',
            ),
          )

          if (pills.length > 1) {
            const heights = pills.map(
              (p) =>
                p.offsetHeight || parseFloat(window.getComputedStyle(p).height),
            )
            results.push({ container: sel, heights })
          }
        }
      }
      return results
    })

    for (const row of flexRowInvariants) {
      if (row.container === '.deck-card-row') {
        // Table row contains direction badge (24px) and status chip (24px)
        for (const h of row.heights) {
          expect(h).toBeCloseTo(24, 1)
        }
      } else {
        // Nav actions / Filter pills / Batch actions / Sync actions contain 32px pills
        for (const h of row.heights) {
          expect(h).toBeCloseTo(32, 1)
        }
      }
    }
  }

  // 6. Test Modals: Signed-in Cloud Sync Modal (Sync now & Sign out pills on the same line)
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'jolito-auth-session-v1',
      JSON.stringify({
        accessToken: 'mock-token',
        refreshToken: 'mock-refresh',
        expiresAt: Date.now() + 3600000,
        user: { id: 'usr-modal-test', email: 'modal-tester@example.com' },
      }),
    )
  })
  await page.goto('/')
  await page.locator('.connection-pill').click()
  await expect(page.locator('.sync-modal')).toBeVisible()

  const syncNowHeight = await page
    .locator('.sync-now-button')
    .evaluate((el: HTMLElement) => el.offsetHeight)
  const signOutHeight = await page
    .locator('.sign-out-button')
    .evaluate((el: HTMLElement) => el.offsetHeight)

  expect(syncNowHeight).toBeCloseTo(32, 1)
  expect(signOutHeight).toBeCloseTo(32, 1)
  expect(syncNowHeight).toBe(signOutHeight)

  // Close sync modal
  await page.locator('.sync-modal .modal-close').click()
  await expect(page.locator('.sync-modal')).not.toBeVisible()

  // 7. Test Modals: Edit Card Modal action buttons on the same line
  await page.goto('/#/deck')
  await page.locator('.deck-card-row').first().click()
  await expect(page.locator('.edit-card-modal')).toBeVisible()

  const editCancelHeight = await page
    .locator('.edit-modal-actions .secondary-button')
    .evaluate((el: HTMLElement) => el.offsetHeight)
  const editSaveHeight = await page
    .locator('.edit-modal-actions .primary-button')
    .evaluate((el: HTMLElement) => el.offsetHeight)

  expect(editCancelHeight).toBeCloseTo(40, 1)
  expect(editSaveHeight).toBeCloseTo(40, 1)
  expect(editCancelHeight).toBe(editSaveHeight)
})

test('supports rapid batch card creation while remaining in create view', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'jolito-auth-session-v1',
      JSON.stringify({
        accessToken: 'mock-token',
        refreshToken: 'mock-refresh',
        expiresAt: Date.now() + 3600000,
        user: { id: 'usr-1', email: 'batch-creator@example.com' },
      }),
    )
  })
  await page.goto('/')
  await page.getByRole('button', { name: /^create a card$/i }).click()

  await expect(
    page.getByRole('heading', { name: 'New flashcard' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /^practice$/i })).toBeVisible()

  const spanishInput = page.getByRole('combobox', { name: /mexican spanish/i })
  const englishInput = page.getByLabel(/english/i)

  // 1. Create first card
  await spanishInput.fill('chido')
  await englishInput.fill('cool / nice')
  await page.getByRole('button', { name: 'Save card' }).click()

  const saveButton = page.getByRole('button', { name: 'Save card' })
  await expect(saveButton).toBeVisible()
  await expect(saveButton).toHaveClass(/is-saved/)
  await expect(saveButton).toContainText(/saved “chido”/i)
  await expect(page.getByRole('status')).toContainText(/saved “chido”/i)
  await expect(page.locator('.create-save-feedback')).toHaveCount(0)
  await page.screenshot({ path: 'test-results/save-button-animated.png' })

  await expect(
    page.getByRole('heading', { name: 'New flashcard' }),
  ).toBeVisible()
  await expect(spanishInput).toHaveValue('')
  await expect(englishInput).toHaveValue('')
  await expect(spanishInput).toBeFocused()
  await expect(page.getByRole('button', { name: /^practice$/i })).toBeVisible()

  // 2. Create second card immediately in batch
  await spanishInput.fill('popote')
  await englishInput.fill('straw')
  await page.getByRole('button', { name: 'Save card' }).click()

  await expect(saveButton).toHaveClass(/is-saved/)
  await expect(saveButton).toContainText(/saved “popote”/i)
  await expect(page.getByRole('status')).toContainText(/saved “popote”/i)
  await expect(
    page.getByRole('heading', { name: 'New flashcard' }),
  ).toBeVisible()
  await expect(spanishInput).toHaveValue('')
  await expect(spanishInput).toBeFocused()
  await expect(page.getByRole('button', { name: /^practice$/i })).toBeVisible()

  // 3. Start review from top navbar
  await page.getByRole('button', { name: /^practice$/i }).click()
  await expect(page.getByRole('heading', { name: 'chido' })).toBeVisible()

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})

test('allows guests to practice example deck immediately and explore card creator without signing in', async ({
  page,
}) => {
  await page.goto('/')

  // 1. Practice example starter cards immediately as a guest
  await expect(page.getByRole('button', { name: /^practice$/i })).toBeVisible()
  await page.getByRole('button', { name: /^practice$/i }).click()

  // Card 1: aguacate -> avocado
  await expect(page.getByRole('heading', { name: 'aguacate' })).toBeVisible()
  await page.getByLabel('Your answer').fill('avocado')
  await page.keyboard.press('Enter')
  await page.keyboard.press('4') // Easy

  // Card 2: avocado -> aguacate
  await expect(page.getByRole('heading', { name: 'avocado' })).toBeVisible()
  await page.getByLabel('Your answer').fill('aguacate')
  await page.keyboard.press('Enter')
  await page.keyboard.press('4')

  // Card 3: Qué padre -> How cool
  await expect(page.getByRole('heading', { name: 'Qué padre' })).toBeVisible()
  await page.getByLabel('Your answer').fill('How cool')
  await page.keyboard.press('Enter')
  await page.keyboard.press('4')

  // Card 4: How cool -> Qué padre
  await expect(page.getByRole('heading', { name: 'How cool' })).toBeVisible()
  await page.getByLabel('Your answer').fill('Qué padre')
  await page.keyboard.press('Enter')
  await page.keyboard.press('4')

  // 2. Reach celebratory session complete screen
  await expect(page.getByRole('heading', { name: '¡Hecho!' })).toBeVisible()
  await expect(page.getByText(/4 cards practiced/i)).toBeVisible()

  // 3. Guest explores create card screen
  await page.getByRole('button', { name: /create a card/i }).click()
  await expect(
    page.getByRole('heading', { name: 'New flashcard' }),
  ).toBeVisible()

  await expect(
    page.locator('.create-visual .sample-card-es .sample-phrase'),
  ).toHaveClass(/is-placeholder/)
  await expect(
    page.locator('.create-visual .sample-card-en .sample-phrase'),
  ).toHaveClass(/is-placeholder/)
  await page.screenshot({
    path: 'test-results/create-card-placeholders-dimmed.png',
  })

  const spanishInput = page.getByRole('combobox', { name: /mexican spanish/i })
  const englishInput = page.getByLabel(/english/i)

  await spanishInput.fill('chela')
  await englishInput.fill('beer')

  // Live preview cards update
  await expect(
    page.locator('.create-visual .sample-card-es .sample-phrase'),
  ).toHaveText('chela')
  await expect(
    page.locator('.create-visual .sample-card-en .sample-phrase'),
  ).toHaveText('beer')

  await page.screenshot({ path: 'test-results/guest-create-exploration.png' })

  // 4. Open Sync Modal directly to inspect modal appearance
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(
    page.getByRole('heading', { name: /^cloud sync$/i }),
  ).toBeVisible()
  await page.screenshot({ path: 'test-results/guest-sync-modal.png' })

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})

test('prompts unauthenticated guest to sign in when clicking save card in card creator', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: /^create a card$/i }).click()

  const spanishInput = page.getByRole('combobox', { name: /mexican spanish/i })
  const englishInput = page.getByLabel(/english/i)

  await spanishInput.fill('chido')
  await englishInput.fill('cool')
  await page.getByRole('button', { name: /save card/i }).click()

  // Sign in modal MUST open asking the user to log in!
  await expect(
    page.getByRole('heading', { name: /^cloud sync$/i }),
  ).toBeVisible()
  await expect(
    page.getByText(/sync your deck across all your devices/i),
  ).toBeVisible()

  await page.screenshot({
    path: 'test-results/save-card-auth-modal.png',
    animations: 'disabled',
  })

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])

  // Modal can be dismissed with Escape and preserves form inputs
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('heading', { name: /^cloud sync$/i }),
  ).not.toBeVisible()
  await expect(spanishInput).toHaveValue('chido')
  await expect(englishInput).toHaveValue('cool')
})

test('configures mobile viewport and touch action defaults for iOS standalone ergonomics', async ({
  page,
}) => {
  await page.goto('/')

  const viewportMeta = page.locator('meta[name="viewport"]')
  await expect(viewportMeta).toHaveAttribute(
    'content',
    'width=device-width, initial-scale=1.0, viewport-fit=cover',
  )

  const touchAction = await page.evaluate(() => {
    return window.getComputedStyle(document.documentElement).touchAction
  })
  expect(touchAction).toBe('manipulation')
})

test('ensures zero horizontal or vertical overflow across mobile and desktop viewports', async ({
  page,
}) => {
  const viewports = [
    { name: 'iPhone SE (375x667)', width: 375, height: 667 },
    { name: 'iPhone 14 (390x844)', width: 390, height: 844 },
    { name: 'iPhone Pro Max (430x932)', width: 430, height: 932 },
    { name: 'Desktop (1280x800)', width: 1280, height: 800 },
  ]

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height })

    for (const testPage of ['welcome', 'deck', 'review']) {
      await page.goto('/')
      if (testPage === 'deck') {
        await page.getByRole('button', { name: /manage deck/i }).click()
      } else if (testPage === 'review') {
        await page.getByRole('button', { name: /^practice$/i }).click()
      }

      const dims = await page.evaluate(() => {
        const doc = document.documentElement
        return {
          docScrollWidth: doc.scrollWidth,
          docClientWidth: doc.clientWidth,
          docScrollHeight: doc.scrollHeight,
          docClientHeight: doc.clientHeight,
        }
      })
      expect(
        dims.docScrollWidth,
        `${testPage} on ${vp.name} horizontal overflow`,
      ).toBe(dims.docClientWidth)
      expect(
        dims.docScrollHeight,
        `${testPage} on ${vp.name} vertical overflow`,
      ).toBe(dims.docClientHeight)
    }
  }
})
