import { auditAccessibility } from './accessibility'
import { expect, test } from '@playwright/test'

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 393, height: 852 },
  { width: 320, height: 568 },
]) {
  test(`grammar is clear, accessible and keyboard-operable at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await page.getByRole('link', { name: 'Practice grammar' }).click()
    await expect(
      page.getByRole('heading', { name: 'Make the past click.' }),
    ).toBeVisible()
    await page.screenshot({
      path: `test-results/grammar-${viewport.width}-home.png`,
      fullPage: true,
    })
    expect((await auditAccessibility(page)).violations).toEqual([])
    await page.getByRole('button', { name: 'Practice pretérito' }).click()
    const input = page.getByRole('textbox', { name: 'Your conjugation' })
    await expect(input).toBeFocused()
    for (const button of await page.locator('.grammar-accents button').all()) {
      const box = await button.boundingBox()
      expect(box!.width).toBeGreaterThanOrEqual(44)
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
    const check = page.getByRole('button', { name: 'Check' })
    const cardBox = (await page.locator('.grammar-study').boundingBox())!
    for (const state of ['rest', 'hover', 'pressed']) {
      if (state === 'hover') await check.hover()
      if (state === 'pressed') await page.mouse.down()
      const box = (await check.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(cardBox.x)
      expect(box.y).toBeGreaterThanOrEqual(cardBox.y)
      expect(box.x + box.width).toBeLessThanOrEqual(cardBox.x + cardBox.width)
      expect(box.y + box.height).toBeLessThanOrEqual(cardBox.y + cardBox.height)
      if (state === 'pressed') {
        await page.mouse.move(0, 0)
        await page.mouse.up()
      }
    }
    await input.fill('habl')
    await page.getByRole('button', { name: 'Insert é' }).click()
    await expect(input).toHaveValue('hablé')
    await expect(input).toBeFocused()
    await page.screenshot({
      path: `test-results/grammar-${viewport.width}-answer.png`,
      fullPage: true,
    })
    await input.press('Enter')
    await expect(page.getByRole('status')).toHaveText('That’s it.')
    await page.screenshot({
      path: `test-results/grammar-${viewport.width}-reveal.png`,
      fullPage: true,
    })
    expect((await auditAccessibility(page)).violations).toEqual([])
    await page.keyboard.press('1')
    for (let index = 0; index < 5; index++) {
      await page.getByRole('textbox').press('Enter')
      await page.keyboard.press('4')
    }
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'El sábado yo',
    )
    for (let index = 0; index < 3; index++) {
      await page.getByRole('textbox').press('Enter')
      await page.keyboard.press('4')
    }
    await expect(
      page.getByRole('heading', { name: 'A little more natural.' }),
    ).toBeVisible()
    await page.screenshot({
      path: `test-results/grammar-${viewport.width}-complete.png`,
      fullPage: true,
    })
    await page.getByRole('button', { name: 'Back to vocabulary' }).click()
    await page.getByRole('button', { name: 'Practice', exact: true }).click()
    await expect(
      page.getByRole('textbox', { name: 'Your answer' }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })
}

test('grammar survives offline reload and never leaks into the vocabulary library', async ({
  page,
  context,
}) => {
  await page.goto('/#/grammar')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.getByRole('radio', { name: /Irregular stems/ }).check()
  await page.getByRole('button', { name: 'Practice pretérito' }).click()
  await page.getByRole('textbox').fill('tuve')
  await page.getByRole('textbox').press('Enter')
  await page.keyboard.press('4')
  await context.setOffline(true)
  await page.reload()
  await page.getByRole('radio', { name: /Irregular stems/ }).check()
  await page.getByRole('button', { name: 'Practice pretérito' }).click()
  await expect(page.getByRole('heading', { level: 1 })).not.toContainText(
    'Ayer yo … una idea.',
  )
  await page.getByRole('textbox').press('Enter')
  await page.keyboard.press('4')
  await page.getByRole('button', { name: 'Vocabulary', exact: true }).click()
  await page.getByRole('button', { name: 'Manage deck' }).click()
  await expect(page.getByRole('main')).not.toContainText('tener · yo')
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('jolito-library-v1')!) as {
        version: number
        cards: { grammar?: unknown }[]
      },
  )
  expect(saved.version).toBe(2)
  expect(saved.cards.filter((card) => card.grammar)).toHaveLength(2)
})
