import { expect, test } from '@playwright/test'
import { auditAccessibility } from './accessibility'

// Safari's retracting browser chrome is outside Playwright's emulation. Keep
// snapping off the root viewport (WebKit bug 245722), and exercise the actual
// scroll owner across round trips and viewport interruptions in both engines.
test('welcome owns snapping through navigation, resize, keyboard input and teardown', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  const welcome = page.getByRole('main')
  const why = page.locator('#why-jolito')
  const cue = page.getByRole('link', {
    name: /scroll down to explore why jolito/i,
  })
  const start = page.getByRole('button', { name: /^start learning/i })
  const scrollTop = () => welcome.evaluate((element) => element.scrollTop)
  const atTop = async () => {
    await expect.poll(scrollTop).toBeLessThanOrEqual(1)
    await expect(cue).toBeInViewport()
  }
  const atWhy = async () => {
    await expect
      .poll(() =>
        why.evaluate((element) =>
          Math.abs(element.getBoundingClientRect().top),
        ),
      )
      .toBeLessThanOrEqual(1)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  }

  // This invariant catches the original root-scroller implementation even on
  // desktop WebKit, which cannot reproduce Safari's browser-chrome defect.
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollSnapType,
    ),
  ).toBe('none')
  await expect(welcome).toHaveCSS('overflow-y', 'auto')
  await expect(welcome).toHaveCSS('scroll-snap-type', 'y mandatory')
  await atTop()
  await page.screenshot({ path: testInfo.outputPath('welcome.png') })
  await cue.click()
  await atWhy()
  await page.screenshot({ path: testInfo.outputPath('why.png') })

  // Interrupt a return trip with a viewport change, then complete another trip.
  await start.click()
  await page.setViewportSize({ width: 393, height: 680 })
  await atTop()
  await cue.click()
  await atWhy()
  await page.setViewportSize({ width: 393, height: 852 })
  await atWhy()
  await start.click()
  await atTop()

  // Native scrolling must use the same container as the buttons. Keyboard
  // input is supported by both engines, unlike Playwright's touch-swipe API.
  await welcome.focus()
  await page.keyboard.press('End')
  await expect(start).toBeInViewport()
  await page.keyboard.press('Home')
  await atTop()
  await cue.click()
  await atWhy()
  await page.goBack()
  await atTop()
  await page.goForward()
  await atWhy()
  expect((await auditAccessibility(page)).violations).toEqual([])

  // Leaving the welcome screen removes its scroll owner and snap behavior.
  await start.click()
  await atTop()
  await page.getByRole('button', { name: /^create a card$/i }).click()
  await expect(page.locator('.welcome-page')).toHaveCount(0)
  await page.setViewportSize({ width: 852, height: 393 })
  await page.setViewportSize({ width: 393, height: 852 })
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollSnapType,
    ),
  ).toBe('none')
  await expect(
    page.getByRole('combobox', { name: /mexican spanish/i }),
  ).toBeVisible()
})

test('direct links and reduced motion preserve welcome round trips', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/why-jolito')
  const welcome = page.getByRole('main')
  await expect(welcome).toHaveCSS('scroll-behavior', 'auto')
  await expect
    .poll(() => welcome.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(100)
  await page.getByRole('button', { name: /^start learning/i }).click()
  await expect
    .poll(() => welcome.evaluate((element) => element.scrollTop))
    .toBe(0)
  await page
    .getByRole('link', { name: /scroll down to explore why jolito/i })
    .click()
  await expect
    .poll(() => welcome.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(100)
})
