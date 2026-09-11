import { expect, test } from '@playwright/test'
import { createStudyCards, collectionVersion } from '../../src/domain/card'
import { auditAccessibility } from './accessibility'

for (const width of [320, 1280]) {
  test(`update guidance preserves an unfinished practice answer at ${width}px`, async ({
    page,
    context,
  }, testInfo) => {
    const viewport = { width, height: width === 320 ? 568 : 900 }
    await page.setViewportSize(viewport)
    await page.addInitScript(
      ({ cards, version }) => {
        if (localStorage.getItem('upgrade-seeded')) return
        localStorage.setItem('upgrade-seeded', 'true')
        localStorage.setItem(
          'jolito-auth-session-v1',
          JSON.stringify({
            accessToken: 'token',
            refreshToken: 'refresh',
            expiresAt: Date.now() + 3600000,
            user: { id: 'upgrade', email: 'upgrade@example.com' },
          }),
        )
        localStorage.setItem(
          'jolito-libraries-v1',
          JSON.stringify({
            version: 1,
            accounts: {
              'user:upgrade': { version, cards, deletedCardIds: [] },
            },
          }),
        )
      },
      {
        cards: createStudyCards(
          {
            spanish: 'guardar',
            english: 'save',
            context: '',
            bidirectional: false,
          },
          'upgrade',
          0,
        ),
        version: collectionVersion,
      },
    )
    await page.route('https://mock.supabase.co/**', (route) =>
      route.fulfill({
        status: 409,
        json: {
          message:
            'Update Jolito to sync. Save unfinished edits and export a deck backup first. Keep this device’s app data. For safe update steps, open https://joli.to/update in your browser.',
        },
      }),
    )
    await page.goto('/#/review')
    const answer = page.getByRole('textbox', { name: 'Your answer' })
    await answer.fill('unfinished answer')
    const savedBefore = await page.evaluate(() =>
      localStorage.getItem('jolito-libraries-v1'),
    )
    await page.locator('.connection-pill').click()
    await page.getByRole('button', { name: /sync now/i }).click()
    const help = page.getByRole('link', { name: /update help/i })
    await expect(help).toBeVisible()
    expect((await auditAccessibility(page)).violations).toEqual([])
    await page.screenshot({
      path: testInfo.outputPath(`update-error-${width}.png`),
      fullPage: true,
    })
    const opened = context.waitForEvent('page')
    await help.click()
    const guide = await opened
    await guide.waitForLoadState()
    await guide.setViewportSize(viewport)
    await expect(
      guide.getByRole('heading', { name: 'Update Jolito safely' }),
    ).toBeVisible()
    await expect(guide.locator('meta[name="jolito-build"]')).toHaveCount(0)
    expect((await auditAccessibility(guide)).violations).toEqual([])
    expect(
      await guide.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await guide.screenshot({
      path: testInfo.outputPath(`update-guide-${width}.png`),
      fullPage: true,
    })
    await guide.close()
    await page.getByRole('button', { name: /close/i }).click()
    await expect(answer).toHaveValue('unfinished answer')
    expect(
      await page.evaluate(() => localStorage.getItem('jolito-libraries-v1')),
    ).toBe(savedBefore)
  })
}
