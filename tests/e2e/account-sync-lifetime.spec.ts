import { expect, test } from '@playwright/test'
import {
  collectionVersion,
  createStudyCards,
  studyCardCollectionSchema,
} from '../../src/domain/card'
import { currentDeckJson } from './storage'
import { auditAccessibility } from './accessibility'

type HeldSyncWindow = Window & {
  releaseOldSync: () => void
  oldSyncReached: boolean
  oldSyncReleased: boolean
}
type CloudPush = {
  p_user_id: string
  p_expected_revision: number
  p_data: { cards: unknown[]; updatedAt: string }
}
type CloudSnapshot = {
  user_id: string
  revision: number
  updated_at: string
  data: CloudPush['p_data']
}

const collection = (owner: string) =>
  studyCardCollectionSchema.parse({
    version: collectionVersion,
    cards: createStudyCards(
      {
        spanish: `${owner}-private`,
        english: owner,
        context: '',
        bidirectional: false,
      },
      owner,
      0,
    ),
    deletedCardIds: [],
  })
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
                'user:A': a,
                'user:B': b,
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
          if (!first || !target.includes('/rpc/read_deck_snapshot'))
            return response
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
      {
        a: collection('A'),
        b: collection('B'),
        auth: session('A'),
        stage: heldAt,
      },
    )
    const pushes: CloudPush[] = []
    const cloud = new Map<string, CloudSnapshot>()
    await page.route('https://mock.supabase.co/**', async (route) => {
      if (route.request().method() === 'POST') {
        const snapshot = route.request().postDataJSON() as CloudPush
        pushes.push(snapshot)
        const currentRevision = cloud.get(snapshot.p_user_id)?.revision ?? 0
        if (snapshot.p_expected_revision !== currentRevision) {
          await route.fulfill({ json: null })
          return
        }
        const revision = currentRevision + 1
        cloud.set(snapshot.p_user_id, {
          user_id: snapshot.p_user_id,
          revision,
          updated_at: snapshot.p_data.updatedAt,
          data: snapshot.p_data,
        })
        await route.fulfill({ json: revision })
      } else {
        const owner = route
          .request()
          .headers()
          .authorization?.replace('Bearer token-', '')
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
