export async function checkOrRequestStoragePersistence(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage) {
    return false
  }

  try {
    if (typeof navigator.storage.persisted === 'function') {
      const isPersisted = await navigator.storage.persisted()
      if (isPersisted) return true
    }

    if (typeof navigator.storage.persist === 'function') {
      return await navigator.storage.persist()
    }
  } catch {
    return false
  }

  return false
}
