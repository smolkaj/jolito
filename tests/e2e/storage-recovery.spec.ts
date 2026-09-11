import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { auditAccessibility } from './accessibility'

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 375, height: 667 },
]) {
  test(`protects unreadable storage and exports exact bytes at ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    const raw = '{"version":999,"cards":[{"future":"preserve me"}]}'
    await page.addInitScript((value) => {
      if (localStorage.getItem('jolito-library-v1') === null)
        localStorage.setItem('jolito-library-v1', value)
    }, raw)
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'Let’s protect your saved deck' }),
    ).toBeVisible()
    expect((await auditAccessibility(page)).violations).toEqual([])
    await page.screenshot({
      path: testInfo.outputPath(`recovery-${viewport.width}.png`),
      fullPage: true,
    })
    await page.keyboard.press('Tab')
    await expect(
      page.getByRole('button', { name: 'Download saved data' }),
    ).toBeFocused()
    const downloaded = page.waitForEvent('download')
    await page.keyboard.press('Enter')
    const download = await downloaded
    expect(await readFile(await download.path(), 'utf8')).toBe(raw)
    await page.getByRole('button', { name: 'Try again' }).click()
    expect(
      await page.evaluate(() => localStorage.getItem('jolito-library-v1')),
    ).toBe(raw)
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Let’s protect your saved deck' }),
    ).toBeVisible()
    // Simulate repaired data from a newer app or restored backup; retry is explicit.
    await page.evaluate(() =>
      localStorage.setItem(
        'jolito-library-v1',
        JSON.stringify({ version: 3, cards: [] }),
      ),
    )
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(
      page.getByRole('button', { name: 'Create a card' }),
    ).toBeVisible()
    expect(
      await page.evaluate(() => localStorage.getItem('jolito-library-v1')),
    ).toBe(JSON.stringify({ version: 3, cards: [] }))
  })
}

test('recovers from browser storage denial before creating auth or sync services', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    const storage = window.localStorage
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Access denied', 'SecurityError')
      },
    })
    window.addEventListener(
      'restore-storage-access',
      () => {
        Object.defineProperty(window, 'localStorage', {
          configurable: true,
          value: storage,
        })
      },
      { once: true },
    )
  })
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Let’s protect your saved deck' }),
  ).toBeVisible()
  await expect(page.getByText(/couldn’t access device storage/i)).toBeVisible()
  await page.getByRole('button', { name: 'Try again' }).click()
  expect(errors).toEqual([])
  await page.evaluate(() =>
    window.dispatchEvent(new Event('restore-storage-access')),
  )
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(
    page.getByRole('button', { name: 'Create a card' }),
  ).toBeVisible()
  await page.locator('html[data-offline-ready="true"]').waitFor()
  expect(errors).toEqual([])
  expect(
    await page.evaluate(() => localStorage.getItem('jolito-device-id-v1')),
  ).toBeTruthy()
})
