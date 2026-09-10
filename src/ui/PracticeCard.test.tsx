import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createStudyCards } from '../domain/card'
import { createGrammarCards } from '../domain/grammar'
import { PracticeCard } from './PracticeCard'

function props() {
  return {
    card: createGrammarCards(0)[0]!,
    prompt: <h1>Recall a form</h1>,
    answer: 'hablé',
    revealed: true,
    paused: false,
    audioUnavailable: false,
    onAnswerChange: vi.fn(),
    onReveal: vi.fn(),
    onGrade: vi.fn(),
    onPlayAnswer: vi.fn(),
    onEdit: vi.fn(),
  }
}

describe('shared practice interaction lifecycle', () => {
  it('pauses shortcuts, resumes with current actions, and stays inert after teardown', () => {
    const initial = props()
    const app = render(<PracticeCard {...initial} />)
    const feedback = screen.getByRole('status', { name: 'Answer feedback' })
    expect(feedback).toHaveFocus()
    fireEvent.keyDown(feedback, { key: '3' })
    fireEvent.keyDown(feedback, { key: ' ', code: 'Space' })
    expect(initial.onGrade).toHaveBeenCalledWith('good')
    expect(initial.onPlayAnswer).toHaveBeenCalledTimes(1)
    app.rerender(<PracticeCard {...initial} paused />)
    fireEvent.keyDown(feedback, { key: '4' })
    fireEvent.keyDown(feedback, { key: ' ', code: 'Space' })
    expect(initial.onGrade).toHaveBeenCalledTimes(1)
    expect(initial.onPlayAnswer).toHaveBeenCalledTimes(1)
    const nextGrade = vi.fn()
    app.rerender(<PracticeCard {...initial} onGrade={nextGrade} />)
    fireEvent.keyDown(feedback, { key: '4', repeat: true })
    fireEvent.keyDown(feedback, { key: '4', altKey: true })
    fireEvent.keyDown(feedback, { key: '4', isComposing: true })
    fireEvent.keyDown(feedback, { key: '4', ctrlKey: true })
    expect(nextGrade).not.toHaveBeenCalled()
    fireEvent.keyDown(feedback, { key: '4' })
    expect(nextGrade).toHaveBeenCalledWith('easy')
    app.unmount()
    fireEvent.keyDown(window, { key: '4' })
    fireEvent.keyDown(window, { key: ' ', code: 'Space' })
    fireEvent(window, new Event('focus'))
    fireEvent(document, new Event('visibilitychange'))
    expect(nextGrade).toHaveBeenCalledTimes(1)
    expect(initial.onPlayAnswer).toHaveBeenCalledTimes(1)
  })

  it('preserves typing and native button activation while supporting explicit replay and edit', async () => {
    const initial = props()
    const promptAudio = vi.fn()
    const user = userEvent.setup()
    const app = render(
      <PracticeCard {...initial} revealed={false} onPlayPrompt={promptAudio} />,
    )
    const input = screen.getByRole('textbox')
    expect(input).toHaveFocus()
    await user.keyboard('1e ')
    expect(initial.onGrade).not.toHaveBeenCalled()
    expect(initial.onEdit).not.toHaveBeenCalled()
    expect(promptAudio).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: ' ', code: 'Space', ctrlKey: true })
    fireEvent.keyDown(input, { key: 'E', metaKey: true })
    expect(promptAudio).toHaveBeenCalledTimes(1)
    expect(initial.onEdit).toHaveBeenCalledTimes(1)
    await user.keyboard('{Enter}')
    expect(initial.onReveal).toHaveBeenCalledTimes(1)
    app.rerender(
      <PracticeCard {...initial}>
        <input aria-label="Reference notes" />
      </PracticeCard>,
    )
    await user.click(screen.getByRole('textbox', { name: 'Reference notes' }))
    await user.keyboard('1e ')
    expect(initial.onGrade).not.toHaveBeenCalled()
    expect(initial.onPlayAnswer).not.toHaveBeenCalled()
    const easy = screen.getByRole('button', { name: /Easy/ })
    easy.focus()
    await user.keyboard(' ')
    expect(initial.onGrade).toHaveBeenCalledWith('easy')
    expect(initial.onPlayAnswer).not.toHaveBeenCalled()
  })
})

const vocabulary = createStudyCards(
  { spanish: 'árbol', english: 'tree', context: '', bidirectional: true },
  'language-contract',
  0,
)

it.each([
  { mode: 'grammar', card: createGrammarCards(0)[0]!, language: 'es-MX' },
  { mode: 'Spanish vocabulary', card: vocabulary[1]!, language: 'es-MX' },
  { mode: 'English vocabulary', card: vocabulary[0]!, language: 'en-US' },
])(
  'preserves $mode content language through every feedback state',
  ({ card, language }) => {
    const initial = { ...props(), card }
    const view = (answer: string, revealed: boolean, paused = false) => (
      <div lang="en">
        <PracticeCard
          {...initial}
          answer={answer}
          revealed={revealed}
          paused={paused}
        />
      </div>
    )
    const app = render(view('', false))
    for (const answer of [card.answer, `${card.answer}x`, '']) {
      app.rerender(view(answer, false))
      expect(screen.getByRole('textbox')).toHaveAttribute('lang', language)
      for (const paused of [false, true, false]) {
        app.rerender(view(answer, true, paused))
        const text = app.container.querySelectorAll('.diff-text')
        expect(text).toHaveLength(answer && answer !== card.answer ? 2 : 1)
        for (const element of text) {
          expect(element.closest('[lang]')).toHaveAttribute('lang', language)
        }
        for (const label of app.container.querySelectorAll('.diff-label')) {
          expect(label.closest('[lang]')).toHaveAttribute('lang', 'en')
        }
        expect(
          screen
            .getByRole('button', { name: 'Play answer audio' })
            .closest('[lang]'),
        ).toHaveAttribute('lang', 'en')
      }
    }
  },
)
