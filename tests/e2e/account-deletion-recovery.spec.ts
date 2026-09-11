import { expect, test, type Page } from '@playwright/test'
import { createStudyCards } from '../../src/domain/card'
import { auditAccessibility } from './accessibility'

const accountCards = (id: string) =>
  createStudyCards(
    {
      spanish: `${id}-private`,
      english: id,
      context: '',
      bidirectional: false,
    },
    id,
    0,
  )
const authSession = (id: string) => ({
  accessToken: `token-${id}`,
  refreshToken: `refresh-${id}`,
  expiresAt: Date.now() + 3600000,
  user: { id, email: `${id}@example.com` },
})
async function confirmDeletion(page: Page) {
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
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ a, b, auth }) => {
      if (localStorage.getItem('deletion-recovery-seeded')) return
      localStorage.setItem('deletion-recovery-seeded', 'true')
      localStorage.setItem('jolito-auth-session-v1', JSON.stringify(auth))
      localStorage.setItem(
        'jolito-libraries-v1',
        JSON.stringify({
          version: 1,
          accounts: {
            'user:A': { version: 3, cards: a },
            'user:B': { version: 3, cards: b },
          },
        }),
      )
    },
    { a: accountCards('A'), b: accountCards('B'), auth: authSession('A') },
  )
})

for (const failure of ['confirmation', 'cleanup'] as const) {
  test(`recovers a confirmed cloud deletion across ${failure} write denial and reload without erasing another account`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.addInitScript((failAt) => {
      const descriptor = Object.getOwnPropertyDescriptor(
        Storage.prototype,
        'setItem',
      )!
      const write = descriptor.value as (
        this: Storage,
        key: string,
        value: string,
      ) => void
      Storage.prototype.setItem = function (key, value) {
        if (
          key === 'jolito-libraries-v1' &&
          !sessionStorage.getItem('allow-cleanup')
        ) {
          const envelope = JSON.parse(value) as {
            deletion?: { phase: string }
            accounts: Record<string, unknown>
          }
          if (
            (failAt === 'confirmation' &&
              envelope.deletion?.phase === 'confirmed') ||
            (failAt === 'cleanup' && !envelope.accounts['user:A'])
          )
            throw new DOMException('Full', 'QuotaExceededError')
        }
        write.call(this, key, value)
      }
    }, failure)
    let deletes = 0
    await page.route('https://mock.supabase.co/**', async (route) => {
      if (route.request().url().includes('/rpc/delete_user_account')) {
        expect(
          await page.evaluate(
            () =>
              (
                JSON.parse(localStorage.getItem('jolito-libraries-v1')!) as {
                  deletion: { phase: string }
                }
              ).deletion.phase,
          ),
        ).toBe('requested')
        deletes++
        await route.fulfill({ status: 204 })
      } else
        await route.fulfill({
          json: route.request().method() === 'GET' ? [] : {},
        })
    })
    await page.goto('/#/deck')
    await confirmDeletion(page)
    await expect(
      page.getByRole('heading', { name: 'Finish account deletion' }),
    ).toBeVisible()
    expect(
      await page.evaluate(() => localStorage.getItem('jolito-auth-session-v1')),
    ).toBeNull()
    await page.evaluate(
      (auth) =>
        localStorage.setItem('jolito-auth-session-v1', JSON.stringify(auth)),
      authSession('B'),
    )
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Finish account deletion' }),
    ).toBeVisible()
    expect((await auditAccessibility(page)).violations).toEqual([])
    await page.screenshot({
      path: `test-results/deletion-recovery-${failure}-mobile.png`,
    })
    expect(deletes).toBe(1)
    expect(
      await page.evaluate(() => localStorage.getItem('jolito-libraries-v1')),
    ).toContain('A-private')
    await page.evaluate(() => sessionStorage.setItem('allow-cleanup', 'true'))
    if (failure === 'cleanup')
      await page.getByRole('button', { name: 'Try again' }).click()
    else {
      await expect(
        page.getByText(/deletion hasn’t finished on this device/i),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Retry cloud deletion' }),
      ).toHaveCount(0)
      await page.getByRole('button', { name: 'Keep local deck' }).click()
    }
    await expect(
      page.getByRole('row', { name: /card: B-private,/i }),
    ).toBeVisible()
    const envelope = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('jolito-libraries-v1')!) as {
          accounts: Record<string, unknown>
          deletion?: unknown
        },
    )
    expect(envelope.deletion).toBeUndefined()
    expect(envelope.accounts['user:B']).toEqual({
      version: 3,
      cards: accountCards('B'),
      deletedCardIds: [],
    })
    expect(Boolean(envelope.accounts['user:A'])).toBe(
      failure === 'confirmation',
    )
    expect(deletes).toBe(1)
  })
}

test('keeps an interrupted cloud outcome across reload and retries only the original owner', async ({
  page,
}) => {
  let attempts = 0
  await page.route('https://mock.supabase.co/**', async (route) => {
    if (route.request().url().includes('/rpc/delete_user_account')) {
      attempts++
      if (attempts === 1) await route.abort('failed')
      else
        await route.fulfill({
          status: 503,
          json: {
            message: 'Cloud deletion unavailable. Local cards retained.',
          },
        })
    } else
      await route.fulfill({
        json: route.request().method() === 'GET' ? [] : {},
      })
  })
  await page.goto('/#/deck')
  await confirmDeletion(page)
  await expect(
    page.getByText(/deletion hasn’t finished on this device/i),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Retry cloud deletion' }),
  ).toBeVisible()
  expect(
    await page.evaluate(() => localStorage.getItem('jolito-libraries-v1')),
  ).toContain('A-private')
  await page.getByRole('button', { name: 'Retry cloud deletion' }).click()
  await expect(
    page.getByRole('row', { name: /card: A-private,/i }),
  ).toBeVisible()
  await expect(
    page.getByText('Cloud deletion unavailable. Local cards retained.'),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('row', { name: /card: A-private,/i }),
  ).toBeVisible()
  expect(attempts).toBe(2)
})

for (const boundary of [
  'before-dispatch',
  'during-refresh',
  'before-retry',
] as const) {
  test(`never deletes or forgets either account when persisted ownership changes ${boundary} before its storage event`, async ({
    page,
  }) => {
    const deletions: string[] = []
    let releaseRefresh!: () => void
    const heldRefresh = new Promise<void>((resolve) => {
      releaseRefresh = resolve
    })
    let refreshing = false
    await page.route('https://mock.supabase.co/**', async (route) => {
      const request = route.request()
      if (request.url().includes('grant_type=refresh_token')) {
        refreshing = true
        await heldRefresh
        await route.fulfill({
          status: 503,
          json: { message: 'Refresh interrupted' },
        })
      } else if (request.url().includes('/rpc/delete_user_account')) {
        deletions.push(request.headers().authorization ?? '')
        // A's rejected request must not refresh/retry using B's persisted session.
        await page.evaluate(
          (auth) =>
            localStorage.setItem(
              'jolito-auth-session-v1',
              JSON.stringify(auth),
            ),
          authSession('B'),
        )
        await route.fulfill({
          status: 401,
          json: { message: 'Sign in again.' },
        })
      } else await route.fulfill({ json: request.method() === 'GET' ? [] : {} })
    })
    await page.goto('/#/deck')
    await expect(
      page.getByRole('row', { name: /card: A-private,/i }),
    ).toBeVisible()
    if (boundary === 'before-dispatch') {
      // This is the persisted-session window before the other tab's storage event.
      await page.evaluate(
        (auth) =>
          localStorage.setItem('jolito-auth-session-v1', JSON.stringify(auth)),
        authSession('B'),
      )
    } else if (boundary === 'during-refresh') {
      await page.evaluate(
        (auth) =>
          localStorage.setItem(
            'jolito-auth-session-v1',
            JSON.stringify({ ...auth, expiresAt: 0 }),
          ),
        authSession('A'),
      )
    }
    await confirmDeletion(page)
    if (boundary === 'during-refresh') {
      await expect.poll(() => refreshing).toBe(true)
      await page.evaluate(
        (auth) =>
          localStorage.setItem('jolito-auth-session-v1', JSON.stringify(auth)),
        authSession('B'),
      )
      releaseRefresh()
    }
    await expect(
      page.getByRole('button', { name: /yes, delete cloud data/i }),
    ).toBeEnabled()
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const envelope = JSON.parse(
            localStorage.getItem('jolito-libraries-v1')!,
          ) as { deletion?: unknown }
          return envelope.deletion === undefined
        }),
      )
      .toBe(true)
    expect(deletions).toEqual(
      boundary === 'before-retry' ? ['Bearer token-A'] : [],
    )
    const stored = await page.evaluate(() =>
      localStorage.getItem('jolito-libraries-v1'),
    )
    expect(stored).toContain('A-private')
    expect(stored).toContain('B-private')
    expect(
      await page.evaluate(() => localStorage.getItem('jolito-auth-session-v1')),
    ).toContain('token-B')
    await page.evaluate(() =>
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'jolito-auth-session-v1' }),
      ),
    )
    await expect(
      page.getByRole('row', { name: /card: B-private,/i }),
    ).toBeVisible()
    await page.reload()
    await expect(
      page.getByRole('row', { name: /card: B-private,/i }),
    ).toBeVisible()
    expect(
      await page.evaluate(() => localStorage.getItem('jolito-libraries-v1')),
    ).toContain('A-private')
  })
}

for (const failure of ['confirmation', 'cleanup'] as const) {
  test(`protects a live deletion from another tab's cancellation and retry, including failed ${failure} writes and reload`, async ({
    page,
    context,
  }) => {
    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    let deletes = 0
    await context.route('https://mock.supabase.co/**', async (route) => {
      if (route.request().url().includes('/rpc/delete_user_account')) {
        deletes++
        await held
        await route.fulfill({ status: 204 })
      } else
        await route.fulfill({
          json: route.request().method() === 'GET' ? [] : {},
        })
    })
    await page.goto('/#/deck')
    await confirmDeletion(page)
    await expect.poll(() => deletes).toBe(1)
    const other = await context.newPage()
    await other.setViewportSize({ width: 375, height: 667 })
    await other.goto('/#/deck')
    await other.getByRole('button', { name: 'Keep local deck' }).click()
    await expect(other.getByRole('alert')).toContainText(
      'Account deletion is still running in another tab',
    )
    await other.getByRole('button', { name: 'Retry cloud deletion' }).click()
    await expect(other.getByRole('alert')).toContainText(
      'Account deletion is still running in another tab',
    )
    expect(deletes).toBe(1)
    expect((await auditAccessibility(other)).violations).toEqual([])
    await other.screenshot({
      path: `test-results/deletion-live-${failure}-mobile.png`,
    })
    await page.evaluate((failAt) => {
      const write = Object.getOwnPropertyDescriptor(
        Storage.prototype,
        'setItem',
      )!.value as (this: Storage, key: string, value: string) => void
      Storage.prototype.setItem = function (key, value) {
        if (key === 'jolito-libraries-v1') {
          const envelope = JSON.parse(value) as {
            deletion?: { phase: string }
            accounts: Record<string, unknown>
          }
          if (
            (failAt === 'confirmation' &&
              envelope.deletion?.phase === 'confirmed') ||
            (failAt === 'cleanup' && !envelope.accounts['user:A'])
          )
            throw new DOMException('Full', 'QuotaExceededError')
        }
        write.call(this, key, value)
      }
    }, failure)
    release()
    await expect(
      page.getByText(/local cleanup could not finish/i),
    ).toBeVisible()
    await other.reload()
    await expect(
      other.getByRole('heading', { name: 'Finish account deletion' }),
    ).toBeVisible()
    if (failure === 'cleanup') {
      await other.getByRole('button', { name: 'Try again' }).click()
    } else {
      await expect(
        other.getByText(/deletion hasn’t finished on this device/i),
      ).toBeVisible()
      // The failed confirmation remains unknown after reload. Keeping the deck
      // is now safe from a late response because the original request finished.
      await other.getByRole('button', { name: 'Keep local deck' }).click()
    }
    await expect(
      other.getByRole('heading', { name: 'Finish account deletion' }),
    ).toHaveCount(0)
    const envelope = await other.evaluate(
      () =>
        JSON.parse(localStorage.getItem('jolito-libraries-v1')!) as {
          accounts: Record<string, unknown>
          deletion?: unknown
        },
    )
    expect(envelope.deletion).toBeUndefined()
    expect(Boolean(envelope.accounts['user:A'])).toBe(
      failure === 'confirmation',
    )
    expect(envelope.accounts['user:B']).toEqual({
      version: 3,
      cards: accountCards('B'),
      deletedCardIds: [],
    })
    expect(deletes).toBe(1)
    await other.close()
  })
}

test('releases a live deletion when its tab closes and recovers the durable request without deleting unconfirmed cards', async ({
  page,
  context,
}) => {
  let dispatched = false
  await context.route('https://mock.supabase.co/**', async (route) => {
    if (route.request().url().includes('/rpc/delete_user_account')) {
      if (!dispatched) {
        dispatched = true
        // Closing the tab destroys this request and releases its browser lock.
        await new Promise<void>((resolve) =>
          page.once('close', () => resolve()),
        )
        await route.abort().catch(() => {})
      } else
        await route.fulfill({
          status: 503,
          json: { message: 'Deletion unavailable; your cards are safe.' },
        })
    } else
      await route.fulfill({
        json: route.request().method() === 'GET' ? [] : {},
      })
  })
  await page.goto('/#/deck')
  await confirmDeletion(page)
  await expect.poll(() => dispatched).toBe(true)
  const other = await context.newPage()
  await other.goto('/#/deck')
  await page.close()
  await other.getByRole('button', { name: 'Retry cloud deletion' }).click()
  await expect(
    other.getByRole('row', { name: /card: A-private,/i }),
  ).toBeVisible()
  await other.reload()
  await expect(
    other.getByRole('row', { name: /card: A-private,/i }),
  ).toBeVisible()
  const stored = await other.evaluate(() =>
    localStorage.getItem('jolito-libraries-v1'),
  )
  expect(stored).toContain('A-private')
  expect(stored).toContain('B-private')
  await other.close()
})

test('restores private study progress through failed deletion, later expired auth, reload and same-owner sign-in', async ({
  page,
}) => {
  const requests: string[] = []
  await page.route('https://mock.supabase.co/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/rpc/delete_user_account')) {
      requests.push('delete')
      await route.fulfill({
        status: 401,
        json: { message: 'Sign in again to delete your account.' },
      })
    } else if (url.includes('/auth/v1/token')) {
      requests.push('refresh')
      await route.fulfill({
        status: 400,
        json: { message: 'Refresh token rejected' },
      })
    } else if (url.includes('/auth/v1/verify')) {
      requests.push('verify')
      await route.fulfill({
        json: {
          access_token: 'reauthenticated-A',
          refresh_token: 'reauthenticated-refresh-A',
          expires_in: 3600,
          user: authSession('A').user,
        },
      })
    } else
      await route.fulfill({
        json: route.request().method() === 'GET' ? [] : {},
      })
  })
  await page.goto('/#/deck')
  await expect(
    page.getByRole('row', { name: /card: A-private,/i }),
  ).toBeVisible()
  // Persist actual study progress before the interrupted account lifecycle.
  await page.evaluate(() => {
    const envelope = JSON.parse(
      localStorage.getItem('jolito-libraries-v1')!,
    ) as {
      accounts: Record<
        string,
        { cards: Array<{ schedule: Record<string, unknown> }> }
      >
    }
    Object.assign(envelope.accounts['user:A']!.cards[0]!.schedule, {
      state: 'review',
      reviews: 7,
      lapses: 2,
      intervalDays: 14,
      dueAt: Date.now() + 14 * 86400000,
      lastReviewedAt: Date.now(),
    })
    localStorage.setItem('jolito-libraries-v1', JSON.stringify(envelope))
  })
  await page.reload()
  await expect(
    page.getByRole('row', { name: /card: A-private,/i }),
  ).toBeVisible()
  const privateDecks = () =>
    page.evaluate(
      () =>
        (
          JSON.parse(localStorage.getItem('jolito-libraries-v1')!) as {
            accounts: unknown
          }
        ).accounts,
    )
  const before = await privateDecks()
  const authBefore = await page.evaluate(() =>
    localStorage.getItem('jolito-auth-session-v1'),
  )
  await confirmDeletion(page)
  await expect(page.getByRole('alert')).toBeVisible()
  expect(requests).toEqual(['delete', 'refresh'])
  expect(await privateDecks()).toEqual(before)
  expect(
    await page.evaluate(() => localStorage.getItem('jolito-auth-session-v1')),
  ).toBe(authBefore)
  // A later, independent expiry follows normal sign-out behavior. Its account
  // library must survive both that transition and another signed-out reload.
  await page.evaluate(() => {
    const auth = JSON.parse(
      localStorage.getItem('jolito-auth-session-v1')!,
    ) as { expiresAt: number }
    auth.expiresAt = 0
    localStorage.setItem('jolito-auth-session-v1', JSON.stringify(auth))
  })
  await page.reload()
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('jolito-auth-session-v1')),
    )
    .toBeNull()
  expect(await privateDecks()).toEqual(before)
  await page.reload()
  await expect(
    page.getByRole('row', { name: /card: A-private,/i }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Sign in to build your deck' }).click()
  await page.getByLabel(/email address/i).fill('A@example.com')
  await page.getByRole('button', { name: /send sign-in link/i }).click()
  await page.getByLabel(/6-digit code or sign-in link/i).fill('123456')
  await page.getByRole('button', { name: /sign in & sync/i }).click()
  await expect(
    page.getByRole('row', { name: /card: A-private,/i }),
  ).toBeVisible()
  expect(await privateDecks()).toEqual(before)
  expect(requests).toEqual(['delete', 'refresh', 'refresh', 'verify'])
  await page.reload()
  await expect(
    page.getByRole('row', { name: /card: A-private,/i }),
  ).toBeVisible()
  expect(await privateDecks()).toEqual(before)
  expect((await auditAccessibility(page)).violations).toEqual([])
  await page.screenshot({
    path: 'test-results/account-ownership-reauthenticated-progress.png',
    fullPage: true,
  })
})
