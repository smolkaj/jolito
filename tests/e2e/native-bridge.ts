import type { Page } from '@playwright/test'

export interface MockNativeCall {
  plugin: string
  method: string
  args: unknown
  timestamp: number
}

export interface MockNativeListener {
  id: string
  plugin: string
  eventName: string
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
 * Enables testing iOS/Android native plugins (AppleSignIn, NativeSpeech, SpeechRecognition,
 * LiveActivity, AppReview, Keyboard, ShareFile) in standard WebKit/Chromium Playwright tests
 * without requiring emulators or native builds.
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

      // 2. Setup call recording log and listener registry
      const recordedCalls: MockNativeCall[] = []
      ;(
        window as unknown as { __nativeBridgeCalls: MockNativeCall[] }
      ).__nativeBridgeCalls = recordedCalls

      interface InternalListener {
        id: string
        plugin: string
        eventName: string
        callback: (data: unknown, error?: unknown) => void
      }
      const listenersById = new Map<string, InternalListener>()
      let nextCallbackId = 1

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
        nativeCallback?: (
          plugin: string,
          method: string,
          options?: unknown,
          callback?: (data: unknown, error?: unknown) => void,
        ) => string
        fromNative?: (result: {
          callbackId?: string
          data?: unknown
          success?: boolean
          error?: unknown
          save?: boolean
        }) => void
      }

      const cap = ((window as unknown as { Capacitor?: CapGlobal }).Capacitor =
        (window as unknown as { Capacitor?: CapGlobal }).Capacitor ?? {})

      const commonListenerMethods = [
        { name: 'addListener', rtype: 'callback' },
        { name: 'removeListener', rtype: 'callback' },
        { name: 'removeAllListeners', rtype: 'promise' },
      ]

      cap.PluginHeaders = [
        {
          name: 'AppleSignIn',
          methods: [
            { name: 'signIn', rtype: 'promise' },
            ...commonListenerMethods,
          ],
        },
        {
          name: 'NativeSpeech',
          methods: [
            { name: 'isAvailable', rtype: 'promise' },
            { name: 'speak', rtype: 'promise' },
            { name: 'stop', rtype: 'promise' },
            { name: 'getVoices', rtype: 'promise' },
            ...commonListenerMethods,
          ],
        },
        {
          name: 'SpeechRecognition',
          methods: [
            { name: 'isAvailable', rtype: 'promise' },
            { name: 'requestPermissions', rtype: 'promise' },
            { name: 'start', rtype: 'promise' },
            { name: 'stop', rtype: 'promise' },
            ...commonListenerMethods,
          ],
        },
        {
          name: 'LiveActivity',
          methods: [
            { name: 'startPractice', rtype: 'promise' },
            { name: 'updatePractice', rtype: 'promise' },
            { name: 'endPractice', rtype: 'promise' },
            ...commonListenerMethods,
          ],
        },
        {
          name: 'AppReview',
          methods: [
            { name: 'requestReview', rtype: 'promise' },
            ...commonListenerMethods,
          ],
        },
        {
          name: 'ShareFile',
          methods: [
            { name: 'shareFile', rtype: 'promise' },
            ...commonListenerMethods,
          ],
        },
        {
          name: 'Keyboard',
          methods: [
            ...commonListenerMethods,
            { name: 'show', rtype: 'promise' },
            { name: 'hide', rtype: 'promise' },
            { name: 'setAccessoryBarVisible', rtype: 'promise' },
            { name: 'setStyle', rtype: 'promise' },
            { name: 'setResizeMode', rtype: 'promise' },
            { name: 'getResizeMode', rtype: 'promise' },
          ],
        },
      ]

      cap.nativeCallback = (
        plugin: string,
        method: string,
        options?: unknown,
        callback?: (data: unknown, error?: unknown) => void,
      ): string => {
        let cb = callback
        let opts = options as Record<string, unknown> | undefined
        if (typeof opts === 'function') {
          cb = opts
          opts = undefined
        }

        recordedCalls.push({
          plugin,
          method,
          args: opts,
          timestamp: Date.now(),
        })

        if (method === 'addListener') {
          const eventName = (opts?.eventName as string) ?? ''
          const callbackId = String(nextCallbackId++)
          if (typeof cb === 'function') {
            listenersById.set(callbackId, {
              id: callbackId,
              plugin,
              eventName,
              callback: cb,
            })
          }
          return callbackId
        }

        if (method === 'removeListener') {
          const callbackId = opts?.callbackId as string | undefined
          if (callbackId && listenersById.has(callbackId)) {
            listenersById.delete(callbackId)
          }
          return callbackId ?? ''
        }

        return ''
      }

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

        if (method === 'removeAllListeners') {
          for (const [id, listener] of listenersById.entries()) {
            if (listener.plugin === plugin) {
              listenersById.delete(id)
            }
          }
          return Promise.resolve()
        }

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

      cap.fromNative = (result: {
        callbackId?: string
        data?: unknown
        success?: boolean
        error?: unknown
        save?: boolean
      }) => {
        if (!result || !result.callbackId) return
        const listener = listenersById.get(result.callbackId)
        if (!listener) return
        if (result.success !== false) {
          listener.callback(result.data)
        } else {
          listener.callback(null, result.error)
        }
        if (result.save === false) {
          listenersById.delete(result.callbackId)
        }
      }

      ;(
        window as unknown as {
          __emitNativeBridgeEvent: (
            plugin: string,
            eventName: string,
            data?: unknown,
          ) => number
        }
      ).__emitNativeBridgeEvent = (
        plugin: string,
        eventName: string,
        data?: unknown,
      ): number => {
        let count = 0
        for (const listener of listenersById.values()) {
          if (listener.plugin === plugin && listener.eventName === eventName) {
            count++
            try {
              listener.callback(data)
            } catch (err) {
              console.error('Error in mock native listener callback:', err)
            }
          }
        }
        return count
      }

      ;(
        window as unknown as {
          __getNativeBridgeListeners: (plugin?: string) => MockNativeListener[]
        }
      ).__getNativeBridgeListeners = (
        plugin?: string,
      ): MockNativeListener[] => {
        const result: MockNativeListener[] = []
        for (const listener of listenersById.values()) {
          if (!plugin || listener.plugin === plugin) {
            result.push({
              id: listener.id,
              plugin: listener.plugin,
              eventName: listener.eventName,
            })
          }
        }
        return result
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

/**
 * Emits an event from the mock native bridge to all active listeners.
 * Returns the number of listeners that received the event.
 */
export async function emitNativeBridgeEvent(
  page: Page,
  pluginName: string,
  eventName: string,
  data?: unknown,
): Promise<number> {
  return await page.evaluate(
    ({ pluginName, eventName, data }) => {
      const emit = (
        window as unknown as {
          __emitNativeBridgeEvent?: (
            plugin: string,
            event: string,
            data?: unknown,
          ) => number
        }
      ).__emitNativeBridgeEvent
      return emit ? emit(pluginName, eventName, data) : 0
    },
    { pluginName, eventName, data },
  )
}

/**
 * Returns all active listeners currently registered on the mock native bridge.
 */
export async function getNativeBridgeListeners(
  page: Page,
  pluginName?: string,
): Promise<MockNativeListener[]> {
  return await page.evaluate((pluginName) => {
    const getListeners = (
      window as unknown as {
        __getNativeBridgeListeners?: (plugin?: string) => MockNativeListener[]
      }
    ).__getNativeBridgeListeners
    return getListeners ? getListeners(pluginName) : []
  }, pluginName)
}
