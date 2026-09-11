import { expect, test } from '@playwright/test'
import { createStudyCards } from '../../src/domain/card'
import { auditAccessibility } from './accessibility'

for (const viewport of [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 1280, height: 800 },
]) {
  test(`failed deletion preserves account and deck through reload and retry at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    const cards = createStudyCards(
      {
        spanish: 'secreto',
        english: 'private',
        context: '',
        bidirectional: false,
      },
      'deletion-contract',
      0,
    )
    await page.addInitScript((initialCards) => {
      if (localStorage.getItem('deletion-contract-seeded')) return
      localStorage.setItem('deletion-contract-seeded', 'true')
      localStorage.setItem(
        'jolito-auth-session-v1',
        JSON.stringify({
          accessToken: 'deletion-token',
          refreshToken: 'deletion-refresh',
          expiresAt: Date.now() + 3600000,
          user: { id: 'deletion-user', email: 'delete@example.com' },
        }),
      )
      localStorage.setItem(
        'jolito-library-v1',
        JSON.stringify({ version: 3, cards: initialCards }),
      )
    }, cards)
    let deletionAttempts = 0
    const separateDeckDeletes: string[] = []
    await page.route('https://mock.supabase.co/**', async (route) => {
      const request = route.request()
      if (request.method() === 'DELETE') separateDeckDeletes.push(request.url())
      if (request.url().includes('/rpc/delete_user_account')) {
        deletionAttempts++
        if (deletionAttempts <= 4) {
          await route.fulfill({
            status: deletionAttempts <= 2 ? 404 : 503,
            json: { message: 'Deletion unavailable. Please try again.' },
          })
        } else {
          await route.fulfill({ status: 204 })
        }
        return
      }
      await route.fulfill({
        status: 200,
        json:
          request.method() === 'GET'
            ? [
                {
                  user_id: 'deletion-user',
                  updated_at: new Date().toISOString(),
                  data: {
                    version: 3,
                    app: 'jolito',
                    deviceId: 'remote',
                    updatedAt: new Date().toISOString(),
                    cards,
                    deletedCardIds: [],
                  },
                },
              ]
            : {},
      })
    })
    await page.goto('/')
    for (const failure of [404, 503]) {
      await page
        .getByRole('button', { name: /signed in|tap to sync|sync/i })
        .first()
        .click()
      await page
        .getByRole('button', { name: /delete cloud account & data/i })
        .click()
      await page
        .getByRole('checkbox', { name: /download an offline backup/i })
        .uncheck()
      await page.getByPlaceholder('DELETE').fill('DELETE')
      for (const attempt of [1, 2]) {
        const confirm = page.getByRole('button', {
          name: /yes, delete cloud data/i,
        })
        await confirm.click()
        await expect(
          page.getByText('Deletion unavailable. Please try again.'),
        ).toBeVisible()
        await expect(page.getByText('delete@example.com')).toBeVisible()
        await expect(
          page.getByRole('button', { name: /yes, delete cloud data/i }),
        ).toBeEnabled()
        expect(
          await page.evaluate(() => localStorage.getItem('jolito-library-v1')),
        ).toContain('secreto')
        expect(
          await page.evaluate(() =>
            localStorage.getItem('jolito-auth-session-v1'),
          ),
        ).toContain('deletion-user')
        const alert = page.getByRole('alert')
        await expect(alert).toBeInViewport({ ratio: 1 })
        await expect(confirm).toBeInViewport({ ratio: 1 })
        await expect(
          page.getByRole('button', { name: 'Cancel', exact: true }),
        ).toBeInViewport({ ratio: 1 })
        await expect(page.getByPlaceholder('DELETE')).toHaveValue('DELETE')
        expect(
          await confirm.evaluate((button) => {
            const text = document.createRange()
            text.selectNodeContents(button)
            const label = text.getBoundingClientRect()
            const bounds = button.getBoundingClientRect()
            return (
              label.top >= bounds.top &&
              label.bottom <= bounds.bottom &&
              label.left >= bounds.left &&
              label.right <= bounds.right
            )
          }),
        ).toBe(true)
        expect((await auditAccessibility(page)).violations).toEqual([])
        await page.screenshot({
          path: `test-results/account-deletion-${viewport.width}-${failure}-${attempt}.png`,
          fullPage: true,
        })
      }
      await page.reload()
    }
    await page
      .getByRole('button', { name: /signed in|tap to sync|sync/i })
      .first()
      .click()
    await page
      .getByRole('button', { name: /delete cloud account & data/i })
      .click()
    await page
      .getByRole('checkbox', { name: /download an offline backup/i })
      .uncheck()
    await page.getByPlaceholder('DELETE').fill('DELETE')
    await page.getByRole('button', { name: /yes, delete cloud data/i }).click()
    await expect(
      page.getByText('Cloud account and backup data deleted.'),
    ).toBeVisible()
    expect(
      await page.evaluate(() => localStorage.getItem('jolito-auth-session-v1')),
    ).toBeNull()
    expect(
      await page.evaluate(() => localStorage.getItem('jolito-library-v1')),
    ).not.toContain('secreto')
    expect(deletionAttempts).toBe(5)
    expect(separateDeckDeletes).toEqual([])
  })
}
