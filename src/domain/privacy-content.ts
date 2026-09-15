export type PrivacySegment =
  | { type: 'text'; text: string }
  | { type: 'strong'; text: string }
  | { type: 'link'; text: string; href: string; external?: boolean }

export interface PrivacySection {
  number: number
  title: string
  paragraphs: PrivacySegment[][]
}

export const PRIVACY_POLICY_METADATA = {
  title: 'Privacy Policy • Jolito',
  description:
    'Jolito Privacy Policy: Local-first by design, no ads, and full user data control.',
  effectiveDate: 'September 7, 2026',
  canonicalUrl: 'https://joli.to/privacy',
} as const

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    number: 1,
    title: 'The Demo vs. Your Account',
    paragraphs: [
      [
        {
          type: 'text',
          text: 'You can try the starter demo deck without an account. To create cards, import decks, and save progress, you sign in with your email. Once signed in, Jolito works offline on your device and syncs changes to the cloud when connected.',
        },
      ],
    ],
  },
  {
    number: 2,
    title: 'What We Collect',
    paragraphs: [
      [
        { type: 'strong', text: 'Email:' },
        {
          type: 'text',
          text: ' Used for passwordless sign-in and to notify Jolito’s maintainer when you join. Never sold or used for marketing.',
        },
      ],
      [
        { type: 'strong', text: 'Your Decks & Progress:' },
        {
          type: 'text',
          text: ' Synced to your private cloud database so your cards and reviews are backed up across devices.',
        },
      ],
      [
        { type: 'strong', text: 'Optional Feedback:' },
        {
          type: 'text',
          text: ' If you send in-app feedback, we receive your message and email to follow up.',
        },
      ],
    ],
  },
  {
    number: 3,
    title: 'Data Export & Account Deletion',
    paragraphs: [
      [
        {
          type: 'text',
          text: 'You can export your complete deck to a JSON file anytime under ',
        },
        { type: 'strong', text: 'Manage deck → Backup & export' },
        { type: 'text', text: '.' },
      ],
      [
        {
          type: 'text',
          text: 'To permanently delete your cloud data, tap ',
        },
        {
          type: 'strong',
          text: 'Cloud sync → Delete cloud account & data',
        },
        {
          type: 'text',
          text: ' in the app. We immediately and permanently delete your user record, cloud decks, feedback, and signup notification records from our servers. Emails already delivered to the maintainer’s inbox are not removed automatically.',
        },
      ],
    ],
  },
  {
    number: 4,
    title: 'Open Source & Contact',
    paragraphs: [
      [
        { type: 'text', text: 'Jolito is ' },
        {
          type: 'link',
          text: 'open-source',
          href: 'https://github.com/smolkaj/jolito',
          external: true,
        },
        { type: 'text', text: ' (Apache-2.0), created by ' },
        {
          type: 'link',
          text: 'Steffen Smolka',
          href: 'https://smolka.st',
          external: true,
        },
        { type: 'text', text: '. You can reach me at ' },
        {
          type: 'link',
          text: 'a@joli.to',
          href: 'mailto:a@joli.to',
          external: false,
        },
        { type: 'text', text: '.' },
      ],
      [
        { type: 'text', text: 'See our ' },
        {
          type: 'link',
          text: 'acknowledgements',
          href: '/acknowledgements',
          external: true,
        },
        {
          type: 'text',
          text: ' for the open-source projects and creators that power Jolito.',
        },
      ],
    ],
  },
]
