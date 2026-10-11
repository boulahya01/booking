type BootstrapRetry = () => Promise<void>

let retryHandler: BootstrapRetry | null = null

export function registerAuthBootstrapRetry(handler: BootstrapRetry): () => void {
  retryHandler = handler

  return () => {
    if (retryHandler === handler) retryHandler = null
  }
}

export async function retryAuthBootstrap(): Promise<boolean> {
  const handler = retryHandler
  if (!handler) return false
  await handler()
  return true
}
