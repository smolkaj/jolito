import { Capacitor } from '@capacitor/core'
import type { DeviceType, Platform } from '../../domain/telemetry.ts'

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
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  maxTouchPoints = typeof navigator !== 'undefined'
    ? navigator.maxTouchPoints
    : 0,
  platform = typeof navigator !== 'undefined' ? navigator.platform : '',
): string {
  if (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (platform === 'MacIntel' && maxTouchPoints > 1)
  ) {
    return 'iOS'
  }
  if (/Android/.test(userAgent)) {
    return 'Android'
  }
  if (/Macintosh|Mac OS X/.test(userAgent)) {
    return 'macOS'
  }
  if (/Windows NT/.test(userAgent)) {
    return 'Windows'
  }
  if (/CrOS/.test(userAgent)) {
    return 'ChromeOS'
  }
  if (/Linux/.test(userAgent)) {
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
  if (/Edg\//.test(userAgent)) {
    return 'Edge'
  }
  if (/Firefox\//.test(userAgent)) {
    return 'Firefox'
  }
  if (/Chrome\//.test(userAgent) && !/Edg\//.test(userAgent)) {
    return 'Chrome'
  }
  if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) {
    return 'Safari'
  }
  return 'Other'
}

export function detectDeviceType(
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  maxTouchPoints = typeof navigator !== 'undefined'
    ? navigator.maxTouchPoints
    : 0,
  platform = typeof navigator !== 'undefined' ? navigator.platform : '',
): DeviceType {
  if (
    /iPad/.test(userAgent) ||
    (platform === 'MacIntel' && maxTouchPoints > 1)
  ) {
    return 'tablet'
  }
  if (/Android/.test(userAgent) && !/Mobile/.test(userAgent)) {
    return 'tablet'
  }
  if (/iPhone|iPod|Mobile/.test(userAgent) || /Android/.test(userAgent)) {
    return 'mobile'
  }
  return 'desktop'
}
