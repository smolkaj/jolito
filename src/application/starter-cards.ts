import type { PrefetchItem } from './ports'
import { createStudyCards, type StudyCard } from '../domain/card'

export const starterHeroSampleCards = {
  spanish: {
    text: 'aguacate',
    locale: 'es-MX',
    cardSeed: 'sample-aguacate',
  },
  english: {
    text: 'avocado',
    locale: 'en-US',
    cardSeed: 'sample-aguacate',
  },
} as const

export const starterHeroPrefetchItems: PrefetchItem[] = [
  starterHeroSampleCards.spanish,
  starterHeroSampleCards.english,
]

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

export function isStarterCard(card: StudyCard): boolean {
  return card.noteId.startsWith('starter-')
}

export function filterOutStarterCards(cards: StudyCard[]): StudyCard[] {
  return cards.filter((card) => !isStarterCard(card))
}
