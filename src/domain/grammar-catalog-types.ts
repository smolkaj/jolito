// Brackets mark the English verb corresponding to the Spanish blank. Separate
// spans preserve intervening words: "[{have}] never [talked]".
type VerbTranslation = `${string}[${string}]${string}`

export type GrammarVerb = {
  family: string
  forms: readonly [string, string, string, string, string]
  contexts: readonly [
    readonly [string, VerbTranslation],
    readonly [string, VerbTranslation],
  ]
  note?: string
}
