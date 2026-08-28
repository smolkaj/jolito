import { describe, expect, it } from 'vitest'
import { feedbackRowSchema, feedbackSubmissionSchema } from './feedback'

describe('Feedback domain schemas', () => {
  it('validates feedback submissions and trims messages', () => {
    const valid = feedbackSubmissionSchema.safeParse({
      message: '  The audio replay did not trigger on spacebar.  ',
      context: { route: '#/study', os: 'Linux' },
    })
    expect(valid.success).toBe(true)
    if (valid.success) {
      expect(valid.data.message).toBe(
        'The audio replay did not trigger on spacebar.',
      )
      expect(valid.data.context?.route).toBe('#/study')
    }

    const empty = feedbackSubmissionSchema.safeParse({
      message: '   ',
    })
    expect(empty.success).toBe(false)
  })

  it('validates feedback database row schema', () => {
    const row = feedbackRowSchema.safeParse({
      user_id: 'user-123',
      email: 'student@example.com',
      message: 'Add more examples for "¡Qué padre!"',
      context: { version: '0.1.0' },
    })
    expect(row.success).toBe(true)

    const invalidEmail = feedbackRowSchema.safeParse({
      user_id: 'user-123',
      email: 'not-an-email',
      message: 'Example',
    })
    expect(invalidEmail.success).toBe(false)
  })
})
