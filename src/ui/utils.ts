import type { FocusEvent } from 'react'

export function handleFocusSelect(
  event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
) {
  event.currentTarget.select()
}
