export interface SendEmailBinding {
  send: (message: {
    from: string
    to: string
    subject: string
    text: string
    html?: string
    replyTo?: string
  }) => Promise<unknown>
}
