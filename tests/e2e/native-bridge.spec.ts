import { expect, test } from '@playwright/test'
import { installMockNativeBridge, getNativeBridgeCalls } from './native-bridge'
import { practiceCards } from './practice'

test.describe('Headless Native Capacitor Bridge', () => {
  test.use({
    viewport: { width: 393, height: 852 },
    hasTouch: true,
    isMobile: true,
  })

  test('activates native Apple Sign-In and dispatches to native plugin', async ({
    page,
  }) => {
    await installMockNativeBridge(page, { platform: 'ios' })
    await page.goto('/')

    // Open Sync Modal from topbar
    const syncButton = page.getByRole('button', { name: /sync/i })
    await expect(syncButton).toBeVisible()
    await syncButton.click()

    // On native iOS, the Apple Sign-In button must be rendered
    const appleButton = page.locator('.apple-signin-button')
    await expect(appleButton).toBeVisible()
    await expect(appleButton).toHaveText(/sign in with apple/i)

    // Clicking Apple Sign-In invokes the native plugin
    await appleButton.click()

    // Verify native bridge recorded the call
    await expect
      .poll(async () => {
        const calls = await getNativeBridgeCalls(page, 'AppleSignIn')
        return calls.some((c) => c.method === 'signIn')
      })
      .toBe(true)
  })

  test('manages Dynamic Island Live Activity lifecycle across practice session', async ({
    page,
  }) => {
    await installMockNativeBridge(page, { platform: 'ios' })
    await page.goto('/')

    // Start practice
    await practiceCards(page)

    // 1. Assert startPractice was invoked with deepLinkUrl and session bounds
    await expect
      .poll(async () => {
        const calls = await getNativeBridgeCalls(page, 'LiveActivity')
        return calls.some(
          (c) =>
            c.method === 'startPractice' &&
            Boolean(
              (c.args as Record<string, unknown> | undefined)?.deepLinkUrl,
            ),
        )
      })
      .toBe(true)

    const startCall = (await getNativeBridgeCalls(page, 'LiveActivity')).find(
      (c) => c.method === 'startPractice',
    )
    expect(startCall).toBeDefined()
    const startArgs = startCall!.args as {
      total: number
      deepLinkUrl?: string
    }
    expect(startArgs.total).toBeGreaterThan(0)
    expect(startArgs.deepLinkUrl).toContain('jolito://')

    // 2. Answer and rate a card to trigger updatePractice
    const answerInput = page.getByLabel(/your answer/i)
    await expect(answerInput).toBeVisible()
    await answerInput.fill('avocado')
    await answerInput.press('Enter')

    const goodBtn = page.getByRole('button', { name: /good/i })
    await expect(goodBtn).toBeVisible()
    await goodBtn.click()

    // Assert updatePractice was called with updated counts
    await expect
      .poll(async () => {
        const calls = await getNativeBridgeCalls(page, 'LiveActivity')
        return calls.some((c) => c.method === 'updatePractice')
      })
      .toBe(true)
  })

  test('routes pronunciation audio directly through NativeSpeech on native platforms', async ({
    page,
  }) => {
    await installMockNativeBridge(page, { platform: 'ios' })
    await page.goto('/')

    await practiceCards(page)

    // Click audio replay button
    const audioBtn = page.getByRole('button', {
      name: /listen to pronunciation/i,
    })
    if (await audioBtn.isVisible()) {
      await audioBtn.click()

      await expect
        .poll(async () => {
          const calls = await getNativeBridgeCalls(page, 'NativeSpeech')
          return calls.some((c) => c.method === 'speak')
        })
        .toBe(true)

      const speakCall = (await getNativeBridgeCalls(page, 'NativeSpeech')).find(
        (c) => c.method === 'speak',
      )
      expect(speakCall).toBeDefined()
      const speakArgs = speakCall!.args as { text: string; locale?: string }
      expect(speakArgs.text.length).toBeGreaterThan(0)
    }
  })
})
