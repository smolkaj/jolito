import { expect, test } from '@playwright/test'

test('reopens the installed app shell and saved cards while offline', async ({
  context,
  page,
}) => {
  await page.goto('/')
  await page.evaluate(async () => navigator.serviceWorker.ready)
  await page.locator('html[data-offline-ready="true"]').waitFor()

  await page.getByRole('button', { name: /^create a card$/i }).click()
  await page.getByLabel(/spanish/i).fill('Nos vemos al rato')
  await page.getByLabel(/english/i).fill('See you later')
  await page.getByRole('button', { name: /save card/i }).click()
  await expect(
    page.getByRole('heading', { name: 'Nos vemos al rato' }),
  ).toBeVisible()

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByLabel('Your answer')).toBeVisible()
  expect(
    await page.evaluate(() => localStorage.getItem('jolito-library-v1')),
  ).toContain('Nos vemos al rato')

  await page.getByRole('button', { name: /jolito/i }).click()
  await expect(
    page.getByRole('heading', { name: /make the words you meet stick/i }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: /local deck only/i }),
  ).toBeVisible()
})
