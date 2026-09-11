import { expect, test } from '@playwright/test'
import { auditAccessibility, settleAnimations } from './accessibility'
import { practiceCards } from './practice'

for (const width of [320, 1280]) {
  test(`accent shortcuts preserve editing, resume and grading at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/#/grammar')
    await page.getByRole('button', { name: 'Start practice' }).click()
    const input = page.getByRole('textbox', { name: 'Your conjugation' })
    for (const [index, letter] of ['á', 'é', 'í', 'ó', 'ú'].entries()) {
      const button = page.getByRole('button', { name: `Insert ${letter}` })
      await expect(button).toHaveAttribute(
        'aria-keyshortcuts',
        String(index + 1),
      )
      await expect(button.locator('kbd')).toHaveText(String(index + 1))
    }
    await page.keyboard.type('12345')
    await expect(input).toHaveValue('áéíóú')
    await input.evaluate((element: HTMLInputElement) =>
      element.setSelectionRange(1, 2),
    )
    await page.keyboard.type('2x')
    await expect(input).toHaveValue('áéxíóú')
    await input.fill('hablX')
    await input.evaluate((element: HTMLInputElement) =>
      element.setSelectionRange(4, 5),
    )
    await page.keyboard.press('2')
    await expect(input).toHaveValue('hablé')
    await input.press('Backspace')
    await expect(input).toHaveValue('habl')
    await page.getByRole('button', { name: 'Insert é' }).click()
    await expect(input).toHaveValue('hablé')
    await expect(input).toBeFocused()
    await page.getByRole('button', { name: 'Grammar', exact: true }).click()
    await page.getByRole('button', { name: 'Resume practice' }).click()
    await expect(input).toHaveValue('hablé')
    await page.keyboard.press('End')
    await page.keyboard.press('3')
    await expect(input).toHaveValue('habléí')
    await page.keyboard.press('Backspace')
    await settleAnimations(page)
    expect((await auditAccessibility(page)).violations).toEqual([])
    await page.screenshot({
      path: `test-results/accent-shortcuts-${width}.png`,
      fullPage: true,
    })
    await input.press('Enter')
    await expect(
      page.getByRole('status', { name: 'Answer feedback' }),
    ).toContainText('hablé')
    await page.keyboard.press('4')
    await expect(input).toHaveValue('')
    await page.keyboard.press('5')
    await expect(input).toHaveValue('ú')
    await page.getByRole('button', { name: 'Jolito home' }).click()
    await practiceCards(page)
    await page.keyboard.type('12345')
    await expect(
      page.getByRole('textbox', { name: 'Your answer' }),
    ).toHaveValue('12345')
  })
}
