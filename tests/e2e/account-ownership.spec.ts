import { expect, test } from '@playwright/test'
import { createStudyCards } from '../../src/domain/card'
import { currentDeckJson } from './storage'
import { auditAccessibility } from './accessibility'

const cards = (owner: string) =>
  createStudyCards(
    {
      spanish: `${owner}-private`,
      english: owner,
      context: '',
      bidirectional: false,
    },
    owner,
    0,
  )
const session = (owner: string) => ({
  accessToken: `token-${owner}`,
  refreshToken: `refresh-${owner}`,
  expiresAt: Date.now() + 3600000,
  user: { id: owner, email: `${owner}@example.com` },
})
const jwt = (owner: string) =>
  `header.${Buffer.from(JSON.stringify({ sub: owner, email: `${owner}@example.com` })).toString('base64url')}.signature`

test('auth redirect migrates the previous owner before loading a new account, then reloads without guest adoption', async ({
  page,
}) => {
  await page.addInitScript(
    ({ initial, auth }) => {
      if (localStorage.getItem('seeded')) return
      localStorage.setItem('seeded', 'true')
      localStorage.setItem('jolito-auth-session-v1', JSON.stringify(auth))
      localStorage.setItem(
        'jolito-library-v1',
        JSON.stringify({ version: 3, cards: initial }),
      )
    },
    { initial: cards('A'), auth: session('A') },
  )
  const pushes: unknown[] = []
  await page.route('https://mock.supabase.co/**', async (route) => {
    if (route.request().method() === 'POST')
      pushes.push(route.request().postDataJSON())
    await route.fulfill({ json: route.request().method() === 'GET' ? [] : {} })
  })
  await page.goto(`/#access_token=${jwt('B')}&refresh_token=refresh-B`)
  await expect(
    page.getByRole('button', { name: /signed in|sync/i }).first(),
  ).toBeVisible()
  await expect.poll(() => pushes.length).toBeGreaterThan(0)
  expect(JSON.stringify(pushes)).not.toContain('A-private')
  expect(await page.evaluate(currentDeckJson)).not.toContain('A-private')
  const envelope = await page.evaluate(() =>
    localStorage.getItem('jolito-libraries-v1'),
  )
  expect(envelope).toContain('user:A')
  expect(envelope).toContain('A-private')
  await page.reload()
  expect(await page.evaluate(currentDeckJson)).not.toContain('A-private')
  expect((await auditAccessibility(page)).violations).toEqual([])
  await page.screenshot({
    path: 'test-results/account-ownership-redirect.png',
    fullPage: true,
  })
})

test('cross-tab A → B → signed out changes isolate held cloud responses and survive reload', async ({
  page,
  context,
}) => {
  await page.addInitScript(
    ({ a, b, auth }) => {
      if (localStorage.getItem('seeded')) return
      localStorage.setItem('seeded', 'true')
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
    { a: cards('A'), b: cards('B'), auth: session('A') },
  )
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  const pushes: Array<{ body: unknown; authorization: string | undefined }> = []
  let pullingA = false
  await page.route('https://mock.supabase.co/**', async (route) => {
    if (
      route.request().method() === 'GET' &&
      route.request().url().includes('eq.A')
    ) {
      pullingA = true
      await held
    }
    if (route.request().method() === 'POST')
      pushes.push({
        body: route.request().postDataJSON(),
        authorization: route.request().headers().authorization,
      })
    await route.fulfill({ json: route.request().method() === 'GET' ? [] : {} })
  })
  await page.goto('/#/deck')
  await expect(
    page.getByRole('row', { name: /card: A-private,/i }),
  ).toBeVisible()
  await expect.poll(() => pullingA).toBe(true)
  const helper = await context.newPage()
  await helper.route('**/ownership-helper', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<title>Storage lifecycle helper</title>',
    }),
  )
  await helper.goto('/ownership-helper')
  const staleRequest = page.waitForEvent('requestfailed', (request) =>
    request.url().includes('/decks?user_id=eq.A'),
  )
  await helper.evaluate(
    (auth) =>
      localStorage.setItem('jolito-auth-session-v1', JSON.stringify(auth)),
    session('B'),
  )
  await expect(
    page.getByRole('row', { name: /card: B-private,/i }),
  ).toBeVisible()
  expect((await staleRequest).failure()).not.toBeNull()
  release()
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
  await expect.poll(() => pushes.length).toBeGreaterThan(0)
  expect(
    pushes.every(
      (push) =>
        push.authorization === 'Bearer token-B' &&
        !JSON.stringify(push.body).includes('A-private'),
    ),
  ).toBe(true)
  expect(await page.evaluate(currentDeckJson)).toContain('B-private')
  await page.reload()
  await expect(
    page.getByRole('row', { name: /card: B-private,/i }),
  ).toBeVisible()
  await helper.evaluate(() => localStorage.removeItem('jolito-auth-session-v1'))
  await expect(page.getByRole('row', { name: /private,/i })).toHaveCount(0)
  await page.reload()
  expect(await page.evaluate(currentDeckJson)).not.toContain('private')
  await helper.close()
})

test('failed ownership migration preserves the old auth owner through reload before redirect retry', async ({
  page,
}) => {
  await page.addInitScript(
    ({ initial, auth }) => {
      if (!localStorage.getItem('seeded')) {
        localStorage.setItem('seeded', 'true')
        localStorage.setItem('jolito-auth-session-v1', JSON.stringify(auth))
        localStorage.setItem(
          'jolito-library-v1',
          JSON.stringify({ version: 3, cards: initial }),
        )
      }
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const write = Storage.prototype.setItem
      Storage.prototype.setItem = function (key, value) {
        if (
          key === 'jolito-libraries-v1' &&
          !sessionStorage.getItem('quota-restored')
        )
          throw new DOMException('Quota', 'QuotaExceededError')
        return write.call(this, key, value)
      }
    },
    { initial: cards('A'), auth: session('A') },
  )
  await page.route('https://mock.supabase.co/**', (route) =>
    route.fulfill({ json: route.request().method() === 'GET' ? [] : {} }),
  )
  await page.goto(`/#access_token=${jwt('B')}&refresh_token=refresh-B`)
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  expect(
    await page.evaluate(
      () =>
        (
          JSON.parse(localStorage.getItem('jolito-auth-session-v1')!) as {
            user: { id: string }
          }
        ).user.id,
    ),
  ).toBe('A')
  await page.setViewportSize({ width: 375, height: 667 })
  expect((await auditAccessibility(page)).violations).toEqual([])
  await page.screenshot({
    path: 'test-results/account-ownership-migration-recovery-mobile.png',
    fullPage: true,
  })
  await page.evaluate(() => sessionStorage.setItem('quota-restored', 'true'))
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0)
  expect(
    await page.evaluate(
      () =>
        (
          JSON.parse(localStorage.getItem('jolito-auth-session-v1')!) as {
            user: { id: string }
          }
        ).user.id,
    ),
  ).toBe('B')
  expect(await page.evaluate(currentDeckJson)).not.toContain('A-private')
  expect(
    await page.evaluate(() => localStorage.getItem('jolito-libraries-v1')),
  ).toContain('user:A')
})

for (const token of ['123456', 'a'.repeat(64)]) {
  test(`keeps the persisted account through held ${token.length === 6 ? 'numeric' : 'hash'} sign-in before storage event delivery and reload`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ a, b }) => {
        if (localStorage.getItem('otp-ownership-seeded')) return
        localStorage.setItem('otp-ownership-seeded', 'true')
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
      { a: cards('A'), b: cards('B') },
    )
    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    let verifying = false
    let requests = 0
    await page.route('https://mock.supabase.co/**', async (route) => {
      if (route.request().url().includes('/auth/v1/verify')) {
        verifying = true
        requests++
        await held
        await route.fulfill({
          json: {
            access_token: jwt('A'),
            refresh_token: 'verified-refresh-A',
            expires_in: 3600,
            user: session('A').user,
          },
        })
      } else
        await route.fulfill({
          json: route.request().method() === 'GET' ? [] : {},
        })
    })
    await page.goto('/#/deck')
    await page
      .getByRole('button', {
        name: 'Sign in to build your deck',
      })
      .click()
    await page.getByLabel(/email address/i).fill('A@example.com')
    await page.getByRole('button', { name: /send sign-in link/i }).click()
    await page.getByLabel(/6-digit code or sign-in link/i).fill(token)
    await page.getByRole('button', { name: /sign in & sync/i }).click()
    await expect.poll(() => verifying).toBe(true)
    // Reproduce the persisted-session window before the other tab's event arrives.
    const auth = session('B')
    await page.evaluate(
      (value) =>
        localStorage.setItem('jolito-auth-session-v1', JSON.stringify(value)),
      auth,
    )
    release()
    await expect(
      page.getByText('Your sign-in session changed. Please try again.'),
    ).toBeVisible()
    expect(requests).toBe(1)
    expect(
      await page.evaluate(() => localStorage.getItem('jolito-auth-session-v1')),
    ).toBe(JSON.stringify(auth))
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
