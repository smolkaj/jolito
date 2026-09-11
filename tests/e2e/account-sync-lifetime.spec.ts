import { expect, test } from '@playwright/test'
import { createStudyCards } from '../../src/domain/card'
import { currentDeckJson } from './storage'
import { auditAccessibility } from './accessibility'

type HeldSyncWindow = Window & {
  releaseOldSync: () => void
  oldSyncReached: boolean
  oldSyncReleased: boolean
}
type CloudPush = { user_id: string; data: { cards: unknown[] } }

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

for (const heldAt of ['response', 'body'] as const) {
  test(`disposed A sync cannot overwrite fresh A after A → B → A with an internal ${heldAt} held`, async ({
    page,
    context,
  }) => {
    await page.addInitScript(
      ({ a, b, auth, stage }) => {
        if (!localStorage.getItem('seeded')) {
          localStorage.setItem('seeded', 'true')
          localStorage.setItem('jolito-auth-session-v1', JSON.stringify(auth))
          localStorage.setItem(
            'jolito-libraries-v1',
            JSON.stringify({
              version: 1,
              accounts: {
                'user:A': { version: 3, cards: a, deletedCardIds: [] },
                'user:B': { version: 3, cards: b, deletedCardIds: [] },
              },
            }),
          )
        }
        if (sessionStorage.getItem('held-sync-installed')) return
        sessionStorage.setItem('held-sync-installed', 'true')
        let release!: () => void
        const held = new Promise<void>((done) => {
          release = done
        })
        Object.assign(window, {
          releaseOldSync: release,
          oldSyncReached: false,
          oldSyncReleased: false,
        })
        const nativeFetch = window.fetch.bind(window)
        let first = true
        window.fetch = async (...args) => {
          const target =
            args[0] instanceof Request ? args[0].url : args[0].toString()
          const response = await nativeFetch(...args)
          if (!first || !target.includes('/decks?user_id=eq.A')) return response
          first = false
          if (stage === 'response') {
            Object.assign(window, { oldSyncReached: true })
            await held
            Object.assign(window, { oldSyncReleased: true })
            return response
          }
          const read = response.json.bind(response)
          response.json = async () => {
            const data: unknown = await read()
            Object.assign(window, { oldSyncReached: true })
            await held
            Object.assign(window, { oldSyncReleased: true })
            return data
          }
          return response
        }
      },
      { a: cards('A'), b: cards('B'), auth: session('A'), stage: heldAt },
    )
    const pushes: CloudPush[] = []
    const cloud = new Map<string, CloudPush>()
    await page.route('https://mock.supabase.co/**', async (route) => {
      if (route.request().method() === 'POST') {
        const snapshot = route.request().postDataJSON() as CloudPush
        pushes.push(snapshot)
        cloud.set(snapshot.user_id, snapshot)
        await route.fulfill({ json: {} })
      } else {
        const owner = new URL(route.request().url()).searchParams
          .get('user_id')
          ?.slice(3)
        const snapshot = owner ? cloud.get(owner) : undefined
        await route.fulfill({ json: snapshot ? [snapshot] : [] })
      }
    })
    await page.goto('/#/deck')
    await expect(
      page.getByRole('row', { name: /card: A-private,/i }),
    ).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as HeldSyncWindow).oldSyncReached,
        ),
      )
      .toBe(true)
    const helper = await context.newPage()
    await helper.route('**/ownership-helper', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<title>Storage lifecycle helper</title>',
      }),
    )
    await helper.goto('/ownership-helper')
    await helper.evaluate(
      (auth) =>
        localStorage.setItem('jolito-auth-session-v1', JSON.stringify(auth)),
      session('B'),
    )
    await expect(
      page.getByRole('row', { name: /card: B-private,/i }),
    ).toBeVisible()
    await helper.evaluate(
      (auth) =>
        localStorage.setItem('jolito-auth-session-v1', JSON.stringify(auth)),
      session('A'),
    )
    await expect(
      page.getByRole('row', { name: /card: A-private,/i }),
    ).toBeVisible()
    await page.getByRole('button', { name: '+ New card', exact: true }).click()
    await page
      .getByLabel('Mexican Spanish', { exact: true })
      .fill('Fresh A card')
    await page.locator('#english').fill('Fresh answer')
    await page.getByRole('button', { name: 'Save card', exact: true }).click()
    await expect
      .poll(() => JSON.stringify(pushes[pushes.length - 1]))
      .toContain('Fresh A card')
    const before = pushes.length
    await page.evaluate(() =>
      (window as unknown as HeldSyncWindow).releaseOldSync(),
    )
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as HeldSyncWindow).oldSyncReleased,
        ),
      )
      .toBe(true)
    await page.evaluate(
      () =>
        new Promise<void>((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done())),
        ),
    )
    expect(pushes).toHaveLength(before)
    expect(JSON.stringify(cloud.get('A'))).toContain('Fresh A card')
    expect(JSON.stringify(pushes[pushes.length - 1])).toContain('Fresh A card')
    expect(await page.evaluate(currentDeckJson)).toContain('Fresh A card')
    await page.reload()
    expect(await page.evaluate(currentDeckJson)).toContain('Fresh A card')
    await expect
      .poll(() => JSON.stringify(pushes[pushes.length - 1]))
      .toContain('Fresh A card')
    await page.getByRole('button', { name: 'Manage deck', exact: true }).click()
    await expect(
      page.getByRole('row', { name: /card: Fresh A card,/i }),
    ).toBeVisible()
    expect((await auditAccessibility(page)).violations).toEqual([])
    await page.screenshot({
      path: `test-results/account-sync-lifetime-${heldAt}.png`,
      fullPage: true,
    })
    await helper.close()
  })
}
