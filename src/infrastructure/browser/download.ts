import { Capacitor } from '@capacitor/core'
import { shareFileNative } from './share-file'

export async function downloadJsonFile(
  filename: string,
  jsonContent: string,
  isNative: boolean = Capacitor.isNativePlatform(),
): Promise<void> {
  if (isNative) {
    await shareFileNative(filename, jsonContent)
    return
  }

  if (typeof document === 'undefined') return

  const blob = new Blob([jsonContent], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
