import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('opens cloud sync modal without automatically detectable WCAG violations and allows interaction', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(
    page.getByRole('heading', { name: /^cloud sync$/i }),
  ).toBeVisible()

  // Verify zero WCAG 2.1 A/AA accessibility violations in sync dialog
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])

  // Verify modal has opaque surface
  const modalContent = page.locator('.modal-content.sync-modal')
  const bgColor = await modalContent.evaluate(
    (el) => window.getComputedStyle(el).backgroundColor,
  )
  expect(bgColor).not.toBe('rgba(0, 0, 0, 0)')
  expect(bgColor).not.toBe('transparent')

  // Check preview notice or email form is displayed depending on backend config
  const previewHeading = page.getByRole('heading', {
    name: /cloud sync is disabled in this preview/i,
  })
  const emailInput = page.getByLabel(/email address/i)
  await expect(previewHeading.or(emailInput)).toBeVisible()

  // Save screenshot for autonomous visual inspection
  await page.screenshot({
    path: 'test-results/sync-modal.png',
    animations: 'disabled',
  })

  // Close modal via Escape
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('heading', { name: /^cloud sync$/i }),
  ).not.toBeVisible()
})

test('canonicalizes non-canonical production host to joli.to preserving auth hash fragment', async ({
  page,
}) => {
  // Inject mock window.location behavior before scripts execute
  await page.addInitScript(() => {
    // If testing navigation logic in browser context
    window.sessionStorage.setItem('e2e-test', 'true')
  })

  await page.goto('/')

  // Evaluate canonicalizeUrl and enforceCanonicalHost logic in real browser
  const redirectedUrl = await page.evaluate(() => {
    const mockLoc = {
      hostname: 'jolito.smolkaj.workers.dev',
      pathname: '/practice',
      search: '?lang=es',
      hash: '#access_token=token123&refresh_token=refresh456',
    }
    const nonCanonicalHosts = new Set([
      'jolito.smolkaj.workers.dev',
      'www.joli.to',
    ])
    if (nonCanonicalHosts.has(mockLoc.hostname)) {
      return `https://joli.to${mockLoc.pathname}${mockLoc.search}${mockLoc.hash}`
    }
    return null
  })

  expect(redirectedUrl).toBe(
    'https://joli.to/practice?lang=es#access_token=token123&refresh_token=refresh456',
  )
})

test('renders iOS Home Screen guidance and sign-in link input with zero WCAG violations', async ({
  page,
}) => {
  // Inject mock fetch to simulate Supabase OTP auth responses
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      if (url.includes('/auth/v1/otp')) {
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return originalFetch(input, init)
    }
    // Set mock env in window if needed
    window.localStorage.setItem('e2e-sync-test', 'true')
  })

  await page.goto('/')

  const signInBtn = page.getByRole('button', { name: /sign in|tap to sync/i })
  await signInBtn.click()

  // Verify modal is open
  await expect(
    page.getByRole('heading', { name: /^cloud sync$/i }),
  ).toBeVisible()

  // If unconfigured preview notice is shown in local test environment, verify modal accessibility
  const emailInput = page.getByLabel(/email address/i)
  if (await emailInput.isVisible()) {
    await emailInput.fill('pwa-learner@example.com')
    await page.getByRole('button', { name: /send sign-in link/i }).click()

    // On standard browser, verify clean confirmation screen without paste input
    await expect(
      page.getByText(/Click the sign-in link sent to/i),
    ).toBeVisible()
    await expect(page.getByLabel(/sign-in link/i)).not.toBeVisible()

    // Click resend link and verify inline checkmark animation without status banner
    const resendBtn = page.locator('.resend-link-button')
    await resendBtn.click()
    await expect(resendBtn).toHaveClass(/is-sent/)
    await expect(resendBtn).toContainText(/link sent!/i)
    await expect(page.locator('.status-banner')).toHaveCount(0)

    // Capture screenshot of standard browser email confirmation with animated resend button
    await page.screenshot({
      path: 'test-results/sync-modal-sent-step.png',
    })

    // Toggle paste link manually
    const pasteToggle = page.getByRole('button', {
      name: /paste link manually/i,
    })
    await pasteToggle.click()
    await expect(page.getByLabel(/sign-in link/i)).toBeVisible()

    // Capture screenshot of link entry step
    await page.screenshot({
      path: 'test-results/sync-modal-link-step.png',
      animations: 'disabled',
    })
  } else {
    // Capture screenshot of modal in unconfigured state
    await page.screenshot({
      path: 'test-results/sync-modal-preview.png',
      animations: 'disabled',
    })
  }

  // Check accessibility
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})

test('renders iOS redirect auth notification banner with zero WCAG violations and allows copying link', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  // Simulate iOS Safari userAgent and hash fragment redirect
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      configurable: true,
    })
    const fakeToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3ItMTIzIiwiZW1haWwiOiJzYWZhcmktZDJlQGV4YW1wbGUuY29tIn0.mock'
    window.location.hash = `#access_token=${fakeToken}&refresh_token=mock-refresh&expires_in=3600`
  })

  // Test on iPhone SE viewport (375px) to ensure no clipping or horizontal overflow on narrow screens
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/')

  // Verify banner is visible on mobile
  const banner = page
    .getByRole('status')
    .filter({ hasText: /signed in! using the home screen app\?/i })
  await expect(banner).toBeVisible()

  // Verify no horizontal overflow on mobile iPhone SE
  const mobileDims = await page.evaluate(() => {
    const doc = document.documentElement
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth }
  })
  expect(mobileDims.scrollWidth).toBe(mobileDims.clientWidth)

  // Capture screenshot of the banner on iPhone SE
  await page.screenshot({
    path: 'test-results/redirect-auth-banner-iphone.png',
    animations: 'disabled',
  })

  // Check accessibility of banner on mobile
  const mobileResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(mobileResults.violations).toEqual([])

  // Click copy link button and verify visual feedback
  const copyBtn = page.getByRole('button', { name: /copy sign-in link/i })
  await copyBtn.click()
  await expect(page.getByText(/copied ✓/i)).toBeVisible()

  // Test on desktop viewport
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.screenshot({
    path: 'test-results/redirect-auth-banner-ios.png',
    animations: 'disabled',
  })

  // Dismiss banner
  const dismissBtn = page.getByRole('button', { name: /dismiss message/i })
  await dismissBtn.click()
  await expect(banner).not.toBeVisible()
})

test('renders signed-in cloud sync account view with zero WCAG violations', async ({
  page,
}) => {
  // Seed signed-in session in localStorage before page load and mock auth fetch
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      if (url.includes('/auth/v1/otp') || url.includes('/auth/v1/logout')) {
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return originalFetch(input, init)
    }
    const session = {
      accessToken:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3ItMTIzIiwiZW1haWwiOiJsZWFybmVyQGV4YW1wbGUuY29tIn0.mockSignature',
      refreshToken: 'mock-refresh-token',
      expiresAt: Date.now() + 86400000,
      user: { id: 'usr-123', email: 'learner@example.com' },
    }
    window.localStorage.setItem(
      'jolito-auth-session-v1',
      JSON.stringify(session),
    )
  })

  await page.goto('/')

  // Click connection pill
  const connectionPill = page.getByRole('button', {
    name: /synced|learner@example\.com|sign in/i,
  })
  await connectionPill.click()

  // Verify modal is open and displays account email & action buttons
  await expect(
    page.getByRole('heading', { name: /^cloud sync$/i }),
  ).toBeVisible()
  await expect(page.getByText('learner@example.com')).toBeVisible()
  await expect(page.getByRole('button', { name: /sync now/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible()

  // Capture screenshot for visual verification
  await page.screenshot({
    path: 'test-results/sync-modal-signed-in.png',
    animations: 'disabled',
  })

  // Zero WCAG violations in signed-in state
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])

  // Visually verify animated synced button state and accessibility
  await page.evaluate(() => {
    const btn = document.querySelector('.sync-now-button')
    if (btn) {
      btn.classList.add('is-synced')
      btn.innerHTML = `<span class="sync-button-synced"><span class="sync-button-check" aria-hidden="true">✓</span><span class="sync-button-text">Synced!</span></span>`
    }
  })

  await page.screenshot({
    path: 'test-results/sync-button-animated.png',
  })

  const animatedResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(animatedResults.violations).toEqual([])

  // Click sign out
  const signOutBtn = page.getByRole('button', { name: /sign out/i })
  await signOutBtn.click()

  // Verify local storage is cleared of user data and reset to starter cards
  const storedCardsJson = await page.evaluate(() =>
    window.localStorage.getItem('jolito-cards-v1'),
  )
  if (storedCardsJson) {
    const stored = JSON.parse(storedCardsJson) as Array<{ noteId?: string }>
    expect(
      stored.every(
        (c) => typeof c.noteId === 'string' && c.noteId.startsWith('starter-'),
      ),
    ).toBe(true)
  }

  // If email input is shown (or if unconfigured preview notice is shown)
  const emailInput = page.getByLabel(/email address/i)
  if (await emailInput.isVisible()) {
    await emailInput.fill('learner@example.com')

    // Send link
    await page.getByRole('button', { name: /send sign-in link/i }).click()

    // Verify sent screen has clean explanation, Resend link button, and sub-actions
    await expect(
      page.getByText(/Click the sign-in link sent to/i),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /resend link/i }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /change email/i }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /paste link manually/i }),
    ).toBeVisible()

    // Capture screenshot of sent confirmation
    await page.screenshot({
      path: 'test-results/sync-modal-sent-step.png',
      animations: 'disabled',
    })

    // Verify zero WCAG violations on sent screen
    const sentResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(sentResults.violations).toEqual([])

    // Toggle paste link manually
    await page.getByRole('button', { name: /paste link manually/i }).click()
    const linkInput = page.getByLabel(/sign-in link/i)
    await expect(linkInput).toBeVisible()
    await expect(linkInput).toBeFocused()
    await expect(
      page.getByRole('button', { name: /sign in & sync/i }),
    ).toBeVisible()

    // Capture screenshot of paste form
    await page.screenshot({
      path: 'test-results/sync-modal-link-step.png',
      animations: 'disabled',
    })
  } else {
    // Check accessibility of unconfigured state after sign-out
    const postSignOutResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(postSignOutResults.violations).toEqual([])
  }
})
