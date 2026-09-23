import { describe, expect, it, vi } from 'vitest'
import {
  isAppleSignInSupported,
  NativeAppleSignIn,
  requestAppleSignIn,
  type NativeAppleSignInPlugin,
} from './apple-signin'

describe('isAppleSignInSupported', () => {
  it('returns true only when native platform is iOS', () => {
    expect(isAppleSignInSupported(true, 'ios')).toBe(true)
    expect(isAppleSignInSupported(true, 'android')).toBe(false)
    expect(isAppleSignInSupported(false, 'ios')).toBe(false)
    expect(isAppleSignInSupported(false, 'web')).toBe(false)
  })
})

describe('requestAppleSignIn', () => {
  it('delegates to native plugin and returns credential result', async () => {
    const signInMock = vi
      .fn<NativeAppleSignInPlugin['signIn']>()
      .mockResolvedValue({
        identityToken: 'mock-jwt-token',
        user: '001234.apple.id',
        email: 'learner@example.com',
      })
    const mockPlugin: NativeAppleSignInPlugin = {
      signIn: signInMock,
    }

    const result = await requestAppleSignIn(mockPlugin)
    expect(result.identityToken).toBe('mock-jwt-token')
    expect(result.user).toBe('001234.apple.id')
    expect(result.email).toBe('learner@example.com')
  })

  it('handles user cancellation gracefully', async () => {
    const signInMock = vi
      .fn<NativeAppleSignInPlugin['signIn']>()
      .mockResolvedValue({
        canceled: true,
      })
    const mockPlugin: NativeAppleSignInPlugin = {
      signIn: signInMock,
    }

    const result = await requestAppleSignIn(mockPlugin)
    expect(result.canceled).toBe(true)
  })

  it('safely catches native plugin failure', async () => {
    const signInMock = vi
      .fn<NativeAppleSignInPlugin['signIn']>()
      .mockRejectedValue(new Error('Native error'))
    const mockPlugin: NativeAppleSignInPlugin = {
      signIn: signInMock,
    }

    const result = await requestAppleSignIn(mockPlugin)
    expect(result.identityToken).toBeUndefined()
    expect(result.canceled).toBe(false)
  })

  it('web no-op plugin returns canceled: true', async () => {
    const result = await NativeAppleSignIn.signIn()
    expect(result.canceled).toBe(true)
  })
})
