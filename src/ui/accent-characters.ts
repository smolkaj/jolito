export const SPANISH_ACCENT_CHARACTERS = [
  'á',
  'é',
  'í',
  'ó',
  'ú',
  'ñ',
  'ü',
  '¿',
  '¡',
] as const

export type SpanishAccentChar = (typeof SPANISH_ACCENT_CHARACTERS)[number]
