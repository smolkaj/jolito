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

test.describe('touch scroll round trips', () => {
  test.use({
    viewport: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true,
  })

  test('swipes reach the entire story and return to the hero after viewport changes', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'Playwright exposes touch dragging only through Chromium CDP; physical iOS swipes require device verification.',
    )
    const touch = await page.context().newCDPSession(page)
    const swipe = async (direction: 'up' | 'down') => {
      const startY = direction === 'up' ? 560 : 160
      const endY = direction === 'up' ? 160 : 560
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: 195, y: startY }],
      })
      for (let step = 1; step <= 12; step++) {
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: 195, y: startY + ((endY - startY) * step) / 12 }],
        })
        await page.waitForTimeout(16)
      }
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      })
      // Allow native momentum and snapping to settle before the next gesture.
      await page.waitForTimeout(500)
    }
    await page.goto('/')
    for (const height of [852, 680, 852]) {
      await page.setViewportSize({ width: 393, height })
      for (let gesture = 0; gesture < 3; gesture++) await swipe('up')
      await expect(
        page.getByRole('button', { name: /^start learning/i }),
      ).toBeInViewport({ ratio: 1 })
      for (let gesture = 0; gesture < 3; gesture++) await swipe('down')
      await expect
        .poll(() =>
          page.getByRole('main').evaluate((element) => element.scrollTop),
        )
        .toBeLessThanOrEqual(1)
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
    }
    await touch.detach()
  })
})
