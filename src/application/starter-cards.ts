import { createStudyCards, type StudyCard } from '../domain/card'

export const starterCards: StudyCard[] = [
  ...createStudyCards(
    {
      spanish: '¿Me lo puede poner para llevar?',
      english: 'Could you make it to go?',
      context:
        'A polite, natural way to ask for food or drinks to go in Mexico.',
      bidirectional: true,
    },
    'starter-takeaway',
    0,
  ),
  ...createStudyCards(
    {
      spanish: '¿Dónde está la estación de metro más cercana?',
      english: 'Where is the nearest metro station?',
      context: '“Más cercana” means “nearest” when the noun is feminine.',
      bidirectional: true,
    },
    'starter-metro',
    0,
  ),
]
