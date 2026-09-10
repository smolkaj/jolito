import { expect, test } from '@playwright/test'
import { auditAccessibility, settleAnimations } from './accessibility'

for (const width of [320, 393, 768, 1024, 1280]) {
  test(`perfecto remains coherent through setup, recall, completion and offline reload at ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: width > 600 ? 900 : 852 })
    await page.goto('/#/grammar')
    await page.getByRole('combobox', { name: 'Tense' }).selectOption('perfect')
    await expect(
      page.getByRole('radio', { name: 'All patterns' }),
    ).toBeChecked()
    await expect(page.getByRole('radio')).toHaveCount(4)
    expect((await auditAccessibility(page)).violations).toEqual([])
    await page.screenshot({
      path: `test-results/perfect-${width}-setup.png`,
      fullPage: true,
    })
    await page.getByRole('button', { name: 'New round' }).click()
    await page.getByRole('textbox').fill('he habla')
    await page.getByRole('button', { name: 'Grammar', exact: true }).click()
    await page
      .getByRole('combobox', { name: 'Tense' })
      .selectOption('preterite')
    await expect(
      page.getByRole('button', { name: 'Resume round' }),
    ).toHaveCount(0)
    await page.getByRole('combobox', { name: 'Tense' }).selectOption('perfect')
    await page.getByRole('button', { name: 'Resume round' }).click()
    await expect(page.getByRole('textbox')).toHaveValue('he habla')
    await page.getByRole('textbox').press('Enter')
    await expect(page.locator('.expected-row')).toContainText('he hablado')
    for (const text of await page.locator('.diff-text').all()) {
      await expect(text).toHaveAttribute('lang', 'es-MX')
    }
    expect((await auditAccessibility(page)).violations).toEqual([])
    await page.screenshot({
      path: `test-results/perfect-${width}-correction.png`,
      fullPage: true,
    })
    await page.keyboard.press('4')
    for (let index = 1; index < 8; index++) {
      await page.getByRole('textbox').press('Enter')
      await page.keyboard.press('4')
    }
    await expect(page.getByRole('heading', { name: '¡Hecho!' })).toBeVisible()
    expect((await auditAccessibility(page)).violations).toEqual([])
    await settleAnimations(page)
    await page.screenshot({
      path: `test-results/perfect-${width}-complete.png`,
      fullPage: true,
    })
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await context.setOffline(true)
    await page.reload()
    await page.getByRole('combobox', { name: 'Tense' }).selectOption('perfect')
    await page.getByRole('button', { name: 'New round' }).click()
    await expect(page.getByRole('heading', { level: 1 })).not.toContainText(
      'Últimamente yo … mucho con la vecina.',
    )
    const saved = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('jolito-library-v1')!) as {
          version: number
          cards: { grammar?: { topic: string } }[]
        },
    )
    expect(saved.version).toBe(3)
    expect(
      saved.cards.filter((card) => card.grammar?.topic === 'perfect'),
    ).toHaveLength(8)
    expect(
      saved.cards.filter((card) => card.grammar?.topic === 'preterite'),
    ).toHaveLength(0)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  })
}
