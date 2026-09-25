/**
 * Bounds credential, response, and body wait times within a deterministic deadline.
 *
 * IMPORTANT CONTRACT:
 * The entire request lifecycle—including reading and decoding the response body
 * (e.g. `await res.json()` or `await res.text()`)—MUST occur inside the `operation` callback.
 * `withRequestDeadline` unconditionally aborts its internal AbortController in its `finally`
 * block when `operation` resolves. Consuming a response body outside this callback will fail
 * with an AbortError / "Fetch is aborted".
 */
export async function withRequestDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  parentSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController()
  let timedOut = false
  let onAbort: () => void = () => {}
  const interrupted = new Promise<never>((_, reject) => {
    onAbort = () =>
      reject(
        new Error(
          timedOut
            ? 'Request timed out. Please try again.'
            : 'Request was interrupted. Please try again.',
        ),
      )
    controller.signal.addEventListener('abort', onAbort, { once: true })
  })
  const forwardAbort = () => controller.abort()
  parentSignal?.addEventListener('abort', forwardAbort, { once: true })
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, 10_000)
  if (parentSignal?.aborted) forwardAbort()
  try {
    if (controller.signal.aborted) return await interrupted
    return await Promise.race([operation(controller.signal), interrupted])
  } finally {
    clearTimeout(timeout)
    parentSignal?.removeEventListener('abort', forwardAbort)
    controller.signal.removeEventListener('abort', onAbort)
    controller.abort()
  }
}
