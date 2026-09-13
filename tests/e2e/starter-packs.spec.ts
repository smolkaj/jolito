import { expect, test, type Page } from '@playwright/test'
import { auditAccessibility } from './accessibility'

async function dismissDemoModal(page: Page) {
  const dismissBtn = page.getByRole('button', { name: /explore demo deck/i })
  if (await dismissBtn.isVisible()) {
    await dismissBtn.click()
  }
}

test('curated starter packs modal allows adding packs with zero WCAG violations and captures visual verification', async ({
  page,
}) => {
  await page.goto('/')

  // Navigate to deck manager
  await page.getByRole('button', { name: /manage deck/i }).click()
  await dismissDemoModal(page)
  await expect(
    page.getByRole('heading', { name: /manage deck/i }),
  ).toBeVisible()

  // Open Starter packs modal
  await page.getByRole('button', { name: /^starter packs$/i }).click()
  await expect(
    page.getByRole('dialog', { name: /curated starter packs/i }),
  ).toBeVisible()

  // Capture visual screenshot of modal (main packs view)
  await page.screenshot({
    path: '/tmp/jolito-starter-packs-modal.png',
    animations: 'disabled',
  })

  // Inspect the first pack
  await page
    .getByRole('button', { name: /inspect mexican street phrases/i })
    .click()
  await expect(
    page.getByRole('button', { name: /back to all starter packs/i }),
  ).toBeVisible()

  // Capture visual screenshot of pack inspection view
  await page.screenshot({
    path: '/tmp/jolito-starter-packs-inspect.png',
    animations: 'disabled',
  })

  // Verify zero WCAG violations in the inspection view
  const inspectAxe = await auditAccessibility(page)
  expect(inspectAxe.violations).toEqual([])

  // Return to all packs view
  await page.getByRole('button', { name: /back to all starter packs/i }).click()
  await expect(
    page.getByRole('button', { name: /back to all starter packs/i }),
  ).not.toBeVisible()

  // Verify zero WCAG 2.1 A/AA violations in the modal main view
  const axeResults = await auditAccessibility(page)
  expect(axeResults.violations).toEqual([])

  // Add Mexican street phrases pack
  const addBtn = page.getByRole('button', {
    name: /^add mexican street phrases/i,
  })
  await addBtn.click()

  // Wait for button to be disabled indicating completion
  await expect(
    page.getByRole('button', {
      name: /mexican street phrases is already added to your deck/i,
    }),
  ).toBeDisabled()

  // Capture visual screenshot after adding pack
  await page.screenshot({
    path: '/tmp/jolito-starter-packs-added.png',
    animations: 'disabled',
  })

  // Close modal
  await page.getByLabel('Close dialog').click()
  await expect(
    page.getByRole('dialog', { name: /curated starter packs/i }),
  ).not.toBeVisible()

  // Verify cards appear in deck table
  await expect(page.getByText('¿Mande?').first()).toBeVisible()
})
