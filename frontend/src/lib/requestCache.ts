type CacheEntry<T> = {
  value: T
  expiresAt: number
}

const values = new Map<string, CacheEntry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()
let generation = 0

export async function cachedRequest<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  force = false
): Promise<T> {
  const now = Date.now()
  const cached = values.get(key) as CacheEntry<T> | undefined

  if (!force && cached && cached.expiresAt > now) {
    return cached.value
  }

  if (!force) {
    const pending = inflight.get(key) as Promise<T> | undefined
    if (pending) return pending
  }

  const requestGeneration = generation
  const pending = loader().then((value) => {
    if (requestGeneration === generation) {
      values.set(key, { value, expiresAt: Date.now() + ttlMs })
    }
    return value
  }).finally(() => {
    if (inflight.get(key) === pending) inflight.delete(key)
  })

  inflight.set(key, pending)
  return pending
}

export function setCachedValue<T>(key: string, value: T, ttlMs: number): void {
  values.set(key, { value, expiresAt: Date.now() + ttlMs })
}

export function invalidateRequestCache(prefix?: string): void {
  generation += 1

  if (!prefix) {
    values.clear()
    inflight.clear()
    return
  }

  for (const key of values.keys()) {
    if (key.startsWith(prefix)) values.delete(key)
  }

  for (const key of inflight.keys()) {
    if (key.startsWith(prefix)) inflight.delete(key)
  }
}

export function clearRequestCache(): void {
  invalidateRequestCache()
}
