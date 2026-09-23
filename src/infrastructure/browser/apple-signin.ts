import { Capacitor, registerPlugin } from '@capacitor/core'

export interface AppleSignInResult {
  identityToken?: string | undefined
  authorizationCode?: string | undefined
  user?: string | undefined
  email?: string | null | undefined
  givenName?: string | null | undefined
  familyName?: string | null | undefined
  canceled?: boolean | undefined
}

export interface NativeAppleSignInPlugin {
  signIn(this: void): Promise<AppleSignInResult>
}

const noopPlugin: NativeAppleSignInPlugin = {
  signIn: () => Promise.resolve({ canceled: true }),
}

export const NativeAppleSignIn = registerPlugin<NativeAppleSignInPlugin>(
  'AppleSignIn',
  {
    web: () => noopPlugin,
  },
)

export function isAppleSignInSupported(
  isNative: boolean = Capacitor.isNativePlatform(),
  platform: string = Capacitor.getPlatform(),
): boolean {
  return isNative && platform === 'ios'
}

export async function requestAppleSignIn(
  nativePlugin: NativeAppleSignInPlugin = NativeAppleSignIn,
): Promise<AppleSignInResult> {
  try {
    return await nativePlugin.signIn()
  } catch {
    return {
      canceled: false,
      identityToken: undefined,
    }
  }
}
