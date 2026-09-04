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
 * Ensures consistent speaker voice for the same phrase across all clients,
 * while cycling evenly between genders across different phrases.
 */
export function getDeterministicVoice(text: string, locale = 'es-MX'): string {
  const normLocale = normalizeLocale(locale)
  const voices = NEURAL_VOICES[normLocale]
  const cleanText = text.trim().toLowerCase()
  const isFemale = hashString(cleanText) % 2 === 0
  return isFemale ? voices.female : voices.male
}
