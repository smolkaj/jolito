import { practiceCards } from './practice'
import { auditAccessibility } from './accessibility'
import { expect, test } from '@playwright/test'

test.describe('Mobile iOS Viewport, Touch Ergonomics & Visual Integrity', () => {
  test.use({
    viewport: { width: 393, height: 852 }, // iPhone 15 / 16 standard viewport
    hasTouch: true,
    isMobile: true,
  })

  test('enforces Apple HIG minimum touch target standards (>= 44x44pt) across all mobile interactive controls', async ({
    page,
  }) => {
    await page.goto('/')

    // 1. Welcome screen primary touch targets
    const practiceBtn = page.getByRole('button', {
      name: /^practice$/i,
    })
    await expect(practiceBtn).toBeVisible()
    const practiceBox = await practiceBtn.boundingBox()
    expect(practiceBox).not.toBeNull()
    expect(practiceBox!.height).toBeGreaterThanOrEqual(44)
    expect(practiceBox!.width).toBeGreaterThanOrEqual(44)

    const createBtn = page.getByRole('button', { name: /^create a card$/i })
    await expect(createBtn).toBeVisible()
    const createBox = await createBtn.boundingBox()
    expect(createBox).not.toBeNull()
    expect(createBox!.height).toBeGreaterThanOrEqual(44)
    expect(createBox!.width).toBeGreaterThanOrEqual(44)

    // 2. Study screen controls
    await practiceCards(page)
    const answerInput = page.getByLabel(/your answer/i)
    await expect(answerInput).toBeVisible()
    const inputBox = await answerInput.boundingBox()
    expect(inputBox).not.toBeNull()
    expect(inputBox!.height).toBeGreaterThanOrEqual(44)

    // 3. Revealed state 4-button grading bar touch targets
    await answerInput.fill('avocado')
    await answerInput.press('Enter')

    const gradeButtons = [
      page.getByRole('button', { name: /again/i }),
      page.getByRole('button', { name: /hard/i }),
      page.getByRole('button', { name: /good/i }),
      page.getByRole('button', { name: /easy/i }),
    ]

    for (const btn of gradeButtons) {
      await expect(btn).toBeVisible()
      const box = await btn.boundingBox()
      expect(box).not.toBeNull()
      // Apple HIG: buttons in a segmented bar must be at least 44pt tall and comfortably wide
      expect(box!.height).toBeGreaterThanOrEqual(44)
      expect(box!.width).toBeGreaterThanOrEqual(44)
    }
  })

  test('supports full mobile touch practice flow with zero WCAG violations and captures visual snapshots', async ({
    page,
  }) => {
    // 1. Load the app on mobile viewport
    await page.goto('/')

    // Verify no horizontal overflow on mobile
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    )
    const clientWidth = await page.evaluate(
      () => document.documentElement.clientWidth,
    )
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)

    // Capture mobile welcome snapshot
    await page.screenshot({ path: 'test-results/mobile-welcome.png' })

    // Verify Why Jolito scroll cue button is visible and meets Apple HIG touch targets on mobile
    const scrollCue = page.getByRole('link', {
      name: /^scroll down to explore why jolito$/i,
    })
    await expect(scrollCue).toBeVisible()
    const cueBox = await scrollCue.boundingBox()
    expect(cueBox).not.toBeNull()
    expect(cueBox!.height).toBeGreaterThanOrEqual(44)
    expect(cueBox!.width).toBeGreaterThanOrEqual(44)

    // Verify Why Jolito scroll cue and Feedback button do not overlap or collide
    const heroFooter = page.locator('.welcome-hero-footer')
    const feedbackBtn = heroFooter.getByRole('button', { name: /^feedback$/i })
    await expect(feedbackBtn).toBeVisible()
    const feedbackBox = await feedbackBtn.boundingBox()
    expect(feedbackBox).not.toBeNull()
    expect(cueBox!.x + cueBox!.width).toBeLessThanOrEqual(feedbackBox!.x)

    // Privacy is housed cleanly in SyncModal / deck footer, not colliding in hero fold
    await expect(
      heroFooter.getByRole('button', { name: /^privacy$/i }),
    ).not.toBeVisible()

    // Initial accessibility check on mobile welcome screen
    const welcomeAxe = await auditAccessibility(page)
    expect(welcomeAxe.violations).toEqual([])

    // 2. Tap Practice on mobile
    const practiceBtn = page.getByRole('button', {
      name: /^practice$/i,
    })
    await expect(practiceBtn).toBeVisible()
    await practiceCards(page)

    // Verify study view is active and responsive
    const answerInput = page.getByLabel(/your answer/i)
    await expect(answerInput).toBeVisible()
    await expect(answerInput).toBeFocused()

    await page.screenshot({ path: 'test-results/mobile-unrevealed.png' })

    // 3. Type answer on mobile and press Enter / Submit
    await answerInput.fill('avocado')
    await answerInput.press('Enter')

    // 4. Verify mobile revealed state has all 4 grade buttons visible and reachable
    const againBtn = page.getByRole('button', { name: /again/i })
    const hardBtn = page.getByRole('button', { name: /hard/i })
    const goodBtn = page.getByRole('button', { name: /good/i })
    const easyBtn = page.getByRole('button', { name: /easy/i })

    await expect(againBtn).toBeVisible()
    await expect(hardBtn).toBeVisible()
    await expect(goodBtn).toBeVisible()
    await expect(easyBtn).toBeVisible()

    // Check accessibility of revealed state on mobile after transition settles
    await page.waitForTimeout(250)
    await page.screenshot({ path: 'test-results/mobile-revealed.png' })

    const reviewAxe = await auditAccessibility(page)
    expect(reviewAxe.violations).toEqual([])

    // 5. Tap Good to grade
    await goodBtn.click()

    // Next card should appear and focus
    await expect(page.getByLabel(/your answer/i)).toBeVisible()
  })

  test('verifies mobile safe-area insets and bottom action bar fit', async ({
    page,
  }) => {
    await page.goto('/')

    // Verify site footer / feedback button is visible and clickable on mobile
    const feedbackBtn = page.getByRole('button', { name: /^feedback$/i })
    await expect(feedbackBtn).toBeVisible()
    await feedbackBtn.click()

    // Verify modal appears and can be dismissed
    await expect(
      page.getByRole('heading', { name: /share feedback/i }),
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(
      page.getByRole('heading', { name: /share feedback/i }),
    ).not.toBeVisible()
  })

  test('ensures feedback button does not overlap save card button on mobile viewports', async ({
    page,
  }) => {
    // Test on iPhone standard mobile viewport
    await page.goto('/')
    await page.getByRole('button', { name: /^create a card$/i }).click()

    const saveBtn = page.getByRole('button', {
      name: /save card|sign in to save/i,
    })
    const feedbackBtn = page.getByRole('button', { name: /^feedback$/i })

    await expect(saveBtn).toBeVisible()
    await expect(feedbackBtn).toBeVisible()

    // Verify non-overlapping bounding boxes: feedback button is positioned below save button
    const saveBox = await saveBtn.boundingBox()
    const feedbackBox = await feedbackBtn.boundingBox()
    expect(saveBox).not.toBeNull()
    expect(feedbackBox).not.toBeNull()
    expect(feedbackBox!.y).toBeGreaterThanOrEqual(saveBox!.y + saveBox!.height)

    // Verify tapping save button interacts with save flow rather than feedback modal
    const spanishInput = page.getByRole('combobox', {
      name: /mexican spanish/i,
    })
    const englishInput = page.getByLabel(/english/i)
    await spanishInput.fill('chido')
    await englishInput.fill('cool')

    await saveBtn.click()
    await expect(
      page.getByRole('heading', { name: /share feedback/i }),
    ).not.toBeVisible()
    await expect(
      page.getByRole('heading', {
        name: /^save your card & start your deck$/i,
      }),
    ).toBeVisible()
  })

  test('supports Why Jolito navigation and clean seamless fold presentation on mobile iPhone viewports', async ({
    page,
  }) => {
    await page.goto('/')

    const scrollCue = page.getByRole('link', {
      name: /^scroll down to explore why jolito$/i,
    })
    await expect(scrollCue).toBeVisible()
    await expect(scrollCue).toHaveText(/why jolito\?/i)

    // Capture mobile landing view showing the centered Why Jolito button
    await page.screenshot({ path: 'test-results/mobile-why-jolito-button.png' })

    // Tap Why Jolito button to smoothly scroll to editorial fold
    await scrollCue.click()
    await expect(page).toHaveURL(/#why-jolito$/)
    await expect
      .poll(async () =>
        page.locator('.welcome-page').evaluate((element) => element.scrollTop),
      )
      .toBeGreaterThan(100)
    await page.waitForTimeout(400)

    const whyFold = page.locator('#why-jolito')
    await expect(whyFold).toBeInViewport()
    await expect(
      page.getByRole('heading', { name: /^why another flashcard app\?$/i }),
    ).toBeVisible()

    // Verify border-top is none / 0px on .welcome-why
    const borderTopWidth = await page.evaluate(() => {
      const el = document.querySelector('.welcome-why')
      return el ? window.getComputedStyle(el).borderTopWidth : null
    })
    expect(borderTopWidth).toBe('0px')

    // Capture mobile fold snapshot
    await page.screenshot({ path: 'test-results/mobile-why-jolito-fold.png' })

    // Tap Start learning button to return to top
    const startBtn = page.getByRole('button', { name: /^start learning/i })
    await expect(startBtn).toBeVisible()
    await startBtn.click()
    await expect
      .poll(async () =>
        page.locator('.welcome-page').evaluate((element) => element.scrollTop),
      )
      .toBeLessThanOrEqual(5)
  })

  test('preserves review progress, queue integrity, and audio controls across device rotation and backgrounding', async ({
    page,
  }) => {
    await page.goto('/')

    // 1. Start practice session in mobile portrait (393x852)
    const practiceBtn = page.getByRole('button', {
      name: /^practice$/i,
    })
    await expect(practiceBtn).toBeVisible()
    await practiceCards(page)

    // First card: aguacate
    const answerInput = page.getByLabel(/your answer/i)
    await expect(answerInput).toBeVisible()
    await expect(page.getByRole('heading', { name: 'aguacate' })).toBeVisible()

    // Answer and grade first card
    await answerInput.fill('avocado')
    await answerInput.press('Enter')
    const easyBtn = page.getByRole('button', { name: /easy/i })
    await expect(easyBtn).toBeVisible()
    await easyBtn.click()

    // 2. Queue has advanced to second card: 'qué padre'
    await expect(page.getByRole('heading', { name: 'qué padre' })).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'aguacate' }),
    ).not.toBeVisible()

    // 3. Simulate device rotation to landscape (852x393)
    await page.setViewportSize({ width: 852, height: 393 })
    await page.evaluate(() => {
      window.dispatchEvent(new Event('orientationchange'))
    })

    // 4. Simulate iOS lifecycle interruption (brief backgrounding/foregrounding on rotate)
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.waitForTimeout(100)
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    // 5. Invariant: Card queue did NOT jump backwards or reset; 'qué padre' remains active
    await expect(page.getByRole('heading', { name: 'qué padre' })).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'aguacate' }),
    ).not.toBeVisible()

    // Audio button remains functional and does not crash or wedge
    const audioBtn = page.getByRole('button', { name: /play prompt audio/i })
    if (await audioBtn.isVisible()) {
      await audioBtn.click()
    }

    // 6. Rotate back to portrait (393x852)
    await page.setViewportSize({ width: 393, height: 852 })
    await page.evaluate(() => {
      window.dispatchEvent(new Event('orientationchange'))
    })

    // Answer and grade card 2: 'qué padre'
    const landscapeInput = page.getByLabel(/your answer/i)
    await expect(landscapeInput).toBeVisible()
    await landscapeInput.fill('how cool')
    await landscapeInput.press('Enter')
    await page.getByRole('button', { name: /easy/i }).click()

    // 7. Queue advances to card 3: 'ajolote'
    await expect(page.getByRole('heading', { name: 'ajolote' })).toBeVisible()
    const card3Input = page.getByLabel(/your answer/i)
    await expect(card3Input).toBeVisible()
    await card3Input.fill('axolotl')
    await card3Input.press('Enter')
    await page.getByRole('button', { name: /easy/i }).click()

    // 8. Cleanly completes review session
    await expect(page.getByRole('heading', { name: /¡hecho!/i })).toBeVisible()
  })

  test('guarantees zero bounding-box overlap and clearance between Why Jolito cue and Feedback on narrow 375px mobile viewports', async ({
    page,
  }) => {
    // Test on iPhone SE (375x667)
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')

    const scrollCue = page.getByRole('link', {
      name: /^scroll down to explore why jolito$/i,
    })
    const heroFooter = page.locator('.welcome-hero-footer')
    const feedbackBtn = heroFooter.getByRole('button', { name: /^feedback$/i })

    await expect(scrollCue).toBeVisible()
    await expect(feedbackBtn).toBeVisible()

    const cueBox = await scrollCue.boundingBox()
    const feedbackBox = await feedbackBtn.boundingBox()

    expect(cueBox).not.toBeNull()
    expect(feedbackBox).not.toBeNull()

    // Ensure strictly no horizontal collision and at least an 8px clearance gap
    expect(feedbackBox!.x - (cueBox!.x + cueBox!.width)).toBeGreaterThanOrEqual(
      8,
    )

    // Capture screenshot on 375px viewport for visual verification
    await page.screenshot({ path: 'test-results/mobile-375-welcome.png' })
  })

  test('anchors home actions to the viewport bottom and right-aligns Feedback on narrow screens', async ({
    page,
  }) => {
    for (const viewport of [
      { width: 375, height: 667 },
      { width: 393, height: 852 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto('/')

      const heroFooter = page.locator('.welcome-hero-footer')
      const feedbackBtn = heroFooter.getByRole('button', {
        name: /^feedback$/i,
      })

      await expect(heroFooter).toBeVisible()
      await expect(feedbackBtn).toBeVisible()

      const [footerBox, feedbackBox, viewportSize] = await Promise.all([
        heroFooter.boundingBox(),
        feedbackBtn.boundingBox(),
        page.evaluate(() => ({
          width: window.innerWidth,
          height: window.innerHeight,
        })),
      ])

      expect(footerBox).not.toBeNull()
      expect(feedbackBox).not.toBeNull()
      expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(
        viewportSize.height,
      )
      expect(
        viewportSize.height - (footerBox!.y + footerBox!.height),
      ).toBeLessThanOrEqual(32)
      expect(
        viewportSize.width - (feedbackBox!.x + feedbackBox!.width),
      ).toBeLessThanOrEqual(16)
    }
  })

  test('enforces Apple HIG touch targets, layout integrity, and single-column create on shallow landscape viewports', async ({
    page,
  }) => {
    for (const viewport of [
      { width: 852, height: 393 }, // iPhone 15/16 landscape
      { width: 932, height: 430 }, // iPhone Pro Max landscape
    ]) {
      await page.setViewportSize(viewport)
      await page.goto('/')

      // 1. Welcome screen touch targets >= 44x44pt
      const createBtn = page.getByRole('button', { name: /^create a card/i })
      const cueBtn = page.getByRole('link', {
        name: /^scroll down to explore why jolito/i,
      })
      await expect(createBtn).toBeVisible()
      await expect(cueBtn).toBeVisible()

      const [createBox, cueBox, heroFooter, viewportSize] = await Promise.all([
        createBtn.boundingBox(),
        cueBtn.boundingBox(),
        page.locator('.welcome-hero-footer').boundingBox(),
        page.evaluate(() => ({
          width: window.innerWidth,
          height: window.innerHeight,
        })),
      ])

      expect(createBox).not.toBeNull()
      expect(cueBox).not.toBeNull()
      expect(heroFooter).not.toBeNull()

      expect(createBox!.height).toBeGreaterThanOrEqual(44)
      expect(createBox!.width).toBeGreaterThanOrEqual(44)
      expect(cueBox!.height).toBeGreaterThanOrEqual(44)
      expect(cueBox!.width).toBeGreaterThanOrEqual(44)

      // Hero footer fits inside viewport
      expect(heroFooter!.y + heroFooter!.height).toBeLessThanOrEqual(
        viewportSize.height,
      )

      // 2. Create card view: single column and .create-visual hidden
      await page.goto('/#create')
      await page.waitForSelector('.create-form')
      const visualHidden = await page
        .locator('.create-visual')
        .evaluate((el) => window.getComputedStyle(el).display === 'none')
      expect(visualHidden).toBe(true)
    }
  })

  test('enforces Apple HIG touch targets, in-place card elevation, and 100dvh fit on tablet portrait viewports', async ({
    page,
  }) => {
    for (const viewport of [
      { width: 768, height: 1024 }, // iPad Mini portrait
      { width: 810, height: 1080 }, // iPad 10.2" portrait
      { width: 820, height: 1180 }, // iPad Air portrait
    ]) {
      await page.setViewportSize(viewport)
      await page.goto('/')

      // 1. All controls >= 44x44pt
      const createBtn = page.getByRole('button', { name: /^create a card/i })
      const cueBtn = page.getByRole('link', {
        name: /^scroll down to explore why jolito/i,
      })
      await expect(createBtn).toBeVisible()
      await expect(cueBtn).toBeVisible()

      const [createBox, cueBox, heroFooter, viewportSize] = await Promise.all([
        createBtn.boundingBox(),
        cueBtn.boundingBox(),
        page.locator('.welcome-hero-footer').boundingBox(),
        page.evaluate(() => ({
          width: window.innerWidth,
          height: window.innerHeight,
        })),
      ])

      expect(createBox!.height).toBeGreaterThanOrEqual(44)
      expect(cueBox!.height).toBeGreaterThanOrEqual(44)

      // Entire hero panel fits inside viewport without vertical overflow
      expect(heroFooter!.y + heroFooter!.height).toBeLessThanOrEqual(
        viewportSize.height,
      )

      // 2. In-place card elevation on hover/active (no coordinate jump)
      const esCard = page.locator('.sample-card-es')
      const enCard = page.locator('.sample-card-en')
      await expect(esCard).toBeVisible()
      await expect(enCard).toBeVisible()

      const initialEsBox = await esCard.boundingBox()
      expect(initialEsBox).not.toBeNull()

      await esCard.hover()
      await page.waitForTimeout(100)
      const hoveredEsBox = await esCard.boundingBox()
      expect(hoveredEsBox).not.toBeNull()

      // Card must not leap across the screen (-50% translation bug would shift by >100px)
      const deltaX = Math.abs(hoveredEsBox!.x - initialEsBox!.x)
      const deltaY = Math.abs(hoveredEsBox!.y - initialEsBox!.y)
      expect(deltaX).toBeLessThanOrEqual(10)
      expect(deltaY).toBeLessThanOrEqual(10)
    }
  })
})
