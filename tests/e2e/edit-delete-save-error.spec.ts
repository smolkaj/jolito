import { currentDeckJson } from './storage'
import { expect, test } from '@playwright/test'
import { auditAccessibility, settleAnimations } from './accessibility'

for (const viewport of [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
]) {
  for (const action of ['edit', 'delete']) {
    test(`${action} retains a long-context card through repeated failures at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      const context =
        'This ticket is valid for one journey across the city. Keep it until you leave the station. '.repeat(
          8,
        )
      await page.setViewportSize(viewport)
      await page.addInitScript((context) => {
        if (localStorage.getItem('jolito-library-v1')) return
        localStorage.setItem(
          'jolito-library-v1',
          JSON.stringify({
            version: 1,
            cards: [
              {
                id: 'long-context-card',
                noteId: 'long-context-note',
                prompt: 'Un boleto de metro',
                answer: 'A subway ticket',
                direction: 'es-en',
                context,
                scene: 'metro',
                createdAt: 0,
                schedule: {
                  state: 'review',
                  dueAt: 0,
                  intervalDays: 1,
                  easeFactor: 2.5,
                  reviews: 2,
                  lapses: 0,
                },
              },
            ],
          }),
        )
      }, context)
      await page.goto('/#/deck')
      const demo = page.getByRole('button', { name: /explore demo deck/i })
      if (await demo.isVisible()) await demo.click()
      const selection = page.getByRole('checkbox', {
        name: /select card Un boleto de metro/i,
      })
      if (action === 'edit') {
        await page
          .getByRole('cell', { name: 'Un boleto de metro', exact: true })
          .click()
        await page.locator('#edit-prompt').fill('Un boleto nuevo')
        await page.getByText('Reset learning progress', { exact: true }).click()
      } else {
        await selection.check()
        await page.getByRole('button', { name: /delete selected/i }).click()
      }
      const dialog = page.getByRole('dialog')
      const confirm = dialog.getByRole('button', {
        name: action === 'edit' ? 'Save changes' : 'Delete card',
        exact: true,
      })
      const before = await page.evaluate(currentDeckJson)
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
          () => Object.defineProperty(Storage.prototype, 'setItem', original),
          { once: true },
        )
      })
      for (let attempt = 0; attempt < 2; attempt++) {
        await confirm.click()
        const error = dialog.getByRole('alert')
        await expect(error).toContainText('couldn’t be saved')
        await settleAnimations(page)
        await expect(error).toBeInViewport({ ratio: 1 })
        await expect(confirm).toBeEnabled()
        if (action === 'edit') {
          await expect(page.locator('#edit-prompt')).toHaveValue(
            'Un boleto nuevo',
          )
          await expect(page.locator('#edit-context')).toHaveValue(context)
          await expect(page.locator('#edit-reset-progress')).toBeChecked()
        } else {
          await expect(selection).toBeChecked()
          await expect(dialog).toContainText(context.trim())
        }
        expect(await page.evaluate(currentDeckJson)).toBe(before)
      }
      expect((await auditAccessibility(page)).violations).toEqual([])
      await page.screenshot({
        path: testInfo.outputPath('visible-mutation-error.png'),
      })
      await page.evaluate(() =>
        window.dispatchEvent(new Event('restore-storage-writes')),
      )
      await confirm.click()
      await expect(dialog).toHaveCount(0)
      await page.reload()
      const stored = JSON.parse(await page.evaluate(currentDeckJson)) as unknown
      if (action === 'edit') {
        expect(stored).toMatchObject({
          cards: [
            {
              prompt: 'Un boleto nuevo',
              context,
              schedule: { state: 'new', reviews: 0 },
            },
          ],
        })
      } else {
        expect(stored).toMatchObject({
          cards: [],
          deletedCardIds: ['long-context-card'],
        })
      }
    })
  }
}
