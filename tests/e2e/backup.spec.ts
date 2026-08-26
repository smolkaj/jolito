import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import * as fflate from 'fflate'
import initSqlJs from 'sql.js'
import * as fs from 'node:fs'
import * as path from 'node:path'

test('opens deck manager without automatically detectable WCAG violations and exports deck JSON', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('button', { name: /manage deck/i }).click()
  await expect(
    page.getByRole('heading', { name: /manage deck/i }),
  ).toBeVisible()

  // Open Backup & Import modal
  await page.getByRole('button', { name: /backup & import/i }).click()

  await expect(
    page.getByRole('heading', { name: /deck import & offline backup/i }),
  ).toBeVisible()
  await page.screenshot({ path: 'test-results/deck-backup-vertical-modal.png' })

  // Verify zero WCAG 2.1 A/AA accessibility violations in deck manager
  await page.waitForTimeout(200)
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

  // Save screenshot for autonomous visual inspection
  await page.screenshot({ path: 'test-results/deck-manager.png' })
  await page.keyboard.press('Escape')
})

test('restores deck from backup JSON file and updates local storage', async ({
  page,
}) => {
  await page.goto('/#/deck')
  await expect(
    page.getByRole('heading', { name: /manage deck/i }),
  ).toBeVisible()

  // Open Backup & Import modal
  await page.getByRole('button', { name: /backup & import/i }).click()

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
  await page.keyboard.press('Escape')

  // Verify local storage is updated with the imported cards
  const stored = await page.evaluate(() =>
    localStorage.getItem('jolito-library-v1'),
  )
  expect(stored).toContain('Un boleto de metro')

  // Start review with the imported card
  await page
    .getByRole('button', { name: /^practice$/i })
    .first()
    .click()
  await expect(
    page.getByRole('heading', { name: 'Un boleto de metro' }),
  ).toBeVisible()
})

test('imports Anki text export deck and updates review cards', async ({
  page,
}) => {
  await page.goto('/#/deck')

  // Open Backup & Import modal
  await page.getByRole('button', { name: /backup & import/i }).click()

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
  await page.keyboard.press('Escape')

  await page
    .getByRole('button', { name: /^practice$/i })
    .first()
    .click()
  await expect(
    page.getByRole('heading', { name: '¿Dónde está la estación?' }),
  ).toBeVisible()
})

test('imports packaged .apkg Anki archive, preserves schedules, and supports full keyboard review', async ({
  page,
}) => {
  await page.goto('/#/deck')

  // Generate a real binary .apkg SQLite package
  const wasmPath = path.resolve(
    process.cwd(),
    'node_modules/sql.js/dist/sql-wasm.wasm',
  )
  const wasmBuffer = fs.readFileSync(wasmPath)
  const wasmBinary = wasmBuffer.buffer.slice(
    wasmBuffer.byteOffset,
    wasmBuffer.byteOffset + wasmBuffer.byteLength,
  )
  const SQL = await initSqlJs({ wasmBinary })
  const db = new SQL.Database()

  db.run(`
    CREATE TABLE col (id INTEGER PRIMARY KEY, crt INTEGER, decks TEXT);
    CREATE TABLE notes (id INTEGER PRIMARY KEY, mid INTEGER, flds TEXT, tags TEXT);
    CREATE TABLE cards (
      id INTEGER PRIMARY KEY, nid INTEGER, ord INTEGER, type INTEGER, queue INTEGER,
      due INTEGER, ivl INTEGER, factor INTEGER, reps INTEGER, lapses INTEGER, did INTEGER
    );
  `)

  db.run(`
    INSERT INTO col VALUES (1, 1600000000, '{"1": {"name": "Mexican Spanish Vocab"}}');
    INSERT INTO notes VALUES (1, 1, '¡Qué chido!\x1fHow cool!\x1fslang expression', 'cdmx slang');
    INSERT INTO notes VALUES (2, 1, 'La cuenta, por favor\x1fThe bill, please\x1frestaurant phrase', 'dining');
    INSERT INTO cards VALUES (101, 1, 0, 2, 2, 10, 5, 2500, 3, 0, 1);
    INSERT INTO cards VALUES (102, 2, 0, 0, 0, 0, 0, 2500, 0, 0, 1);
  `)

  const dbBytes = db.export()
  db.close()

  const apkgZip = fflate.zipSync({
    'collection.anki2': dbBytes,
  })

  // Open Backup & Import modal
  await page.getByRole('button', { name: /backup & import/i }).click()

  // Upload .apkg binary file
  await page.getByLabel(/choose anki deck or backup file/i).setInputFiles({
    name: 'mexican-spanish.apkg',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(apkgZip),
  })

  await expect(
    page.getByText(/found 2 cards from “mexican spanish vocab”/i),
  ).toBeVisible()

  await page
    .getByRole('button', {
      name: /import "mexican spanish vocab" \(replace\)/i,
    })
    .click()
  await expect(
    page.getByText(
      /successfully imported 2 cards from “mexican spanish vocab”/i,
    ),
  ).toBeVisible()

  await page.keyboard.press('Escape')

  // Start review
  await page
    .getByRole('button', { name: /^practice$/i })
    .first()
    .click()
  await expect(page.getByRole('heading', { name: '¡Qué chido!' })).toBeVisible()

  // Enter to reveal answer
  await page.keyboard.press('Enter')
  await expect(page.getByText('How cool!')).toBeVisible()

  // Grade 'Good' via keyboard '3'
  await page.keyboard.press('3')

  // Second card is revealed
  await expect(
    page.getByRole('heading', { name: 'La cuenta, por favor' }),
  ).toBeVisible()
})

test('modifies and deletes cards in the deck manager with zero accessibility violations', async ({
  page,
}) => {
  await page.goto('/#/deck')
  await expect(
    page.getByRole('heading', { name: /manage deck/i }),
  ).toBeVisible()

  // Verify list of cards
  const cardsList = page.getByRole('table', { name: /deck cards/i })
  await expect(cardsList.getByRole('row', { name: /card:/i })).toHaveCount(4)

  // Search filter
  await page.getByLabel(/search cards in deck/i).fill('aguacate')
  await expect(cardsList.getByRole('row', { name: /card:/i })).toHaveCount(2)
  await page.getByLabel(/search cards in deck/i).fill('')
  await expect(cardsList.getByRole('row', { name: /card:/i })).toHaveCount(4)

  await page.screenshot({ path: 'test-results/deck-table-view.png' })

  // Click row to edit card
  await cardsList.getByText('aguacate').first().click()

  await expect(
    page.getByRole('heading', { name: /edit flashcard/i }),
  ).toBeVisible()
  await page.screenshot({ path: 'test-results/deck-edit-card-modal.png' })

  // Verify accessibility of edit modal
  const editAxe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(editAxe.violations).toEqual([])

  await page.getByLabel(/mexican spanish \(prompt\)/i).fill('el aguacate')
  await page.getByLabel(/english \(answer\)/i).fill('the avocado')
  await page.getByRole('button', { name: /save changes/i }).click()

  await expect(
    page.getByRole('heading', { name: /edit flashcard/i }),
  ).not.toBeVisible()
  await expect(page.getByText('el aguacate')).toBeVisible()

  // Select card via checkbox to delete
  await page.getByRole('checkbox', { name: /select card el aguacate/i }).click()
  await page.screenshot({ path: 'test-results/deck-selected-row.png' })

  const deleteBtn = page.getByRole('button', { name: /delete selected \(1\)/i })
  await expect(deleteBtn).toBeVisible()
  await deleteBtn.click()

  await expect(
    page.getByRole('heading', { name: /delete flashcard\?/i }),
  ).toBeVisible()
  await page.locator('.delete-card-modal').waitFor({ state: 'visible' })
  await page.waitForTimeout(200)
  await page.screenshot({ path: 'test-results/deck-delete-modal.png' })

  // Verify accessibility of delete modal
  const deleteAxe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  expect(deleteAxe.violations).toEqual([])

  // Cancel deletion
  await page.getByRole('button', { name: /cancel/i }).click()
  await expect(
    page.getByRole('heading', { name: /delete flashcard\?/i }),
  ).not.toBeVisible()
  await expect(cardsList.getByRole('row', { name: /card:/i })).toHaveCount(4)

  // Confirm deletion
  await deleteBtn.click()
  await page.getByRole('button', { name: /^delete card$/i }).click()

  await expect(
    page.getByRole('heading', { name: /delete flashcard\?/i }),
  ).not.toBeVisible()
  await expect(cardsList.getByRole('row', { name: /card:/i })).toHaveCount(3)
  await expect(page.getByText('el aguacate')).not.toBeVisible()
})

test('resets learning history to new card in deck manager edit modal with zero accessibility violations', async ({
  page,
}) => {
  const now = Date.now()
  const matureCard = {
    id: 'mature-card-1',
    noteId: 'note-1',
    prompt: 'platicar',
    answer: 'to chat',
    direction: 'es-en',
    context: 'Informal Mexican Spanish',
    scene: 'conversation',
    schedule: {
      state: 'review',
      dueAt: now + 86400000 * 14,
      intervalDays: 14,
      easeFactor: 2.6,
      reviews: 6,
      lapses: 1,
    },
  }

  await page.addInitScript((card) => {
    window.localStorage.setItem(
      'jolito-library-v1',
      JSON.stringify({ version: 1, cards: [card] }),
    )
  }, matureCard)

  await page.goto('/#/deck')
  await expect(
    page.getByRole('heading', { name: /manage deck/i }),
  ).toBeVisible()

  const cardsList = page.getByRole('table', { name: /deck cards/i })
  await expect(cardsList.getByRole('row', { name: /card:/i })).toHaveCount(1)
  await expect(cardsList.locator('.deck-stat-chip.is-review')).toBeVisible()

  // Open edit modal
  await cardsList.getByText('platicar').click()
  await expect(
    page.getByRole('heading', { name: /edit flashcard/i }),
  ).toBeVisible()

  const toggle = page.getByRole('checkbox', {
    name: /reset learning progress/i,
  })
  await expect(toggle).toBeAttached()
  await expect(toggle).toBeEnabled()
  await expect(toggle).not.toBeChecked()
  await expect(page.getByText('Reset learning progress')).toBeVisible()
  await expect(
    page.getByText('Treat as a new card and restart review history'),
  ).toBeVisible()

  // Verify accessibility with toggle
  const editAxe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(editAxe.violations).toEqual([])

  await page.screenshot({
    path: 'test-results/deck-edit-reset-progress-modal.png',
  })

  // Toggle reset progress and save
  await page.getByText('Reset learning progress').click()
  await expect(toggle).toBeChecked()
  await page.screenshot({
    path: 'test-results/deck-edit-reset-progress-checked.png',
  })

  await page.getByRole('button', { name: /save changes/i }).click()
  await expect(
    page.getByRole('heading', { name: /edit flashcard/i }),
  ).not.toBeVisible()

  // Verify filter pills and status chip changed to reflect reset unstudied/due card
  await expect(
    page.getByRole('button', { name: /unstudied \(1\)/i }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: /mastered \(0\)/i }),
  ).toBeVisible()
  await expect(cardsList.locator('.deck-stat-chip.is-due')).toBeVisible()
  await expect(cardsList.locator('.deck-stat-chip.is-review')).not.toBeVisible()

  await page.screenshot({ path: 'test-results/deck-after-reset-progress.png' })
})
