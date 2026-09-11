import { expect, test } from '@playwright/test'
import {
  collectionVersion,
  createStudyCards,
  studyCardCollectionSchema,
} from '../../src/domain/card'
import { auditAccessibility } from './accessibility'

const auth = {
  accessToken: 'A-token',
  refreshToken: 'A-refresh',
  expiresAt: Date.now() + 3600000,
  user: { id: 'A', email: 'A@example.com' },
}
const collection = studyCardCollectionSchema.parse({
  version: collectionVersion,
  cards: createStudyCards(
    { spanish: 'A-private', english: 'A', context: '', bidirectional: false },
    'A',
    0,
  ),
  deletedCardIds: [],
})
for (const width of [320, 375]) {
  for (const action of [
    'grade',
    'grammar',
    'create',
    'edit',
    'import',
  ] as const) {
    test(`${action} explains denied account verification at ${width}px and preserves work through interruption and retry`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 667 })
      await page.addInitScript(
        ({ auth, collection }) => {
          if (localStorage.getItem('verification-recovery-seeded')) return
          localStorage.setItem('verification-recovery-seeded', 'true')
          localStorage.setItem('jolito-auth-session-v1', JSON.stringify(auth))
          localStorage.setItem(
            'jolito-libraries-v1',
            JSON.stringify({ version: 1, accounts: { 'user:A': collection } }),
          )
        },
        { auth, collection },
      )
      await page.route('https://mock.supabase.co/**', (route) =>
        route.fulfill({ json: route.request().method() === 'GET' ? [] : 1 }),
      )
      await page.goto(
        action === 'grammar'
          ? '/#/grammar'
          : action === 'grade'
            ? '/#/review'
            : action === 'create'
              ? '/#/create'
              : '/#/deck',
      )
      if (action === 'grammar')
        await page.getByRole('button', { name: 'Start practice' }).click()
      if (action === 'grade' || action === 'grammar') {
        await page.getByRole('textbox').fill('Keep my complete answer')
        await page.getByRole('textbox').press('Enter')
      } else if (action === 'create') {
        await page.locator('#spanish').fill('Keep my Spanish draft')
        await page.locator('#english').fill('Keep my English draft')
      } else if (action === 'edit') {
        await page.getByRole('cell', { name: 'A-private', exact: true }).click()
        await page.locator('#edit-prompt').fill('Keep my edited prompt')
      } else {
        await page.getByRole('button', { name: /backup & import/i }).click()
        await page
          .getByLabel(/choose anki deck or backup file/i)
          .setInputFiles({
            name: 'retained.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('Keep imported card\tKeep imported answer'),
          })
      }
      const before = await page.evaluate(() =>
        localStorage.getItem('jolito-libraries-v1'),
      )
      await page.evaluate(() => {
        const descriptor = Object.getOwnPropertyDescriptor(
          Storage.prototype,
          'getItem',
        )!
        const read = descriptor.value as (
          this: Storage,
          key: string,
        ) => string | null
        Storage.prototype.getItem = function (key) {
          if (key === 'jolito-auth-session-v1')
            throw new DOMException('Access denied', 'SecurityError')
          return read.call(this, key)
        }
        window.addEventListener(
          'restore-auth-read',
          () => Object.defineProperty(Storage.prototype, 'getItem', descriptor),
          { once: true },
        )
        // An unreadable notification must not reclassify A as guest or drop drafts.
        window.dispatchEvent(
          new StorageEvent('storage', { key: 'jolito-auth-session-v1' }),
        )
        window.dispatchEvent(new Event('online'))
        document.dispatchEvent(new Event('visibilitychange'))
      })
      const submit = page.getByRole('button', {
        name:
          action === 'grade' || action === 'grammar'
            ? /^4 Easy/i
            : action === 'create'
              ? /^Save card$/
              : action === 'edit'
                ? /^Save changes$/
                : /import deck \(replace current\)/i,
      })
      for (let attempt = 0; attempt < 2; attempt++) {
        await submit.click()
        const error = page
          .getByRole('alert')
          .filter({ hasText: 'Your account couldn’t be verified.' })
          .last()
        await expect(error).toBeInViewport({ ratio: 1 })
        expect(
          await page.evaluate(() =>
            localStorage.getItem('jolito-libraries-v1'),
          ),
        ).toBe(before)
        if (action === 'grade' || action === 'grammar')
          await expect(
            page.getByRole('status', { name: 'Answer feedback' }),
          ).toContainText('Keep my complete answer')
        else if (action === 'create')
          await expect(page.locator('#spanish')).toHaveValue(
            'Keep my Spanish draft',
          )
        else if (action === 'edit')
          await expect(page.locator('#edit-prompt')).toHaveValue(
            'Keep my edited prompt',
          )
        else
          expect(
            await page
              .getByLabel(/choose anki deck or backup file/i)
              .evaluate((input: HTMLInputElement) => input.files?.[0]?.name),
          ).toBe('retained.txt')
      }
      expect((await auditAccessibility(page)).violations).toEqual([])
      await page.screenshot({
        path: testInfo.outputPath('visible-account-verification-error.png'),
        fullPage: true,
      })
      await page.evaluate(() =>
        window.dispatchEvent(new Event('restore-auth-read')),
      )
      await submit.click()
      await expect
        .poll(() =>
          page.evaluate(() => localStorage.getItem('jolito-libraries-v1')),
        )
        .not.toBe(before)
      await page.reload()
      const saved = await page.evaluate(() =>
        localStorage.getItem('jolito-libraries-v1'),
      )
      expect(saved).not.toBe(before)
      expect(saved).toContain(
        action === 'grade' || action === 'grammar'
          ? '"reviews":1'
          : action === 'create'
            ? 'Keep my Spanish draft'
            : action === 'edit'
              ? 'Keep my edited prompt'
              : 'Keep imported card',
      )
    })
  }
}

for (const failure of [
  'transient read',
  'malformed JSON',
  'invalid schema',
  'empty value',
] as const) {
  test(`startup preserves legacy ownership through ${failure}, a pending redirect and recovery`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    const raw =
      failure === 'malformed JSON'
        ? '{broken'
        : failure === 'invalid schema'
          ? '{"user":{"id":"A"}}'
          : failure === 'empty value'
            ? ''
            : JSON.stringify(auth)
    const legacy = JSON.stringify(
      { ...collection, version: 3 },
      (key, value: unknown) =>
        key === 'contentRevision' || key === 'resetRevision'
          ? undefined
          : value,
    )
    await page.addInitScript(
      ({ raw, legacy, transient }) => {
        if (localStorage.getItem('startup-ownership-seeded')) return
        localStorage.setItem('startup-ownership-seeded', 'true')
        localStorage.setItem('jolito-auth-session-v1', raw)
        localStorage.setItem('jolito-library-v1', legacy)
        if (transient) {
          const descriptor = Object.getOwnPropertyDescriptor(
            Storage.prototype,
            'getItem',
          )!
          const read = descriptor.value as (
            this: Storage,
            key: string,
          ) => string | null
          let first = true
          Storage.prototype.getItem = function (key) {
            if (key === 'jolito-auth-session-v1' && first) {
              first = false
              throw new DOMException('Transient access denial', 'SecurityError')
            }
            return read.call(this, key)
          }
        }
      },
      { raw, legacy, transient: failure === 'transient read' },
    )
    const requests: unknown[] = []
    await page.route('https://mock.supabase.co/**', async (route) => {
      requests.push(
        route.request().method() === 'POST'
          ? route.request().postDataJSON()
          : route.request().url(),
      )
      await route.fulfill({
        json: route.request().method() === 'GET' ? [] : 1,
      })
    })
    const token = `header.${Buffer.from(JSON.stringify({ sub: 'B', email: 'B@example.com' })).toString('base64url')}.signature`
    await page.goto(`/#access_token=${token}&refresh_token=B-refresh`)
    const recovery = page.getByRole('heading', {
      name: 'Let’s protect your saved deck',
    })
    await expect(recovery).toBeVisible()
    expect(
      await page.evaluate(() => localStorage.getItem('jolito-auth-session-v1')),
    ).toBe(raw)
    expect(
      await page.evaluate(() => localStorage.getItem('jolito-library-v1')),
    ).toBe(legacy)
    expect(
      await page.evaluate(() => localStorage.getItem('jolito-libraries-v1')),
    ).toBeNull()
    expect(page.url()).toContain('access_token=')
    expect(requests).toEqual([])
    await expect(page.getByRole('link', { name: 'Get help' })).toHaveAttribute(
      'href',
      'mailto:a@joli.to',
    )
    expect((await auditAccessibility(page)).violations).toEqual([])
    await page.screenshot({
      path: `test-results/account-startup-${failure.replace(/ /g, '-')}.png`,
      fullPage: true,
    })
    if (failure !== 'transient read') {
      await page.getByRole('button', { name: 'Try again' }).click()
      await expect(recovery).toBeVisible()
      await page.reload()
      await expect(recovery).toBeVisible()
      expect(
        await page.evaluate(() =>
          localStorage.getItem('jolito-auth-session-v1'),
        ),
      ).toBe(raw)
      expect(
        await page.evaluate(() => localStorage.getItem('jolito-libraries-v1')),
      ).toBeNull()
      // Model assistance restoring the original session; the app never guesses
      // an owner or discards damaged identity evidence to manufacture a guest.
      await page.evaluate(
        (auth) =>
          localStorage.setItem('jolito-auth-session-v1', JSON.stringify(auth)),
        auth,
      )
    }
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(recovery).toHaveCount(0)
    await expect.poll(() => requests.length).toBeGreaterThan(0)
    expect(JSON.stringify(requests)).not.toContain('A-private')
    const libraries = await page.evaluate(() =>
      localStorage.getItem('jolito-libraries-v1'),
    )
    expect(libraries).toContain('user:A')
    expect(libraries).toContain('A-private')
    expect(libraries).not.toContain('"guest"')
    await page.reload()
    expect(
      await page.evaluate(() => localStorage.getItem('jolito-libraries-v1')),
    ).toContain('user:A')
    await expect(
      page.getByRole('row', { name: /card: A-private,/i }),
    ).toHaveCount(0)
  })
}
