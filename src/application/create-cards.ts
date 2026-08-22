import { createStudyCards, type NewNote, type StudyCard } from '../domain/card'
import type { Clock, IdGenerator } from './ports'

export function createCards(
  note: NewNote,
  services: { clock: Clock; ids: IdGenerator },
): StudyCard[] {
  const noteId = services.ids.nextId('note')
  return createStudyCards(note, noteId, services.clock.now())
}
