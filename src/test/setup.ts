import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)

if (
  typeof window !== 'undefined' &&
  !window.HTMLElement.prototype.scrollIntoView
) {
  window.HTMLElement.prototype.scrollIntoView = () => {}
}

if (typeof window !== 'undefined' && !window.HTMLElement.prototype.scrollTo) {
  window.HTMLElement.prototype.scrollTo = () => {}
}
