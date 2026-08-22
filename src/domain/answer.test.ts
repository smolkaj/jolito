import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { compareAnswer } from './answer'

describe('compareAnswer', () => {
  it('matches answers despite differences in case and punctuation', () => {
    expect(
      compareAnswer('could YOU make it to go', 'Could you make it to go?'),
    ).toEqual({
      expected: [
        { value: 'Could', status: 'match' },
        { value: 'you', status: 'match' },
        { value: 'make', status: 'match' },
        { value: 'it', status: 'match' },
        { value: 'to', status: 'match' },
        { value: 'go?', status: 'match' },
      ],
      extra: [],
    })
  })

  it('shows omitted and extra words without requiring a brittle grade', () => {
    expect(
      compareAnswer('Could make this to go', 'Could you make it to go?'),
    ).toEqual({
      expected: [
        { value: 'Could', status: 'match' },
        { value: 'you', status: 'missing' },
        { value: 'make', status: 'match' },
        { value: 'it', status: 'missing' },
        { value: 'to', status: 'match' },
        { value: 'go?', status: 'match' },
      ],
      extra: ['this'],
    })
  })

  it('handles answers with only extras or only omissions', () => {
    expect(compareAnswer('extra words', '')).toEqual({
      expected: [],
      extra: ['extra', 'words'],
    })
    expect(compareAnswer('', 'expected words')).toEqual({
      expected: [
        { value: 'expected', status: 'missing' },
        { value: 'words', status: 'missing' },
      ],
      extra: [],
    })
  })

  it('always marks an identical sequence as a complete match', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc
            .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), {
              minLength: 1,
              maxLength: 12,
            })
            .map((characters) => characters.join('')),
          {
            minLength: 1,
            maxLength: 12,
          },
        ),
        (words) => {
          const comparison = compareAnswer(words.join(' '), words.join(' '))
          expect(comparison.extra).toEqual([])
          expect(
            comparison.expected.every((token) => token.status === 'match'),
          ).toBe(true)
        },
      ),
    )
  })
})
