import { z } from 'zod'
import type {
  PendingCard,
  PendingCardRepository,
} from '../../application/ports'
import { newNoteSchema } from '../../domain/card'

const key = 'jolito-pending-card-v1'
const schema = z.object({
  version: z.literal(1),
  card: newNoteSchema.extend({
    id: z.string().min(1),
    createdAt: z.number().finite(),
  }),
})

export class LocalPendingCardRepository implements PendingCardRepository {
  constructor(private readonly storage: Storage = window.localStorage) {}
  load(): PendingCard | null {
    const raw = this.storage.getItem(key)
    return raw === null ? null : schema.parse(JSON.parse(raw)).card
  }
  save(card: PendingCard): void {
    this.storage.setItem(
      key,
      JSON.stringify(schema.parse({ version: 1, card })),
    )
  }
  clear(): void {
    this.storage.removeItem(key)
  }
}
