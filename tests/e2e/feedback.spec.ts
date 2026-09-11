import { expect, test } from '@playwright/test'
import { auditAccessibility } from './accessibility'

test.describe('Feedback modal & submission', () => {
  test('opens feedback modal, verifies zero WCAG violations, and submits note successfully', async ({
    page,
  }) => {
    // Route mock Supabase URL when running under standalone mock preview harness
    await page.route('https://mock.supabase.co/rest/v1/feedback', (route) => {
      void route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: '',
      })
    })

    await page.goto('/')

    const feedbackBtn = page.getByRole('button', { name: /^feedback$/i })
    await expect(feedbackBtn).toBeVisible()
    await feedbackBtn.click()

    const modalTitle = page.getByRole('heading', { name: /share feedback/i })
    await expect(modalTitle).toBeVisible()

    // 1. Verify zero WCAG accessibility violations on initial feedback modal
    const initialAxeResults = await auditAccessibility(page)
    expect(initialAxeResults.violations).toEqual([])

    // Capture visual snapshot of the feedback modal form
    await page.screenshot({
      path: 'test-results/feedback-modal-form.png',
      animations: 'disabled',
    })

    const textarea = page.getByPlaceholder(/what’s on your mind\?/i)
    await expect(textarea).toBeFocused()

    const note = `Jolito feedback test ${Date.now()}: Mexican Spanish phrases are delightful!`
    await textarea.fill(note)

    const submitBtn = page.getByRole('button', { name: /send feedback/i })
    await expect(submitBtn).toBeEnabled()
    await submitBtn.click()

    // 2. Verify success screen appears
    const successTitle = page.getByRole('heading', {
      name: /¡muchas gracias!/i,
    })
    await expect(successTitle).toBeVisible()
    await expect(page.getByText(/your note has been received\./i)).toBeVisible()

    // 3. Verify zero WCAG accessibility violations on success screen
    const successAxeResults = await auditAccessibility(page)
    expect(successAxeResults.violations).toEqual([])

    // Capture visual snapshot of the success screen
    await page.screenshot({
      path: 'test-results/feedback-modal-success.png',
      animations: 'disabled',
    })

    // 4. Click Done to dismiss
    const doneBtn = page.getByRole('button', { name: /done/i })
    await doneBtn.click()
    await expect(successTitle).not.toBeVisible()
  })

  test('displays accessible error banner when submission encounters backend failure', async ({
    page,
  }) => {
    // Intercept feedback endpoint to simulate a backend error (e.g. unapplied migration 404 or 500)
    await page.route('**/rest/v1/feedback', (route) => {
      void route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          code: '500',
          message: 'Internal server error processing feedback',
        }),
      })
    })

    await page.goto('/')

    await page.getByRole('button', { name: /^feedback$/i }).click()
    const textarea = page.getByPlaceholder(/what’s on your mind\?/i)
    await textarea.fill('Testing error handling')

    await page.getByRole('button', { name: /send feedback/i }).click()

    // Verify error banner is visible with role="alert"
    const errorBanner = page.locator('.feedback-error-banner')
    await expect(errorBanner).toBeVisible()
    await expect(errorBanner).toHaveAttribute('role', 'alert')
    await expect(errorBanner).toContainText(
      /internal server error processing feedback/i,
    )

    // Verify WCAG accessibility of modal with error banner
    const errorAxeResults = await auditAccessibility(page)
    expect(errorAxeResults.violations).toEqual([])

    // Capture visual snapshot of error banner
    await page.screenshot({
      path: 'test-results/feedback-modal-error.png',
      animations: 'disabled',
    })

    // Escape closes the modal
    await page.keyboard.press('Escape')
    await expect(errorBanner).not.toBeVisible()
  })

  test('preserves consistent vertical baseline and right alignment of Feedback button across home, deck, and app views', async ({
    page,
  }) => {
    // 1. Verify desktop alignment parity across all standard views
    await page.setViewportSize({ width: 1280, height: 800 })

    const desktopViews = [
      { name: 'home', path: '/' },
      { name: 'deck', path: '/#/deck' },
      { name: 'complete', path: '/#/complete' },
      { name: 'grammar', path: '/#/grammar' },
    ]

    const desktopMeasurements: Array<{
      name: string
      bottomOffset: number
      rightOffset: number
    }> = []

    for (const view of desktopViews) {
      await page.goto(view.path)
      const feedbackBtn = page
        .locator('.app-footer')
        .getByRole('button', { name: /^feedback$/i })
      await expect(feedbackBtn).toBeVisible()

      const box = await feedbackBtn.boundingBox()
      expect(box).not.toBeNull()

      desktopMeasurements.push({
        name: view.name,
        bottomOffset: 800 - (box!.y + box!.height),
        rightOffset: 1280 - (box!.x + box!.width),
      })
    }

    const firstDesktop = desktopMeasurements[0]
    expect(firstDesktop).toBeDefined()
    if (!firstDesktop) return

    for (const m of desktopMeasurements.slice(1)) {
      // Allow at most 1px subpixel variation across flex and grid baseline rendering
      expect(
        Math.abs(m.bottomOffset - firstDesktop.bottomOffset),
        `Vertical bottom offset mismatch between home (${firstDesktop.bottomOffset}px) and ${m.name} (${m.bottomOffset}px)`,
      ).toBeLessThanOrEqual(1)

      expect(
        Math.abs(m.rightOffset - firstDesktop.rightOffset),
        `Right offset mismatch between home (${firstDesktop.rightOffset}px) and ${m.name} (${m.rightOffset}px)`,
      ).toBeLessThanOrEqual(1)
    }

    // 2. Verify mobile alignment parity across views
    await page.setViewportSize({ width: 390, height: 844 })

    const mobileViews = [
      { name: 'home', path: '/' },
      { name: 'deck', path: '/#/deck' },
      { name: 'complete', path: '/#/complete' },
      { name: 'grammar', path: '/#/grammar' },
    ]

    const mobileMeasurements: Array<{
      name: string
      bottomOffset: number
      rightOffset: number
    }> = []

    for (const view of mobileViews) {
      await page.goto(view.path)
      const feedbackBtn = page
        .locator('.app-footer')
        .getByRole('button', { name: /^feedback$/i })
      await expect(feedbackBtn).toBeVisible()

      const box = await feedbackBtn.boundingBox()
      expect(box).not.toBeNull()

      mobileMeasurements.push({
        name: view.name,
        bottomOffset: 844 - (box!.y + box!.height),
        rightOffset: 390 - (box!.x + box!.width),
      })
    }

    const firstMobile = mobileMeasurements[0]
    expect(firstMobile).toBeDefined()
    if (!firstMobile) return

    for (const m of mobileMeasurements.slice(1)) {
      expect(
        Math.abs(m.bottomOffset - firstMobile.bottomOffset),
        `Mobile bottom offset mismatch between home (${firstMobile.bottomOffset}px) and ${m.name} (${m.bottomOffset}px)`,
      ).toBeLessThanOrEqual(1)

      expect(
        Math.abs(m.rightOffset - firstMobile.rightOffset),
        `Mobile right offset mismatch between home (${firstMobile.rightOffset}px) and ${m.name} (${m.rightOffset}px)`,
      ).toBeLessThanOrEqual(1)
    }
  })
})
