import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

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
    const initialAxeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
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
    const successAxeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
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
    const errorAxeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
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
})
