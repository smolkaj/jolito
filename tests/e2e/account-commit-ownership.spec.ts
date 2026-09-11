import { expect, test, type Page } from '@playwright/test'
import { collectionVersion, createStudyCards } from '../../src/domain/card'

const session = (id: string) => ({
  accessToken: `token-${id}`,
  refreshToken: `refresh-${id}`,
  expiresAt: Date.now() + 3600000,
  user: { id, email: `${id}@example.com` },
})
const collection = (id: string) => ({
  version: collectionVersion,
  cards: createStudyCards(
    {
      spanish: `${id}-private`,
      english: id,
      context: '',
      bidirectional: false,
    },
    id,
    0,
  ),
  deletedCardIds: [],
})
async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
}

for (const transition of [
  'deletion',
  'signout',
  'switch',
  'guest-signin',
] as const) {
  for (const mutation of ['grade', 'edit', 'import', 'create'] as const) {
    if (transition === 'guest-signin' && mutation === 'create') continue
    test(`${mutation} cannot commit through ${transition} before its auth event, or resurrect data after delivery and reload`, async ({
      page,
      context,
    }) => {
      const owner = transition === 'guest-signin' ? null : 'A'
      await page.addInitScript(
        ({ initial, accounts, guest }) => {
          if (!localStorage.getItem('commit-ownership-seeded')) {
            localStorage.setItem('commit-ownership-seeded', 'true')
            if (initial)
              localStorage.setItem(
                'jolito-auth-session-v1',
                JSON.stringify(initial),
              )
            localStorage.setItem(
              'jolito-libraries-v1',
              JSON.stringify({ version: 1, accounts, guest }),
            )
          }
          // Delay only this tab's auth notification; real storage and the other
          // tab's deletion/sign-out continue normally.
          const add = window.addEventListener.bind(window)
          const remove = window.removeEventListener.bind(window)
          const callbacks = new Map<
            EventListenerOrEventListenerObject,
            EventListener
          >()
          const pending: Array<() => void> = []
          let paused = true
          window.addEventListener = function (
            type: string,
            listener: EventListenerOrEventListenerObject | null,
            options?: boolean | AddEventListenerOptions,
          ) {
            if (!listener) return
            if (type !== 'storage') return add(type, listener, options)
            const wrapped: EventListener = (event) => {
              const deliver = () => {
                if (!callbacks.has(listener)) return
                if (typeof listener === 'function') listener.call(window, event)
                else listener.handleEvent(event)
              }
              if (
                paused &&
                (event as StorageEvent).key === 'jolito-auth-session-v1'
              )
                pending.push(deliver)
              else deliver()
            }
            callbacks.set(listener, wrapped)
            add(type, wrapped, options)
          }
          window.removeEventListener = function (
            type: string,
            listener: EventListenerOrEventListenerObject | null,
            options?: boolean | EventListenerOptions,
          ) {
            if (!listener) return
            const wrapped = callbacks.get(listener)
            if (type === 'storage' && listener && wrapped) {
              callbacks.delete(listener)
              return remove(type, wrapped, options)
            }
            remove(type, listener, options)
          }
          add('deliver-auth-events', () => {
            paused = false
            pending.splice(0).forEach((deliver) => deliver())
          })
        },
        {
          initial: owner ? session(owner) : null,
          accounts: { 'user:A': collection('A'), 'user:B': collection('B') },
          guest: collection('guest'),
        },
      )
      await context.route('https://mock.supabase.co/**', (route) =>
        route.fulfill(
          route.request().url().includes('/rpc/delete_user_account') ||
            route.request().url().includes('/auth/v1/logout')
            ? { status: 204 }
            : { json: route.request().method() === 'GET' ? [] : {} },
        ),
      )
      await page.goto(
        mutation === 'grade'
          ? '/#/review'
          : mutation === 'create'
            ? '/#/create'
            : '/#/deck',
      )
      const demo = page.getByRole('button', { name: /explore demo deck/i })
      if (await demo.isVisible()) await demo.click()
      if (mutation === 'grade') {
        await page.getByRole('textbox').fill('held answer')
        await page.getByRole('textbox').press('Enter')
      } else if (mutation === 'edit') {
        await page
          .getByRole('cell', {
            name: `${owner ?? 'guest'}-private`,
            exact: true,
          })
          .click()
        await page.locator('#edit-prompt').fill('stale-edit')
      } else if (mutation === 'import') {
        await page.getByRole('button', { name: /backup & import/i }).click()
        await page
          .getByLabel(/choose anki deck or backup file/i)
          .setInputFiles({
            name: 'held-import.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('stale-import\tHeld import'),
          })
      } else {
        await page.locator('#spanish').fill('stale-create')
        await page.locator('#english').fill('Held create')
      }
      const other = await context.newPage()
      await other.goto('/#/deck')
      if (transition === 'deletion' || transition === 'signout') {
        await other
          .getByRole('button', { name: /signed in|tap to sync|sync/i })
          .first()
          .click()
        if (transition === 'deletion') {
          await other
            .getByRole('button', { name: /delete cloud account & data/i })
            .click()
          await other
            .getByRole('checkbox', { name: /download an offline backup/i })
            .uncheck()
          await other.getByPlaceholder('DELETE').fill('DELETE')
          await other
            .getByRole('button', { name: /yes, delete cloud data/i })
            .click()
          await expect(
            other.getByText('Cloud account and backup data deleted.'),
          ).toBeVisible()
        } else await other.getByRole('button', { name: /^sign out$/i }).click()
        await expect
          .poll(() =>
            other.evaluate(() =>
              localStorage.getItem('jolito-auth-session-v1'),
            ),
          )
          .toBeNull()
      } else
        await other.evaluate(
          (auth) =>
            localStorage.setItem(
              'jolito-auth-session-v1',
              JSON.stringify(auth),
            ),
          session('B'),
        )
      const stored = () =>
        page.evaluate(() => ({
          auth: localStorage.getItem('jolito-auth-session-v1'),
          libraries: localStorage.getItem('jolito-libraries-v1'),
        }))
      const before = await stored()
      if (mutation === 'grade')
        await page.getByRole('button', { name: /^4 Easy/i }).click()
      else if (mutation === 'edit')
        await page
          .getByRole('button', { name: 'Save changes', exact: true })
          .click()
      else if (mutation === 'import') {
        await page
          .getByRole('button', { name: /import deck \(replace current\)/i })
          .click()
        await page.waitForFunction(
          () =>
            document.querySelector('[role="alert"]') ||
            /Imported \d+ cards?/i.test(document.body.textContent ?? ''),
        )
      } else
        await page
          .getByRole('button', { name: 'Save card', exact: true })
          .click()
      await settle(page)
      expect(await stored()).toEqual(before)
      await page.evaluate(() =>
        window.dispatchEvent(new Event('deliver-auth-events')),
      )
      await settle(page)
      expect(await stored()).toEqual(before)
      await page.reload()
      await settle(page)
      expect(await stored()).toEqual(before)
      // A fresh lifetime can still study normally, without reviving the old
      // account or modifying any other owner's collection.
      await page.goto('/#/review')
      await page.getByRole('textbox').fill('resumed answer')
      await page.getByRole('textbox').press('Enter')
      await page.getByRole('button', { name: /^4 Easy/i }).click()
      await settle(page)
      type Libraries = {
        accounts: Record<string, ReturnType<typeof collection>>
        guest?: ReturnType<typeof collection>
      }
      const after = JSON.parse((await stored()).libraries!) as Libraries
      const expected = JSON.parse(before.libraries!) as Libraries
      if (transition === 'switch' || transition === 'guest-signin') {
        expect(after.accounts['user:B']?.cards[0]?.schedule.reviews).toBe(1)
        delete after.accounts['user:B']
        delete expected.accounts['user:B']
      } else {
        expect(after.guest?.cards[0]?.schedule.reviews).toBe(1)
        delete after.guest
        delete expected.guest
      }
      expect(after).toEqual(expected)
      await other.close()
    })
  }
}
