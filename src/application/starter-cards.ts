import { createStudyCards, type StudyCard } from '../domain/card'

export const starterCards: StudyCard[] = [
  ...createStudyCards(
    {
      spanish: 'aguacate',
      english: 'avocado',
      context:
        'Essential ingredient across Mexican cuisine, from guacamole to tacos.',
      bidirectional: true,
    },
    'starter-aguacate',
    0,
  ),
  ...createStudyCards(
    {
      spanish: 'qué padre',
      english: 'how cool',
      context: 'Quintessential Mexican Spanish slang for something great.',
      bidirectional: true,
    },
    'starter-que-padre',
    0,
  ),
]
