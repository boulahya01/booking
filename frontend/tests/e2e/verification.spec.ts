import { test, expect } from '@playwright/test'

test('all students browse, see a persistent reminder and correct ID before approval', async ({ page }) => {
  const uid = '11111111-1111-4111-8111-111111111111'
  const pitchId = '44444444-4444-4444-8444-444444444444'
  const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'fixture@usmba.ac.ma', email_confirmed_at: new Date().toISOString(), app_metadata: { provider: 'email' }, user_metadata: {} }
  const exp = Math.floor(Date.now() / 1000) + 3600
  const token = [{ alg: 'HS256', typ: 'JWT' }, { sub: uid, aud: 'authenticated', role: 'authenticated', exp }, 'fixture'].map(x => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url')).join('.')
  const session = { access_token: token, refresh_token: 'fixture-refresh', expires_in: 3600, expires_at: exp, token_type: 'bearer', user }
  const account = { user_id: uid, full_name: 'Yasmine El Amrani', username: 'yasmine', student_id: null as string | null, role: 'student', access_status: 'pending', email_kind: 'academic', identity_status: 'required', can_use_sports: false, needs_identity_action: true, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' }
  const facility = { id: pitchId, name: 'Main football pitch', location: 'University campus', capacity: 22, sport_type: 'football', open_time: '08:00', close_time: '22:00', timezone: 'Africa/Casablanca', booking_frequency_enabled: false, booking_frequency_days: 1 }
  const starts = new Date(Date.now() + 2 * 3600_000).toISOString()
  const ends = new Date(Date.now() + 3 * 3600_000).toISOString()
  const unexpected: string[] = []
  const errors: string[] = []
  const savedIds: string[] = []
  let rejectSave = false
  let approveDuringEdit = false
  let submissions = 0
  page.on('pageerror', e => errors.push(e.message))
  await page.route('**/*.supabase.co/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const key = url.pathname.split('/').at(-1)!
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (key === 'settings') return json({ external: { google: true, facebook: true } })
    if (key === 'token') return json(session)
    if (key === 'user') return json(user)
    if (key === 'logout') return route.fulfill({ status: 204 })
    if (key === 'get_my_session_context' || key === 'get_my_account_state') return json([account])
    if (key === 'get_next_booking' || key === 'list_my_bookings' || key === 'announcements' || key === 'announcement_dismissals' || key === 'list_open_matches') return json([])
    if (key === 'pitches') return json(url.searchParams.has('id') ? facility : [facility])
    if (key === 'get_pitch_availability') return json([{ id: starts, pitch_id: pitchId, starts_at: starts, ends_at: ends, is_available: true, capacity: 22, timezone: 'Africa/Casablanca' }])
    if (url.pathname.includes('/storage/v1/object/student-verification/')) return json({ Key: url.pathname.split('/object/')[1] })
    if (key === 'update_my_student_id') {
      if (approveDuringEdit) {
        account.identity_status = 'verified'
        account.access_status = 'approved'
        account.can_use_sports = true
        account.needs_identity_action = false
        return json({ code: 'P0001', message: 'identity_already_verified' }, 400)
      }
      if (rejectSave) return json({ code: '42501', message: 'Simulated failure' }, 403)
      account.student_id = request.postDataJSON().p_student_id
      savedIds.push(account.student_id!)
      return json(null)
    }
    if (key === 'submit_identity_verification') {
      submissions++
      account.student_id = request.postDataJSON().p_student_id
      account.identity_status = 'pending'
      account.needs_identity_action = false
      return json({ id: 'attempt-fixture', status: 'pending' })
    }
    unexpected.push(key)
    return json({ message: `Unhandled fixture: ${key}` }, 400)
  })

  await page.goto('/login')
  await page.getByLabel('Email address', { exact: true }).fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill('Fixture123!')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Play today' })).toBeVisible()
  const reminder = page.getByRole('complementary', { name: 'Student verification' })
  await expect(reminder).toBeVisible()
  await page.goto('/matches')
  await expect(page.getByRole('heading', { name: 'Open matches', exact: true })).toBeVisible()
  await expect(reminder).toBeVisible()
  await page.goto(`/pitch/${pitchId}`)
  await expect(page.getByText('Available', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Book', exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Verify', exact: true }).last().click()
  await expect(page.getByRole('heading', { name: 'Verify your student ID' })).toBeVisible()
  const id = page.getByLabel('Student ID', { exact: true })
  await id.fill('A123')
  await page.getByRole('button', { name: 'Save Student ID' }).click()
  await expect(page.getByText('Use S followed by numbers, for example S123.', { exact: true })).toBeVisible()
  expect(savedIds).toEqual([])
  await id.fill('s123')
  await page.getByRole('button', { name: 'Save Student ID' }).click()
  await expect(id).toHaveValue('S123')
  expect(savedIds).toEqual(['S123'])
  await page.getByLabel('Add card photo').setInputFiles({ name: 'card.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZxQAAAAASUVORK5CYII=', 'base64') })
  await page.getByRole('button', { name: 'Submit for review', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'ID under review' })).toBeVisible()
  expect(submissions).toBe(1)
  await id.fill('s456')
  await page.getByRole('button', { name: 'Save Student ID' }).click()
  await expect(id).toHaveValue('S456')
  expect(savedIds).toEqual(['S123', 'S456'])
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await expect(reminder).toBeVisible()
  expect((await reminder.boundingBox())!.y).toBeLessThan(100)
  const width = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }))
  expect(width.content).toBeLessThanOrEqual(width.viewport)
  await page.screenshot({ path: test.info().outputPath('verification.png'), fullPage: true })

  rejectSave = true
  await id.fill('S789')
  await page.getByRole('button', { name: 'Save Student ID' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Couldn’t save this change.' })).toBeVisible()
  await expect(id).toHaveValue('S789')
  expect(account.student_id).toBe('S456')
  rejectSave = false
  approveDuringEdit = true
  await page.getByRole('button', { name: 'Save Student ID' }).click()
  await expect(page.getByRole('heading', { name: 'Identity verified' })).toBeVisible()
  await expect(id).toHaveCount(0)
  await expect(reminder).toHaveCount(0)
  await page.goto(`/pitch/${pitchId}`)
  await expect(page.getByRole('button', { name: 'Book', exact: true })).toBeVisible()
  expect(unexpected).toEqual([])
  expect(errors).toEqual([])
})
