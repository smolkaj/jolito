export type PrivacySegment =
  | { type: 'text'; text: string }
  | { type: 'strong'; text: string }
  | { type: 'link'; text: string; href: string; newTab?: boolean }

export interface PrivacySection {
  number: number
  title: string
  paragraphs: PrivacySegment[][]
}

export const PRIVACY_POLICY_METADATA = {
  title: 'Privacy Policy • Jolito',
  description:
    'Jolito Privacy Policy: Local-first by design, service disclosures, and full user data control.',
  effectiveDate: 'September 19, 2026',
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
          text: 'You can try the starter demo deck without an account; your cards and study progress remain stored on your device in your browser. To create cards, import decks, and save progress across devices, you sign in with your email. Once signed in, Jolito works offline on your device and syncs changes to the cloud when connected.',
        },
      ],
    ],
  },
  {
    number: 2,
    title: 'What We Collect & Store',
    paragraphs: [
      [
        { type: 'strong', text: 'Email:' },
        {
          type: 'text',
          text: ' Used for passwordless sign-in and to notify Jolito’s maintainer when new accounts join.',
        },
      ],
      [
        { type: 'strong', text: 'Your Decks & Progress:' },
        {
          type: 'text',
          text: ' Stored on your device (IndexedDB) and synced to your cloud database so your cards and reviews are backed up across devices.',
        },
      ],
      [
        { type: 'strong', text: 'Optional Feedback:' },
        {
          type: 'text',
          text: ' If you send in-app feedback, we receive your message and email address to follow up.',
        },
      ],
    ],
  },
  {
    number: 3,
    title: 'Third-Party Services & AI Processing',
    paragraphs: [
      [
        {
          type: 'text',
          text: 'To provide audio pronunciations, AI card assistance, and cloud sync, Jolito uses the following service providers:',
        },
      ],
      [
        { type: 'strong', text: 'Microsoft Speech Services:' },
        {
          type: 'text',
          text: ' When you play card audio or prefetch pronunciations, card text is sent to Microsoft’s text-to-speech service to generate audio.',
        },
      ],
      [
        { type: 'strong', text: 'Cloudflare (Workers AI & Hosting):' },
        {
          type: 'text',
          text: ' When you request AI suggestions (such as example sentences or mnemonics) in the card creator, your card text is processed using Meta Llama models on Cloudflare Workers AI. Cloudflare also hosts Jolito’s web application, caches synthesized audio, and routes API requests.',
        },
      ],
      [
        { type: 'strong', text: 'Supabase:' },
        {
          type: 'text',
          text: ' Provides authentication and cloud database hosting (on AWS infrastructure) for syncing user accounts, decks, and study logs.',
        },
      ],
      [
        { type: 'strong', text: 'Resend:' },
        {
          type: 'text',
          text: ' Delivers in-app feedback messages and administrative notification emails.',
        },
      ],
    ],
  },
  {
    number: 4,
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
    number: 5,
    title: 'Open Source & Contact',
    paragraphs: [
      [
        { type: 'text', text: 'Jolito is ' },
        {
          type: 'link',
          text: 'open-source',
          href: 'https://github.com/smolkaj/jolito',
          newTab: true,
        },
        { type: 'text', text: ' (Apache-2.0), created by ' },
        {
          type: 'link',
          text: 'Steffen Smolka',
          href: 'https://smolka.st',
          newTab: true,
        },
        { type: 'text', text: '. You can reach me at ' },
        {
          type: 'link',
          text: 'a@joli.to',
          href: 'mailto:a@joli.to',
          newTab: false,
        },
        { type: 'text', text: '.' },
      ],
      [
        { type: 'text', text: 'See our ' },
        {
          type: 'link',
          text: 'acknowledgements',
          href: '/acknowledgements',
          newTab: true,
        },
        {
          type: 'text',
          text: ' for the open-source projects and creators that power Jolito.',
        },
      ],
    ],
  },
]
