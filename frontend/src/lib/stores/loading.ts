import { derived, writable } from 'svelte/store'

export type LoadingKind = 'bootstrap' | 'navigating' | 'action' | 'background'

type LoadingCounts = Record<LoadingKind, number>

const initialCounts: LoadingCounts = {
  bootstrap: 0,
  navigating: 0,
  action: 0,
  background: 0
}

const counts = writable<LoadingCounts>(initialCounts)
const operations = new Map<number, { kind: LoadingKind; timer: number | null; visible: boolean }>()
let nextOperationId = 0

function changeCount(kind: LoadingKind, delta: number) {
  counts.update((current) => ({
    ...current,
    [kind]: Math.max(0, current[kind] + delta)
  }))
}

export const globalLoading = derived(counts, ($counts) => ({
  ...$counts,
  // Actions own their button/form feedback; don't duplicate it across the app.
  visible: $counts.bootstrap > 0 || $counts.navigating > 0,
  any: Object.values($counts).some((count) => count > 0)
}))

export function beginLoading(kind: LoadingKind): () => void {
  if (typeof window === 'undefined') return () => undefined

  const id = ++nextOperationId
  const operation = { kind, timer: null as number | null, visible: false }
  operations.set(id, operation)

  operation.timer = window.setTimeout(() => {
    if (!operations.has(id) || operation.visible) return
    operation.visible = true
    changeCount(kind, 1)
  }, 120)

  return () => {
    const active = operations.get(id)
    if (!active) return
    if (active.timer !== null) window.clearTimeout(active.timer)
    if (active.visible) changeCount(active.kind, -1)
    operations.delete(id)
  }
}

export async function withLoading<T>(kind: LoadingKind, task: () => Promise<T>): Promise<T> {
  const stop = beginLoading(kind)
  try {
    return await task()
  } finally {
    stop()
  }
}
