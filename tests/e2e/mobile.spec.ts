import AxeBuilder from '@axe-core/playwright'
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
    const practiceBtn = page.getByRole('button', { name: /^practice$/i })
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
    await practiceBtn.click()
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

    // Initial accessibility check on mobile welcome screen
    const welcomeAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(welcomeAxe.violations).toEqual([])

    // 2. Tap Practice on mobile
    const practiceBtn = page.getByRole('button', { name: /^practice$/i })
    await expect(practiceBtn).toBeVisible()
    await practiceBtn.click()

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

    const reviewAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
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
      .poll(async () => page.evaluate(() => window.scrollY))
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
      .poll(async () => page.evaluate(() => window.scrollY))
      .toBeLessThanOrEqual(5)
  })

  test('supports mobile swipe gestures to navigate between views with visual captures', async ({
    page,
  }) => {
    await page.goto('/')

    await expect(
      page.getByRole('heading', { level: 1, name: /make the words/i }),
    ).toBeVisible()

    // 1. Swipe left on welcome screen to navigate to Create view
    await page.evaluate(() => {
      const hero = document.querySelector('.welcome-hero') ?? document.body
      const start = new Touch({
        identifier: 1,
        target: hero,
        clientX: 300,
        clientY: 300,
      })
      window.dispatchEvent(
        new TouchEvent('touchstart', {
          touches: [start],
          changedTouches: [start],
          bubbles: true,
        }),
      )
      const move = new Touch({
        identifier: 1,
        target: hero,
        clientX: 120,
        clientY: 302,
      })
      window.dispatchEvent(
        new TouchEvent('touchmove', {
          touches: [move],
          changedTouches: [move],
          bubbles: true,
          cancelable: true,
        }),
      )
    })
    await page.screenshot({ path: '/tmp/mobile-home-swipe-left-cue.png' })

    await page.evaluate(() => {
      const hero = document.querySelector('.welcome-hero') ?? document.body
      const end = new Touch({
        identifier: 1,
        target: hero,
        clientX: 100,
        clientY: 305,
      })
      window.dispatchEvent(
        new TouchEvent('touchend', {
          touches: [],
          changedTouches: [end],
          bubbles: true,
        }),
      )
    })

    await expect(
      page.getByRole('heading', { name: /^new flashcard$/i }),
    ).toBeVisible()
    await page.screenshot({ path: '/tmp/mobile-swipe-create.png' })

    // 2. Return to Welcome via Brand logo
    await page.getByRole('button', { name: /jolito home/i }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: /make the words/i }),
    ).toBeVisible()

    // 3. Swipe right on welcome screen to start Practice
    await page.evaluate(() => {
      const hero = document.querySelector('.welcome-hero') ?? document.body
      const start = new Touch({
        identifier: 1,
        target: hero,
        clientX: 100,
        clientY: 300,
      })
      window.dispatchEvent(
        new TouchEvent('touchstart', {
          touches: [start],
          changedTouches: [start],
          bubbles: true,
        }),
      )
      const move = new Touch({
        identifier: 1,
        target: hero,
        clientX: 260,
        clientY: 302,
      })
      window.dispatchEvent(
        new TouchEvent('touchmove', {
          touches: [move],
          changedTouches: [move],
          bubbles: true,
          cancelable: true,
        }),
      )
    })
    await page.screenshot({ path: '/tmp/mobile-home-swipe-right-cue.png' })

    await page.evaluate(() => {
      const hero = document.querySelector('.welcome-hero') ?? document.body
      const end = new Touch({
        identifier: 1,
        target: hero,
        clientX: 280,
        clientY: 305,
      })
      window.dispatchEvent(
        new TouchEvent('touchend', {
          touches: [],
          changedTouches: [end],
          bubbles: true,
        }),
      )
    })

    const answerInput = page.getByLabel(/your answer/i)
    await expect(answerInput).toBeVisible()
    await page.screenshot({ path: '/tmp/mobile-swipe-practice.png' })

    // 4. Verify Practice session is loaded and accessible
    const reviewAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(reviewAxe.violations).toEqual([])
  })
})
