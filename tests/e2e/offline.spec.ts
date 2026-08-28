import { expect, test } from '@playwright/test'

test('supports complete learner workflow, audio, autocomplete, and celebration while offline', async ({
  context,
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'jolito-auth-session-v1',
      JSON.stringify({
        accessToken: 'mock-token',
        refreshToken: 'mock-refresh',
        expiresAt: Date.now() + 3600000,
        user: { id: 'usr-1', email: 'offline-learner@example.com' },
      }),
    )
  })
  await page.goto('/')
  await page.evaluate(async () => navigator.serviceWorker.ready)
  await page.locator('html[data-offline-ready="true"]').waitFor()
  await page.evaluate(() =>
    localStorage.setItem(
      'jolito-library-v1',
      JSON.stringify({ version: 1, cards: [] }),
    ),
  )
  await page.reload()
  await page.locator('html[data-offline-ready="true"]').waitFor()

  // Track any failed app asset requests while offline
  const failedRequests: string[] = []
  page.on('requestfailed', (req) => {
    if (!req.url().includes('supabase.co')) {
      failedRequests.push(req.url())
    }
  })

  // Disconnect network completely
  await context.setOffline(true)

  // 1. Create a card with offline dictionary autocomplete
  await page.getByRole('button', { name: /^create a card$/i }).click()
  const spanishInput = page.getByRole('combobox', { name: /mexican spanish/i })
  await spanishInput.fill('¿Dónde está el')
  await expect(page.getByText('¿Dónde está el metro?')).toBeVisible()

  await spanishInput.fill('Nos vemos al rato')
  await page.getByLabel(/english/i).fill('See you later')
  await page.getByRole('button', { name: /save card/i }).click()
  await page.getByRole('button', { name: /^practice$/i }).click()
  await expect(
    page.getByRole('heading', { name: 'Nos vemos al rato' }),
  ).toBeVisible()

  // 2. Play prompt audio offline without network errors
  const playAudioBtn = page.getByRole('button', {
    name: /play prompt audio/i,
  })
  await expect(playAudioBtn).toBeVisible()
  await playAudioBtn.click()

  // 3. Review the card offline
  await page.getByLabel('Your answer').fill('See you later')
  await page.keyboard.press('Enter')
  await expect(page.getByText('MEXICAN SPANISH →')).toBeVisible()

  // Rate card as Easy -> completes session (reverse direction card is staggered for tomorrow)
  await page.getByRole('button', { name: /easy/i }).click()

  // 4. Verify completion view and celebration mascot artwork load offline
  await expect(page.getByText('SESSION COMPLETE')).toBeVisible()
  const mascotImg = page.locator('.complete-mascot-img')
  await expect(mascotImg).toBeVisible()
  const isMascotLoaded = await mascotImg.evaluate(
    (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
  )
  expect(isMascotLoaded).toBe(true)

  // 5. Reload while offline and verify cold boot & persistence
  await page.reload()
  await expect(page.getByText('SESSION COMPLETE')).toBeVisible()
  expect(
    await page.evaluate(() => localStorage.getItem('jolito-library-v1')),
  ).toContain('Nos vemos al rato')

  // 6. Navigate home while offline
  await page.getByRole('button', { name: /back home/i }).click()
  await expect(
    page.getByRole('heading', { name: /make the words you meet stick/i }),
  ).toBeVisible()

  // 7. Verify zero network assets failed
  expect(failedRequests).toEqual([])
})

test('supports immediate card creation and dictionary autocomplete after service worker installation without synthetic wait barriers', async ({
  context,
  page,
}) => {
  await page.goto('/')
  await page.evaluate(async () => navigator.serviceWorker.ready)

  // Go offline immediately without waiting for data-offline-ready synthetic attribute
  await context.setOffline(true)

  // Navigate directly to create card
  await page.getByRole('button', { name: /^create a card$/i }).click()
  const spanishInput = page.getByRole('combobox', { name: /mexican spanish/i })
  await spanishInput.fill('ahor')

  // Autocomplete suggestions should resolve from offline cached dictionary
  await expect(
    page.getByRole('listbox', { name: /spanish suggestions/i }),
  ).toBeVisible()
  await expect(page.getByText('ahorita')).toBeVisible()

  await page.getByText('ahorita').click()
  await expect(spanishInput).toHaveValue('ahorita')
  await expect(page.getByLabel(/english/i)).toHaveValue('right now / in a bit')
})
