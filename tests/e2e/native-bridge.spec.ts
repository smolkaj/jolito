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

    // 3. Exit practice session by clicking Jolito home brand button
    const homeBtn = page.getByRole('button', { name: /jolito home/i })
    await expect(homeBtn).toBeVisible()
    await homeBtn.click()

    // Assert endPractice was invoked
    await expect
      .poll(async () => {
        const calls = await getNativeBridgeCalls(page, 'LiveActivity')
        return calls.some((c) => c.method === 'endPractice')
      })
      .toBe(true)
  })

  test('routes pronunciation audio directly through NativeSpeech on native platforms', async ({
    page,
  }) => {
    await installMockNativeBridge(page, { platform: 'ios' })
    // Route cloud TTS endpoint to abort so LayeredNeuralSpeaker falls back to NativeSpeech
    await page.route(
      (url) => url.href.includes('/api/tts'),
      (route) => route.abort('failed'),
    )
    await page.goto('/')

    // Set offline before starting practice session so voice engine cleanly uses native fallback
    await page.context().setOffline(true)

    await practiceCards(page)

    // Click prompt audio button directly on prompt card
    const audioBtn = page.getByRole('button', {
      name: /play prompt audio/i,
    })
    await expect(audioBtn).toBeVisible()
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
  })

  test('triggers native AppReview prompt upon reaching milestone session completion', async ({
    page,
  }) => {
    await installMockNativeBridge(page, { platform: 'ios' })

    // Seed state: completedSessionsCount = 2, totalCardsReviewed = 27 (3 cards away from 30 milestone)
    await page.addInitScript(() => {
      localStorage.setItem(
        'jolito-app-review-v1',
        JSON.stringify({
          completedSessionsCount: 2,
          totalCardsReviewed: 27,
          lastPromptedAt: null,
        }),
      )
    })

    await page.goto('/')
    await practiceCards(page)

    // Complete the 3-card starter demo session (Enter to reveal, 4 for Easy rating)
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Enter')
      await page.keyboard.press('4')
    }

    // Completes demo session
    await expect(page.getByText('DEMO SESSION COMPLETE')).toBeVisible()

    // Assert AppReview.requestReview was called upon reaching milestone
    await expect
      .poll(async () => {
        const calls = await getNativeBridgeCalls(page, 'AppReview')
        return calls.some((c) => c.method === 'requestReview')
      })
      .toBe(true)
  })
})
