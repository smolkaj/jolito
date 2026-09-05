export const NEURAL_VOICES = {
  'es-MX': {
    female: 'es-MX-DaliaNeural',
    male: 'es-MX-JorgeNeural',
  },
  'en-US': {
    female: 'en-US-JennyNeural',
    male: 'en-US-GuyNeural',
  },
} as const

export type SupportedLocale = keyof typeof NEURAL_VOICES

export const VALID_VOICES = new Set<string>([
  NEURAL_VOICES['es-MX'].female,
  NEURAL_VOICES['es-MX'].male,
  NEURAL_VOICES['en-US'].female,
  NEURAL_VOICES['en-US'].male,
])

export function isValidVoice(voice: string): boolean {
  return VALID_VOICES.has(voice)
}

export function normalizeLocale(locale: string): SupportedLocale {
  const clean = locale.trim().toLowerCase().replace(/_/g, '-')
  if (clean.startsWith('en')) {
    return 'en-US'
  }
  return 'es-MX'
}

/**
 * Fast, deterministic string hash (djb2 variant) that produces positive integers.
 */
export function hashString(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
  }
  return Math.abs(hash)
}

/**
 * Deterministically selects a male or female voice for the given text and locale.
 * When a seed (such as a card ID) is provided, it uses the seed so both the prompt
 * and answer of that card speak with the exact same persona (female or male).
 * When no seed is provided, it falls back to hashing the text.
 */
export function getDeterministicVoice(
  text: string,
  locale = 'es-MX',
  seed?: string,
): string {
  const normLocale = normalizeLocale(locale)
  const voices = NEURAL_VOICES[normLocale]
  const key =
    seed && seed.trim().length > 0 ? seed.trim() : text.trim().toLowerCase()
  const isFemale = hashString(key) % 2 === 0
  return isFemale ? voices.female : voices.male
}

/**
 * Returns the counter-voice (opposite gender) for a given neural voice.
 */
export function getAlternateVoice(voice: string): string {
  if (voice === NEURAL_VOICES['es-MX'].female) return NEURAL_VOICES['es-MX'].male
  if (voice === NEURAL_VOICES['es-MX'].male) return NEURAL_VOICES['es-MX'].female
  if (voice === NEURAL_VOICES['en-US'].female) return NEURAL_VOICES['en-US'].male
  if (voice === NEURAL_VOICES['en-US'].male) return NEURAL_VOICES['en-US'].female
  return voice
}

/**
 * Returns both neural voices (female and male) available for a given locale.
 */
export function getAllVoicesForLocale(locale: string): [string, string] {
  const norm = normalizeLocale(locale)
  const voices = NEURAL_VOICES[norm]
  return [voices.female, voices.male]
}
