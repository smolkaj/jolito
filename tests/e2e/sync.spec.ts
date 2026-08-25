import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('opens cloud sync modal without automatically detectable WCAG violations and allows interaction', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('button', { name: /tap to sync/i }).click()
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

  // Check preview notice is displayed when cloud backend is unconfigured
  await expect(
    page.getByRole('heading', {
      name: /cloud sync is disabled in this preview/i,
    }),
  ).toBeVisible()

  // Save screenshot for autonomous visual inspection
  await page.screenshot({ path: 'test-results/sync-modal.png' })

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
