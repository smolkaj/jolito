import { describe, expect, it, vi } from 'vitest'
import { downloadJsonFile } from './download'

describe('downloadJsonFile', () => {
  it('creates blob url, triggers download click, and revokes url', () => {
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

    downloadJsonFile('test-deck.json', '{"version":1}')

    expect(createObjectURLMock).toHaveBeenCalled()
    expect(clickMock).toHaveBeenCalled()
    expect(appendChildSpy).toHaveBeenCalled()
    expect(removeChildSpy).toHaveBeenCalled()
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url')

    vi.restoreAllMocks()
  })

  it('no-ops safely when document is undefined', () => {
    const originalDocument = globalThis.document
    // @ts-expect-error test SSR/undefined environment
    delete globalThis.document

    expect(() => downloadJsonFile('file.json', '{}')).not.toThrow()

    globalThis.document = originalDocument
  })
})
