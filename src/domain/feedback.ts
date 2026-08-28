import { z } from 'zod'

export const feedbackSubmissionSchema = z.object({
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
  message: z.string().min(1),
  context: z.record(z.string(), z.unknown()).default({}),
})

export type FeedbackRow = z.infer<typeof feedbackRowSchema>
