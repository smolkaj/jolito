import { expect, test } from '@playwright/test'

const testViewports = [
  // Desktop / Laptop (2-column layout)
  { width: 1470, height: 956, label: 'MacBook Air default' },
  { width: 1440, height: 900, label: 'MacBook Air 13-inch' },
  { width: 1280, height: 832, label: 'MacBook Air scaled' },
  { width: 1280, height: 720, label: 'Standard laptop 720p' },
  { width: 1150, height: 750, label: 'Mid desktop' },
  { width: 1080, height: 700, label: 'Desktop 1080' },
  { width: 1024, height: 768, label: 'Compact desktop' },
  { width: 960, height: 700, label: 'Minimum 2-column breakpoint' },

  // Tablet (single-column layout)
  { width: 820, height: 1180, label: 'iPad Air portrait' },
  { width: 768, height: 1024, label: 'iPad Mini portrait' },

  // Mobile (single-column layout)
  { width: 430, height: 932, label: 'iPhone 14 Pro Max' },
  { width: 390, height: 844, label: 'iPhone standard' },
  { width: 375, height: 667, label: 'iPhone SE' },
]

for (const vp of testViewports) {
  test(`stable form and input width across keystrokes at ${vp.width}x${vp.height} (${vp.label})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.goto('/#/create')
    await page.waitForLoadState('networkidle')

    const spanishInput = page.locator('#spanish')
    await spanishInput.waitFor({ state: 'visible' })

    const getWidths = async () => {
      return await page.evaluate(() => {
        const form = document.querySelector('.create-form')
        const input = document.querySelector('#spanish')
        const layout = document.querySelector('.create-layout')
        return {
          layoutW: layout
            ? Math.round(layout.getBoundingClientRect().width * 100) / 100
            : 0,
          formW: form
            ? Math.round(form.getBoundingClientRect().width * 100) / 100
            : 0,
          inputW: input
            ? Math.round(input.getBoundingClientRect().width * 100) / 100
            : 0,
        }
      })
    }

    const initial = await getWidths()
    let currentText = ''
    const suggestions = page.locator('.suggestions-container')

    for (const char of ['t', 'e', 's', 't']) {
      currentText += char
      await spanishInput.press(char)

      // Ensure input value has updated before measuring DOM
      await expect(spanishInput).toHaveValue(currentText)

      // When query reaches 2+ characters, suggestions mount
      if (currentText.length >= 2) {
        await suggestions.waitFor({ state: 'visible', timeout: 5000 })
      }

      const curr = await getWidths()

      // Width of grid layout, form container, and input must remain identical
      expect(
        curr.layoutW,
        `layout width changed on typing '${char}' (text="${currentText}") at ${vp.width}x${vp.height}`,
      ).toBe(initial.layoutW)
      expect(
        curr.formW,
        `form width changed on typing '${char}' (text="${currentText}") at ${vp.width}x${vp.height}`,
      ).toBe(initial.formW)
      expect(
        curr.inputW,
        `input width changed on typing '${char}' (text="${currentText}") at ${vp.width}x${vp.height}`,
      ).toBe(initial.inputW)
    }
  })
}

test('typing english first mounts suggestions below english field and auto-fills on selection', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 832 })
  await page.goto('/#/create')
  await page.waitForLoadState('networkidle')

  const englishInput = page.locator('#english')
  const spanishInput = page.locator('#spanish')
  await englishInput.waitFor({ state: 'visible' })

  await englishInput.pressSequentially('avocado')

  const suggestions = page.locator('#english-suggestions')
  await suggestions.waitFor({ state: 'visible' })

  // Verify the suggestion container is inside the English field group, not Spanish
  const englishFieldGroup = page
    .locator('.field-group')
    .filter({ has: englishInput })
  await expect(englishFieldGroup.locator('#english-suggestions')).toBeVisible()

  // Verify primary text is avocado and secondary is aguacate
  const option = suggestions.locator('.suggestion-item').first()
  await expect(option.locator('.suggestion-primary')).toHaveText('avocado')
  await expect(option.locator('.suggestion-secondary')).toHaveText('aguacate')

  // Capture screenshot of the English suggestions open below the English field
  await page.screenshot({
    path: '/tmp/jolito-english-suggestions-preview.png',
  })

  // Click suggestion
  await option.click()
  await expect(spanishInput).toHaveValue('aguacate')
  await expect(englishInput).toHaveValue('avocado')
  await expect(suggestions).not.toBeVisible()
})

test('additional context placeholder and multiline content do not overflow or clip across viewports', async ({
  page,
}) => {
  for (const vp of [
    { width: 1280, height: 832, label: 'desktop' },
    { width: 390, height: 844, label: 'mobile' },
    { width: 320, height: 568, label: 'narrow-mobile' },
  ]) {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.goto('/#/create')
    await page.waitForLoadState('networkidle')

    const contextEl = page.locator('#context')
    await contextEl.waitFor({ state: 'visible' })

    // Placeholder must fit within the element without vertical clipping or scrollbar
    const metrics = await contextEl.evaluate((el: HTMLTextAreaElement) => {
      const cs = window.getComputedStyle(el)
      return {
        offsetHeight: el.offsetHeight,
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
        paddingTop: parseFloat(cs.paddingTop),
        paddingBottom: parseFloat(cs.paddingBottom),
        fontSize: parseFloat(cs.fontSize),
      }
    })

    expect(
      metrics.scrollHeight,
      `Placeholder text is clipped/scrolling in ${vp.label} (${vp.width}x${vp.height}): scrollHeight (${metrics.scrollHeight}) > clientHeight (${metrics.clientHeight})`,
    ).toBeLessThanOrEqual(metrics.clientHeight)

    expect(
      metrics.clientHeight,
      `Additional context clientHeight is too short for 2 rows in ${vp.label}`,
    ).toBeGreaterThanOrEqual(56)

    // Verify auto-growth when multiline content is typed
    await contextEl.fill('Line 1\nLine 2\nLine 3\nLine 4\nLine 5')
    const multiLineMetrics = await contextEl.evaluate(
      (el: HTMLTextAreaElement) => ({
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
      }),
    )

    expect(
      multiLineMetrics.clientHeight,
      `Textarea did not expand for multiline content in ${vp.label}`,
    ).toBeGreaterThan(metrics.clientHeight)

    // Clear content and verify it returns to baseline height without clipping
    await contextEl.fill('')
    const resetMetrics = await contextEl.evaluate(
      (el: HTMLTextAreaElement) => ({
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
      }),
    )

    expect(
      resetMetrics.scrollHeight,
      `Reset textarea clipped placeholder in ${vp.label}`,
    ).toBeLessThanOrEqual(resetMetrics.clientHeight)
  }
})

test('edit modal additional context placeholder does not overflow or clip across viewports', async ({
  page,
}) => {
  for (const vp of [
    { width: 1280, height: 832, label: 'desktop' },
    { width: 390, height: 844, label: 'mobile' },
  ]) {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.goto('/#/deck')
    await page.waitForLoadState('networkidle')
    const demo = page.getByRole('button', { name: /explore demo deck/i })
    if (await demo.isVisible()) await demo.click()

    const firstCardRow = page.locator('.deck-card-row').first()
    await firstCardRow.waitFor({ state: 'visible' })
    await firstCardRow.click()

    const contextEl = page.locator('#edit-context')
    await contextEl.waitFor({ state: 'visible' })

    // Clear any existing context to test placeholder visibility
    await contextEl.fill('')

    const metrics = await contextEl.evaluate((el: HTMLTextAreaElement) => ({
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
    }))

    expect(
      metrics.scrollHeight,
      `Edit modal placeholder text is clipped/scrolling in ${vp.label}`,
    ).toBeLessThanOrEqual(metrics.clientHeight)

    expect(
      metrics.clientHeight,
      `Edit modal additional context clientHeight is too short for 2 rows in ${vp.label}`,
    ).toBeGreaterThanOrEqual(56)

    // Close modal with Cancel or Escape
    await page.keyboard.press('Escape')
  }
})
