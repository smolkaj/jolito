import { describe, expect, it } from 'vitest'
import {
  getAllVoicesForLocale,
  getAlternateVoice,
  getDeterministicVoice,
  isValidVoice,
  NEURAL_VOICES,
  normalizeLocale,
} from './voices'

describe('voices', () => {
  it('normalizes locales correctly', () => {
    expect(normalizeLocale('es-MX')).toBe('es-MX')
    expect(normalizeLocale('es_mx')).toBe('es-MX')
    expect(normalizeLocale('es')).toBe('es-MX')
    expect(normalizeLocale('es-ES')).toBe('es-MX')
    expect(normalizeLocale('en-US')).toBe('en-US')
    expect(normalizeLocale('en_US')).toBe('en-US')
    expect(normalizeLocale('en')).toBe('en-US')
    expect(normalizeLocale('fr-FR')).toBe('es-MX') // fallback to default
  })

  it('validates supported neural voices', () => {
    expect(isValidVoice('es-MX-DaliaNeural')).toBe(true)
    expect(isValidVoice('es-MX-JorgeNeural')).toBe(true)
    expect(isValidVoice('en-US-JennyNeural')).toBe(true)
    expect(isValidVoice('en-US-GuyNeural')).toBe(true)
    expect(isValidVoice('es-ES-ElviraNeural')).toBe(false)
    expect(isValidVoice('')).toBe(false)
  })

  it('deterministically selects female or male voice for Spanish text', () => {
    const textA = 'hola'
    const textB = 'buenos días'
    const voiceA1 = getDeterministicVoice(textA, 'es-MX')
    const voiceA2 = getDeterministicVoice(textA, 'es-MX')
    const voiceB1 = getDeterministicVoice(textB, 'es-MX')

    // Same text must always produce the identical voice
    expect(voiceA1).toBe(voiceA2)
    // Both voices must be one of the Mexican Spanish neural voices
    expect([
      NEURAL_VOICES['es-MX'].female,
      NEURAL_VOICES['es-MX'].male,
    ]).toContain(voiceA1)
    expect([
      NEURAL_VOICES['es-MX'].female,
      NEURAL_VOICES['es-MX'].male,
    ]).toContain(voiceB1)
  })

  it('deterministically selects female or male voice for English text', () => {
    const text = 'good morning'
    const voice1 = getDeterministicVoice(text, 'en-US')
    const voice2 = getDeterministicVoice(text, 'en-US')

    expect(voice1).toBe(voice2)
    expect([
      NEURAL_VOICES['en-US'].female,
      NEURAL_VOICES['en-US'].male,
    ]).toContain(voice1)
  })

  it('cycles across different cards providing both female and male voices', () => {
    const samplePhrases = [
      'aguacate',
      'qué padre',
      '¿dónde está el metro?',
      'nos vemos al rato',
      'la cuenta, por favor',
      'para llevar',
      'despacio',
      'fresa',
    ]

    const voices = samplePhrases.map((phrase) =>
      getDeterministicVoice(phrase, 'es-MX'),
    )
    const femaleCount = voices.filter(
      (v) => v === NEURAL_VOICES['es-MX'].female,
    ).length
    const maleCount = voices.filter(
      (v) => v === NEURAL_VOICES['es-MX'].male,
    ).length

    // Expect reasonable variety across phrases (both female and male voices present)
    expect(femaleCount).toBeGreaterThan(0)
    expect(maleCount).toBeGreaterThan(0)
    expect(femaleCount + maleCount).toBe(samplePhrases.length)
  })

  it('keeps speaker persona consistent across front and back of the same card using card seed', () => {
    const cardId = 'card-12345'
    const prompt = 'how cool'
    const answer = '¡qué padre!'

    const promptVoice = getDeterministicVoice(prompt, 'en-US', cardId)
    const answerVoice = getDeterministicVoice(answer, 'es-MX', cardId)

    const isPromptFemale = promptVoice === NEURAL_VOICES['en-US'].female
    const isAnswerFemale = answerVoice === NEURAL_VOICES['es-MX'].female

    // Both sides of the card must share the same persona (both female or both male)
    expect(isPromptFemale).toBe(isAnswerFemale)
  })

  it('correctly maps alternate voices between female and male personas', () => {
    expect(getAlternateVoice('es-MX-DaliaNeural')).toBe('es-MX-JorgeNeural')
    expect(getAlternateVoice('es-MX-JorgeNeural')).toBe('es-MX-DaliaNeural')
    expect(getAlternateVoice('en-US-JennyNeural')).toBe('en-US-GuyNeural')
    expect(getAlternateVoice('en-US-GuyNeural')).toBe('en-US-JennyNeural')
    expect(getAlternateVoice('unknown-voice')).toBe('unknown-voice')
  })

  it('retrieves both female and male voices for supported locales', () => {
    expect(getAllVoicesForLocale('es-MX')).toEqual([
      'es-MX-DaliaNeural',
      'es-MX-JorgeNeural',
    ])
    expect(getAllVoicesForLocale('en-US')).toEqual([
      'en-US-JennyNeural',
      'en-US-GuyNeural',
    ])
  })

  it('alternates between male and female voices across consecutive review turns for the same card', () => {
    const cardId = 'card-1'
    const prompt = 'apple'
    const voiceTurn0 = getDeterministicVoice(prompt, 'es-MX', `${cardId}:turn0`)
    const voiceTurn1 = getDeterministicVoice(prompt, 'es-MX', `${cardId}:turn1`)
    const voiceTurn2 = getDeterministicVoice(prompt, 'es-MX', `${cardId}:turn2`)
    const voiceTurn3 = getDeterministicVoice(prompt, 'es-MX', `${cardId}:turn3`)

    expect(voiceTurn0).not.toBe(voiceTurn1)
    expect(voiceTurn1).not.toBe(voiceTurn2)
    expect(voiceTurn2).not.toBe(voiceTurn3)
    expect(voiceTurn0).toBe(voiceTurn2)
  })
})

