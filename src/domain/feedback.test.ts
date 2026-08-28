import { describe, expect, it } from 'vitest'
import {
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_CATEGORY_PLACEHOLDERS,
  feedbackCategorySchema,
  feedbackRowSchema,
  feedbackSubmissionSchema,
} from './feedback'

describe('Feedback domain schemas', () => {
  it('validates valid feedback categories', () => {
    expect(feedbackCategorySchema.parse('suggestion')).toBe('suggestion')
    expect(feedbackCategorySchema.parse('bug')).toBe('bug')
    expect(feedbackCategorySchema.parse('spanish')).toBe('spanish')
    expect(feedbackCategorySchema.parse('other')).toBe('other')

    expect(() => feedbackCategorySchema.parse('invalid')).toThrow()
  })

  it('has label and placeholder for each category', () => {
    const categories = ['suggestion', 'bug', 'spanish', 'other'] as const
    for (const cat of categories) {
      expect(FEEDBACK_CATEGORY_LABELS[cat]).toBeTruthy()
      expect(FEEDBACK_CATEGORY_PLACEHOLDERS[cat]).toBeTruthy()
    }
  })

  it('validates feedback submissions and trims messages', () => {
    const valid = feedbackSubmissionSchema.safeParse({
      category: 'bug',
      message: '  The audio replay did not trigger on spacebar.  ',
      context: { route: '#/study', os: 'Linux' },
    })
    expect(valid.success).toBe(true)
    if (valid.success) {
      expect(valid.data.category).toBe('bug')
      expect(valid.data.message).toBe(
        'The audio replay did not trigger on spacebar.',
      )
      expect(valid.data.context?.route).toBe('#/study')
    }

    const empty = feedbackSubmissionSchema.safeParse({
      category: 'suggestion',
      message: '   ',
    })
    expect(empty.success).toBe(false)
  })

  it('validates feedback database row schema', () => {
    const row = feedbackRowSchema.safeParse({
      user_id: 'user-123',
      email: 'student@example.com',
      category: 'spanish',
      message: 'Add more examples for "¡Qué padre!"',
      context: { version: '0.1.0' },
    })
    expect(row.success).toBe(true)

    const invalidEmail = feedbackRowSchema.safeParse({
      user_id: 'user-123',
      email: 'not-an-email',
      category: 'spanish',
      message: 'Example',
    })
    expect(invalidEmail.success).toBe(false)
  })
})
