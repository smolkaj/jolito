import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createStudyCards, type Grade } from '../domain/card'
import { createGrammarCards } from '../domain/grammar'
import { cachedSpeechAvailableByLocale } from '../infrastructure/browser/speech-recognition'
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
  beforeEach(() => {
    cachedSpeechAvailableByLocale.clear()
  })

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

  it('suppresses mobile suggestions, autocorrect, autocapitalize, and spellcheck on the answer input', () => {
    const initial = props()
    render(<PracticeCard {...initial} revealed={false} />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('autocomplete', 'off')
    expect(input).toHaveAttribute('autocorrect', 'off')
    expect(input).toHaveAttribute('autocapitalize', 'none')
    expect(input).toHaveAttribute('spellcheck', 'false')
    expect(input).toHaveAttribute('lang', 'es-MX')
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

it('keeps a correction rule with the expected answer through pause/resume and removes it on recall or success', () => {
  const initial = props()
  const correctionRule = 'Replace -ar with -é.'
  const app = render(
    <PracticeCard {...initial} correctionRule={correctionRule} />,
  )
  expect(screen.queryByText('Rule:')).not.toBeInTheDocument()
  for (const answer of ['hable', '']) {
    for (const paused of [false, true, false]) {
      app.rerender(
        <PracticeCard
          {...initial}
          answer={answer}
          paused={paused}
          correctionRule={correctionRule}
        />,
      )
      const rule = screen.getByText('Rule:').closest('p')!
      expect(rule).toHaveTextContent('Rule: Replace -ar with -é.')
      expect(rule.closest('.expected-row')).toHaveTextContent('Expected')
      expect(rule.closest('[role="status"]')).toHaveAccessibleName(
        'Answer feedback',
      )
    }
  }
  app.rerender(
    <PracticeCard
      {...initial}
      revealed={false}
      correctionRule={correctionRule}
    />,
  )
  expect(screen.queryByText('Rule:')).not.toBeInTheDocument()
  app.rerender(<PracticeCard {...initial} correctionRule={correctionRule} />)
  expect(screen.queryByText('Rule:')).not.toBeInTheDocument()
})

function AccentPractice({
  paused = false,
  revealed = false,
  accents = true,
  onGrade = vi.fn(),
}) {
  const [answer, setAnswer] = useState('')
  return (
    <PracticeCard
      {...props()}
      answer={answer}
      onAnswerChange={setAnswer}
      paused={paused}
      revealed={revealed}
      accents={accents}
      onGrade={onGrade}
    />
  )
}

describe('accent keyboard insertion', () => {
  it('inserts all accents and shares selection/caret behavior with pointer insertion', async () => {
    const user = userEvent.setup()
    render(<AccentPractice />)
    const input = screen.getByRole<HTMLInputElement>('textbox')
    await user.keyboard('12345')
    expect(input).toHaveValue('áéíóú')
    input.setSelectionRange(1, 2)
    await user.keyboard('2x')
    expect(input).toHaveValue('áéxíóú')
    expect(input.selectionStart).toBe(3)
    input.setSelectionRange(2, 4)
    await user.click(screen.getByRole('button', { name: 'Insert ó' }))
    expect(input).toHaveValue('áéóóú')
    expect(input).toHaveFocus()
    expect(input.selectionStart).toBe(3)
    await user.keyboard('1')
    expect(input).toHaveValue('áéóáóú')
  })

  it('respects modifiers/composition, pause/resume, reveal grading and teardown', async () => {
    const user = userEvent.setup()
    const grade = vi.fn<(value: Grade) => void>()
    const app = render(<AccentPractice onGrade={grade} />)
    const input = screen.getByRole('textbox')
    for (const modifier of [
      'ctrlKey',
      'metaKey',
      'altKey',
      'shiftKey',
      'isComposing',
    ]) {
      expect(fireEvent.keyDown(input, { key: '1', [modifier]: true })).toBe(
        true,
      )
    }
    expect(input).toHaveValue('')
    await user.keyboard('1')
    app.rerender(<AccentPractice paused onGrade={grade} />)
    fireEvent.keyDown(input, { key: '2' })
    expect(input).toHaveValue('á')
    app.rerender(<AccentPractice onGrade={grade} />)
    fireEvent(document, new Event('visibilitychange'))
    await user.keyboard('2')
    expect(fireEvent.keyDown(input, { key: '2', repeat: true })).toBe(false)
    expect(input).toHaveValue('áé')
    expect(grade).not.toHaveBeenCalled()
    app.rerender(<AccentPractice revealed onGrade={grade} />)
    await user.keyboard('1234')
    expect(grade.mock.calls.map(([value]) => value)).toEqual([
      'again',
      'hard',
      'good',
      'easy',
    ])
    app.rerender(<AccentPractice onGrade={grade} />)
    await user.keyboard('3')
    expect(screen.getByRole('textbox')).toHaveValue('áéí')
    app.unmount()
    fireEvent.keyDown(window, { key: '1' })
    expect(grade).toHaveBeenCalledTimes(4)
  })

  it('leaves number typing unchanged without grammar accents and outside the answer field', async () => {
    const user = userEvent.setup()
    const app = render(<AccentPractice accents={false} />)
    await user.keyboard('12345')
    expect(screen.getByRole('textbox')).toHaveValue('12345')
    app.rerender(
      <>
        <AccentPractice />
        <input aria-label="Other field" />
      </>,
    )
    await user.click(screen.getByRole('textbox', { name: 'Other field' }))
    await user.keyboard('12345')
    expect(screen.getByRole('textbox', { name: 'Other field' })).toHaveValue(
      '12345',
    )
    expect(fireEvent.keyDown(window, { key: '1' })).toBe(true)
  })

  it('renders "Report issue" button when error is present and onFeedback is provided', async () => {
    const user = userEvent.setup()
    const onFeedback = vi.fn()
    const initial = props()

    const { rerender } = render(
      <PracticeCard
        {...initial}
        error="Your progress couldn’t be saved."
        onFeedback={onFeedback}
      />,
    )

    const button = screen.getByRole('button', { name: 'Report issue' })
    expect(button).toBeInTheDocument()
    await user.click(button)
    expect(onFeedback).toHaveBeenCalledTimes(1)

    // Omitted onFeedback
    rerender(
      <PracticeCard {...initial} error="Your progress couldn’t be saved." />,
    )
    expect(
      screen.queryByRole('button', { name: 'Report issue' }),
    ).not.toBeInTheDocument()

    // Omitted error
    rerender(<PracticeCard {...initial} error={null} onFeedback={onFeedback} />)
    expect(
      screen.queryByRole('button', { name: 'Report issue' }),
    ).not.toBeInTheDocument()
  })

  it('supports spoken recall, streams transcription to answer, and cleans up on reveal', async () => {
    const user = userEvent.setup()
    const initial = props()
    const callbacks: {
      transcript: ((text: string, isFinal: boolean) => void) | null
    } = {
      transcript: null,
    }

    const mockRecognizer = {
      isSupported: vi.fn().mockResolvedValue(true),
      start: vi
        .fn()
        .mockImplementation(
          (opts: {
            locale: string
            onTranscript: (t: string, isFinal: boolean) => void
          }) => {
            callbacks.transcript = opts.onTranscript
            return Promise.resolve(true)
          },
        ),
      stop: vi.fn().mockResolvedValue(undefined),
    }

    const onStopAudio = vi.fn()
    const { rerender } = render(
      <PracticeCard
        {...initial}
        revealed={false}
        speechRecognizer={mockRecognizer}
        onStopAudio={onStopAudio}
      />,
    )

    // Wait for support check
    const micBtn = await screen.findByRole('button', {
      name: 'Start voice input',
    })
    expect(micBtn).toBeInTheDocument()

    // Tap mic button to start listening
    await user.click(micBtn)
    expect(onStopAudio).toHaveBeenCalledTimes(1)
    expect(mockRecognizer.start).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'es-MX' }),
    )
    expect(
      screen.getByRole('button', { name: 'Stop voice input' }),
    ).toHaveClass('is-listening')

    // Stream spoken transcript with speech-engine inserted trailing period
    callbacks.transcript?.('hablamos.', false)
    expect(initial.onAnswerChange).toHaveBeenCalledWith('hablamos')

    // Revealing the answer automatically stops speech recognition
    rerender(
      <PracticeCard
        {...initial}
        revealed={true}
        speechRecognizer={mockRecognizer}
        onStopAudio={onStopAudio}
      />,
    )
    expect(mockRecognizer.stop).toHaveBeenCalled()
  })

  it('stops active listening when user types into the answer input', async () => {
    const user = userEvent.setup()
    const initial = props()
    const mockRecognizer = {
      isSupported: vi.fn().mockResolvedValue(true),
      start: vi.fn().mockResolvedValue(true),
      stop: vi.fn().mockResolvedValue(undefined),
    }

    render(
      <PracticeCard
        {...initial}
        revealed={false}
        speechRecognizer={mockRecognizer}
      />,
    )

    const micBtn = await screen.findByRole('button', {
      name: 'Start voice input',
    })
    await user.click(micBtn)
    expect(
      screen.getByRole('button', { name: 'Stop voice input' }),
    ).toHaveClass('is-listening')

    // Typing into the input field immediately stops speech recognition
    const answerInput = screen.getByPlaceholderText('Type your answer…')
    await user.type(answerInput, 'a')
    expect(mockRecognizer.stop).toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Start voice input' }),
    ).not.toHaveClass('is-listening')
  })

  it('displays visible feedback when voice input fails and clears it on input', async () => {
    const user = userEvent.setup()
    const initial = props()
    const mockRecognizer = {
      isSupported: vi.fn().mockResolvedValue(true),
      start: vi.fn().mockResolvedValue(false),
      stop: vi.fn().mockResolvedValue(undefined),
    }

    render(
      <PracticeCard
        {...initial}
        revealed={false}
        speechRecognizer={mockRecognizer}
      />,
    )

    const micBtn = await screen.findByRole('button', {
      name: 'Start voice input',
    })
    await user.click(micBtn)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'Voice input unavailable or permission denied',
    )
    expect(alert).toBeVisible()

    // Typing clears the error notice
    const answerInput = screen.getByPlaceholderText('Type your answer…')
    await user.type(answerInput, 'h')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Voice input unavailable or permission denied'),
    ).not.toBeInTheDocument()
  })
})
