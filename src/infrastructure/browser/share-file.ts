import { registerPlugin } from '@capacitor/core'

export interface ShareFileOptions {
  filename: string
  content: string
}

export interface NativeShareFilePlugin {
  shareFile(
    this: void,
    options: ShareFileOptions,
  ): Promise<{ completed: boolean; canceled?: boolean }>
}

const noopPlugin: NativeShareFilePlugin = {
  shareFile: () => Promise.resolve({ completed: false, canceled: true }),
}

export const NativeShareFile = registerPlugin<NativeShareFilePlugin>(
  'ShareFile',
  {
    web: () => noopPlugin,
  },
)

export type ShareFileOutcome = 'completed' | 'canceled' | 'error'

export async function shareFileNative(
  filename: string,
  content: string,
  nativePlugin: NativeShareFilePlugin = NativeShareFile,
): Promise<ShareFileOutcome> {
  try {
    const res = await nativePlugin.shareFile({ filename, content })
    return res.completed ? 'completed' : 'canceled'
  } catch {
    return 'error'
  }
}
