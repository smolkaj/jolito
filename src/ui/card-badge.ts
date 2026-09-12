import { isDue, type StudyCard } from '../domain/card'

export interface CardScheduleBadge {
  label: string
  type: 'due' | 'new' | 'learning' | 'review'
}

export function getCardScheduleBadge(
  card: StudyCard,
  now: number,
): CardScheduleBadge {
  if (isDue(card, now)) {
    return { label: 'Due now', type: 'due' }
  }
  const state = card.schedule.state
  if (state === 'new') {
    return { label: 'Unstudied', type: 'new' }
  }
  if (state === 'learning' || state === 'relearning') {
    return { label: 'Learning', type: 'learning' }
  }
  const msUntilDue = card.schedule.dueAt - now
  const daysUntilDue = Math.max(
    1,
    Math.round(msUntilDue / (24 * 60 * 60 * 1000)),
  )
  return { label: `Due in ${daysUntilDue}d`, type: 'review' }
}
