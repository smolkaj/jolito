import { registerPlugin } from '@capacitor/core'

export interface ShareFileOptions {
  filename: string
  content: string
}

export interface NativeShareFilePlugin {
  shareFile(
    this: void,
    options: ShareFileOptions,
  ): Promise<{ completed: boolean }>
}

const noopPlugin: NativeShareFilePlugin = {
  shareFile: () => Promise.resolve({ completed: false }),
}

export const NativeShareFile = registerPlugin<NativeShareFilePlugin>(
  'ShareFile',
  {
    web: () => noopPlugin,
  },
)

export async function shareFileNative(
  filename: string,
  content: string,
  nativePlugin: NativeShareFilePlugin = NativeShareFile,
): Promise<boolean> {
  try {
    const res = await nativePlugin.shareFile({ filename, content })
    return res.completed
  } catch {
    return false
  }
}
