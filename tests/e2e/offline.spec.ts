import { expect, test } from '@playwright/test'

test('reopens the installed app shell and saved cards while offline', async ({
  context,
  page,
}) => {
  await page.goto('/')
  await page.evaluate(async () => navigator.serviceWorker.ready)
  await page.locator('html[data-offline-ready="true"]').waitFor()

  await page.getByRole('button', { name: /^create a card$/i }).click()
  await page.getByLabel(/^Spanish Mexican Spanish$/).fill('Nos vemos al rato')
  await page.getByLabel(/^English Concise meaning$/).fill('See you later')
  await page.getByRole('button', { name: /save & practice both/i }).click()
  await expect(
    page.getByRole('heading', { name: 'Nos vemos al rato' }),
  ).toBeVisible()

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByLabel('Your answer')).toBeVisible()
  expect(
    await page.evaluate(() => localStorage.getItem('ritmo-library-v1')),
  ).toContain('Nos vemos al rato')

  await page.getByRole('button', { name: 'Ritmo' }).click()
  await expect(
    page.getByRole('heading', { name: /make the words you meet stick/i }),
  ).toBeVisible()
  await expect(page.getByText(/on-device · works offline/i)).toBeVisible()
})
