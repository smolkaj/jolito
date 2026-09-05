import { expect, test } from '@playwright/test'

const testViewports = [
  { width: 1470, height: 956 },
  { width: 1440, height: 900 },
  { width: 1280, height: 832 },
  { width: 1280, height: 720 },
  { width: 1150, height: 750 },
  { width: 1080, height: 700 },
  { width: 1024, height: 768 },
  { width: 960, height: 700 },
]

for (const vp of testViewports) {
  test(`stable form and input width across keystrokes at ${vp.width}x${vp.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(vp)
    await page.goto('/#/create')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(200)

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
    for (const char of ['t', 'e', 's', 't']) {
      currentText += char
      await spanishInput.press(char)
      await page.waitForTimeout(100)
      const curr = await getWidths()

      // Width of grid layout, form container, and input must remain identical
      expect(
        curr.layoutW,
        `layout width changed on typing '${char}' (text="${currentText}")`,
      ).toBe(initial.layoutW)
      expect(
        curr.formW,
        `form width changed on typing '${char}' (text="${currentText}")`,
      ).toBe(initial.formW)
      expect(
        curr.inputW,
        `input width changed on typing '${char}' (text="${currentText}")`,
      ).toBe(initial.inputW)
    }
  })
}
