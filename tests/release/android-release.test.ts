import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, statSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const rootDir = join(import.meta.dirname, '../..')

void test('android/app/build.gradle configures release signing and dynamic versioning', () => {
  const gradle = readFileSync(join(rootDir, 'android/app/build.gradle'), 'utf8')

  assert.match(
    gradle,
    /signingConfigs\s*\{[^}]*release\s*\{[^}]*ANDROID_KEYSTORE_PATH/,
    'Signing configs must define release block checking ANDROID_KEYSTORE_PATH',
  )
  assert.match(
    gradle,
    /storePassword System\.getenv\("ANDROID_KEYSTORE_PASSWORD"\)/,
    'Release signing config must use ANDROID_KEYSTORE_PASSWORD',
  )
  assert.match(
    gradle,
    /keyAlias System\.getenv\("ANDROID_KEY_ALIAS"\)/,
    'Release signing config must use ANDROID_KEY_ALIAS',
  )
  assert.match(
    gradle,
    /keyPassword System\.getenv\("ANDROID_KEY_PASSWORD"\)/,
    'Release signing config must use ANDROID_KEY_PASSWORD',
  )
  assert.match(
    gradle,
    /buildTypes\s*\{[^}]*release\s*\{[^}]*signingConfig signingConfigs\.release/,
    'buildTypes.release must apply signingConfigs.release when keystore is present',
  )
  assert.match(
    gradle,
    /versionCode System\.getenv\("BUILD_NUMBER"\)/,
    'versionCode must support dynamic BUILD_NUMBER injection',
  )
  assert.match(
    gradle,
    /versionName System\.getenv\("APP_VERSION"\)/,
    'versionName must support dynamic APP_VERSION injection',
  )
})

void test('scripts/generate-android-keystore.sh exists, is executable, and uses secure PKCS12 parameters', () => {
  const scriptPath = join(rootDir, 'scripts/generate-android-keystore.sh')
  assert.ok(existsSync(scriptPath), 'Keystore generator script must exist')

  const stat = statSync(scriptPath)
  const isExecutable = (stat.mode & 0o111) !== 0
  assert.ok(isExecutable, 'Keystore generator script must be executable')

  const content = readFileSync(scriptPath, 'utf8')
  assert.match(content, /keytool -genkeypair/, 'Must use keytool -genkeypair')
  assert.match(content, /-storetype PKCS12/, 'Must specify PKCS12 store type')
  assert.match(content, /-keyalg RSA/, 'Must use RSA key algorithm')
  assert.match(content, /-keysize 2048/, 'Must use at least 2048-bit key size')
  assert.match(content, /-validity 10000/, 'Must specify 25-year validity')
  assert.match(
    content,
    /chmod 0600/,
    'Must enforce restrictive file permissions (0600)',
  )
  assert.match(
    content,
    /ANDROID_KEYSTORE_BASE64/,
    'Must output instructions for ANDROID_KEYSTORE_BASE64',
  )
})

void test('fastlane Appfile and Fastfile support Android distribution lanes', () => {
  const appfile = readFileSync(join(rootDir, 'fastlane/Appfile'), 'utf8')
  assert.match(
    appfile,
    /package_name\(/,
    'Appfile must configure package_name for Android',
  )

  const fastfile = readFileSync(join(rootDir, 'fastlane/Fastfile'), 'utf8')
  assert.match(
    fastfile,
    /platform :android do/,
    'Fastfile must define platform :android',
  )
  assert.match(
    fastfile,
    /lane :build do/,
    'Android platform must include :build lane',
  )
  assert.match(
    fastfile,
    /lane :internal do/,
    'Android platform must include :internal lane',
  )
  assert.match(
    fastfile,
    /lane :release do/,
    'Android platform must include :release lane',
  )
  assert.match(
    fastfile,
    /lane :metadata do/,
    'Android platform must include :metadata lane',
  )
})

void test('fastlane/metadata/android conforms strictly to Google Play limits and asset requirements', () => {
  const metadataDir = join(rootDir, 'fastlane/metadata/android/en-US')

  // 1. Title (max 30 characters)
  const titlePath = join(metadataDir, 'title.txt')
  assert.ok(existsSync(titlePath), 'title.txt must exist')
  const title = readFileSync(titlePath, 'utf8').trim()
  assert.ok(
    title.length > 0 && title.length <= 30,
    `Title length must be <= 30 chars, got: ${title.length}`,
  )

  // 2. Short description (max 80 characters)
  const shortDescPath = join(metadataDir, 'short_description.txt')
  assert.ok(existsSync(shortDescPath), 'short_description.txt must exist')
  const shortDesc = readFileSync(shortDescPath, 'utf8').trim()
  assert.ok(
    shortDesc.length > 0 && shortDesc.length <= 80,
    `Short description length must be <= 80 chars, got: ${shortDesc.length}`,
  )

  // 3. Full description (max 4000 characters)
  const fullDescPath = join(metadataDir, 'full_description.txt')
  assert.ok(existsSync(fullDescPath), 'full_description.txt must exist')
  const fullDesc = readFileSync(fullDescPath, 'utf8').trim()
  assert.ok(
    fullDesc.length > 0 && fullDesc.length <= 4000,
    `Full description length must be <= 4000 chars, got: ${fullDesc.length}`,
  )

  // 4. Feature graphic (1024 x 500 PNG)
  const fgPath = join(metadataDir, 'images/featureGraphic.png')
  assert.ok(existsSync(fgPath), 'featureGraphic.png must exist')
  const fgBuffer = readFileSync(fgPath)
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  assert.equal(
    fgBuffer.subarray(0, 8).toString('hex'),
    '89504e470d0a1a0a',
    'featureGraphic must be a valid PNG',
  )
  // IHDR width and height at offset 16 and 20 (big-endian 32-bit uint)
  const fgWidth = fgBuffer.readUInt32BE(16)
  const fgHeight = fgBuffer.readUInt32BE(20)
  assert.equal(
    fgWidth,
    1024,
    `featureGraphic width must be 1024, got: ${fgWidth}`,
  )
  assert.equal(
    fgHeight,
    500,
    `featureGraphic height must be 500, got: ${fgHeight}`,
  )

  // 5. Icon (512 x 512 PNG)
  const iconPath = join(metadataDir, 'images/icon.png')
  assert.ok(existsSync(iconPath), 'icon.png must exist')
  const iconBuffer = readFileSync(iconPath)
  assert.equal(
    iconBuffer.subarray(0, 8).toString('hex'),
    '89504e470d0a1a0a',
    'icon must be a valid PNG',
  )
  const iconWidth = iconBuffer.readUInt32BE(16)
  const iconHeight = iconBuffer.readUInt32BE(20)
  assert.equal(iconWidth, 512, `icon width must be 512, got: ${iconWidth}`)
  assert.equal(iconHeight, 512, `icon height must be 512, got: ${iconHeight}`)

  // 6. Screenshot directories have assets
  const phoneScreenshots = readdirSync(
    join(metadataDir, 'images/phoneScreenshots'),
  )
  assert.ok(
    phoneScreenshots.length >= 2,
    'Must have at least 2 phone screenshots',
  )

  const sevenInchScreenshots = readdirSync(
    join(metadataDir, 'images/sevenInchScreenshots'),
  )
  assert.ok(
    sevenInchScreenshots.length >= 1,
    'Must have at least 1 7-inch tablet screenshot',
  )

  const tenInchScreenshots = readdirSync(
    join(metadataDir, 'images/tenInchScreenshots'),
  )
  assert.ok(
    tenInchScreenshots.length >= 1,
    'Must have at least 1 10-inch tablet screenshot',
  )
})

void test('.github/workflows/playstore.yml enforces production safety invariants', () => {
  const workflowPath = join(rootDir, '.github/workflows/playstore.yml')
  assert.ok(existsSync(workflowPath), 'playstore.yml must exist')

  const workflow = readFileSync(workflowPath, 'utf8')
  assert.match(
    workflow,
    /concurrency:\s*group:\s*google-release\s*cancel-in-progress:\s*false/,
    'Must enforce single-runner mutual exclusion with cancel-in-progress: false',
  )
  assert.match(
    workflow,
    /if:\s*github\.ref == 'refs\/heads\/main'/,
    'Must restrict release execution strictly to refs/heads/main',
  )
  assert.match(
    workflow,
    /ANDROID_KEYSTORE_BASE64:\s*\$\{\{\s*secrets\.ANDROID_KEYSTORE_BASE64\s*\}\}/,
    'Must reference ANDROID_KEYSTORE_BASE64 secret',
  )
  assert.match(
    workflow,
    /chmod 0600 "\$RUNNER_TEMP\/keystore\/release\.keystore"/,
    'Must restrict permissions on decoded keystore',
  )
  assert.match(
    workflow,
    /\.\/gradlew bundleRelease/,
    'Must build production release Android App Bundle (AAB)',
  )
})
