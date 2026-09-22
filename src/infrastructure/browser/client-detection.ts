import { Capacitor } from '@capacitor/core'
import type { DeviceType, Platform } from '../../domain/telemetry.ts'
import { isIOS, isMacOS } from './environment.ts'

export function detectPlatform(
  isNative = Capacitor.isNativePlatform(),
  platformName = Capacitor.getPlatform(),
): Platform {
  if (isNative) {
    if (platformName === 'ios') return 'ios'
    if (platformName === 'android') return 'android'
    return 'unknown'
  }
  return 'web'
}

export function detectOperatingSystem(
  customNavigator?: {
    userAgent?: string
    maxTouchPoints?: number
    platform?: string
  } | null,
): string {
  const nav =
    customNavigator === undefined
      ? typeof navigator !== 'undefined'
        ? navigator
        : null
      : customNavigator
  if (!nav) return 'Other'

  if (isIOS(nav)) {
    return 'iOS'
  }
  const ua = nav.userAgent || ''
  if (/Android/.test(ua)) {
    return 'Android'
  }
  if (isMacOS(nav)) {
    return 'macOS'
  }
  if (/Windows NT/.test(ua)) {
    return 'Windows'
  }
  if (/CrOS/.test(ua)) {
    return 'ChromeOS'
  }
  if (/Linux/.test(ua)) {
    return 'Linux'
  }
  return 'Other'
}

export function detectBrowser(
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  isNative = Capacitor.isNativePlatform(),
): string {
  if (isNative) {
    return 'Capacitor'
  }
  if (/Edg\/|EdgiOS\//.test(userAgent)) {
    return 'Edge'
  }
  if (/Firefox\/|FxiOS\//.test(userAgent)) {
    return 'Firefox'
  }
  if (/Chrome\/|CriOS\//.test(userAgent) && !/Edg\/|EdgiOS\//.test(userAgent)) {
    return 'Chrome'
  }
  if (/Safari\//.test(userAgent) && !/Chrome\/|CriOS\//.test(userAgent)) {
    return 'Safari'
  }
  return 'Other'
}

export function detectDeviceType(
  customNavigator?: {
    userAgent?: string
    maxTouchPoints?: number
    platform?: string
  } | null,
): DeviceType {
  const nav =
    customNavigator === undefined
      ? typeof navigator !== 'undefined'
        ? navigator
        : null
      : customNavigator
  if (!nav) return 'unknown'

  const ua = nav.userAgent || ''
  const isTablet =
    /iPad/.test(ua) ||
    (nav.platform === 'MacIntel' && (nav.maxTouchPoints || 0) > 1) ||
    (/Android/.test(ua) && !/Mobile/.test(ua))

  if (isTablet) {
    return 'tablet'
  }
  if (/iPhone|iPod|Mobile/.test(ua) || /Android/.test(ua)) {
    return 'mobile'
  }
  return 'desktop'
}
