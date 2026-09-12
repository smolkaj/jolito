import { currentDeckJson } from './storage'
import { expect, test } from '@playwright/test'
import { auditAccessibility, settleAnimations } from './accessibility'

for (const width of [320, 393, 768, 1024, 1280]) {
  test(`gerundio remains coherent through setup, recall, completion and offline reload at ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: width > 600 ? 900 : 852 })
    await page.goto('/#/grammar')
    await page.getByRole('combobox', { name: 'Tense' }).selectOption('gerund')
    await expect(
      page.getByRole('radio', { name: 'All patterns' }),
    ).toBeChecked()
    await expect(page.getByRole('radio')).toHaveCount(5)
    expect((await auditAccessibility(page)).violations).toEqual([])
    await page.screenshot({
      path: `test-results/gerund-${width}-setup.png`,
      fullPage: true,
    })
    await page.getByRole('button', { name: 'Start practice' }).click()
    await page.getByRole('textbox').fill('estoy habla')
    await page.getByRole('button', { name: 'Grammar', exact: true }).click()
    await page
      .getByRole('combobox', { name: 'Tense' })
      .selectOption('preterite')
    await expect(
      page.getByRole('button', { name: 'Resume practice' }),
    ).toHaveCount(0)
    await page.getByRole('combobox', { name: 'Tense' }).selectOption('gerund')
    await page.getByRole('button', { name: 'Resume practice' }).click()
    await expect(page.getByRole('textbox')).toHaveValue('estoy habla')
    await page.getByRole('textbox').press('Enter')
    await expect(page.locator('.expected-row')).toContainText('estoy hablando')
    const rule = page.locator('.expected-row .diff-rule')
    await expect(rule).toContainText(
      'Rule: Replace -ar with -ando and -er/-ir with -iendo.',
    )
    const ruleBounds = await rule.boundingBox()
    const answerBounds = await page
      .locator('.expected-row .diff-text')
      .boundingBox()
    const comparisonBounds = await page.locator('.diff-card').boundingBox()
    expect(ruleBounds!.y).toBeGreaterThanOrEqual(
      answerBounds!.y + answerBounds!.height,
    )
    expect(ruleBounds!.x).toBeCloseTo(answerBounds!.x, 0)
    expect(ruleBounds!.x + ruleBounds!.width).toBeLessThan(
      comparisonBounds!.x + comparisonBounds!.width,
    )
    expect(ruleBounds!.y + ruleBounds!.height).toBeLessThan(
      comparisonBounds!.y + comparisonBounds!.height,
    )
    for (const text of await page.locator('.diff-text').all()) {
      await expect(text).toHaveAttribute('lang', 'es-MX')
    }
    expect((await auditAccessibility(page)).violations).toEqual([])
    await page.screenshot({
      path: `test-results/gerund-${width}-correction.png`,
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
      path: `test-results/gerund-${width}-complete.png`,
      fullPage: true,
    })
    await page.locator('html[data-offline-ready="true"]').waitFor()
    await context.setOffline(true)
    await page.reload()
    await page.getByRole('combobox', { name: 'Tense' }).selectOption('gerund')
    await page.getByRole('button', { name: 'Start practice' }).click()
    await expect(page.getByRole('heading', { level: 1 })).not.toContainText(
      'Ahora mismo yo … con la vecina.',
    )
    const saved = JSON.parse(await page.evaluate(currentDeckJson)) as {
      version: number
      cards: { grammar?: { topic: string } }[]
    }
    expect(saved.version).toBe(4)
    expect(
      saved.cards.filter((card) => card.grammar?.topic === 'gerund'),
    ).toHaveLength(8)
    expect(
      saved.cards.filter((card) => card.grammar?.topic === 'preterite'),
    ).toHaveLength(0)
    expect(
      saved.cards.filter((card) => card.grammar?.topic === 'perfect'),
    ).toHaveLength(0)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  })
}
