import { rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptsDirectory = dirname(fileURLToPath(import.meta.url))
const vercelOutputDirectory = resolve(scriptsDirectory, '../frontend/.vercel/output')

await rm(vercelOutputDirectory, { recursive: true, force: true })
