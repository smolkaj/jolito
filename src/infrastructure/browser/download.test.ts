import { describe, expect, it, vi } from 'vitest'
import { downloadJsonFile } from './download'
import * as shareFileModule from './share-file'

describe('downloadJsonFile', () => {
  it('delegates to native sharing when isNative is true', async () => {
    const shareSpy = vi
      .spyOn(shareFileModule, 'shareFileNative')
      .mockResolvedValue('completed')

    const res = await downloadJsonFile('test-deck.json', '{"version":1}', true)

    expect(shareSpy).toHaveBeenCalledWith('test-deck.json', '{"version":1}')
    expect(res).toBe('completed')
    shareSpy.mockRestore()
  })

  it('creates blob url, triggers download click, and revokes url on web', async () => {
    const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url')
    const revokeObjectURLMock = vi.fn()
    window.URL.createObjectURL = createObjectURLMock
    window.URL.revokeObjectURL = revokeObjectURLMock

    const clickMock = vi.fn()
    const appendChildSpy = vi.spyOn(document.body, 'appendChild')
    const removeChildSpy = vi.spyOn(document.body, 'removeChild')

    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(
      (tagName: string) => {
        const el = originalCreateElement(tagName)
        if (tagName === 'a') {
          el.click = clickMock
        }
        return el
      },
    )

    const res = await downloadJsonFile('test-deck.json', '{"version":1}', false)

    expect(createObjectURLMock).toHaveBeenCalled()
    expect(clickMock).toHaveBeenCalled()
    expect(appendChildSpy).toHaveBeenCalled()
    expect(removeChildSpy).toHaveBeenCalled()
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url')
    expect(res).toBe('completed')

    vi.restoreAllMocks()
  })

  it('no-ops safely when document is undefined', async () => {
    const originalDocument = globalThis.document
    // @ts-expect-error test SSR/undefined environment
    delete globalThis.document

    const res = await downloadJsonFile('file.json', '{}', false)
    expect(res).toBe('error')

    globalThis.document = originalDocument
  })
})
