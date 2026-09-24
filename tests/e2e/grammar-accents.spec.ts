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
    for (const [index, letter] of [
      'á',
      'é',
      'í',
      'ó',
      'ú',
      'ñ',
      'ü',
      '¿',
      '¡',
    ].entries()) {
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
    await page.keyboard.type('6789')
    await expect(input).toHaveValue('áéxñü¿¡íóú')
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

test('reveal button is vertically centered within the answer input field on desktop viewports', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/#/study')
  await expect(page.getByLabel('Your answer')).toBeVisible()

  const studyMetrics = await page.evaluate(() => {
    const input = document
      .querySelector('.answer-input')!
      .getBoundingClientRect()
    const reveal = document
      .querySelector('.reveal-button')!
      .getBoundingClientRect()
    return {
      inputCenterY: input.top + input.height / 2,
      revealCenterY: reveal.top + reveal.height / 2,
      topOffset: reveal.top - input.top,
      bottomOffset: input.bottom - reveal.bottom,
    }
  })
  expect(
    Math.abs(studyMetrics.inputCenterY - studyMetrics.revealCenterY),
  ).toBeLessThanOrEqual(1)
  expect(
    Math.abs(studyMetrics.topOffset - studyMetrics.bottomOffset),
  ).toBeLessThanOrEqual(1)

  // Also verify on grammar cards with accent toolbar
  await page.goto('/#/grammar')
  const startBtn = page.getByRole('button', { name: 'Start practice' })
  if (await startBtn.isVisible()) {
    await startBtn.click()
  }
  await expect(
    page.getByRole('textbox', { name: 'Your conjugation' }),
  ).toBeVisible()

  const grammarMetrics = await page.evaluate(() => {
    const input = document
      .querySelector('.answer-input')!
      .getBoundingClientRect()
    const reveal = document
      .querySelector('.reveal-button')!
      .getBoundingClientRect()
    return {
      inputCenterY: input.top + input.height / 2,
      revealCenterY: reveal.top + reveal.height / 2,
      topOffset: reveal.top - input.top,
      bottomOffset: input.bottom - reveal.bottom,
    }
  })
  expect(
    Math.abs(grammarMetrics.inputCenterY - grammarMetrics.revealCenterY),
  ).toBeLessThanOrEqual(1)
  expect(
    Math.abs(grammarMetrics.topOffset - grammarMetrics.bottomOffset),
  ).toBeLessThanOrEqual(1)
})

test('card layout hierarchy places keyboard shortcuts above card management actions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/#/study')
  await expect(page.getByLabel('Your answer')).toBeVisible()

  const hierarchy = await page.evaluate(() => {
    const input = document
      .querySelector('.answer-input')!
      .getBoundingClientRect()
    const kbdHint = document
      .querySelector('.keyboard-hint')!
      .getBoundingClientRect()
    const quickActions = document
      .querySelector('.study-card-quick-actions')
      ?.getBoundingClientRect()

    return {
      inputTop: input.top,
      kbdHintTop: kbdHint.top,
      quickActionsTop: quickActions?.top ?? null,
    }
  })

  // Keyboard hint is directly below the study interaction
  expect(hierarchy.kbdHintTop).toBeGreaterThan(hierarchy.inputTop)
  if (hierarchy.quickActionsTop !== null) {
    // Quick actions (edit/delete) are placed below the keyboard hints
    expect(hierarchy.quickActionsTop).toBeGreaterThan(hierarchy.kbdHintTop)
  }
})
