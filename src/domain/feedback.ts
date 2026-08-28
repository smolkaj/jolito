import { z } from 'zod'

export const feedbackCategorySchema = z.enum([
  'suggestion',
  'bug',
  'spanish',
  'other',
])

export type FeedbackCategory = z.infer<typeof feedbackCategorySchema>

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  suggestion: '💡 Idea / Suggestion',
  bug: '🐛 Bug report',
  spanish: '🇲🇽 Spanish nuance',
  other: '💬 Other',
}

export const FEEDBACK_CATEGORY_PLACEHOLDERS: Record<FeedbackCategory, string> = {
  suggestion: 'What would make Jolito better for your Spanish practice?',
  bug: 'What happened, and what did you expect to happen instead?',
  spanish:
    'Which phrase, translation, audio, or Mexican Spanish nuance needs attention?',
  other: 'What’s on your mind?',
}

export const feedbackSubmissionSchema = z.object({
  category: feedbackCategorySchema,
  message: z
    .string()
    .trim()
    .min(1, 'Please enter a message before sending feedback.')
    .max(5000, 'Feedback message is too long (maximum 5000 characters).'),
  context: z.record(z.string(), z.unknown()).optional(),
})

export type FeedbackSubmission = z.infer<typeof feedbackSubmissionSchema>

export const feedbackRowSchema = z.object({
  user_id: z.string().min(1, 'User ID is required.'),
  email: z.string().email('Valid email is required.'),
  category: feedbackCategorySchema,
  message: z.string().min(1),
  context: z.record(z.string(), z.unknown()).default({}),
})

export type FeedbackRow = z.infer<typeof feedbackRowSchema>
