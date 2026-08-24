import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('opens deck backup modal without automatically detectable WCAG violations and exports deck JSON', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('button', { name: /tap to sync/i }).click()
  await expect(
    page.getByRole('heading', { name: /cloud sync & deck backup/i }),
  ).toBeVisible()

  // Verify zero WCAG 2.1 A/AA accessibility violations in backup dialog
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])

  // Export JSON backup
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /export backup \(json\)/i }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toMatch(
    /^jolito-deck-\d{4}-\d{2}-\d{2}\.json$/,
  )

  await expect(page.getByRole('status')).toContainText(/deck exported/i)

  // Close modal via Escape
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('heading', { name: /cloud sync & deck backup/i }),
  ).not.toBeVisible()
})

test('restores deck from backup JSON file and updates local storage', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: /tap to sync/i }).click()

  const backupData = {
    version: 1,
    app: 'jolito',
    exportedAt: '2026-08-23T12:00:00.000Z',
    cards: [
      {
        id: 'e2e-card:es-en',
        noteId: 'e2e-card',
        prompt: 'Un boleto de metro',
        answer: 'A subway ticket',
        direction: 'es-en',
        context: 'CDMX subway ticket',
        scene: 'metro',
        schedule: {
          state: 'new',
          dueAt: 0,
          intervalDays: 0,
          easeFactor: 2.5,
          reviews: 0,
          lapses: 0,
        },
      },
    ],
  }

  // Upload backup JSON file
  await page.getByLabel(/choose anki deck or backup file/i).setInputFiles({
    name: 'test-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backupData)),
  })

  await expect(page.getByText(/found 1 cards.*ready to import/i)).toBeVisible()

  await page
    .getByRole('button', { name: /import deck \(replace current\)/i })
    .click()

  await expect(page.getByText(/successfully imported 1 cards/i)).toBeVisible()

  // Verify local storage is updated with the imported cards
  const stored = await page.evaluate(() =>
    localStorage.getItem('jolito-library-v1'),
  )
  expect(stored).toContain('Un boleto de metro')

  await page.getByRole('button', { name: /close dialog/i }).click()
  await expect(
    page.getByRole('heading', { name: /cloud sync & deck backup/i }),
  ).not.toBeVisible()

  // Start review with the imported card
  await page.getByRole('button', { name: /practice 1 due/i }).click()
  await expect(
    page.getByRole('heading', { name: 'Un boleto de metro' }),
  ).toBeVisible()
})

test('imports Anki text export deck and updates review cards', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: /tap to sync/i }).click()

  const ankiContent = `#separator:tab\n#html:true\n¿Dónde está la estación?\tWhere is the station?\tTransit question`

  await page.getByLabel(/choose anki deck or backup file/i).setInputFiles({
    name: 'anki-deck.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(ankiContent),
  })

  await expect(page.getByText(/found 1 cards.*ready to import/i)).toBeVisible()

  await page
    .getByRole('button', { name: /import deck \(replace current\)/i })
    .click()

  await expect(page.getByText(/successfully imported 1 cards/i)).toBeVisible()

  await page.getByRole('button', { name: /close dialog/i }).click()

  await page.getByRole('button', { name: /practice 1 due/i }).click()
  await expect(
    page.getByRole('heading', { name: '¿Dónde está la estación?' }),
  ).toBeVisible()
})
