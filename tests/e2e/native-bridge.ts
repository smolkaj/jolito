import type { Page } from '@playwright/test'

export interface MockNativeCall {
  plugin: string
  method: string
  args: unknown
  timestamp: number
}

export interface MockNativeBridgeOptions {
  platform?: 'ios' | 'android'
  appleSignInResult?: {
    user?: string
    identityToken?: string
    authorizationCode?: string
    nonce?: string
    email?: string | null
    givenName?: string | null
    familyName?: string | null
    canceled?: boolean
    error?: string
  }
  nativeVoices?: Array<{
    identifier: string
    name: string
    language: string
    quality: string
    gender: string
  }>
}

/**
 * Installs a spec-compliant headless mock Capacitor bridge in the browser page context.
 * Enables testing iOS/Android native plugins (AppleSignIn, NativeSpeech, LiveActivity, AppReview)
 * in standard WebKit/Chromium Playwright tests without requiring emulators or native builds.
 */
export async function installMockNativeBridge(
  page: Page,
  options: MockNativeBridgeOptions = {},
): Promise<void> {
  const platform = options.platform ?? 'ios'
  const appleSignInResult = options.appleSignInResult ?? {
    user: 'test-apple-user-id',
    identityToken: 'mock-apple-identity-token',
    authorizationCode: 'mock-auth-code',
    nonce: 'mock-apple-nonce',
    email: 'learner@example.com',
    givenName: 'Test',
    familyName: 'Learner',
  }
  const nativeVoices = options.nativeVoices ?? [
    {
      identifier: 'com.apple.voice.compact.es-MX.Paulina',
      name: 'Paulina',
      language: 'es-MX',
      quality: 'default',
      gender: 'female',
    },
    {
      identifier: 'com.apple.voice.compact.es-ES.Jorge',
      name: 'Jorge',
      language: 'es-ES',
      quality: 'default',
      gender: 'male',
    },
  ]

  await page.addInitScript(
    ({ platform, appleSignInResult, nativeVoices }) => {
      // 1. Simulate native platform environment check in WebKit
      if (platform === 'ios') {
        const globalWin = window as unknown as {
          webkit?: {
            messageHandlers?: {
              bridge?: {
                postMessage?: (msg: unknown) => void
              }
            }
          }
        }
        globalWin.webkit = globalWin.webkit ?? {}
        globalWin.webkit.messageHandlers =
          globalWin.webkit.messageHandlers ?? {}
        globalWin.webkit.messageHandlers.bridge = {
          postMessage: () => {},
        }
      } else if (platform === 'android') {
        ;(window as unknown as { androidBridge?: unknown }).androidBridge = {}
      }

      // 2. Setup call recording log
      const recordedCalls: MockNativeCall[] = []
      ;(
        window as unknown as { __nativeBridgeCalls: MockNativeCall[] }
      ).__nativeBridgeCalls = recordedCalls

      // 3. Configure Capacitor global and PluginHeaders before plugins register
      interface CapGlobal {
        PluginHeaders?: Array<{
          name: string
          methods: Array<{ name: string; rtype?: string }>
        }>
        nativePromise?: (
          plugin: string,
          method: string,
          args: unknown,
        ) => Promise<unknown>
      }

      const cap = ((window as unknown as { Capacitor?: CapGlobal }).Capacitor =
        (window as unknown as { Capacitor?: CapGlobal }).Capacitor ?? {})

      cap.PluginHeaders = [
        {
          name: 'AppleSignIn',
          methods: [{ name: 'signIn', rtype: 'promise' }],
        },
        {
          name: 'NativeSpeech',
          methods: [
            { name: 'isAvailable', rtype: 'promise' },
            { name: 'speak', rtype: 'promise' },
            { name: 'stop', rtype: 'promise' },
            { name: 'getVoices', rtype: 'promise' },
          ],
        },
        {
          name: 'SpeechRecognition',
          methods: [
            { name: 'isAvailable', rtype: 'promise' },
            { name: 'requestPermissions', rtype: 'promise' },
            { name: 'start', rtype: 'promise' },
            { name: 'stop', rtype: 'promise' },
          ],
        },
        {
          name: 'LiveActivity',
          methods: [
            { name: 'startPractice', rtype: 'promise' },
            { name: 'updatePractice', rtype: 'promise' },
            { name: 'endPractice', rtype: 'promise' },
          ],
        },
        {
          name: 'AppReview',
          methods: [{ name: 'requestReview', rtype: 'promise' }],
        },
        {
          name: 'ShareFile',
          methods: [{ name: 'shareFile', rtype: 'promise' }],
        },
      ]

      cap.nativePromise = (
        plugin: string,
        method: string,
        args: unknown,
      ): Promise<unknown> => {
        recordedCalls.push({
          plugin,
          method,
          args,
          timestamp: Date.now(),
        })

        if (plugin === 'AppleSignIn') {
          if (method === 'signIn') {
            if (appleSignInResult.error) {
              return Promise.reject(new Error(appleSignInResult.error))
            }
            return Promise.resolve(appleSignInResult)
          }
        }

        if (plugin === 'NativeSpeech') {
          if (method === 'isAvailable') {
            return Promise.resolve({ available: true })
          }
          if (method === 'getVoices') {
            return Promise.resolve({ voices: nativeVoices })
          }
          if (method === 'speak') {
            return Promise.resolve({ completed: true, interrupted: false })
          }
          if (method === 'stop') {
            return Promise.resolve({ stopped: true })
          }
        }

        if (plugin === 'SpeechRecognition') {
          if (method === 'isAvailable') {
            return Promise.resolve({
              available: true,
              supportsOnDevice: true,
            })
          }
          if (method === 'requestPermissions') {
            return Promise.resolve({ granted: true })
          }
          if (method === 'start') {
            return Promise.resolve({ started: true })
          }
          if (method === 'stop') {
            return Promise.resolve({ stopped: true })
          }
        }

        if (plugin === 'LiveActivity') {
          if (method === 'startPractice') {
            return Promise.resolve({
              supported: true,
              enabled: true,
              started: true,
              id: 'mock-activity-123',
            })
          }
          if (method === 'updatePractice') {
            return Promise.resolve({ supported: true, updated: true })
          }
          if (method === 'endPractice') {
            return Promise.resolve({ supported: true, ended: true })
          }
        }

        if (plugin === 'AppReview') {
          if (method === 'requestReview') {
            return Promise.resolve({ requested: true })
          }
        }

        if (plugin === 'ShareFile') {
          if (method === 'shareFile') {
            return Promise.resolve({ completed: true })
          }
        }

        return Promise.resolve({})
      }
    },
    { platform, appleSignInResult, nativeVoices },
  )
}

/**
 * Retrieves all recorded native plugin calls from the page context.
 */
export async function getNativeBridgeCalls(
  page: Page,
  pluginName?: string,
): Promise<MockNativeCall[]> {
  const calls = await page.evaluate(() => {
    return (
      (window as unknown as { __nativeBridgeCalls?: MockNativeCall[] })
        .__nativeBridgeCalls ?? []
    )
  })

  if (pluginName) {
    return calls.filter((c) => c.plugin === pluginName)
  }
  return calls
}
