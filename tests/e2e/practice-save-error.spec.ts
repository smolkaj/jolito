import { expect, test } from '@playwright/test'
import { auditAccessibility, settleAnimations } from './accessibility'

for (const mode of ['vocabulary', 'grammar']) {
  for (const answer of [
    'my answer',
    'This deliberately longer answer spans several lines of correction feedback on a small phone.',
  ]) {
    test(`reveals a failed ${mode} rating with ${answer.length} answer characters`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto(mode === 'grammar' ? '/#/grammar' : '/#/review')
      if (mode === 'grammar')
        await page.getByRole('button', { name: 'Start practice' }).click()
      await page.getByRole('textbox').fill(answer)
      await page.getByRole('textbox').press('Enter')
      const prompt = await page.getByRole('heading', { level: 1 }).textContent()
      const before = await page.evaluate(() =>
        localStorage.getItem('jolito-library-v1'),
      )
      await page.evaluate(() => {
        const descriptor = Object.getOwnPropertyDescriptor(
          Storage.prototype,
          'setItem',
        )!
        Storage.prototype.setItem = () => {
          throw new DOMException('Full', 'QuotaExceededError')
        }
        window.addEventListener(
          'restore-storage-writes',
          () => {
            Object.defineProperty(Storage.prototype, 'setItem', descriptor)
          },
          { once: true },
        )
      })
      await page.getByRole('button', { name: /^4 Easy/i }).click()
      const error = page.locator('.practice-error[role="alert"]')
      await settleAnimations(page)
      await expect(error).toBeInViewport({ ratio: 1 })
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(prompt!)
      await expect(
        page.getByRole('status', { name: 'Answer feedback' }),
      ).toContainText(answer)
      await expect(page.getByRole('button', { name: /^4 Easy/i })).toBeEnabled()
      expect(
        await page.evaluate(() => localStorage.getItem('jolito-library-v1')),
      ).toBe(before)
      expect((await auditAccessibility(page)).violations).toEqual([])
      await expect(error).toBeInViewport({ ratio: 1 })
      await page.screenshot({
        path: testInfo.outputPath('visible-save-error.png'),
      })
      await page.evaluate(() =>
        window.dispatchEvent(new Event('restore-storage-writes')),
      )
      await page.keyboard.press('4')
      await expect(error).toHaveCount(0)
      expect(
        await page.evaluate(() => localStorage.getItem('jolito-library-v1')),
      ).not.toBe(before)
    })
  }
}
