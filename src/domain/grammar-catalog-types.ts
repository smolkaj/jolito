export type GrammarVerb = {
  family: string
  forms: readonly [string, string, string, string, string]
  contexts: readonly [readonly [string, string], readonly [string, string]]
  note?: string
}
