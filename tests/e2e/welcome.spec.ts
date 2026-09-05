import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('welcomes learners without automatically detectable WCAG A/AA violations', async ({
  page,
}) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: /make the words you meet stick/i }),
  ).toBeVisible()
  await expect(page.getByText('Jolito', { exact: true })).toBeVisible()
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

  // Reach celebratory ¡Hecho! completion screen (reverse direction card is staggered for day 2)
  await expect(page.getByRole('heading', { name: '¡Hecho!' })).toBeVisible()
  await expect(page.getByText(/1 card practiced\./i)).toBeVisible()
  await expect(page.locator('.complete-mascot-frame')).toBeVisible()
  await expect(page.locator('.complete-mascot-img')).toBeVisible()

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})

test('advances progress bar visibly during practice with bidirectional cards', async ({
  page,
}) => {
  const now = Date.now()
  const cards = []
  for (let i = 1; i <= 10; i++) {
    const idx = String(i).padStart(2, '0')
    cards.push(
      {
        id: `card-${idx}:es-en`,
        noteId: `note-${idx}`,
        prompt: `palabra-${idx}`,
        answer: `word-${idx}`,
        direction: 'es-en',
        context: '',
        scene: 'conversation',
        schedule: {
          state: 'new',
          dueAt: now - 1000,
          intervalDays: 0,
          easeFactor: 2.5,
          reviews: 0,
          lapses: 0,
        },
        createdAt: now - 1000,
      },
      {
        id: `card-${idx}:en-es`,
        noteId: `note-${idx}`,
        prompt: `word-${idx}`,
        answer: `palabra-${idx}`,
        direction: 'en-es',
        context: '',
        scene: 'conversation',
        schedule: {
          state: 'new',
          dueAt: now - 1000,
          intervalDays: 0,
          easeFactor: 2.5,
          reviews: 0,
          lapses: 0,
        },
        createdAt: now - 1000,
      },
    )
  }

  await page.addInitScript((cardList) => {
    window.localStorage.setItem(
      'jolito-library-v1',
      JSON.stringify({ version: 1, cards: cardList, deletedCardIds: [] }),
    )
  }, cards)

  await page.goto('/#/study')
  const progressBar = page.locator('.review-progress-track')
  await expect(progressBar).toHaveAttribute('aria-valuenow', '0')
  await expect(progressBar).toHaveAttribute(
    'aria-valuetext',
    '10 cards remaining',
  )

  // Reveal answer and rate Easy (4)
  await page.keyboard.press('Enter')
  await page.keyboard.press('4')

  // Progress bar advances to 10% (1 completed out of 10 in batch, 9 remaining)
  await expect(progressBar).toHaveAttribute('aria-valuenow', '10')
  await expect(progressBar).toHaveAttribute(
    'aria-valuetext',
    '9 cards remaining',
  )

  // Rate second card Easy (4)
  await page.keyboard.press('Enter')
  await page.keyboard.press('4')
  await expect(progressBar).toHaveAttribute('aria-valuenow', '20')
  await expect(progressBar).toHaveAttribute(
    'aria-valuetext',
    '8 cards remaining',
  )

  await page.screenshot({ path: '/tmp/jolito-progress-bar-active.png' })
  await page.screenshot({ path: 'test-results/jolito-progress-bar-active.png' })

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

  // 2. Test Typo / Fuzzy match in autocomplete dropdown
  await spanishInput.fill('aguacatte')
  const suggestionsList = page.getByRole('listbox', {
    name: /spanish suggestions/i,
  })
  await expect(suggestionsList).toBeVisible()
  await expect(suggestionsList.getByText('aguacate')).toBeVisible()
  await expect(suggestionsList.getByText(/typo match/i)).toBeVisible()

  // Click typo suggestion item to apply
  await suggestionsList.getByText('aguacate').click()
  await expect(spanishInput).toHaveValue('aguacate')
  await expect(page.getByLabel(/english/i)).toHaveValue('avocado')
  await expect(suggestionsList).not.toBeVisible()

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
  const demoDismiss = page.getByRole('button', { name: /explore demo deck/i })
  if (await demoDismiss.isVisible()) {
    await demoDismiss.click()
  }
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
      const demoDismiss = page.getByRole('button', {
        name: /explore demo deck/i,
      })
      if (await demoDismiss.isVisible()) {
        await demoDismiss.click()
      }
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

  // Card 2: qué padre -> how cool
  await expect(page.getByRole('heading', { name: 'qué padre' })).toBeVisible()
  await page.getByLabel('Your answer').fill('how cool')
  await page.keyboard.press('Enter')
  await page.keyboard.press('4')

  // 2. Reach celebratory session complete screen
  await expect(page.getByRole('heading', { name: '¡Hecho!' })).toBeVisible()
  await expect(page.getByText(/2 cards practiced/i)).toBeVisible()

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
  await page.locator('.connection-pill').click()
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
    page.getByRole('heading', { name: /^save your card & start your deck$/i }),
  ).toBeVisible()
  await expect(
    page.getByText(/save “chido” to your personal deck/i),
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
    page.getByRole('heading', { name: /^save your card & start your deck$/i }),
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

test('ensures zero horizontal overflow across mobile and desktop viewports and verifies vertical fit for single-screen views', async ({
  page,
}) => {
  const viewports = [
    { name: 'Narrow Mobile (320x568)', width: 320, height: 568 },
    { name: 'iPhone SE (375x667)', width: 375, height: 667 },
    { name: 'iPhone 14 (390x844)', width: 390, height: 844 },
    { name: 'iPhone Pro Max (430x932)', width: 430, height: 932 },
    { name: 'Desktop (1280x800)', width: 1280, height: 800 },
  ]

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height })

    for (const testPage of ['welcome', 'deck', 'review', 'create']) {
      await page.goto('/')
      if (testPage === 'deck') {
        await page.getByRole('button', { name: /manage deck/i }).click()
      } else if (testPage === 'review') {
        await page.getByRole('button', { name: /^practice$/i }).click()
      } else if (testPage === 'create') {
        await page.getByRole('button', { name: /create a card/i }).click()
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

      // Invariant: zero horizontal overflow on any view
      expect(
        dims.docScrollWidth,
        `${testPage} on ${vp.name} horizontal overflow`,
      ).toBe(dims.docClientWidth)

      // Single-screen study review view should fit cleanly in viewport without unnecessary vertical scroll
      if (testPage === 'review') {
        expect(
          dims.docScrollHeight,
          `${testPage} on ${vp.name} vertical overflow`,
        ).toBe(dims.docClientHeight)
      }
    }
  }
})

test('displays "Why Jolito?" value proposition fold on welcome view with zero WCAG violations', async ({
  page,
}) => {
  await page.goto('/')
  const scrollCue = page.getByRole('button', {
    name: /^scroll down to explore why jolito$/i,
  })
  await expect(scrollCue).toBeVisible()
  await scrollCue.click()

  await expect(
    page.getByRole('heading', { name: /^why another flashcard app\?$/i }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: /^type before you flip$/i }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: /^spaced repetition that sticks$/i }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: /^spoken mexican spanish$/i }),
  ).toBeVisible()

  // Topbar feedback is visible
  await expect(page.getByRole('button', { name: /^feedback$/i })).toBeVisible()

  // Test interactive audio sampler pill
  const samplerPill = page.getByRole('button', {
    name: /listen to mexican spanish pronunciation for ¡órale!/i,
  })
  await expect(samplerPill).toBeVisible()
  await samplerPill.click()
  await expect(samplerPill).toHaveClass(/is-playing/)

  await page.screenshot({
    path: 'test-results/welcome-landing-page.png',
    fullPage: true,
  })

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})

test('hides card preview on tablet and mobile viewports (<= 860px) so it does not crowd form inputs', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: /create a card/i }).click()
  await expect(
    page.getByRole('heading', { name: 'New flashcard' }),
  ).toBeVisible()

  // On desktop (> 860px), preview cards are visible side-by-side
  await page.setViewportSize({ width: 1024, height: 768 })
  await expect(page.locator('.create-visual')).toBeVisible()
  await page.screenshot({ path: 'test-results/create-desktop-1024.png' })

  // On tablet (800px) and mobile (390px), preview cards are hidden
  await page.setViewportSize({ width: 800, height: 800 })
  await expect(page.locator('.create-visual')).toBeHidden()
  await page.screenshot({ path: 'test-results/create-tablet-800.png' })

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('.create-visual')).toBeHidden()
  await page.screenshot({ path: 'test-results/create-mobile-390.png' })
})

test('enables vertical scrolling in deck manager when card list exceeds viewport', async ({
  page,
}) => {
  const cards = Array.from({ length: 25 }, (_, i) => ({
    id: `scroll-test-card-${i}:es-en`,
    noteId: `scroll-note-${i}`,
    prompt: `Palabra ${i + 1}`,
    answer: `Word ${i + 1}`,
    direction: 'es-en',
    context: 'Context sample',
    scene: 'conversation',
    schedule: {
      state: 'new',
      dueAt: 0,
      intervalDays: 0,
      easeFactor: 2.5,
      reviews: 0,
      lapses: 0,
    },
  }))

  await page.addInitScript((cardList) => {
    window.localStorage.setItem(
      'jolito-library-v1',
      JSON.stringify({ version: 1, cards: cardList, deletedCardIds: [] }),
    )
  }, cards)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/deck')
  await expect(
    page.getByRole('heading', { name: /manage deck/i }),
  ).toBeVisible()

  const lastCard = page.getByText('Palabra 25')
  await expect(lastCard).toBeAttached()

  const initialDims = await page.evaluate(() => ({
    docScrollHeight: document.documentElement.scrollHeight,
    docClientHeight: document.documentElement.clientHeight,
    scrollY: window.scrollY,
  }))

  // Deck list exceeds viewport height and document is scrollable
  expect(initialDims.docScrollHeight).toBeGreaterThan(
    initialDims.docClientHeight,
  )
  expect(initialDims.scrollY).toBe(0)

  // Save screenshot of top state
  await page.screenshot({ path: 'test-results/deck-scroll-top.png' })

  // Scroll last card into view
  await lastCard.scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)

  const scrolledY = await page.evaluate(() => window.scrollY)
  expect(scrolledY).toBeGreaterThan(0)
  await expect(lastCard).toBeInViewport()

  // Save screenshot of scrolled bottom state
  await page.screenshot({ path: 'test-results/deck-scroll-bottom.png' })
})

test('aligns layout widths and container boundaries across desktop views', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })

  // 1. Deck View
  await page.goto('/#/deck')
  await expect(
    page.getByRole('heading', { name: /manage deck/i }),
  ).toBeVisible()

  const deckAlign = await page.evaluate(() => {
    const topbar = document.querySelector('.topbar')?.getBoundingClientRect()
    const deckLayout = document
      .querySelector('.deck-layout')
      ?.getBoundingClientRect()
    return {
      topbarWidth: topbar?.width,
      topbarLeft: topbar?.left,
      topbarRight: topbar?.right,
      layoutWidth: deckLayout?.width,
      layoutLeft: deckLayout?.left,
      layoutRight: deckLayout?.right,
    }
  })

  expect(deckAlign.layoutWidth).toBe(1080)
  expect(deckAlign.topbarWidth).toBe(1080)
  expect(
    Math.abs((deckAlign.topbarLeft ?? 0) - (deckAlign.layoutLeft ?? 0)),
  ).toBeLessThanOrEqual(1)
  expect(
    Math.abs((deckAlign.topbarRight ?? 0) - (deckAlign.layoutRight ?? 0)),
  ).toBeLessThanOrEqual(1)

  await page.screenshot({ path: 'test-results/deck-aligned.png' })

  // 2. Create View
  await page.goto('/#/create')
  await expect(
    page.getByRole('heading', { name: /new flashcard/i }),
  ).toBeVisible()

  const createAlign = await page.evaluate(() => {
    const topbar = document.querySelector('.topbar')?.getBoundingClientRect()
    const createLayout = document
      .querySelector('.create-layout')
      ?.getBoundingClientRect()
    return {
      topbarWidth: topbar?.width,
      topbarLeft: topbar?.left,
      topbarRight: topbar?.right,
      layoutWidth: createLayout?.width,
      layoutLeft: createLayout?.left,
      layoutRight: createLayout?.right,
    }
  })

  expect(createAlign.layoutWidth).toBe(1080)
  expect(createAlign.topbarWidth).toBe(1080)
  expect(
    Math.abs((createAlign.topbarLeft ?? 0) - (createAlign.layoutLeft ?? 0)),
  ).toBeLessThanOrEqual(1)
  expect(
    Math.abs((createAlign.topbarRight ?? 0) - (createAlign.layoutRight ?? 0)),
  ).toBeLessThanOrEqual(1)

  await page.screenshot({ path: 'test-results/create-aligned.png' })
})

test('gracefully formats and displays cards with long prompts and answers', async ({
  page,
}) => {
  const longSpanish =
    'El otro día fui al tianguis de la esquina para comprar unos aguacates bien maduros y limones para preparar un guacamole delicioso.'
  const longEnglish =
    'The other day I went to the street market on the corner to buy some very ripe avocados and limes to prepare a delicious guacamole.'

  await page.setViewportSize({ width: 1440, height: 900 })

  // 1. Create View long preview
  await page.goto('/#/create')
  await expect(
    page.getByRole('heading', { name: /new flashcard/i }),
  ).toBeVisible()

  await page.locator('#spanish').fill(longSpanish)
  await page.locator('#english').fill(longEnglish)

  const spanishPreview = page.locator('.sample-card-es .sample-phrase')
  await expect(spanishPreview).toHaveClass(/is-long/)

  // Verify preview does not overflow card container bounds
  const previewOverflow = await page.evaluate(() => {
    const card = document.querySelector('.sample-card-es')
    const phrase = document.querySelector('.sample-card-es .sample-phrase')
    const cardRect = card?.getBoundingClientRect()
    const phraseRect = phrase?.getBoundingClientRect()
    return {
      cardBottom: cardRect?.bottom ?? 0,
      phraseBottom: phraseRect?.bottom ?? 0,
    }
  })
  expect(previewOverflow.phraseBottom).toBeLessThanOrEqual(
    previewOverflow.cardBottom + 5,
  )

  await page.screenshot({ path: 'test-results/long-card-create-preview.png' })

  // 2. Study View long prompt & diff
  await page.evaluate(
    ([prompt, answer]) => {
      window.localStorage.setItem(
        'jolito-library-v1',
        JSON.stringify({
          version: 1,
          cards: [
            {
              id: 'long-card-study:es-en',
              noteId: 'long-note-1',
              prompt,
              answer,
              direction: 'es-en',
              context: 'Casual storytelling in CDMX',
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
    },
    [longSpanish, longEnglish],
  )

  await page.goto('/#/study')
  await page.reload()
  const studyPrompt = page.locator('.study-prompt')
  await expect(studyPrompt).toBeVisible()
  await expect(studyPrompt).toHaveClass(/is-long/)

  await page.screenshot({ path: 'test-results/long-card-study-prompt.png' })

  // Reveal answer with diff
  await page.getByLabel('Your answer').fill('The other day I went to market.')
  await page.getByLabel('Your answer').press('Enter')
  await expect(page.getByText('You wrote')).toBeVisible()
  await expect(page.getByText('Expected')).toBeVisible()

  await page.screenshot({ path: 'test-results/long-card-study-diff.png' })
})

test('displays lightweight demo deck modal and demo session complete screen with zero WCAG violations', async ({
  page,
}) => {
  // 1. Deck Manager shows DemoDeckModal on first guest visit
  await page.goto('/#/deck')
  const demoModal = page.getByRole('dialog', { name: /^demo deck$/i })
  await expect(demoModal).toBeVisible()
  await expect(
    page.getByText(/You’re exploring 4 example flashcards/i),
  ).toBeVisible()

  // Verify modal accessibility
  const modalAxe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(modalAxe.violations).toEqual([])

  // Dismiss demo modal
  await page.getByRole('button', { name: /explore demo deck/i }).click()
  await expect(demoModal).not.toBeVisible()

  // Return to Deck Manager after visiting Create -> modal appears again
  await page.getByRole('button', { name: /\+ new card/i }).click()
  await page.getByRole('button', { name: /manage deck/i }).click()
  await expect(demoModal).toBeVisible()
  await page.getByRole('button', { name: /explore demo deck/i }).click()
  await expect(demoModal).not.toBeVisible()

  // 2. Practice session to demo complete screen
  await page.goto('/')
  await page.getByRole('button', { name: /^practice$/i }).click()

  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Enter')
    await page.keyboard.press('4')
  }

  // Verify demo session complete view
  await expect(page.locator('.complete-card')).toBeVisible()
  await expect(page.getByText('DEMO SESSION COMPLETE')).toBeVisible()
  await expect(page.getByText(/\d+ cards practiced\./i)).toBeVisible()
  await expect(
    page.getByText(/to create and sync your personal deck\./i),
  ).toBeVisible()
  await expect(
    page
      .locator('.complete-subtext')
      .getByRole('button', { name: /^sign in$/i }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: /create a card/i }),
  ).toBeVisible()

  const completeAxe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(completeAxe.violations).toEqual([])
})

test('aligns study card quick actions with card container and supports keyboard edit shortcuts', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/#/study')

  const answerInput = page.getByLabel('Your answer')
  await expect(answerInput).toBeVisible()
  await expect(answerInput).toBeFocused()

  // 1. Verify unrevealed quick actions alignment with answer input
  const unrevealedAlign = await page.evaluate(() => {
    const cardInput = document
      .querySelector('.answer-input')
      ?.getBoundingClientRect()
    const quickActions = document
      .querySelector('.study-card-quick-actions')
      ?.getBoundingClientRect()
    return {
      cardRight: cardInput?.right,
      cardLeft: cardInput?.left,
      actionsRight: quickActions?.right,
      actionsLeft: quickActions?.left,
    }
  })

  expect(
    Math.abs(
      (unrevealedAlign.actionsRight ?? 0) - (unrevealedAlign.cardRight ?? 0),
    ),
  ).toBeLessThanOrEqual(1)
  expect(
    Math.abs(
      (unrevealedAlign.actionsLeft ?? 0) - (unrevealedAlign.cardLeft ?? 0),
    ),
  ).toBeLessThanOrEqual(1)

  await page.screenshot({ path: 'test-results/study-unrevealed-aligned.png' })

  const unrevealedAxe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(unrevealedAxe.violations).toEqual([])

  // 2. Typing 'e' types into the field without opening edit modal
  await page.keyboard.type('el')
  await expect(answerInput).toHaveValue('el')
  await expect(
    page.getByRole('heading', { name: /edit flashcard/i }),
  ).not.toBeVisible()

  // 3. Pressing Control+E opens edit modal from active input
  await page.keyboard.press('Control+e')
  const editModal = page.getByRole('dialog', { name: /edit flashcard/i })
  await expect(editModal).toBeVisible()
  await page.waitForTimeout(250)
  await page.screenshot({ path: 'test-results/study-edit-modal-opened.png' })

  // Close modal via Escape
  await page.keyboard.press('Escape')
  await expect(editModal).not.toBeVisible()
  await expect(answerInput).toBeFocused()

  // 4. Reveal answer and verify alignment with reveal panel
  await page.keyboard.press('Enter')
  const revealPanel = page.locator('.reveal-panel')
  await expect(revealPanel).toBeVisible()

  const revealedAlign = await page.evaluate(() => {
    const panel = document
      .querySelector('.reveal-panel')
      ?.getBoundingClientRect()
    const quickActions = document
      .querySelector('.study-card-quick-actions')
      ?.getBoundingClientRect()
    return {
      panelRight: panel?.right,
      panelLeft: panel?.left,
      actionsRight: quickActions?.right,
      actionsLeft: quickActions?.left,
    }
  })

  expect(
    Math.abs(
      (revealedAlign.actionsRight ?? 0) - (revealedAlign.panelRight ?? 0),
    ),
  ).toBeLessThanOrEqual(1)
  expect(
    Math.abs((revealedAlign.actionsLeft ?? 0) - (revealedAlign.panelLeft ?? 0)),
  ).toBeLessThanOrEqual(1)

  await page.waitForTimeout(250)
  await page.screenshot({ path: 'test-results/study-revealed-aligned.png' })

  const revealedAxe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(revealedAxe.violations).toEqual([])

  // 5. Bare 'e' shortcut opens edit modal when revealed
  await page.keyboard.press('e')
  await expect(editModal).toBeVisible()
  await page.waitForTimeout(250)

  const editModalAxe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(editModalAxe.violations).toEqual([])

  await page.keyboard.press('Escape')
  await expect(editModal).not.toBeVisible()
})
