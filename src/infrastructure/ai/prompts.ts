export function buildExamplePrompt(spanish: string): string {
  return `Give me an authentic, characteristic, but simple and short Mexican Spanish example sentence using "${spanish}" with an English translation in parentheses. Keep all other words in the sentence strictly to very basic, common everyday vocabulary (A1–A2 level) so it is easy for a beginner learner to understand. Output ONLY the Spanish sentence and English translation in parentheses on a single line without any preamble or conversational filler.`
}

export function buildMnemonicPrompt(spanish: string, english: string): string {
  return `Create a concise sound-alike mnemonic hook to remember that the Mexican Spanish phrase "${spanish}" means "${english}". Connect an English word that sounds like "${spanish}" to "${english}" in a single punchy mental image under 15 words. Example: "en voz alta" sounds like "voice alter" -> picture altering your voice to speak loud. Output ONLY the 1-sentence hook on a single line without preamble or conversational filler.`
}

export function cleanAiOutput(raw: string): string {
  if (!raw) return ''

  const rawLines = raw.split(/\r?\n/)

  for (const rawLine of rawLines) {
    let line = rawLine.trim()
    if (!line) continue

    // Ignore markdown code fences, headers, horizontal rules, and answer keys
    if (
      line.startsWith('```') ||
      line.startsWith('~~~') ||
      /^#{1,6}\s/.test(line) ||
      /^[-*_]{3,}$/.test(line) ||
      /^\*{0,2}(note|answer key|the final answer is|nota)\*{0,2}:/i.test(line)
    ) {
      continue
    }

    // Strip wrapping quotes and markdown styling
    line = stripWrappingDelimiters(line)

    // Check if line is an introductory phrase ending with a colon
    if (
      /^(sure|certainly|here is|here's|por supuesto|aquí tienes|example|mnemonic|ejemplo|nemotecnia|a continuation)/i.test(
        line,
      ) &&
      line.endsWith(':')
    ) {
      continue
    }

    // Strip leading conversational phrases
    line = line
      .replace(
        /^(sure[!,.]*|certainly[!,.]*|here is[a-z\s]*:|here's[a-z\s]*:|por supuesto[!,.]*|aquí tienes[a-z\s]*:)\s*/i,
        '',
      )
      .trim()

    // Strip leading label headers (e.g., "Example sentence:", "**Ejemplo:**", "Mnemonic:", "Sound-alike:")
    line = line
      .replace(
        /^\*{0,2}(example sentence|example|ejemplo|mnemonic hook|mnemonic|nemotecnia|sound-alike|soundalike):?\*{0,2}:?\s*/i,
        '',
      )
      .trim()

    // Re-strip any wrapping quotes or markdown delimiters exposed after label removal
    line = stripWrappingDelimiters(line)

    if (line) {
      return line
    }
  }

  return ''
}

function stripWrappingDelimiters(text: string): string {
  let s = text.trim()
  let changed = true
  while (changed) {
    changed = false
    if (
      (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
      (s.startsWith("'") && s.endsWith("'") && s.length >= 2) ||
      (s.startsWith('`') && s.endsWith('`') && s.length >= 2) ||
      (s.startsWith('«') && s.endsWith('»') && s.length >= 2)
    ) {
      s = s.slice(1, -1).trim()
      changed = true
    }
    if (
      (s.startsWith('**') && s.endsWith('**') && s.length >= 4) ||
      (s.startsWith('*') && s.endsWith('*') && s.length >= 2) ||
      (s.startsWith('_') && s.endsWith('_') && s.length >= 2)
    ) {
      s = s.slice(s.startsWith('**') ? 2 : 1, s.endsWith('**') ? -2 : -1).trim()
      changed = true
    }
  }
  return s
}

export function formatMnemonicResult(raw: string): string {
  const cleaned = cleanAiOutput(raw)
  if (!cleaned) return ''
  if (cleaned.startsWith('💡 Mnemonic:')) {
    return cleaned
  }
  return `💡 Mnemonic: ${cleaned}`
}
