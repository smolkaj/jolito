import { expect, test } from '@playwright/test'
import { auditAccessibility, settleAnimations } from './accessibility'

test('reveals every failed import after scrolling and retains the selected file for retry', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/#/deck')
  const demo = page.getByRole('button', { name: /explore demo deck/i })
  if (await demo.isVisible()) await demo.click()
  await page.getByRole('button', { name: /backup & import/i }).click()
  const file = page.getByLabel(/choose anki deck or backup file/i)
  await file.setInputFiles({
    name: 'retry-import.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Un boleto de metro\tA subway ticket'),
  })
  const confirm = page.getByRole('button', {
    name: /import deck \(replace current\)/i,
  })
  await expect(confirm).toBeEnabled()
  const before = await page.evaluate(() =>
    localStorage.getItem('jolito-library-v1'),
  )
  await page.evaluate(() => {
    const original = Object.getOwnPropertyDescriptor(
      Storage.prototype,
      'setItem',
    )!
    Storage.prototype.setItem = () => {
      throw new DOMException('Full', 'QuotaExceededError')
    }
    window.addEventListener(
      'restore-storage-writes',
      () => {
        Object.defineProperty(Storage.prototype, 'setItem', original)
      },
      { once: true },
    )
  })
  for (let attempt = 0; attempt < 2; attempt++) {
    await confirm.scrollIntoViewIfNeeded()
    await confirm.click()
    const error = page.getByRole('dialog').getByRole('alert')
    await expect(error).toContainText('couldn’t be saved')
    await settleAnimations(page)
    await expect(error).toBeInViewport({ ratio: 1 })
    await expect(confirm).toBeEnabled()
    expect(
      await file.evaluate((input: HTMLInputElement) => input.files?.[0]?.name),
    ).toBe('retry-import.txt')
    expect(
      await page.evaluate(() => localStorage.getItem('jolito-library-v1')),
    ).toBe(before)
  }
  expect((await auditAccessibility(page)).violations).toEqual([])
  await page.screenshot({
    path: testInfo.outputPath('visible-import-error.png'),
  })
  await page.evaluate(() =>
    window.dispatchEvent(new Event('restore-storage-writes')),
  )
  await confirm.click()
  await expect(page.getByText(/imported \d+ cards?/i)).toBeVisible()
  await expect(confirm).toHaveCount(0)
  await expect(file).toHaveValue('')
  expect(
    await page.evaluate(() => localStorage.getItem('jolito-library-v1')),
  ).toContain('Un boleto de metro')
  await page.keyboard.press('Escape')
  await page.reload()
  await expect(
    page.getByRole('cell', { name: 'Un boleto de metro', exact: true }),
  ).toBeVisible()
})
