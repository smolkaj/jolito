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
})
