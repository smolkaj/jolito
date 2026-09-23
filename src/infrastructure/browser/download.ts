import { Capacitor } from '@capacitor/core'
import { shareFileNative, type ShareFileOutcome } from './share-file'

export type DownloadFileOutcome = ShareFileOutcome

export async function downloadJsonFile(
  filename: string,
  jsonContent: string,
  isNative: boolean = Capacitor.isNativePlatform(),
): Promise<DownloadFileOutcome> {
  if (isNative) {
    return await shareFileNative(filename, jsonContent)
  }

  if (typeof document === 'undefined') return 'error'

  try {
    const blob = new Blob([jsonContent], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    return 'completed'
  } catch {
    return 'error'
  }
}
