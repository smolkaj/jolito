import { expect, test } from '@playwright/test'
import { auditAccessibility, settleAnimations } from './accessibility'

for (const viewport of [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
]) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    for (const action of ['pack', 'note']) {
      test(`reveals and recovers failed ${action} additions after scrolling`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize(viewport)
        await page.goto('/#/deck')
        const demo = page.getByRole('button', { name: /explore demo deck/i })
        if (await demo.isVisible()) await demo.click()
        await page.getByRole('button', { name: /^starter packs$/i }).click()
        const pack = page.locator('.starter-pack-card').last()
        if (action === 'note')
          await pack.getByRole('button', { name: /^Inspect/ }).click()
        const add =
          action === 'pack'
            ? pack.getByRole('button', { name: /^Add/ })
            : page
                .locator('.starter-pack-inspect-item')
                .last()
                .getByRole('button', { name: /^Add/ })
        await add.scrollIntoViewIfNeeded()
        const before = await page.evaluate(() =>
          localStorage.getItem('jolito-library-v1'),
        )
        await page.evaluate(() => {
          const original = Object.getOwnPropertyDescriptor(
            Storage.prototype,
            'setItem',
          )!
          Storage.prototype.setItem = () => {
            throw new DOMException('Full', 'QuotaExceededError')
          }
          window.addEventListener(
            'restore-storage-writes',
            () => {
              Object.defineProperty(Storage.prototype, 'setItem', original)
            },
            { once: true },
          )
        })
        for (let attempt = 0; attempt < 2; attempt++) {
          await add.click()
          const error = page
            .getByRole('dialog')
            .getByRole('alert')
            .filter({ hasText: /couldn’t be saved/ })
          await settleAnimations(page)
          await expect(error).toBeInViewport({ ratio: 1 })
          await expect(error).toBeFocused()
          const dialog = page.getByRole('dialog')
          const buttons = dialog.getByRole('button').filter({ visible: true })
          await page.keyboard.press('Shift+Tab')
          await expect(buttons.last()).toBeFocused()
          await page.keyboard.press('Tab')
          await expect(buttons.first()).toBeFocused()
          await error.focus()
          await page.keyboard.press('Tab')
          await expect(buttons.first()).toBeFocused()
          await error.focus()
          await expect(add).toBeEnabled()
          expect(
            await page.evaluate(() =>
              localStorage.getItem('jolito-library-v1'),
            ),
          ).toBe(before)
        }
        expect((await auditAccessibility(page)).violations).toEqual([])
        await page.screenshot({
          path: testInfo.outputPath('visible-add-error.png'),
        })
        await page.evaluate(() =>
          window.dispatchEvent(new Event('restore-storage-writes')),
        )
        await add.click()
        await expect(
          page
            .getByRole('dialog')
            .getByRole('alert')
            .filter({ hasText: /couldn’t be saved/ }),
        ).toHaveCount(0)
        expect(
          await page.evaluate(() => localStorage.getItem('jolito-library-v1')),
        ).not.toBe(before)
      })
    }
  })
}
