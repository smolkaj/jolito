import { expect, test } from '@playwright/test'
import { auditAccessibility, settleAnimations } from './accessibility'

for (const viewport of [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
]) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test('keeps mobile card-creation failure visible and the complete draft available for retry', async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport)
      await page.addInitScript(() => {
        localStorage.setItem(
          'jolito-auth-session-v1',
          JSON.stringify({
            accessToken: 'mock-token',
            refreshToken: 'mock-refresh',
            expiresAt: Date.now() + 3600000,
            user: { id: 'creator', email: 'creator@example.com' },
          }),
        )
      })
      await page.route('https://mock.supabase.co/**', (route) => route.abort())
      await page.goto('/#/create')
      await page.locator('#spanish').fill('Un boleto de metro')
      await page.locator('#english').fill('A subway ticket')
      await page
        .locator('#context')
        .fill('Keep the complete draft after a failed save.')
      const save = page.getByRole('button', { name: 'Save card', exact: true })
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
        await save.click()
        const error = page
          .getByRole('alert')
          .filter({ hasText: 'couldn’t be saved' })
        await settleAnimations(page)
        await expect(error).toBeInViewport({ ratio: 1 })
        await expect(page.locator('#spanish')).toHaveValue('Un boleto de metro')
        await expect(page.locator('#english')).toHaveValue('A subway ticket')
        await expect(page.locator('#context')).toHaveValue(
          'Keep the complete draft after a failed save.',
        )
        await expect(save).toHaveText('Save card')
        expect(
          await page.evaluate(() => localStorage.getItem('jolito-library-v1')),
        ).toBe(before)
      }
      expect((await auditAccessibility(page)).violations).toEqual([])
      await page.screenshot({
        path: testInfo.outputPath('visible-create-error.png'),
      })
      await page.evaluate(() =>
        window.dispatchEvent(new Event('restore-storage-writes')),
      )
      await save.click()
      await expect(
        page.getByRole('alert').filter({ hasText: 'couldn’t be saved' }),
      ).toHaveCount(0)
      await expect(save).toContainText('Saved')
      expect(
        await page.evaluate(() => localStorage.getItem('jolito-library-v1')),
      ).toContain('Un boleto de metro')
      await page.goto('/#/deck')
      await expect(
        page.getByRole('cell', { name: 'Un boleto de metro', exact: true }),
      ).toBeVisible()
    })
  })
}
