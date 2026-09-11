/** Resolve once during startup, before services begin subscribing or prewarming. */
export function getOrCreateDeviceId(
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
): string {
  if (!storage && typeof window === 'undefined') return 'device-server'
  const target = storage ?? window.localStorage
  const key = 'jolito-device-id-v1'
  let id = target.getItem(key)
  if (!id) {
    id = `dev-${Math.random().toString(36).slice(2, 10)}`
    target.setItem(key, id)
  }
  return id
}
