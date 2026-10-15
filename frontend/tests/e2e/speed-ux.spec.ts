import { expect, test, type Page } from '@playwright/test'

// All Auth/REST requests are intercepted. These tests never create live users or bookings.
const uid = '11111111-1111-4111-8111-111111111111'
const pitchId = '44444444-4444-4444-8444-444444444444'
const bookingId = '55555555-5555-4555-8555-555555555555'
const laterId = '66666666-6666-4666-8666-666666666666'
const historyId = '77777777-7777-4777-8777-777777777777'
const starts = new Date(Date.now() + 2 * 3600_000).toISOString()
const ends = new Date(Date.now() + 3 * 3600_000).toISOString()
const atHour = (hours: number) => new Date(Date.now() + hours * 3600_000).toISOString()

function gate() {
  let release: () => void = () => undefined
  const promise = new Promise<void>(resolve => { release = resolve })
  return { promise, release }
}

async function fixture(page: Page) {
  const now = new Date().toISOString()
  const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'student@example.com', email_confirmed_at: now, app_metadata: { provider: 'email' }, user_metadata: {} }
  const exp = Math.floor(Date.now() / 1000) + 3600
  const token = [{ alg: 'HS256', typ: 'JWT' }, { sub: uid, aud: 'authenticated', role: 'authenticated', exp }, 'fixture'].map(item => Buffer.from(typeof item === 'string' ? item : JSON.stringify(item)).toString('base64url')).join('.')
  const session = { access_token: token, refresh_token: 'fictional-refresh', expires_in: 3600, expires_at: exp, token_type: 'bearer', user }
  const account = { user_id: uid, id: uid, full_name: 'Test User', username: 'test_user', student_id: 'S123', role: 'student', access_status: 'approved', status: 'approved', email_kind: 'personal', identity_status: 'verified', can_use_sports: true, needs_identity_action: false, created_at: now, updated_at: now }
  const facility = { id: pitchId, name: 'Student football pitch', location: 'Student sports centre', capacity: 12, sport_type: 'football', open_time: '08:00', close_time: '22:00', timezone: 'Africa/Casablanca', booking_frequency_enabled: false, booking_frequency_days: 1, slot_duration_minutes: 60, booking_window_hours: 24, cancellation_cutoff_minutes: 0, is_active: true, sort_order: 0 }
  const booking = { booking_id: bookingId, pitch_id: pitchId, pitch_name: facility.name, pitch_location: facility.location, pitch_capacity: 12, pitch_timezone: facility.timezone, location: facility.location, timezone: facility.timezone, starts_at: starts, ends_at: ends, booking_status: 'scheduled', lifecycle_status: 'upcoming', booker_id: uid, booker_name: 'Test User', booker_username: 'test_user', capacity: 12, booked_by_me: true, match_id: null, match_open: false, match_visibility: 'private', reserved_spots: 0, joined_count: 0, spots_left: 11, participant_by_me: false, reserved_by_me: false, created_at: now }
  const available = { ...booking, booking_id: null, booked_by_me: false, booker_id: null, booker_name: null, booker_username: null, is_available: true }
  const state = { bookings: [] as any[], matches: [] as any[], availability: [available] as any[], bookingRequests: 0, availabilityReads: 0, accountReads: 0, unhandled: [] as string[], errors: [] as string[] }
  page.on('pageerror', error => state.errors.push(error.message))
  await page.route('**/*.supabase.co/**', async route => {
    const url = new URL(route.request().url()), key = url.pathname.split('/').at(-1)!
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (key === 'settings') return json({ external: { google: true } })
    if (key === 'token') return json(session)
    if (key === 'user') return json(user)
    if (key === 'logout') return route.fulfill({ status: 204 })
    if (['get_my_session_context', 'get_my_account_state'].includes(key)) { state.accountReads++; return json([account]) }
    if (key === 'profiles') return json(account)
    if (key === 'pitches') return json(url.searchParams.has('id') ? facility : [facility])
    if (key === 'list_my_bookings') return json(state.bookings)
    if (key === 'list_my_matches') return json(state.matches)
    if (key === 'get_next_booking') return json(state.bookings.filter(item => item.booking_status !== 'cancelled' && Date.parse(item.ends_at) > Date.now()).slice(0, 1))
    if (key === 'get_pitch_availability') { state.availabilityReads++; return json(state.availability) }
    if (key === 'get_booking_details') return json([booking])
    if (['list_booking_roster', 'list_open_matches', 'announcements', 'announcement_dismissals', 'list_my_support_threads'].includes(key)) return json([])
    if (key === 'create_booking') { state.bookingRequests++; return json({ id: bookingId, pitch_id: pitchId, starts_at: starts, ends_at: ends, status: 'scheduled' }) }
    state.unhandled.push(`${route.request().method()} ${key}`)
    return json({ message: `Unhandled fixture ${key}` }, 400)
  })
  async function login(capture = false) {
    await page.goto('/login')
    if (capture) {
      await expect(page.getByRole('button', { name: 'Continue with Google', exact: true })).toBeEnabled()
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: test.info().outputPath('login-en.png'), fullPage: true })
      const authHeader = page.locator('.auth-shell-header')
      await authHeader.getByRole('button', { name: 'Switch to dark mode', exact: true }).click()
      await authHeader.getByRole('button', { name: 'Language', exact: true }).click()
      await authHeader.getByRole('button', { name: 'العربية', exact: true }).click()
      await expect(page.getByRole('button', { name: 'المتابعة باستخدام Google', exact: true })).toBeEnabled()
      await page.evaluate(() => document.fonts.ready)
      // Capture the finished theme transition, rather than an intermediate color.
      await expect.poll(() => page.locator('.google-sign-in').evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgb(28, 29, 32)')
      await page.screenshot({ path: test.info().outputPath('login-ar-dark.png'), fullPage: true })
      await authHeader.getByRole('button', { name: 'اللغة', exact: true }).click()
      await authHeader.getByRole('button', { name: 'English', exact: true }).click()
      await authHeader.getByRole('button', { name: 'Switch to light mode', exact: true }).click()
      await expect.poll(() => page.locator('.google-sign-in').evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgb(255, 255, 255)')
    }
    await page.getByLabel('Email address', { exact: true }).fill(user.email)
    await page.getByLabel('Password', { exact: true }).fill('Fictional123!')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await page.waitForURL('**/home')
    await expect(page.getByRole('heading', { name: 'Play today', exact: true })).toBeVisible()
  }
  async function openBooking() {
    await login()
    await page.goto(`/pitch/${pitchId}`)
    await page.getByRole('button', { name: 'Book', exact: true }).first().click()
    return page.getByRole('dialog', { name: 'Confirm booking', exact: true })
  }
  function healthy() {
    expect(state.errors).toEqual([])
    expect(state.unhandled).toEqual([])
  }
  return { state, booking, available, account, user, session, login, openBooking, healthy }
}

test('header controls switch immediately, persist preferences, and close with keyboard focus restored', async ({ page }) => {
  const f = await fixture(page)
  await f.login(true)
  await page.screenshot({ path: test.info().outputPath('play-en.png'), fullPage: true })
  const header = page.locator('.uneem-topbar')
  const menu = header.getByRole('button', { name: 'Open menu', exact: true })
  await menu.focus()
  await page.keyboard.press('Enter')
  await expect(header.getByRole('navigation', { name: 'Quick links' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).toBeFocused()
  await expect(header.getByRole('navigation', { name: 'Quick links' })).toHaveCount(0)
  await header.getByRole('button', { name: 'Language', exact: true }).click()
  await header.getByRole('button', { name: 'العربية', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(header.getByRole('button', { name: 'اللغة', exact: true })).toBeFocused()
  await header.getByRole('button', { name: 'التبديل إلى الوضع الداكن', exact: true }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'العب اليوم', exact: true })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.setViewportSize({ width: 320, height: 680 })
  await page.screenshot({ path: test.info().outputPath('play-ar-dark-320.png'), fullPage: true })
  await page.goto('/menu')
  await expect(page.getByRole('heading', { name: 'حسابي', exact: true })).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('account-ar-dark-320.png'), fullPage: true })
  await header.getByRole('button', { name: 'فتح القائمة', exact: true }).click()
  await page.screenshot({ path: test.info().outputPath('menu-ar-dark-320.png'), fullPage: true })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.keyboard.press('Escape')
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'الإعدادات', exact: true })).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('settings-ar-dark-320.png'), fullPage: true })
  f.healthy()
})

test('Play separates facilities and open matches while Account groups related destinations', async ({ page }) => {
  const f = await fixture(page)
  await f.login()
  await expect(page.getByRole('region', { name: 'Facilities', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Open matches', exact: true })).toHaveCount(0)
  await page.getByRole('navigation', { name: 'Play sections', exact: true }).getByRole('link', { name: 'Open matches', exact: true }).click()
  await expect(page).toHaveURL(/\/matches$/)
  await expect(page.getByRole('heading', { name: 'No open matches yet', exact: true })).toBeVisible()
  await page.goto('/menu')
  await expect(page.getByRole('heading', { name: 'Account', exact: true })).toBeVisible()
  const accountNavigation = page.getByRole('navigation', { name: 'Account sections', exact: true })
  await accountNavigation.getByRole('link', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
  f.healthy()
})

test('owned, other, open and full slots remain distinguishable without comparing usernames', async ({ page }) => {
  const f = await fixture(page)
  f.state.availability = [
    { ...f.booking, is_available: false },
    { ...f.booking, booking_id: laterId, starts_at: atHour(4), ends_at: atHour(5), booked_by_me: false, is_available: false },
    { ...f.booking, booking_id: historyId, starts_at: atHour(5), ends_at: atHour(6), booked_by_me: false, match_open: true, match_id: laterId, spots_left: 3, joined_count: 8, is_available: false },
    { ...f.booking, booking_id: '88888888-8888-4888-8888-888888888888', starts_at: atHour(6), ends_at: atHour(7), booked_by_me: false, match_open: true, match_id: historyId, spots_left: 0, joined_count: 11, is_available: false }
  ]
  await f.login()
  await page.goto(`/pitch/${pitchId}`)
  await expect(page.getByText('Your booking', { exact: true })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'View your booking', exact: true })).toHaveCount(1)
  await expect(page.getByText('Open match', { exact: true })).toHaveCount(1)
  await expect(page.locator('.slot-status').getByText('Full', { exact: true })).toHaveCount(1)
  await expect(page.getByText('Booked', { exact: true })).toHaveCount(1)
  await expect(page.getByText('You’re playing', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Book', exact: true })).toHaveCount(0)
  await page.screenshot({ path: test.info().outputPath('ownership-slots-en.png'), fullPage: true })
  f.healthy()
})

test('availability and booking confirmation open while personal policy reads are pending', async ({ page }) => {
  const f = await fixture(page)
  const policyRead = gate()
  let pendingReads = 0
  await page.route(/\/rpc\/list_my_(?:bookings|matches)$/, async route => {
    pendingReads++
    await policyRead.promise
    await route.fallback()
  })
  await f.login()
  await page.goto(`/pitch/${pitchId}`)
  await expect.poll(() => pendingReads).toBe(2)
  await expect(page.getByRole('heading', { name: 'Choose your time', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Book', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Confirm booking', exact: true })
  await expect(dialog).toBeVisible()
  expect(f.state.bookingRequests).toBe(0)
  policyRead.release()
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  f.healthy()
})

test('booking guidance appears while the membership read is still pending', async ({ page }) => {
  const f = await fixture(page)
  f.state.bookings = [f.booking]
  const membershipRead = gate()
  await page.route('**/rpc/list_my_matches', async route => { await membershipRead.promise; await route.fallback() })
  await f.login()
  await page.goto(`/pitch/${pitchId}`)
  try {
    await expect(page.locator('#booking-policy')).toContainText('You can book again from')
    await expect(page.getByRole('button', { name: 'Book later', exact: true })).toBeDisabled()
    expect(f.state.availabilityReads).toBe(1)
  } finally {
    membershipRead.release()
  }
  f.healthy()
})

test('late membership updates the slot to You’re playing without refetching availability', async ({ page }) => {
  const f = await fixture(page)
  f.state.availability = [{ ...f.booking, booked_by_me: false, match_open: true, match_id: laterId, is_available: false }]
  f.state.matches = [{ ...f.booking, member_role: 'player', visibility: 'open', match_id: laterId }]
  const membershipRead = gate()
  await page.route('**/rpc/list_my_matches', async route => { await membershipRead.promise; await route.fallback() })
  await f.login()
  await page.goto(`/pitch/${pitchId}`)
  await expect(page.getByText('Open match', { exact: true })).toBeVisible()
  expect(f.state.availabilityReads).toBe(1)
  membershipRead.release()
  await expect(page.getByText('You’re playing', { exact: true })).toBeVisible()
  await expect(page.getByText('Open match', { exact: true })).toHaveCount(0)
  expect(f.state.availabilityReads).toBe(1)
  f.healthy()
})

test('booking waits for authoritative confirmation, prevents double submit, and updates ownership before background reads', async ({ page }) => {
  const f = await fixture(page)
  const bookingGate = gate(), refreshGate = gate()
  let submitted = false
  await page.route('**/rpc/create_booking', async route => {
    f.state.bookingRequests++
    submitted = true
    await bookingGate.promise
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: bookingId, pitch_id: pitchId, starts_at: starts, ends_at: ends, status: 'scheduled' }) })
  })
  await page.route('**/rpc/get_pitch_availability', async route => {
    if (submitted) await refreshGate.promise
    await route.fallback()
  })
  const dialog = await f.openBooking()
  await dialog.getByRole('button', { name: 'Confirm Booking', exact: true }).click()
  const pending = dialog.getByRole('button', { name: 'Booking…', exact: true })
  await expect(pending).toBeDisabled()
  await pending.dispatchEvent('click')
  await expect.poll(() => f.state.bookingRequests).toBe(1)
  await expect(page.getByText('Your booking', { exact: true })).toHaveCount(0)
  // The old global bar appeared after 120ms; hold this request beyond that delay.
  await page.waitForTimeout(200)
  await expect(page.locator('.global-loading-bar')).toHaveCount(0)
  f.state.bookings = [f.booking]
  f.state.availability = [{ ...f.booking, is_available: false }]
  bookingGate.release()
  await expect(page.getByText('Your booking', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'View your booking', exact: true })).toBeVisible()
  await expect(dialog).toHaveCount(0)
  refreshGate.release()
  f.healthy()
})

test('a definite conflict refreshes its slot and never shows ownership or success', async ({ page }) => {
  const f = await fixture(page)
  await page.route('**/rpc/create_booking', async route => {
    f.state.bookingRequests++
    f.state.availability = [{ ...f.booking, booked_by_me: false, is_available: false }]
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'P0001', message: 'slot_unavailable' }) })
  })
  const dialog = await f.openBooking()
  await dialog.getByRole('button', { name: 'Confirm Booking', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('That time was just taken')
  await expect(page.getByText('Your booking', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Booking confirmed', { exact: true })).toHaveCount(0)
  await expect.poll(() => f.state.availabilityReads).toBeGreaterThan(1)
  expect(f.state.bookingRequests).toBe(1)
  f.healthy()
})

test('lost response reconciles a successful booking without sending another create request', async ({ page }) => {
  const f = await fixture(page)
  await page.route('**/rpc/create_booking', async route => {
    f.state.bookingRequests++
    f.state.bookings = [f.booking]
    f.state.availability = [{ ...f.booking, is_available: false }]
    await route.abort('failed')
  })
  const dialog = await f.openBooking()
  await dialog.getByRole('button', { name: 'Confirm Booking', exact: true }).click()
  await expect(page.getByText('Your booking', { exact: true })).toBeVisible()
  await expect(dialog).toHaveCount(0)
  expect(f.state.bookingRequests).toBe(1)
  f.healthy()
})

test('uncertain booking exposes Check booking and holds new writes until its result is resolved', async ({ page }) => {
  const f = await fixture(page)
  await page.route('**/rpc/create_booking', async route => { f.state.bookingRequests++; await route.abort('failed') })
  const dialog = await f.openBooking()
  await dialog.getByRole('button', { name: 'Confirm Booking', exact: true }).click()
  const check = dialog.getByRole('button', { name: 'Check booking', exact: true })
  await expect(check).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Confirm Booking', exact: true })).toHaveCount(0)
  await expect(page.getByText('Your booking', { exact: true })).toHaveCount(0)
  f.state.bookings = [f.booking]
  f.state.availability = [{ ...f.booking, is_available: false }]
  await check.click()
  await expect(page.getByText('Your booking', { exact: true })).toBeVisible()
  await expect(dialog).toHaveCount(0)
  expect(f.state.bookingRequests).toBe(1)
  f.healthy()
})

test('activity merges by time, deduplicates hosted bookings, and separates history', async ({ page }) => {
  const f = await fixture(page)
  f.state.bookings = [
    { ...f.booking, booking_id: laterId, pitch_name: 'Later booking', starts_at: atHour(5), ends_at: atHour(6) },
    { ...f.booking, booking_id: historyId, pitch_name: 'Finished booking', starts_at: atHour(-3), ends_at: atHour(-2), lifecycle_status: 'completed' },
    { ...f.booking, booking_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', pitch_name: 'Cancelled booking', starts_at: atHour(4), ends_at: atHour(5), booking_status: 'cancelled', lifecycle_status: 'cancelled' },
    { ...f.booking, pitch_name: 'Hosted booking' }
  ]
  f.state.matches = [
    { ...f.booking, booking_id: bookingId, pitch_name: 'Duplicate hosted match', member_role: 'organizer', visibility: 'open' },
    { ...f.booking, booking_id: '88888888-8888-4888-8888-888888888888', pitch_name: 'Earlier joined game', starts_at: atHour(1), ends_at: atHour(2), member_role: 'player', visibility: 'open' }
  ]
  await f.login()
  await page.goto('/bookings')
  const activity = page.locator('.activity-page')
  await expect(activity.locator('.next-activity')).toContainText('Earlier joined game')
  await expect(activity.locator('.next-activity')).toContainText('Joined')
  await expect(activity.locator('.activity-list h2')).toHaveText(['Hosted booking', 'Later booking'])
  await expect(activity.getByText('Hosting', { exact: true })).toHaveCount(1)
  await expect(activity.getByText('Duplicate hosted match', { exact: true })).toHaveCount(0)
  await expect(activity.getByText('Finished booking', { exact: true })).toHaveCount(0)
  await expect(activity.getByText('Cancelled booking', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: test.info().outputPath('activity-en.png'), fullPage: true })
  await page.getByRole('navigation', { name: 'Activity view', exact: true }).getByRole('link', { name: 'History', exact: true }).click()
  await expect(activity.getByText('Finished booking', { exact: true })).toBeVisible()
  await expect(activity.getByText('Finished', { exact: true })).toBeVisible()
  await expect(activity.getByText('Cancelled booking', { exact: true })).toBeVisible()
  await expect(activity.getByText('Cancelled', { exact: true })).toBeVisible()
  await expect(activity.getByText('Earlier joined game', { exact: true })).toHaveCount(0)
  f.healthy()
})

for (const delayed of ['list_my_bookings', 'list_my_matches']) {
  test(`activity paints available results while ${delayed} is still pending`, async ({ page }) => {
    const f = await fixture(page)
    f.state.bookings = [{ ...f.booking, pitch_name: 'Owned activity' }]
    f.state.matches = [{ ...f.booking, booking_id: laterId, pitch_name: 'Joined activity', member_role: 'player', visibility: 'open', starts_at: atHour(4), ends_at: atHour(5) }]
    const delayedRead = gate()
    await page.route(`**/rpc/${delayed}`, async route => { await delayedRead.promise; await route.fallback() })
    await f.login()
    await page.goto('/bookings')
    const firstTitle = delayed === 'list_my_bookings' ? 'Joined activity' : 'Owned activity'
    await expect(page.locator('.next-activity')).toContainText(firstTitle)
    await expect(page.locator('.activity-loading')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Your next game is waiting', exact: true })).toHaveCount(0)
    delayedRead.release()
    await expect(page.locator('.activity-page').getByText('Owned activity', { exact: true })).toBeVisible()
    await expect(page.locator('.activity-page').getByText('Joined activity', { exact: true })).toBeVisible()
    f.healthy()
  })

  test(`activity keeps loading after an empty first result until delayed ${delayed} resolves`, async ({ page }) => {
    const f = await fixture(page)
    if (delayed === 'list_my_bookings') f.state.bookings = [{ ...f.booking, pitch_name: 'Delayed owned activity' }]
    else f.state.matches = [{ ...f.booking, booking_id: laterId, pitch_name: 'Delayed joined activity', member_role: 'player', visibility: 'open' }]
    const delayedRead = gate()
    let firstFulfilled = false
    const first = delayed === 'list_my_bookings' ? 'list_my_matches' : 'list_my_bookings'
    await page.route(`**/rpc/${delayed}`, async route => { await delayedRead.promise; await route.fallback() })
    await page.route(`**/rpc/${first}`, async route => {
      await route.fulfill({ contentType: 'application/json', body: '[]' })
      firstFulfilled = true
    })
    await page.addInitScript(() => {
      ;(window as any).prematureActivityEmpty = false
      const observer = new MutationObserver(() => {
        if (document.querySelector('.activity-empty')) (window as any).prematureActivityEmpty = true
      })
      observer.observe(document, { childList: true, subtree: true })
    })
    await f.login()
    await page.goto('/bookings')
    await expect.poll(() => firstFulfilled).toBe(true)
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await expect(page.locator('.activity-loading')).toBeVisible()
    await expect(page.locator('.activity-empty')).toHaveCount(0)
    delayedRead.release()
    await expect(page.locator('.next-activity')).toContainText(delayed === 'list_my_bookings' ? 'Delayed owned activity' : 'Delayed joined activity')
    expect(await page.evaluate(() => (window as any).prematureActivityEmpty)).toBe(false)
    f.healthy()
  })
}

test('cache invalidation prevents an old private response from being reused after identity changes', async ({ page }) => {
  const f = await fixture(page)
  await f.login()
  const result = await page.evaluate(async () => {
    const modulePath = '/src/lib/requestCache.ts'
    const cache = await import(modulePath)
    let release: (value: string) => void = () => undefined
    const oldRequest = cache.cachedRequest('private-identity-fixture', 60_000, () => new Promise(resolve => { release = resolve }))
    cache.clearRequestCache()
    cache.setCachedValue('private-identity-fixture', 'new account', 60_000)
    release('old account')
    await oldRequest
    return cache.peekCachedValue('private-identity-fixture')
  })
  expect(result).toBe('new account')
  f.healthy()
})

test('same-user account refresh preserves the current screen without global progress', async ({ page }) => {
  const f = await fixture(page)
  await f.login()
  const contextGate = gate()
  let pending = false
  await page.route('**/rpc/get_my_session_context', async route => {
    pending = true
    await contextGate.promise
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([f.account]) })
  })
  await page.evaluate(() => {
    const modulePath = '/src/lib/authBootstrap.ts'
    void import(modulePath).then(module => module.retryAuthBootstrap())
  })
  await expect.poll(() => pending).toBe(true)
  await expect(page.getByRole('heading', { name: 'Play today', exact: true })).toBeVisible()
  await expect(page.locator('.account-loading')).toHaveCount(0)
  await page.waitForTimeout(200)
  await expect(page.locator('.global-loading-bar')).toHaveCount(0)
  contextGate.release()
  await expect(page.getByRole('heading', { name: 'Play today', exact: true })).toBeVisible()
  f.healthy()
})

test('same-user refresh failure keeps known account content and retry recovers inline', async ({ page }) => {
  const f = await fixture(page)
  await f.login()
  let requests = 0
  await page.route('**/rpc/get_my_session_context', async route => {
    requests++
    if (requests === 1) return route.abort('failed')
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([f.account]) })
  })
  await page.evaluate(async () => {
    const modulePath = '/src/lib/authBootstrap.ts'
    const { retryAuthBootstrap } = await import(modulePath)
    await retryAuthBootstrap()
  })
  await expect(page).toHaveURL(/\/home$/)
  await expect(page.getByRole('heading', { name: 'Play today', exact: true })).toBeVisible()
  const notice = page.locator('.account-refresh-notice')
  await expect(notice).toContainText('Couldn’t refresh your account')
  await expect(page.locator('.global-loading-bar')).toHaveCount(0)
  await notice.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(notice).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Play today', exact: true })).toBeVisible()
  expect(requests).toBe(2)
  f.healthy()
})

test('sign-out invalidates a pending different-account response and clears prior identity', async ({ page }) => {
  const f = await fixture(page)
  await f.login()
  const secondUid = '99999999-9999-4999-8999-999999999999'
  const secondUser = { ...f.user, id: secondUid, email: 'other.student@example.com' }
  const exp = Math.floor(Date.now() / 1000) + 3600
  const token = [{ alg: 'HS256', typ: 'JWT' }, { sub: secondUid, aud: 'authenticated', role: 'authenticated', exp }, 'fixture'].map(item => Buffer.from(typeof item === 'string' ? item : JSON.stringify(item)).toString('base64url')).join('.')
  const contextGate = gate()
  let pending = false
  await page.route('**/auth/v1/user', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(secondUser) }))
  await page.route('**/rpc/get_my_session_context', async route => {
    pending = true
    await contextGate.promise
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ ...f.account, user_id: secondUid, id: secondUid, full_name: 'Other Test User', username: 'other_test_user' }]) })
  })
  await page.evaluate(async accessToken => {
    const modulePath = '/src/lib/supabaseClient.ts'
    const { supabase } = await import(modulePath)
    await supabase.auth.setSession({ access_token: accessToken, refresh_token: 'second-fictional-refresh' })
  }, token)
  await expect.poll(() => pending).toBe(true)
  await expect(page.getByText('Hi Test', { exact: true })).toHaveCount(0)
  await page.evaluate(async () => {
    const modulePath = '/src/lib/supabaseClient.ts'
    const { supabase } = await import(modulePath)
    await supabase.auth.signOut({ scope: 'local' })
  })
  contextGate.release()
  await expect.poll(() => page.evaluate(async () => {
    const modulePath = '/src/lib/stores/auth.ts'
    const { authState } = await import(modulePath)
    let current: any
    authState.subscribe((value: any) => { current = value })()
    return { user: current.user, account: current.account, loading: current.loading }
  })).toEqual({ user: null, account: null, loading: false })
  await expect(page.getByText('Other Test User', { exact: true })).toHaveCount(0)
  f.healthy()
})

test('a new account resolves before an old account refresh and cannot be overwritten by it', async ({ page }) => {
  const f = await fixture(page)
  await f.login()
  const secondUid = '99999999-9999-4999-8999-999999999999'
  const secondUser = { ...f.user, id: secondUid, email: 'other.student@example.com' }
  const exp = Math.floor(Date.now() / 1000) + 3600
  const token = [{ alg: 'HS256', typ: 'JWT' }, { sub: secondUid, aud: 'authenticated', role: 'authenticated', exp }, 'fixture'].map(item => Buffer.from(typeof item === 'string' ? item : JSON.stringify(item)).toString('base64url')).join('.')
  const oldContext = gate()
  let requests = 0
  await page.route('**/auth/v1/user', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(secondUser) }))
  await page.route('**/rpc/get_my_session_context', async route => {
    requests++
    if (requests === 1) {
      await oldContext.promise
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify([f.account]) })
    } else {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ ...f.account, user_id: secondUid, id: secondUid, full_name: 'Other Test User', username: 'other_test_user' }]) })
    }
  })
  await page.evaluate(() => {
    const modulePath = '/src/lib/authBootstrap.ts'
    ;(window as any).pendingOldAccount = import(modulePath).then(module => module.retryAuthBootstrap())
  })
  await expect.poll(() => requests).toBe(1)
  await page.evaluate(async accessToken => {
    const modulePath = '/src/lib/supabaseClient.ts'
    const { supabase } = await import(modulePath)
    await supabase.auth.setSession({ access_token: accessToken, refresh_token: 'second-fictional-refresh' })
  }, token)
  await expect.poll(() => requests).toBe(2)
  await expect(page.getByText('Hi Other', { exact: true })).toBeVisible()
  await expect(page.getByText('Hi Test', { exact: true })).toHaveCount(0)
  oldContext.release()
  await page.evaluate(() => (window as any).pendingOldAccount)
  await expect(page.getByText('Hi Other', { exact: true })).toBeVisible()
  f.healthy()
})

test('public language switch updates landing content and legal navigation at narrow widths', async ({ page }) => {
  const f = await fixture(page)
  await page.setViewportSize({ width: 320, height: 680 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Book. Play. Meet.', exact: true })).toBeVisible()
  const header = page.locator('.public-header')
  await header.getByRole('button', { name: 'Language', exact: true }).click()
  await header.getByRole('button', { name: 'العربية', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'احجز. العب. تعارف.', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'ابدأ الآن', exact: true })).toHaveAttribute('href', '/login')
  const legal = page.getByRole('navigation', { name: 'روابط قانونية', exact: true })
  await expect(legal.getByRole('link', { name: 'الخصوصية', exact: true })).toHaveAttribute('href', '/privacy')
  await expect(legal.getByRole('link', { name: 'الشروط', exact: true })).toHaveAttribute('href', '/terms')
  await header.getByRole('button', { name: 'التبديل إلى الوضع الداكن', exact: true }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: test.info().outputPath('landing-ar-dark-320.png'), fullPage: true })
  f.healthy()
})
