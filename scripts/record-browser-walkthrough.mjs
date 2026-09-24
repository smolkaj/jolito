import { chromium, expect } from '@playwright/test'
import { spawn, execFileSync } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { z } from 'zod'
import fs from 'node:fs/promises'
// Requires a dedicated Xvfb display, PulseAudio sink and local Vite/Supabase.
// This records browser behavior. It does not emulate native iOS speech or prove device QA.
const baseURL = process.env.WALKTHROUGH_URL ?? 'http://127.0.0.1:4189'
const mailURL = process.env.WALKTHROUGH_MAIL_URL ?? 'http://127.0.0.1:54324'
for (const value of [baseURL, mailURL]) {
  if (!['127.0.0.1', 'localhost'].includes(new URL(value).hostname))
    throw Error('Use a local test environment only')
}
const output = 'build/walkthrough'
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({
  headless: false,
  env: {
    ...process.env,
    DISPLAY: process.env.DISPLAY ?? ':94',
    PULSE_SINK: 'jolito_record',
  },
  args: [
    '--force-device-scale-factor=2',
    '--window-position=0,0',
    '--window-size=440,1040',
    '--autoplay-policy=no-user-gesture-required',
  ],
})
const context = await browser.newContext({
  viewport: { width: 440, height: 956 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})
await context.route(/\/(auth|rest)\/v1\//, async (route) => {
  if (
    !['127.0.0.1', 'localhost'].includes(
      new URL(route.request().url()).hostname,
    )
  ) {
    await route.abort()
    throw Error('Refusing account operations against a non-local backend')
  }
  await route.continue()
})
const page = await context.newPage()
const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(error.message))
const chapters = []
let recording
let recordingDone
let started
const mailSchema = z.object({
  messages: z.array(
    z.object({
      Subject: z.string(),
      To: z.array(z.object({ Address: z.string() })),
    }),
  ),
})
page.setDefaultTimeout(12000)
const cdp = await page.context().newCDPSession(page)
async function touch(locator) {
  await locator.waitFor({ state: 'visible' })
  await locator.click({ trial: true })
  await locator.scrollIntoViewIfNeeded()
  const b = await locator.boundingBox()
  const x = b.x + b.width / 2,
    y = b.y + b.height / 2
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
}
const pace = Number(process.env.PACE ?? 1)
if (!Number.isFinite(pace) || pace <= 0) throw Error('PACE must be positive')
const wait = (ms) => page.waitForTimeout(Math.max(650, ms * pace))
const type = async (selector, text) => {
  const field = page.locator(selector)
  await touch(field)
  await field.fill('')
  await field.pressSequentially(text, { delay: 85 * pace })
  await wait(1200)
}
const tap = async (locator) => {
  await touch(locator)
  await wait(1800)
}
const chapter = async (text) => {
  console.log(text)
  await fs.writeFile(`${output}/chapter.next.txt`, text)
  await fs.rename(`${output}/chapter.next.txt`, `${output}/chapter.txt`)
  if (started)
    chapters.push({ seconds: (Date.now() - started) / 1000, title: text })
}
const email = process.env.DEMO_EMAIL ?? `learner-${Date.now()}@example.test`
if (!/^[a-z0-9@.+-]+$/.test(email)) throw Error('Invalid test email')
await fs.appendFile(`${output}/accounts.txt`, email + '\n')
async function code() {
  for (let i = 0; i < 20; i++) {
    const response = await fetch(`${mailURL}/api/v1/messages?limit=100`)
    if (!response.ok) throw Error('Could not read test mailbox')
    const data = mailSchema.parse(await response.json())
    const message = data.messages.find((m) =>
      m.To.some((to) => to.Address === email),
    )
    const match = message?.Subject.match(/\b\d{6}\b/)
    if (match) return match[0]
    await page.waitForTimeout(500)
  }
  throw Error('Test email not delivered')
}
async function auth() {
  await type('#sync-email', email)
  await tap(page.getByRole('button', { name: /send.*link/i }))
  await expect(page.locator('#sync-otp')).toBeVisible()
  const otp = await code()
  await wait(3500)
  await type('#sync-otp', otp)
  await tap(
    page
      .getByRole('button', { name: /verify|sign in/i })
      .filter({ hasNotText: 'Resend' })
      .last(),
  )
}
async function closeSheet() {
  const b = await page.locator('.sheet-grabber-zone').boundingBox()
  const x = b.x + b.width / 2,
    y = b.y + b.height / 2
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  })
  for (let i = 1; i <= 18; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y + i * 12 }],
    })
    await page.waitForTimeout(18)
  }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
  await wait(1800)
}
async function nav(name) {
  await tap(
    page
      .locator('.mobile-tab-btn')
      .filter({ hasText: new RegExp(name, 'i') })
      .first(),
  )
}
async function practice(mode = 'Cards') {
  await nav('Practice')
  const item = page.getByRole('menuitem', { name: mode, exact: true })
  if (await item.isVisible()) await tap(item)
}
try {
  await page.setContent(
    '<body style="margin:0;background:#f8f5f3;color:#101815;font-family:system-ui;display:grid;place-content:center;height:100vh;text-align:center"><h1>Jolito</h1><p>A phrase worth remembering</p><p style="font-size:13px">Browser walkthrough · Local test environment</p></body>',
  )
  await chapter('Launch Jolito')
  const log = createWriteStream(`${output}/capture.log`)
  recording = spawn(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'warning',
      '-y',
      '-thread_queue_size',
      '512',
      '-f',
      'x11grab',
      '-framerate',
      '25',
      '-video_size',
      '880x1912',
      '-draw_mouse',
      '0',
      '-i',
      `${process.env.DISPLAY ?? ':94'}.0+0,174`,
      '-thread_queue_size',
      '512',
      '-f',
      'pulse',
      '-i',
      'jolito_record.monitor',
      '-vf',
      `pad=iw:ih+120:0:56:color=0xf8f5f3,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='Browser walkthrough | Local test environment':fontcolor=0x303a35:fontsize=23:x=(w-tw)/2:y=17,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=${output}/chapter.txt:reload=1:fontcolor=0x303a35:fontsize=25:x=(w-tw)/2:y=h-43`,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      `${output}/walkthrough.partial.mp4`,
    ],
    { stdio: ['pipe', 'ignore', 'pipe'] },
  )
  recording.stderr.pipe(log)
  recordingDone = new Promise((resolve, reject) => {
    recording.on('error', reject)
    recording.on('close', (code) => {
      log.end()
      code === 0 ? resolve() : reject(Error(`Capture exited ${code}`))
    })
  })
  // Attach a handler immediately; the awaited promise still reports capture failure.
  void recordingDone.catch(() => {})
  started = Date.now()
  await wait(1800)
  await page.goto(baseURL)
  await chapter('Save something worth remembering')
  await wait(5000)
  await tap(page.getByRole('button', { name: 'Create a card', exact: true }))
  await type('#spanish', '¿Me trae la cuenta, por favor?')
  await type('#english', 'Could you bring me the bill, please?')
  await type('#context', 'At a restaurant, when I am ready to pay.')
  await wait(2500)
  await tap(page.getByRole('button', { name: /sign in to save card/i }))
  await chapter('Create a free account')
  await wait(3000)
  await auth()
  await expect(page.getByText(/Saved/).first()).toBeVisible()
  await wait(3000)
  await nav('Account|Sync')
  await expect(page.getByText(email, { exact: true })).toBeVisible()
  await wait(3500)
  await closeSheet()
  await chapter('Build a personal deck')
  await nav('Deck')
  await wait(4000)
  await tap(page.getByRole('button', { name: 'Starter packs', exact: true }))
  await tap(
    page.getByRole('button', { name: /Inspect Mexican Street Phrases/i }),
  )
  await wait(4000)

  await tap(
    page.getByRole('button', { name: 'Add Provecho to deck', exact: true }),
  )
  await tap(
    page.getByRole('button', {
      name: 'Add Para llevar, por favor to deck',
      exact: true,
    }),
  )
  await wait(3000)
  await closeSheet()
  await chapter('Listen, recall, reveal, review')
  await practice()
  await wait(7000)

  const answers = {
    '¿Me trae la cuenta, por favor?': 'Could you bring me the bill, please?',
    'Could you bring me the bill, please?': '¿Me trae la cuenta, por favor?',
    Provecho: 'Enjoy your meal',
    'Enjoy your meal / Bon appétit': 'Provecho',
    'Para llevar, por favor': 'To go, please',
    'To go, please': 'Para llevar, por favor',
  }
  for (let i = 0; i < 3; i++) {
    await expect(page.locator('.study-prompt')).toBeVisible()
    const prompt = (await page.locator('.study-prompt').innerText()).trim()
    if (!answers[prompt]) throw Error('Unscripted prompt: ' + prompt)
    await wait(5500)
    await type('.answer-input', answers[prompt])
    await wait(1600)
    await tap(page.getByRole('button', { name: /reveal answer/i }))
    await wait(6500)
    if (i === 1) {
      await tap(
        page.getByRole('button', { name: 'Play answer audio', exact: true }),
      )
      await wait(5000)
    }
    await tap(page.getByRole('button', { name: /good/i }))
    await wait(2000)
  }
  await chapter('Improve a reminder')
  await nav('Deck')
  await type('input[aria-label="Search cards in deck"]', 'cuenta')
  await wait(3000)
  await tap(page.getByRole('row', { name: /Card: ¿Me trae/ }))
  await type('#edit-context', 'At a restaurant: ¿Me trae la cuenta, por favor?')
  await tap(page.getByRole('button', { name: 'Save changes', exact: true }))
  await wait(2500)
  await tap(page.getByRole('row', { name: /Card: ¿Me trae/ }))
  await expect(page.locator('#edit-context')).toHaveValue(
    'At a restaurant: ¿Me trae la cuenta, por favor?',
  )
  await wait(3500)
  await closeSheet()
  await chapter('Practice verb forms in context')
  await tap(page.getByRole('button', { name: 'Jolito home', exact: true }))
  await tap(page.locator('button.practice-menu-trigger'))
  await tap(page.getByRole('menuitem', { name: 'Grammar', exact: true }))
  await wait(4000)
  await tap(page.getByRole('button', { name: 'Start practice', exact: true }))
  await wait(7000)

  await type('.answer-input', 'hablé')
  await wait(2000)
  await tap(page.getByRole('button', { name: /reveal answer/i }))
  await wait(6500)
  await tap(page.getByRole('button', { name: /good/i }))
  await wait(6500)
  await chapter('Keep studying offline')
  await nav('Sync')
  await page.context().setOffline(true)
  await wait(5000)
  await closeSheet()
  await wait(5500)
  await expect(page.locator('.grammar-verb-cue')).toHaveText('ir')
  await type('.answer-input', 'fuiste')
  await wait(1600)
  await tap(page.getByRole('button', { name: /reveal answer/i }))
  await wait(6500)
  await tap(page.getByRole('button', { name: /good/i }))
  await wait(6500)
  await page.context().setOffline(false)
  await nav('Sync')
  await wait(4500)
  await chapter('Sign back in and pick up your deck')
  await tap(page.getByRole('button', { name: 'Sign out', exact: true }))
  await wait(2500)
  await nav('Account')
  await auth()
  await wait(3500)
  const sheet = page.locator('.sheet-grabber-zone')
  if (await sheet.isVisible()) await closeSheet()
  await nav('Deck')
  await type('input[aria-label="Search cards in deck"]', 'cuenta')
  await tap(page.getByRole('row', { name: /Card: ¿Me trae/ }))
  await expect(page.locator('#edit-context')).toHaveValue(
    'At a restaurant: ¿Me trae la cuenta, por favor?',
  )
  await wait(4500)
  await closeSheet()
  await chapter('Delete the disposable demonstration account')
  await nav('Sync')
  await tap(
    page.getByRole('button', {
      name: 'Delete cloud account & data',
      exact: true,
    }),
  )
  await wait(6500)
  await tap(
    page.getByRole('checkbox', {
      name: 'Save an offline backup before deleting',
      exact: true,
    }),
  )
  await type('#delete-confirm-input', 'DELETE')
  await wait(2000)
  await tap(
    page.getByRole('button', { name: 'Yes, delete cloud data', exact: true }),
  )
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('jolito-auth-session-v1')),
    )
    .toBeNull()
  await expect(
    page.getByText('Cloud account and backup data deleted.', { exact: true }),
  ).toBeVisible()
  await wait(5000)
  await chapter('Walkthrough complete')
  await wait(4000)

  const remaining = execFileSync(
    'docker',
    [
      'exec',
      'supabase_db_jolito',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-Atc',
      `SELECT count(*) FROM auth.users WHERE email = '${email}'`,
    ],
    { encoding: 'utf8' },
  ).trim()
  if (remaining !== '0') throw Error('Test account still exists after deletion')
  expect(pageErrors).toEqual([])
  await page.screenshot({ path: `${output}/completed.png` })
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim()
  await fs.writeFile(
    `${output}/manifest.json`,
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        sourceCommit,
        capture:
          'Chromium mobile viewport; local Supabase/Mailpit; web speech; not physical iOS',
        playbackSpeed: pace,
        viewport: { width: 440, height: 956, scale: 2 },
        chapters,
        accountDeleted: true,
        pageErrors,
      },
      null,
      2,
    ) + '\n',
  )
  recording.stdin.write('q')
  await recordingDone
  recording = null
  await fs.rename(
    `${output}/walkthrough.partial.mp4`,
    `${output}/walkthrough.mp4`,
  )
  console.log(
    'Completed browser recording; human audiovisual review still required.',
  )
} catch (e) {
  console.error(e.message)
  await page.screenshot({ path: `${output}/error.png` }).catch(() => {})
  process.exitCode = 1
} finally {
  if (recording) {
    recording.stdin.write('q')
    await recordingDone.catch(() => {})
  }
  await context.setOffline(false).catch(() => {})
  await browser.close()
}
