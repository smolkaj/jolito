import type { Card } from '../domain/card'

export const starterCards: readonly Card[] = [
  {
    id: 'starter-es-en',
    prompt: '¿Me lo puede poner para llevar?',
    answer: 'Could you make it to go?',
    direction: 'es-en',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'starter-en-es',
    prompt: 'Could you make this to go?',
    answer: '¿Me lo puede poner para llevar?',
    direction: 'en-es',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
] as const
