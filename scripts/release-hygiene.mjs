import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename } from 'node:path'

const forbiddenPaths = [
  'api/cron',
  'frontend/src/routes/api/cron',
  'supabase/functions',
  'frontend/src/routes/(app)/admin/manage-users/+page.svelte',
  'frontend/src/lib/api.ts'
]

const expectedMigrationVersions = [
  '20260818050000',
  '20260818050001',
  '20260818050002',
  '20260818050003',
  '20260818050004',
  '20260818050005',
  '20260818050006',
  '20260818050007',
  '20260818050008',
  '20260818050009',
  '20260818050010',
  '20260818050011',
  '20260818050012',
  '20260818050013',
  '20260818050014',
  '20260818050015',
  '20260818050016',
  '20260818050017',
  '20260818050018',
  '20260818050019',
  '20260818050020',
  '20260818061400',
  '20260818065000',
  '20260818070000'
]

const failures = []

for (const path of forbiddenPaths) {
  if (existsSync(path)) failures.push(`legacy release surface still exists: ${path}`)
}

const mockPath = 'frontend/src/lib/mock.ts'
if (!existsSync(mockPath)) {
  failures.push(`${mockPath} is missing`)
} else {
  const mockSource = readFileSync(mockPath, 'utf8')
  if (!mockSource.includes('export const USE_MOCK = false as const')) {
    failures.push('UI mock mode is not hard-disabled')
  }
  if (mockSource.includes('process.env.USE_MOCK')) {
    failures.push('UI mock mode can still be enabled from the runtime environment')
  }
}

const migrationsDir = 'supabase/migrations'
if (!existsSync(migrationsDir)) {
  failures.push('supabase/migrations is missing')
} else {
  const migrationFiles = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
  const versions = migrationFiles.map((name) => basename(name).split('_', 1)[0])

  if (migrationFiles.length !== expectedMigrationVersions.length) {
    failures.push(
      `expected ${expectedMigrationVersions.length} V2 migration files, found ${migrationFiles.length}`
    )
  }

  const unexpected = versions.filter((version) => !expectedMigrationVersions.includes(version))
  const missing = expectedMigrationVersions.filter((version) => !versions.includes(version))

  if (unexpected.length) failures.push(`unexpected migration versions: ${unexpected.join(', ')}`)
  if (missing.length) failures.push(`missing migration versions: ${missing.join(', ')}`)
}

const requiredPaths = [
  'supabase/v2/schema.sql',
  'supabase/v2/024_advisor_hardening.sql',
  'supabase/v2/tests/concurrency_contract.ps1',
  'frontend/tests/e2e/public-launch-smoke.spec.ts',
  'docs/v2/release-checklist.md'
]

for (const path of requiredPaths) {
  if (!existsSync(path)) failures.push(`required release artifact is missing: ${path}`)
}

if (failures.length) {
  console.error('UNEEM release hygiene FAILED')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('UNEEM release hygiene PASS')
