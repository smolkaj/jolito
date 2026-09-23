import { describe, expect, it, vi } from 'vitest'
import {
  NativeShareFile,
  shareFileNative,
  type NativeShareFilePlugin,
} from './share-file'

describe('shareFileNative', () => {
  it('calls nativePlugin.shareFile and returns completed', async () => {
    const shareFileMock = vi
      .fn<NativeShareFilePlugin['shareFile']>()
      .mockResolvedValue({ completed: true })
    const mockPlugin: NativeShareFilePlugin = {
      shareFile: shareFileMock,
    }

    const result = await shareFileNative(
      'backup.json',
      '{"hello":"world"}',
      mockPlugin,
    )
    expect(result).toBe('completed')
    expect(shareFileMock).toHaveBeenCalledWith({
      filename: 'backup.json',
      content: '{"hello":"world"}',
    })
  })

  it('returns canceled when dismissed/cancelled', async () => {
    const shareFileMock = vi
      .fn<NativeShareFilePlugin['shareFile']>()
      .mockResolvedValue({ completed: false })
    const mockPlugin: NativeShareFilePlugin = {
      shareFile: shareFileMock,
    }

    const result = await shareFileNative(
      'backup.json',
      '{"hello":"world"}',
      mockPlugin,
    )
    expect(result).toBe('canceled')
  })

  it('catches exceptions and returns error safely', async () => {
    const shareFileMock = vi
      .fn<NativeShareFilePlugin['shareFile']>()
      .mockRejectedValue(new Error('Share failed'))
    const mockPlugin: NativeShareFilePlugin = {
      shareFile: shareFileMock,
    }

    const result = await shareFileNative('backup.json', '{}', mockPlugin)
    expect(result).toBe('error')
  })

  it('default web plugin no-ops safely', async () => {
    const result = await NativeShareFile.shareFile({
      filename: 'backup.json',
      content: '{}',
    })
    expect(result.completed).toBe(false)
  })
})
