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

test('mobile practice card places input, accents, and reveal button in natural sequential order', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/grammar')
  const startBtn = page.getByRole('button', { name: 'Start practice' })
  if (await startBtn.isVisible()) {
    await startBtn.click()
  }
  await expect(
    page.getByRole('textbox', { name: 'Your conjugation' }),
  ).toBeVisible()

  const mobileOrder = await page.evaluate(() => {
    const input = document
      .querySelector('.answer-input')!
      .getBoundingClientRect()
    const accents = document
      .querySelector('.answer-accents-container')!
      .getBoundingClientRect()
    const reveal = document
      .querySelector('.reveal-button')!
      .getBoundingClientRect()
    return {
      inputBottom: input.bottom,
      accentsTop: accents.top,
      accentsBottom: accents.bottom,
      revealTop: reveal.top,
    }
  })

  // Natural flow: input -> accents -> reveal button
  expect(mobileOrder.accentsTop).toBeGreaterThanOrEqual(
    mobileOrder.inputBottom - 2,
  )
  expect(mobileOrder.revealTop).toBeGreaterThanOrEqual(
    mobileOrder.accentsBottom - 2,
  )
})

test('mobile practice card on iOS/touch without physical keyboard suppresses in-card accents at rest and places reveal directly below input', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  // Emulate iOS touch environment without physical keyboard
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    })
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 5,
      configurable: true,
    })
  })
  await page.goto('/#/grammar')
  const startBtn = page.getByRole('button', { name: 'Start practice' })
  if (await startBtn.isVisible()) {
    await startBtn.click()
  }
  await expect(
    page.getByRole('textbox', { name: 'Your conjugation' }),
  ).toBeVisible()

  const metrics = await page.evaluate(() => {
    const input = document
      .querySelector('.answer-input')!
      .getBoundingClientRect()
    const accents = document.querySelector('.answer-accents-container')!
    const reveal = document
      .querySelector('.reveal-button')!
      .getBoundingClientRect()
    const accentsComputed = window.getComputedStyle(accents)
    return {
      accentsDisplay: accentsComputed.display,
      inputBottom: input.bottom,
      revealTop: reveal.top,
      revealDirectlyBelow: reveal.top - input.bottom,
    }
  })

  // In-card accents container is suppressed on mobile touch devices
  expect(metrics.accentsDisplay).toBe('none')
  // Reveal button sits directly below input without an empty blank gap
  expect(metrics.revealTop).toBeGreaterThanOrEqual(metrics.inputBottom - 2)
  expect(metrics.revealDirectlyBelow).toBeLessThan(40)
})

test('mobile practice card preserves clean layout across keyboard open and voice input transitions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    })
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 5,
      configurable: true,
    })
  })
  await page.goto('/#/grammar')
  const startBtn = page.getByRole('button', { name: 'Start practice' })
  if (await startBtn.isVisible()) {
    await startBtn.click()
  }

  // 1. Initial rest state: in-card accents container is hidden
  const inCardAccents = page.locator('.answer-accents-container')
  await expect(inCardAccents).toBeHidden()
  await page.screenshot({ path: 'test-results/mobile-ios-rest.png' })

  // 2. Simulate virtual keyboard open
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent('jolito:keyboard-change', {
        detail: { isOpen: true, keyboardHeight: 336 },
      }),
    )
  })

  // 3. Docked toolbar appears above keyboard
  const dockedToolbar = page.locator('.answer-accents.is-docked')
  await expect(dockedToolbar).toBeVisible()
  await expect(inCardAccents).toBeHidden()
  await page.screenshot({ path: 'test-results/mobile-ios-docked.png' })

  // 4. Simulate keyboard dismiss (e.g. voice input mic tap or blur)
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent('jolito:keyboard-change', {
        detail: { isOpen: false, keyboardHeight: 0 },
      }),
    )
  })

  // 5. Docked toolbar unmounts and in-card accents remain completely hidden (no jump!)
  await expect(dockedToolbar).toHaveCount(0)
  await expect(inCardAccents).toBeHidden()

  // 6. Reveal button sits right below input
  const metrics = await page.evaluate(() => {
    const input = document
      .querySelector('.answer-input')!
      .getBoundingClientRect()
    const reveal = document
      .querySelector('.reveal-button')!
      .getBoundingClientRect()
    return {
      gap: reveal.top - input.bottom,
    }
  })
  expect(metrics.gap).toBeGreaterThanOrEqual(-2)
  expect(metrics.gap).toBeLessThan(40)
})
