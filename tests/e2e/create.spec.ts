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
