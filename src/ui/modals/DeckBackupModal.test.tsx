import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DeckBackupModal } from './DeckBackupModal'
import * as downloadModule from '../../infrastructure/browser/download'
import { createStudyCards } from '../../domain/card'

describe('DeckBackupModal', () => {
  const dummyCards = createStudyCards(
    { spanish: 'hola', english: 'hello', context: '', bidirectional: false },
    'personal',
    1,
  )

  it('renders correctly and handles successful export', async () => {
    vi.useFakeTimers()
    const downloadSpy = vi
      .spyOn(downloadModule, 'downloadJsonFile')
      .mockResolvedValue('completed')

    render(
      <DeckBackupModal
        isOpen={true}
        onClose={vi.fn()}
        cards={dummyCards}
        deletedCardIds={[]}
        onUpdateCards={vi.fn()}
        clock={{ now: () => 1000 }}
      />,
    )

    const exportBtn = screen.getByRole('button', {
      name: /export backup \(json\)/i,
    })
    await act(async () => {
      fireEvent.click(exportBtn)
      await Promise.resolve()
    })

    expect(downloadSpy).toHaveBeenCalled()
    expect(screen.getByText('Exported backup')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2600)
    })
    expect(screen.queryByText('Exported backup')).not.toBeInTheDocument()

    vi.useRealTimers()
    downloadSpy.mockRestore()
  })

  it('does not display error banner when user cancels the export', async () => {
    const downloadSpy = vi
      .spyOn(downloadModule, 'downloadJsonFile')
      .mockResolvedValue('canceled')

    render(
      <DeckBackupModal
        isOpen={true}
        onClose={vi.fn()}
        cards={dummyCards}
        deletedCardIds={[]}
        onUpdateCards={vi.fn()}
        clock={{ now: () => 1000 }}
      />,
    )

    const exportBtn = screen.getByRole('button', {
      name: /export backup \(json\)/i,
    })
    await act(async () => {
      fireEvent.click(exportBtn)
      await Promise.resolve()
    })

    expect(downloadSpy).toHaveBeenCalled()
    expect(screen.queryByText('Exported backup')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    downloadSpy.mockRestore()
  })

  it('displays error alert on export failure and clears it on successful export', async () => {
    const downloadSpy = vi
      .spyOn(downloadModule, 'downloadJsonFile')
      .mockResolvedValueOnce('error')

    render(
      <DeckBackupModal
        isOpen={true}
        onClose={vi.fn()}
        cards={dummyCards}
        deletedCardIds={[]}
        onUpdateCards={vi.fn()}
        clock={{ now: () => 1000 }}
      />,
    )

    const exportBtn = screen.getByRole('button', {
      name: /export backup \(json\)/i,
    })
    await act(async () => {
      fireEvent.click(exportBtn)
      await Promise.resolve()
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unable to export deck backup. Please try again.',
    )

    downloadSpy.mockResolvedValueOnce('completed')
    await act(async () => {
      fireEvent.click(exportBtn)
      await Promise.resolve()
    })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('Exported backup')).toBeInTheDocument()

    downloadSpy.mockRestore()
  })
})
