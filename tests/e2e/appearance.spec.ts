import { expect, test, type Page } from '@playwright/test'
import { createStudyCards } from '../../src/domain/card'
import { auditAccessibility } from './accessibility'

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
    test(`${colorScheme} surfaces remain accessible across learning flows at ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 852 })
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      for (const [name, route] of [
        ['welcome', '/'],
        ['create', '/#/create'],
        ['deck-dialog', '/#/deck'],
        ['grammar', '/#/grammar'],
        ['practice', '/#/study'],
      ]) {
        await page.goto(route!)
        await expect(page.locator('main')).toBeVisible()
        await expectAppearance(page, colorScheme)
        expect((await auditAccessibility(page)).violations).toEqual([])
        await page.screenshot({
          path: testInfo.outputPath(`${name}.png`),
          fullPage: true,
        })
        if (name === 'create') {
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
      }
    })
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
  test(`${colorScheme} interactive surfaces and dialogs stay legible`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 852 })
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
    await page.goto('/')
    for (const card of await page.locator('.hero-visual .sample-card').all()) {
      await card.hover({ position: { x: 80, y: 35 } })
      expect((await auditAccessibility(page)).violations).toEqual([])
    }
    await page.getByRole('button', { name: 'Practice', exact: true }).click()
    expect((await auditAccessibility(page)).violations).toEqual([])
    await page.keyboard.press('Escape')
    for (const name of [/^feedback$/i, /sign in/i]) {
      await page.getByRole('button', { name }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      expect((await auditAccessibility(page)).violations).toEqual([])
      await page.screenshot({
        path: testInfo.outputPath(
          name.source.includes('feedback')
            ? 'feedback-dialog.png'
            : 'sign-in.png',
        ),
        fullPage: true,
      })
      await page.keyboard.press('Escape')
    }
    await page.goto('/#/deck')
    await page.getByRole('button', { name: /explore demo deck/i }).click()
    for (const name of [/starter packs/i, /backup & import/i]) {
      await page.getByRole('button', { name }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      expect((await auditAccessibility(page)).violations).toEqual([])
      await page.screenshot({
        path: testInfo.outputPath(
          name.source.includes('starter') ? 'starter-packs.png' : 'backup.png',
        ),
        fullPage: true,
      })
      await page.keyboard.press('Escape')
    }
  })
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
