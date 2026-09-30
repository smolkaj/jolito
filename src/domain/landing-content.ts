export type StorySegment =
  | { type: 'text'; text: string }
  | { type: 'em'; text: string }
  | { type: 'strong'; text: string }
  | { type: 'link'; text: string; href: string }

export interface StoryParagraph {
  segments: StorySegment[]
}

export const LANDING_HERO_CONTENT = {
  headlineLead: 'Make the words',
  headlineMiddle: 'you meet',
  headlineEmp: 'stick.',
  ledeLead: 'Create beautiful, spoken flashcards.',
  ledeRest: 'Practice them at your rhythm.',
} as const

export const ORIGIN_STORY = {
  eyebrow: 'BORN IN MEXICO CITY',
  title: 'Why another flashcard app?',
  links: {
    ihMexico: 'https://ihmexico.mx/',
    spacedRepetition: 'https://en.wikipedia.org/wiki/Spaced_repetition',
  },
  resolution: {
    prefix: 'I am glad to report:',
    punchline: 'Memorization and I have become friends!',
  },
} as const

export const ORIGIN_STORY_PARAGRAPHS: StoryParagraph[] = [
  {
    segments: [
      { type: 'text', text: 'In July 2026, my wife ' },
      { type: 'em', text: '(Mexican)' },
      { type: 'text', text: ', our twins ' },
      { type: 'em', text: '(Gexican)' },
      { type: 'text', text: ', and I ' },
      { type: 'em', text: '(German)' },
      {
        type: 'text',
        text: ' moved to Mexico City. I started learning Spanish at the ',
      },
      {
        type: 'link',
        text: 'International House in Condesa',
        href: ORIGIN_STORY.links.ihMexico,
      },
      {
        type: 'text',
        text: '. The classes were fantastic—but memorizing vocabulary? ',
      },
      { type: 'strong', text: 'My archenemy.' },
      {
        type: 'text',
        text: ' The absolute worst part of learning a new language!',
      },
    ],
  },
  {
    segments: [
      {
        type: 'text',
        text: 'I built Jolito to make memorization something to look forward to: ',
      },
      { type: 'strong', text: 'fast, tactile, immersive' },
      { type: 'text', text: '. Jolito uses ' },
      {
        type: 'link',
        text: 'spaced repetition',
        href: ORIGIN_STORY.links.spacedRepetition,
      },
      { type: 'text', text: ' to game your memory—' },
      { type: 'strong', text: 'legally!' },
      {
        type: 'text',
        text: ' It resurfaces words just before you forget them, so they stick almost effortlessly.',
      },
    ],
  },
]

export function storyParagraphToPlainText(paragraph: StoryParagraph): string {
  return paragraph.segments.map((s) => s.text).join('')
}
