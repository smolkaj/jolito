import { describe, expect, it } from 'vitest'
import {
  buildExamplePrompt,
  buildMnemonicPrompt,
  formatMnemonicResult,
  cleanAiOutput,
} from './prompts'

describe('AI prompts and cleaners', () => {
  it('builds authentic Mexican Spanish example sentence prompt', () => {
    const prompt = buildExamplePrompt('o sea')
    expect(prompt).toContain('o sea')
    expect(prompt).toContain('Mexican Spanish')
    expect(prompt).toContain('ONLY')
  })

  it('builds quirky mnemonic prompt targeting Mexican Spanish', () => {
    const prompt = buildMnemonicPrompt('en voz alta', 'out loud')
    expect(prompt).toContain('en voz alta')
    expect(prompt).toContain('out loud')
    expect(prompt).toContain('Mexican Spanish')
    expect(prompt).toContain('mnemonic')
  })

  it('cleans enclosing quotes and whitespace from AI output', () => {
    expect(cleanAiOutput('  "¿Vienes o qué? — O sea, sí."  ')).toBe(
      '¿Vienes o qué? — O sea, sí.',
    )
    expect(cleanAiOutput("'`Habla en voz alta.`'")).toBe('Habla en voz alta.')
    expect(cleanAiOutput('«¡Qué padre!»')).toBe('¡Qué padre!')
  })

  it('strips conversational preambles and header labels from model output', () => {
    expect(
      cleanAiOutput(
        'Here is an authentic example sentence: "¿Vienes o qué? — O sea, sí."',
      ),
    ).toBe('¿Vienes o qué? — O sea, sí.')

    expect(
      cleanAiOutput(
        'Sure! Here is a memorable mnemonic:\nThink of voice alter',
      ),
    ).toBe('Think of voice alter')

    expect(cleanAiOutput('Ejemplo: Habla en voz alta.')).toBe(
      'Habla en voz alta.',
    )

    expect(cleanAiOutput('**Ejemplo:** Habla en voz alta.')).toBe(
      'Habla en voz alta.',
    )

    expect(cleanAiOutput('Mnemonic: Think of voice alter.')).toBe(
      'Think of voice alter.',
    )
  })

  it('extracts single statement and strips runaway loops, markdown headers, and code fences', () => {
    const loopWithHeader = `La fiesta fue chido. (The party was cool.)
## Answer Key
La fiesta fue chido. (The party was cool.)
La fiesta fue chido. (The party was cool.)`
    expect(cleanAiOutput(loopWithHeader)).toBe(
      'La fiesta fue chido. (The party was cool.)',
    )

    const withCodeBlock = `💡 Mnemonic: ¡Ojalá! I hope I don't get a jalapeño on my taco!
\`\`\`haskell
import Data.List
\`\`\``
    expect(cleanAiOutput(withCodeBlock)).toBe(
      "💡 Mnemonic: ¡Ojalá! I hope I don't get a jalapeño on my taco!",
    )

    const withNotes = `**Note:** Here is an answer.
¿Vienes o qué? — O sea, sí. (Are you coming or what? — I mean, yes.)
The final answer is: ¿Vienes o qué?`
    expect(cleanAiOutput(withNotes)).toBe(
      '¿Vienes o qué? — O sea, sí. (Are you coming or what? — I mean, yes.)',
    )
  })

  it('formats mnemonic with lightbulb emoji prefix', () => {
    expect(
      formatMnemonicResult('Think of voice alter - altering voice to be loud.'),
    ).toBe('💡 Mnemonic: Think of voice alter - altering voice to be loud.')

    expect(
      formatMnemonicResult('💡 Mnemonic: Already formatted mnemonic'),
    ).toBe('💡 Mnemonic: Already formatted mnemonic')
  })
})
