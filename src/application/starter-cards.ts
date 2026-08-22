import { createStudyCards, type StudyCard } from '../domain/card'

export const starterCards: StudyCard[] = [
  ...createStudyCards(
    {
      spanish: 'Tal vez',
      english: 'Maybe',
      context: 'Everyday expression for uncertainty or possibility.',
      bidirectional: true,
    },
    'starter-tal-vez',
    0,
  ),
  ...createStudyCards(
    {
      spanish: 'Qué padre',
      english: 'How cool',
      context: 'Quintessential Mexican Spanish slang for something great.',
      bidirectional: true,
    },
    'starter-que-padre',
    0,
  ),
]
