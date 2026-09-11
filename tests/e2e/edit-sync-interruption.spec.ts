import { expect, test } from '@playwright/test'
import {
  collectionVersion,
  createStudyCards,
  resetCardProgress,
  scheduleReview,
  studyCardCollectionSchema,
  updateStudyCard,
  type StudyCard,
} from '../../src/domain/card'
import { currentDeckJson } from './storage'
import { auditAccessibility } from './accessibility'

for (const width of [320, 1280]) {
  for (const outcome of ['advance', 'delete'] as const) {
    test(`editor preserves its draft through a held ${outcome} sync at ${width}px, then saves or explains deletion`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 800 })
      const now = Date.now()
      const initial = scheduleReview(
        createStudyCards(
          {
            spanish: 'hola',
            english: 'hello',
            context: 'Opening context',
            bidirectional: false,
          },
          'note',
          now,
        )[0]!,
        'easy',
        now,
      )
      const collection = studyCardCollectionSchema.parse({
        version: collectionVersion,
        cards: [initial],
        deletedCardIds: [],
      })
      const user = { id: 'editor', email: 'editor@example.com' }
      await page.addInitScript(
        ({ collection, user }) => {
          if (localStorage.getItem('editor-sync-seeded')) return
          localStorage.setItem('editor-sync-seeded', 'true')
          localStorage.setItem(
            'jolito-auth-session-v1',
            JSON.stringify({
              accessToken: 'token',
              refreshToken: 'refresh',
              expiresAt: Date.now() + 3600000,
              user,
            }),
          )
          localStorage.setItem(
            'jolito-libraries-v1',
            JSON.stringify({
              version: 1,
              accounts: { 'user:editor': collection },
            }),
          )
        },
        { collection, user },
      )
      let cloud: { cards: StudyCard[]; deletedCardIds: string[] } = collection
      let revision = 1
      let hold = false
      let pending = false
      let release!: () => void
      const held = new Promise<void>((resolve) => {
        release = resolve
      })
      await page.route('https://mock.supabase.co/**', async (route) => {
        if (route.request().method() === 'POST') {
          const write = route.request().postDataJSON() as {
            p_user_id: string
            p_expected_revision: number
            p_data: typeof cloud
          }
          expect(new URL(route.request().url()).pathname).toBe(
            '/rest/v1/rpc/compare_and_set_deck',
          )
          expect(write.p_user_id).toBe(user.id)
          if (write.p_expected_revision !== revision) {
            await route.fulfill({ json: null })
            return
          }
          cloud = write.p_data
          revision += 1
          await route.fulfill({ json: revision })
          return
        }
        const snapshot = {
          user_id: user.id,
          revision,
          updated_at: new Date(now).toISOString(),
          data: {
            version: collectionVersion,
            app: 'jolito',
            updatedAt: new Date(now).toISOString(),
            deviceId: 'remote',
            ...cloud,
          },
        }
        if (hold) {
          hold = false
          pending = true
          await held
        }
        await route.fulfill({ json: [snapshot] })
      })
      await page.goto('/#/deck')
      await expect(page.getByRole('button', { name: /synced/i })).toBeVisible()
      await page.getByRole('row', { name: /card: hola,/i }).click()
      const prompt = page.locator('#edit-prompt')
      const reset = page.getByRole('checkbox', {
        name: /reset learning progress/i,
      })
      await page.getByText('Reset learning progress', { exact: true }).click()
      await expect(reset).toBeChecked()
      let remote = updateStudyCard(initial, { answer: 'Remote answer' }, now)
      remote = updateStudyCard(remote, { context: 'Remote context' }, now)
      remote = scheduleReview(
        resetCardProgress(resetCardProgress(remote, now), now),
        'easy',
        now,
      )
      cloud =
        outcome === 'delete'
          ? { cards: [], deletedCardIds: [initial.id] }
          : { cards: [remote], deletedCardIds: [] }
      revision += 1
      hold = true
      await page.evaluate(() => window.dispatchEvent(new Event('focus')))
      await expect.poll(() => pending).toBe(true)
      await prompt.fill('Keep my local draft')
      release()
      await expect
        .poll(() => page.evaluate(currentDeckJson))
        .toContain(outcome === 'delete' ? `"${initial.id}"` : 'Remote context')
      if (outcome === 'delete') await expect(reset).toBeDisabled()
      else
        await expect
          .poll(async () => {
            const current = JSON.parse(
              await page.evaluate(currentDeckJson),
            ) as typeof cloud
            return current.cards[0]?.resetRevision.generation
          })
          .toBe(2)
      await expect(prompt).toHaveValue('Keep my local draft')
      const before = await page.evaluate(currentDeckJson)
      const save = page.getByRole('button', { name: 'Save changes' })
      if (outcome === 'delete') {
        for (let attempt = 0; attempt < 2; attempt++) {
          await save.click()
          const error = page.getByRole('dialog').getByRole('alert')
          await expect(error).toContainText(
            'This card was removed from your deck. Your draft is still here.',
          )
          await expect(error).toBeInViewport({ ratio: 1 })
          await expect(prompt).toHaveValue('Keep my local draft')
          expect(await page.evaluate(currentDeckJson)).toBe(before)
        }
      } else {
        await save.click()
        await expect(page.getByRole('dialog')).toHaveCount(0)
        await expect
          .poll(() => cloud.cards[0]?.prompt)
          .toBe('Keep my local draft')
        const saved = cloud.cards[0]!
        expect(saved).toMatchObject({
          prompt: 'Keep my local draft',
          answer: 'Remote answer',
          context: 'Remote context',
          contentRevision: 3,
          resetRevision: { generation: 3 },
          schedule: { state: 'new', reviews: 0, lapses: 0, intervalDays: 0 },
        })
        expect(saved.schedule.lastReviewedAt).toBeUndefined()
      }
      expect((await auditAccessibility(page)).violations).toEqual([])
      if (outcome === 'delete')
        await expect(
          page.getByRole('dialog').getByRole('alert'),
        ).toBeInViewport({ ratio: 1 })
      await page.screenshot({
        path: testInfo.outputPath(`editor-${outcome}.png`),
      })
      const committed = await page.evaluate(currentDeckJson)
      await page.evaluate(() => window.dispatchEvent(new Event('focus')))
      await page.reload()
      await expect(page.getByRole('button', { name: /synced/i })).toBeVisible()
      expect(await page.evaluate(currentDeckJson)).toBe(committed)
      if (outcome === 'delete') expect(cloud.cards).toEqual([])
      else
        await expect(
          page.getByRole('row', { name: /card: Keep my local draft,/i }),
        ).toBeVisible()
    })
  }
}
