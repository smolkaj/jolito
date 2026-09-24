import { expect, test, type Page, type Locator } from '@playwright/test'
import { createStudyCards } from '../../src/domain/card'
import { auditAccessibility, settleAnimations } from './accessibility'

async function expectAppearance(page: Page, scheme: 'light' | 'dark') {
  await expect(page.locator('html')).toHaveCSS('color-scheme', scheme)
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    scheme === 'dark' ? 'rgb(13, 19, 16)' : 'rgb(253, 245, 248)',
  )
  const browserColor = await page.evaluate(
    () =>
      [
        ...document.querySelectorAll<HTMLMetaElement>(
          'meta[name="theme-color"]',
        ),
      ].find((meta) => !meta.media || matchMedia(meta.media).matches)?.content,
  )
  expect(browserColor).toBe(scheme === 'dark' ? '#0d1310' : '#fdf5f8')
}

for (const colorScheme of ['light', 'dark'] as const) {
  for (const width of [393, 1280]) {
    for (const [name, route] of [
      ['welcome', '/'],
      ['create', '/#/create'],
      ['deck-dialog', '/#/deck'],
      ['grammar', '/#/grammar'],
      ['practice', '/#/study'],
    ] as const) {
      test(`${colorScheme} ${name} is accessible at ${width}px`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width, height: 852 })
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
        await page.goto(route)
        await expect(page.locator('main')).toBeVisible()
        await expectAppearance(page, colorScheme)
        expect((await auditAccessibility(page)).violations).toEqual([])
        await page.screenshot({
          path: testInfo.outputPath(`${name}.png`),
          fullPage: true,
        })
        if (name === 'create') {
          const reverse = page.getByRole('checkbox', {
            name: /practice both directions/i,
          })
          await reverse.focus()
          await reverse.press('Space')
          await expect(reverse).not.toBeChecked()
          expect((await auditAccessibility(page)).violations).toEqual([])
          await page.screenshot({
            path: testInfo.outputPath('one-direction.png'),
            fullPage: true,
          })
          await reverse.press('Space')
          await expect(reverse).toBeChecked()

          await page
            .getByLabel('Mexican Spanish', { exact: true })
            .fill('ahorita')
          await expect(page.locator('.suggestions-container')).toBeVisible()
          expect((await auditAccessibility(page)).violations).toEqual([])
          await page.screenshot({
            path: testInfo.outputPath('suggestions.png'),
            fullPage: true,
          })
        }
        if (name === 'deck-dialog') {
          await page.getByRole('button', { name: /explore demo deck/i }).click()
          expect((await auditAccessibility(page)).violations).toEqual([])
          await page.screenshot({
            path: testInfo.outputPath('deck.png'),
            fullPage: true,
          })
        }
        if (name === 'practice') {
          await page.getByRole('textbox').fill('something else')
          await page.getByRole('textbox').press('Enter')
          await expect(page.locator('.grade-buttons')).toBeVisible()
          expect((await auditAccessibility(page)).violations).toEqual([])
          for (const button of await page
            .locator('.grade-buttons button')
            .all()) {
            await button.hover()
            expect((await auditAccessibility(page)).violations).toEqual([])
          }
          await page.screenshot({
            path: testInfo.outputPath('feedback.png'),
            fullPage: true,
          })
        }
      })
    }
  }
}

test('device appearance changes round-trip without interrupting recall, grading, or form drafts', async ({
  page,
}) => {
  const cards = createStudyCards(
    {
      spanish: 'el aguacate',
      english: 'avocado',
      context: '',
      bidirectional: false,
    },
    'appearance',
    0,
  )
  await page.addInitScript(
    (cards) =>
      localStorage.setItem(
        'jolito-library-v1',
        JSON.stringify({ version: 3, cards }),
      ),
    cards,
  )
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/#/study')
  const input = page.getByRole('textbox')
  await input.fill('avokado')
  for (const colorScheme of ['dark', 'light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    await expectAppearance(page, colorScheme)
    await expect(input).toHaveValue('avokado')
    await expect(input).toBeFocused()
  }
  await input.press('Enter')
  const feedback = page.getByLabel('Answer comparison')
  const answer = await feedback.textContent()
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    await expectAppearance(page, colorScheme)
    await expect(feedback).toHaveText(answer!)
    await expect(page.locator('.grade-buttons')).toBeVisible()
  }
  await page.keyboard.press('4')
  await expect(page.getByRole('heading', { name: '¡Hecho!' })).toBeVisible()
  expect((await auditAccessibility(page)).violations).toEqual([])
  await page.goto('/#/create')
  const spanish = page.getByLabel('Mexican Spanish', { exact: true })
  await spanish.fill('buenas noches')
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    await expectAppearance(page, colorScheme)
    await expect(spanish).toHaveValue('buenas noches')
  }
})

for (const colorScheme of ['light', 'dark'] as const) {
  test(`${colorScheme} sample cards and practice menu remain legible on interaction`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 852 })
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
    await page.goto('/')
    for (const card of await page.locator('.hero-visual .sample-card').all()) {
      await card.hover({ position: { x: 80, y: 35 } })
      expect((await auditAccessibility(page)).violations).toEqual([])
    }
    await page.getByRole('button', { name: 'Practice', exact: true }).click()
    expect((await auditAccessibility(page)).violations).toEqual([])
  })
  for (const { name, route, trigger } of [
    { name: 'feedback', route: '/', trigger: /^feedback$/i },
    { name: 'sign-in', route: '/', trigger: /sign in/i },
    { name: 'starter-packs', route: '/#/deck', trigger: /^starter packs$/i },
    { name: 'backup', route: '/#/deck', trigger: /backup & import/i },
  ]) {
    test(`${colorScheme} ${name} dialog remains legible`, async ({
      page,
    }, testInfo) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      await page.goto(route)
      if (route === '/#/deck') {
        await page.getByRole('button', { name: /explore demo deck/i }).click()
      }
      await page.getByRole('button', { name: trigger }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      expect((await auditAccessibility(page)).violations).toEqual([])
      await page.screenshot({
        path: testInfo.outputPath(`${name}.png`),
        fullPage: true,
      })
    })
  }
}

test('dark keyboard toolbar survives open, close, and reopen with readable keys', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.goto('/#/grammar')
  await page.getByRole('button', { name: 'Start practice' }).click()
  for (let cycle = 0; cycle < 2; cycle++) {
    await page.getByRole('textbox').focus()
    await page.evaluate(() =>
      window.dispatchEvent(
        new CustomEvent('keyboardWillShow', {
          detail: { keyboardHeight: 300 },
        }),
      ),
    )
    const toolbar = page.locator('.answer-accents.is-docked')
    await expect(toolbar).toBeVisible()
    expect((await auditAccessibility(page)).violations).toEqual([])
    await page.screenshot({
      path: testInfo.outputPath(`keyboard-${cycle}.png`),
      fullPage: true,
    })
    await page.evaluate(() =>
      window.dispatchEvent(new Event('keyboardWillHide')),
    )
    await expect(toolbar).toBeHidden()
  }
})

test('the first paint follows device appearance even before JavaScript runs', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    colorScheme: 'dark',
  })
  try {
    const page = await context.newPage()
    await page.goto(baseURL!)
    await expectAppearance(page, 'dark')
    await page.emulateMedia({ colorScheme: 'light' })
    await expectAppearance(page, 'light')
  } finally {
    await context.close()
  }
})

// Axe does not audit the contrast of CSS focus outlines. Measure the ring
// against its surrounding opaque surface, rather than against button text.
async function focusContrast(locator: Locator) {
  await locator.focus()
  await settleAnimations(locator.page())
  return locator.evaluate((element) => {
    const style = getComputedStyle(element)
    let surrounding = element.parentElement!
    while (
      getComputedStyle(surrounding).backgroundColor === 'rgba(0, 0, 0, 0)'
    ) {
      surrounding = surrounding.parentElement!
    }
    function luminance(color: string) {
      const rgb = color
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number)
      const linear = rgb.map((channel) => {
        const value = channel / 255
        return value <= 0.04045
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4
      })
      return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722
    }
    const ring = luminance(style.outlineColor)
    const background = luminance(getComputedStyle(surrounding).backgroundColor)
    return {
      visible:
        element.matches(':focus-visible') &&
        parseFloat(style.outlineWidth) >= 2 &&
        style.outlineStyle !== 'none',
      ratio:
        (Math.max(ring, background) + 0.05) /
        (Math.min(ring, background) + 0.05),
    }
  })
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`${colorScheme} focus indicators contrast with canvas, cards, and dialogs`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 852 })
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
    await page.goto('/')
    await page.keyboard.press('Tab')
    for (const selector of [
      '.sample-card-es',
      '.sample-card-en',
      '.hero-actions .primary-button',
    ]) {
      const focus = await focusContrast(page.locator(selector))
      expect(focus.visible, selector).toBe(true)
      expect(focus.ratio, selector).toBeGreaterThanOrEqual(3)
    }
    await page.goto('/#/deck')
    await page.getByRole('button', { name: /explore demo deck/i }).click()
    await page.getByRole('button', { name: /^starter packs$/i }).click()
    await page
      .getByRole('button', { name: /inspect mexican street phrases/i })
      .click()
    await page.keyboard.press('Tab')
    for (const selector of [
      '.starter-pack-inspect-list',
      '.inspect-item-add-btn:not(:disabled)',
    ]) {
      const focus = await focusContrast(page.locator(selector).first())
      expect(focus.visible, selector).toBe(true)
      expect(focus.ratio, selector).toBeGreaterThanOrEqual(3)
    }
    await page.screenshot({
      path: testInfo.outputPath('focused-starter-pack.png'),
      fullPage: true,
    })
  })
}
