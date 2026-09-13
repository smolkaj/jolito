import { z } from 'zod'
import { collectionVersion } from '../../domain/card'
import type {
  AccountDeletion,
  CardLoadResult,
  CardRepository,
} from '../../application/ports'
import {
  studyCardCollectionSchema,
  type Direction,
  type StudyCard,
} from '../../domain/card'

export const ACCOUNT_STORAGE_KEY = 'jolito-libraries-v1'
const STORAGE_KEY = 'jolito-library-v1'
const accountLibrariesSchema = z.object({
  version: z.literal(1),
  accounts: z.record(z.string(), studyCardCollectionSchema),
  guest: studyCardCollectionSchema.optional(),
  deletion: z
    .object({
      ownerId: z.string().min(1),
      phase: z.enum(['requested', 'confirmed']),
    })
    .optional(),
  legacy: z
    .object({
      ownerId: z.string().nullable(),
      key: z.enum(['jolito-library-v1', 'ritmo-library-v1', 'ritmo-cards']),
    })
    .optional(),
})
type AccountLibraries = z.infer<typeof accountLibrariesSchema>
type Recovery = Extract<CardLoadResult, { status: 'recovery' }>
const LEGACY_STORAGE_KEY = 'ritmo-library-v1'
const LEGACY_KEY = 'ritmo-cards'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'> &
  Partial<Pick<Storage, 'removeItem'>>

const directions: Direction[] = ['es-en', 'en-es']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const parseJson = (value: string | null): unknown => {
  if (!value) return null
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

const restoreCurrent = (
  raw: unknown,
): { cards: StudyCard[]; deletedCardIds: string[] } | null => {
  const result = studyCardCollectionSchema.safeParse(raw)
  if (!result.success) return null
  return {
    cards: result.data.cards,
    deletedCardIds: result.data.deletedCardIds,
  }
}

const restoreLegacy = (raw: unknown): StudyCard[] | null => {
  if (!Array.isArray(raw)) return null
  const cards: StudyCard[] = []
  for (const [index, candidate] of raw.entries()) {
    if (
      !isRecord(candidate) ||
      typeof candidate.prompt !== 'string' ||
      typeof candidate.answer !== 'string' ||
      !directions.includes(candidate.direction as Direction)
    )
      return null
    const direction = candidate.direction as Direction
    const legacyId =
      typeof candidate.id === 'string' || typeof candidate.id === 'number'
        ? String(candidate.id)
        : String(index)
    const noteId = `legacy-${legacyId}`
    cards.push({
      id: `${noteId}:${direction}`,
      noteId,
      prompt: candidate.prompt,
      answer: candidate.answer,
      direction,
      context: '',
      scene: 'conversation',
      schedule: {
        state: 'new',
        dueAt: 0,
        intervalDays: 0,
        easeFactor: 2.5,
        reviews: 0,
        lapses: 0,
      },
      contentRevision: 0,
      resetRevision: { generation: 0, at: 0 },
      createdAt: 0,
    })
  }
  return cards
}

export class LocalStorageCardRepository implements CardRepository {
  private deletedCardIds: string[] = []
  private recovery: Recovery | null = null

  constructor(
    private readonly storage?: StorageLike,
    private readonly legacyOwnerId: string | null = null,
    private readonly ownerId: string | null = legacyOwnerId,
  ) {}

  forOwner(ownerId: string | null): CardRepository {
    return ownerId === this.ownerId
      ? this
      : new LocalStorageCardRepository(
          this.storage,
          this.legacyOwnerId,
          ownerId,
        )
  }

  getDeletedCardIds(): string[] {
    return [...this.deletedCardIds]
  }

  private selected(envelope: AccountLibraries) {
    if (this.ownerId === null) return envelope.guest
    return Object.prototype.hasOwnProperty.call(
      envelope.accounts,
      `user:${this.ownerId}`,
    )
      ? envelope.accounts[`user:${this.ownerId}`]
      : undefined
  }

  load(fallback: StudyCard[]): CardLoadResult {
    this.recovery = null
    this.deletedCardIds = []
    const result = this.readEnvelope()
    if (result.status === 'recovery') return result
    const selected = this.selected(result.envelope)
    this.deletedCardIds = selected?.deletedCardIds ?? []
    return {
      status: result.migrated ? 'migrated' : selected ? 'loaded' : 'missing',
      cards: selected?.cards ?? fallback,
    }
  }

  private readEnvelope():
    | { status: 'ready'; envelope: AccountLibraries; migrated: boolean }
    | Recovery {
    let raw: string | null = null
    const storage = () => this.storage ?? window.localStorage
    try {
      raw = storage().getItem(ACCOUNT_STORAGE_KEY)
      if (raw !== null) {
        const parsed = parseJson(raw)
        const result = accountLibrariesSchema.safeParse(parsed)
        if (!result.success) return this.invalid(parsed, raw, 1)
        return { status: 'ready', envelope: result.data, migrated: false }
      }
      // Commit migration and its ownership in one storage operation. Retain original
      // bytes, but never consult them again once the account envelope exists.
      for (const key of [
        STORAGE_KEY,
        LEGACY_STORAGE_KEY,
        LEGACY_KEY,
      ] as const) {
        raw = storage().getItem(key)
        if (raw === null) continue
        const parsed = parseJson(raw)
        const current = key === LEGACY_KEY ? null : restoreCurrent(parsed)
        const legacy = key === LEGACY_KEY ? restoreLegacy(parsed) : null
        if (!current && !legacy)
          return this.invalid(parsed, raw, collectionVersion)
        const collection = studyCardCollectionSchema.parse({
          version: collectionVersion,
          cards: current?.cards ?? legacy,
          deletedCardIds: current?.deletedCardIds ?? [],
        })
        const envelope: AccountLibraries = {
          version: 1,
          accounts: {},
          legacy: { ownerId: this.legacyOwnerId, key },
        }
        if (this.legacyOwnerId === null) envelope.guest = collection
        else envelope.accounts = { [`user:${this.legacyOwnerId}`]: collection }
        try {
          storage().setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(envelope))
        } catch {
          return this.block(
            'migration-failed',
            raw,
            'Your deck needs an update, but it couldn’t be saved. Free up device storage, then try again.',
          )
        }
        return { status: 'ready', envelope, migrated: true }
      }
      return {
        status: 'ready',
        envelope: { version: 1, accounts: {} },
        migrated: false,
      }
    } catch {
      return this.block(
        'unavailable',
        raw,
        'Jolito couldn’t access device storage. Allow storage access in your browser, then try again.',
      )
    }
  }

  private invalid(parsed: unknown, raw: string, version: number): Recovery {
    const unsupported =
      isRecord(parsed) &&
      typeof parsed.version === 'number' &&
      parsed.version > version
    return this.block(
      unsupported ? 'unsupported' : 'corrupt',
      raw,
      unsupported
        ? 'This deck was saved by a newer version of Jolito. Update or reopen Jolito, then try again.'
        : 'Jolito couldn’t read your saved deck. Download a copy to keep it safe before repairing or restoring your data.',
    )
  }

  private block(
    reason: Recovery['reason'],
    raw: string | null,
    message: string,
  ): Recovery {
    this.recovery = { status: 'recovery', reason, raw, message, cards: [] }
    return this.recovery
  }

  getPendingDeletion(): AccountDeletion | null {
    const result = this.readEnvelope()
    return result.status === 'ready' ? (result.envelope.deletion ?? null) : null
  }

  setPendingDeletion(phase: AccountDeletion['phase'] | null): void {
    if (this.ownerId === null)
      throw new Error('Sign in to delete your account.')
    const result = this.readEnvelope()
    if (result.status === 'recovery') throw new Error(result.message)
    const envelope = result.envelope
    if (envelope.deletion && envelope.deletion.ownerId !== this.ownerId)
      throw new Error('Finish the other pending account deletion first.')
    if (envelope.deletion?.phase === 'confirmed' && phase !== 'confirmed')
      throw new Error('Confirmed deletion requires local cleanup.')
    if (phase === null) {
      delete envelope.deletion
    } else {
      if (phase === 'confirmed' && !envelope.deletion)
        throw new Error('Prepare account deletion before confirming it.')
      envelope.deletion = { ownerId: this.ownerId, phase }
    }
    ;(this.storage ?? window.localStorage).setItem(
      ACCOUNT_STORAGE_KEY,
      JSON.stringify(envelope),
    )
  }

  forget(): void {
    if (this.recovery) throw new Error(this.recovery.message)
    const result = this.readEnvelope()
    if (result.status === 'recovery') throw new Error(result.message)
    const envelope = result.envelope
    if (
      envelope.deletion?.ownerId !== this.ownerId ||
      envelope.deletion.phase !== 'confirmed'
    )
      throw new Error(
        'Cloud deletion must be confirmed before removing the local deck.',
      )
    const storage = this.storage ?? window.localStorage
    // Keep the durable receipt until both legacy bytes and the owned slot are gone.
    if (envelope.legacy?.ownerId === this.ownerId) {
      if (!storage.removeItem)
        throw new Error('The legacy local copy could not be removed.')
      storage.removeItem(envelope.legacy.key)
    }
    delete envelope.accounts[`user:${this.ownerId}`]
    delete envelope.deletion
    storage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(envelope))
    this.deletedCardIds = []
  }

  save(cards: StudyCard[], deletedCardIds = this.deletedCardIds): void {
    if (this.recovery) throw new Error(this.recovery.message)
    // Reread on every commit: a scope never writes a cached snapshot of other owners.
    const result = this.readEnvelope()
    if (result.status === 'recovery') throw new Error(result.message)
    if (result.envelope.deletion?.ownerId === this.ownerId)
      throw new Error(
        'This account has a pending deletion. Resolve it before saving more cards.',
      )
    const collection = studyCardCollectionSchema.parse({
      version: collectionVersion,
      cards,
      deletedCardIds,
    })
    const envelope = result.envelope
    if (this.ownerId === null) envelope.guest = collection
    else
      envelope.accounts = {
        ...envelope.accounts,
        [`user:${this.ownerId}`]: collection,
      }
    const storage = this.storage ?? window.localStorage
    storage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(envelope))
    this.deletedCardIds = [...deletedCardIds]
  }
}
