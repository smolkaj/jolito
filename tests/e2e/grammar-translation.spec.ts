import { expect, test } from '@playwright/test'
import { createGrammarCards } from '../../src/domain/grammar'
import { auditAccessibility, settleAnimations } from './accessibility'

for (const width of [320, 1280]) {
  for (const example of [
    {
      topic: 'preterite',
      verb: 'comer',
      person: 0,
      reviews: 0,
      highlights: ['I', 'ate'],
    },
    {
      topic: 'perfect',
      verb: 'hablar',
      person: 0,
      reviews: 1,
      highlights: ['I', 'have', 'talked'],
    },
    {
      topic: 'perfect',
      verb: 'hablar',
      person: 2,
      reviews: 0,
      highlights: ['has talked'],
    },
  ] as const) {
    test(`English alignment for ${example.topic} ${example.person}/${example.reviews} at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      const card = createGrammarCards(0, example.topic).find(
        (card) =>
          card.grammar.verb === example.verb &&
          card.grammar.person === example.person,
      )!
      await page.addInitScript(
        ({ card, reviews }) => {
          localStorage.setItem(
            'jolito-library-v1',
            JSON.stringify({
              version: 3,
              cards: [
                {
                  ...card,
                  schedule: {
                    ...card.schedule,
                    reviews: reviews || 2,
                    dueAt: 0,
                  },
                },
              ],
            }),
          )
        },
        { card, reviews: example.reviews },
      )
      await page.goto('/#/grammar')
      await page
        .getByRole('combobox', { name: 'Tense' })
        .selectOption(example.topic)
      await page.getByRole('button', { name: 'Start practice' }).click()
      const translation = page.locator('.grammar-translation')
      const text = await translation.textContent()
      const before = await translation.boundingBox()
      await expect(translation.locator('.grammar-filled')).toHaveText([
        ...example.highlights,
      ])
      await page.screenshot({
        path: `test-results/english-${example.topic}-${example.person}-${width}-prompt.png`,
        fullPage: true,
      })
      await page.getByRole('textbox').press('Enter')
      await settleAnimations(page)
      await expect(translation).toHaveText(text!)
      await expect(translation.locator('.grammar-filled')).toHaveText([
        ...example.highlights,
      ])
      const pink = await page
        .locator('.grammar-sentence .grammar-filled')
        .evaluate((el) => getComputedStyle(el).color)
      for (const part of await translation.locator('.grammar-filled').all())
        await expect(part).toHaveCSS('color', pink)
      for (const part of await translation
        .locator('span:not(.grammar-filled)')
        .all())
        expect(
          await part.evaluate((el) => getComputedStyle(el).color),
        ).not.toBe(pink)
      expect((await translation.boundingBox())!.height).toBe(before!.height)
      expect((await auditAccessibility(page)).violations).toEqual([])
      await page.screenshot({
        path: `test-results/english-${example.topic}-${example.person}-${width}.png`,
        fullPage: true,
      })
      await page.getByRole('button', { name: 'Grammar', exact: true }).click()
      await page.getByRole('button', { name: 'Resume practice' }).click()
      await expect(translation.locator('.grammar-filled')).toHaveText([
        ...example.highlights,
      ])
      await page.keyboard.press('4')
      await expect(page.locator('.grammar-blank')).toBeVisible()
      await expect(translation.locator('.grammar-filled')).not.toHaveCount(0)
      await expect(translation).not.toHaveText(text!)
    })
  }
}
