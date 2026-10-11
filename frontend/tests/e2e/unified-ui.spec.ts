import { test, expect, type Page } from '@playwright/test'

test('dismissed update stays available in Menu with one update action', async ({ page }) => {
  await page.addInitScript(() => {
    const waiting = { postMessage() { (window as any).updateRequests = ((window as any).updateRequests || 0) + 1 } }
    const registration = Object.assign(new EventTarget(), { waiting, installing: null, update: async () => undefined })
    Object.defineProperty(navigator, 'serviceWorker', { value: Object.assign(new EventTarget(), { controller: {}, ready: Promise.resolve(registration), register: async () => registration }) })
  })
  const f = await fixture(page)
  await f.login()
  await page.getByRole('status', { name: 'UNEEM update ready' }).getByRole('button', { name: 'Later', exact: true }).click()
  await page.getByRole('link', { name: 'Menu', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Menu', exact: true })).toBeVisible()
  await expect(page.getByRole('status', { name: 'UNEEM update ready' })).toHaveCount(0)
  const update = page.getByRole('button', { name: 'Update UNEEM', exact: true })
  await expect(update).toHaveCount(1)
  await update.click()
  expect(await page.evaluate(() => (window as any).updateRequests)).toBe(1)
  await expect(update).toBeDisabled()
  expect(f.errors).toEqual([])
})

async function fixture(page: Page, admin = false) {
  const uid = '11111111-1111-4111-8111-111111111111'
  const pitchId = '44444444-4444-4444-8444-444444444444'
  const bookingId = '55555555-5555-4555-8555-555555555555'
  const now = new Date().toISOString()
  const starts = new Date(Date.now() + 2 * 3600_000).toISOString()
  const ends = new Date(Date.now() + 3 * 3600_000).toISOString()
  const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.com', email_confirmed_at: now, app_metadata: { provider: 'email' }, user_metadata: {} }
  const exp = Math.floor(Date.now() / 1000) + 3600
  const token = [{ alg: 'HS256', typ: 'JWT' }, { sub: uid, aud: 'authenticated', role: 'authenticated', exp }, 'fixture'].map(x => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url')).join('.')
  const session = { access_token: token, refresh_token: 'fixture-refresh', expires_in: 3600, expires_at: exp, token_type: 'bearer', user }
  const account = { user_id: uid, id: uid, full_name: 'Test User', username: 'test_user', student_id: 'S123', role: admin ? 'admin' : 'student', access_status: 'approved', status: 'approved', email_kind: 'personal', identity_status: 'verified', can_use_sports: true, needs_identity_action: false, created_at: now, updated_at: now }
  const facility = { id: pitchId, name: 'University football pitch', location: 'University campus · Student sports centre', capacity: 22, sport_type: 'football', open_time: '08:00', close_time: '22:00', timezone: 'Africa/Casablanca', booking_frequency_enabled: false, booking_frequency_days: 1, slot_duration_minutes: 60, booking_window_hours: 24, cancellation_cutoff_minutes: 0, is_active: true, sort_order: 0 }
  const booking = { booking_id: bookingId, pitch_id: pitchId, pitch_name: facility.name, pitch_location: facility.location, pitch_capacity: 22, pitch_timezone: facility.timezone, location: facility.location, timezone: facility.timezone, starts_at: starts, ends_at: ends, booking_status: 'scheduled', lifecycle_status: 'upcoming', booker_id: uid, booker_name: 'Test Organizer', booker_username: 'test_organizer', capacity: 22, booked_by_me: false, match_id: '66666666-6666-4666-8666-666666666666', match_open: true, match_visibility: 'open', reserved_spots: 3, joined_count: 5, spots_left: 13, participant_by_me: false, reserved_by_me: false, created_at: now }
  const errors: string[] = []
  const unhandled: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*.supabase.co/**', async route => {
    const req = route.request(), url = new URL(req.url()), key = url.pathname.split('/').at(-1)!
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (key === 'settings') return json({ external: { google: true, facebook: true } })
    if (key === 'token') return json(session)
    if (key === 'user') return json(user)
    if (key === 'logout') return route.fulfill({ status: 204 })
    if (['get_my_session_context', 'get_my_account_state'].includes(key)) return json([account])
    if (key === 'profiles') return json(account)
    if (key === 'pitches') return json(url.searchParams.has('id') ? facility : [facility])
    if (['get_next_booking','list_my_bookings','list_my_matches','announcement_dismissals','list_identity_verification_queue','admin_list_support_threads','list_my_support_threads'].includes(key)) return json([])
    if (key === 'announcements') return json([{ id:'announcement-fixture', title_en:'Evening football',title_ar:'كرة القدم المسائية',body_en:'The football pitch is open this evening.',body_ar:'ملعب كرة القدم متاح هذا المساء.',published_at:now,expires_at:null,is_active:true,created_at:now }])
    if (key === 'get_pitch_availability') return json([
      { ...booking, is_available:false },
      { ...booking, booking_id:null, match_id:null, match_open:false, is_available:true, starts_at:ends, ends_at:new Date(Date.now()+4*3600_000).toISOString() }
    ])
    if (key === 'list_open_matches') return json([{ ...booking, organizer_id:uid, organizer_name:booking.booker_name, organizer_username:booking.booker_username, organized_by_me:false, joined_by_me:false }])
    if (key === 'get_booking_details') return json([booking])
    if (key === 'list_booking_roster') return json([{ entry_id:uid, user_id:uid,display_name:booking.booker_name,username:booking.booker_username,member_role:'organizer',source:'account',joined_at:now }])
    if (key === 'create_booking') return json({ code:'P0001', message:'slot_unavailable' },400)
    if (key === 'admin_list_users') return json([{ ...account, total_count:1 }])
    if (key === 'admin_list_bookings') return json([{ ...booking, user_id:uid, full_name:account.full_name, student_id:'S123',email:user.email,total_count:1 }])
    unhandled.push(`${req.method} ${key}`)
    return json({ message:`Unhandled ${key}` },400)
  })
  async function login(path = '/login') {
    await page.goto(path)
    await page.getByLabel('Email address',{exact:true}).fill(user.email)
    await page.getByLabel('Password',{exact:true}).fill('Fixture123!')
    await page.getByRole('button',{name:'Sign in',exact:true}).click()
    await page.waitForURL(url => url.pathname === (path !== '/login' ? path : admin ? '/admin' : '/home'))
  }
  return { login, errors, unhandled, pitchId, bookingId, booking, facility }
}

async function fits(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    layoutWidth: innerWidth,
    noOverflow: document.documentElement.scrollWidth <= innerWidth
  }))).toEqual({layoutWidth:page.viewportSize()!.width,noOverflow:true})
}

test('Home keeps facilities in place while an empty next booking resolves', async ({ page }) => {
  const f = await fixture(page)
  let releaseBooking: () => void = () => undefined
  const bookingGate = new Promise<void>(resolve => { releaseBooking = resolve })
  await page.route('**/rpc/get_next_booking', async route => {
    await bookingGate
    await route.fulfill({ contentType: 'application/json', body: '[]' })
  })
  await f.login()
  await expect(page.getByRole('heading', { name: 'Play today' })).toBeVisible()
  await expect(page.locator('.loading-card')).toBeVisible()
  await expect(page.getByRole('link', { name: /View times/ })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  const facilities = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Facilities', exact: true }) })
  const before = (await facilities.boundingBox())!.y
  releaseBooking()
  await expect(page.getByRole('heading', { name: 'No booking yet', exact: true })).toBeVisible()
  expect(Math.abs((await facilities.boundingBox())!.y - before)).toBeLessThan(1)
  await fits(page)
  expect(f.errors).toEqual([])
  expect(f.unhandled).toEqual([])
})

test('Home shows open matches after facilities without blocking facility loading', async ({ page }) => {
  const f = await fixture(page)
  let releaseMatches: () => void = () => undefined
  const gate = new Promise<void>(resolve => { releaseMatches = resolve })
  await page.route('**/rpc/list_open_matches', async route => { await gate; await route.fallback() })
  await f.login()
  const section = page.getByRole('region', { name: 'Open matches', exact: true })
  await expect(page.getByRole('link', { name: /View times/ })).toBeVisible()
  await expect(section.getByLabel('Loading matches', { exact: true })).toBeVisible()
  await expect(page.locator('.home-header').getByRole('link')).toHaveCount(0)
  const facilities = page.getByRole('region', { name: 'Facilities', exact: true })
  expect((await section.boundingBox())!.y).toBeGreaterThan((await facilities.boundingBox())!.y)
  releaseMatches()
  const match = section.getByRole('link', { name: /Join match/ })
  await expect(match).toHaveCount(1)
  await expect(match).toHaveAttribute('href', `/bookings/${f.bookingId}`)
  await expect(section.getByText('13 spots left', { exact: true })).toBeVisible()
  await expect(section.getByRole('searchbox')).toHaveCount(0)
  await expect(section.getByRole('combobox')).toHaveCount(0)
  await fits(page)
  await match.click()
  await expect(page.getByRole('heading', { name: 'Match details' })).toBeVisible()
  expect(f.errors).toEqual([])
  expect(f.unhandled).toEqual([])
})

test('Home match errors retry inline and empty matches remain below facilities', async ({ page }) => {
  const f = await fixture(page)
  let requests = 0
  await page.route('**/rpc/list_open_matches', route => {
    requests += 1
    return route.fulfill({ status: requests === 1 ? 500 : 200, contentType: 'application/json', body: requests === 1 ? JSON.stringify({ message: 'Temporary failure' }) : '[]' })
  })
  await f.login()
  const section = page.getByRole('region', { name: 'Open matches', exact: true })
  await expect(section.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('link', { name: /View times/ })).toBeVisible()
  await section.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(section.getByRole('heading', { name: 'No open matches yet' })).toBeVisible()
  await expect(section.getByRole('alert')).toHaveCount(0)
  await fits(page)
  expect(requests).toBe(2)
  expect(f.errors).toEqual([])
})

test('open-match organizer can find a registered friend without kicking joined players', async ({ page }) => {
  const f = await fixture(page)
  f.booking.booked_by_me = true
  f.booking.joined_count = 1
  f.booking.reserved_spots = 1
  f.booking.spots_left = 19
  const playerId = '77777777-7777-4777-8777-777777777777'
  const reservations: unknown[] = []
  await page.route('**/rpc/list_booking_roster', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify([
    { entry_id: f.booking.booker_id, user_id: f.booking.booker_id, display_name: 'Test Organizer', username: 'test_organizer', member_role: 'organizer', source: 'account', joined_at: new Date().toISOString() },
    { entry_id: playerId, user_id: playerId, display_name: 'Test Player', username: 'test_player', member_role: 'player', source: 'account', joined_at: new Date().toISOString() },
    { entry_id: 'reservation:guest', reservation_id: '99999999-9999-4999-8999-999999999999', user_id: null, display_name: 'Test Guest', username: null, member_role: 'reserved', source: 'guest', joined_at: new Date().toISOString() }
  ]) }))
  await page.route('**/rpc/search_usernames', route => {
    expect(route.request().postDataJSON().p_query).toBe('test')
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ user_id: playerId, username: 'test_friend', full_name: 'Test Friend' }]) })
  })
  await page.route('**/rpc/add_match_reservation', route => {
    reservations.push(route.request().postDataJSON())
    f.booking.reserved_spots += 1
    f.booking.spots_left -= 1
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: '88888888-8888-4888-8888-888888888888', profile_id: playerId, created_at: new Date().toISOString() }) })
  })
  await f.login()
  await page.goto(`/bookings/${f.bookingId}`)
  await expect(page.getByRole('heading', { name: 'Manage your match' })).toBeVisible()
  const visibility = page.getByRole('switch', { name: 'Open to players' })
  await expect(visibility).toBeEnabled()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Remove.*Test Player/ })).toHaveCount(0)
  await expect(page.getByLabel('Search username', { exact: true })).toHaveCount(0)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.locator('h1').click()
  await page.screenshot({ path: test.info().outputPath('organizer-overview.png'), fullPage: true })
  await visibility.click()
  await expect(page.getByRole('alert')).toContainText('You can’t close this match after players have joined.')
  await expect(visibility).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('button', { name: 'Cancel booking', exact: true }).click()
  await expect(page.locator('.cancellation-error')).toContainText('You can’t cancel this match after players have joined.')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Add player', exact: true }).click()
  const reserve = page.getByRole('button', { name: 'Reserve a spot' })
  await expect(reserve).toBeDisabled()
  await page.getByLabel('Search username', { exact: true }).fill('test')
  await page.getByRole('option', { name: /test_friend/ }).click()
  await expect(reserve).toBeEnabled()
  await reserve.click()
  await expect.poll(() => reservations.length).toBe(1)
  expect(reservations[0]).toMatchObject({ p_username: 'test_friend', p_guest_name: null })
  await page.getByRole('button', { name: 'Add a guest', exact: true }).click()
  await expect(page.getByLabel('Guest name', { exact: true })).toBeVisible()
  await fits(page)
  await page.screenshot({ path: test.info().outputPath('organizer-details.png'), fullPage: true })
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByLabel('Guest name', { exact: true })).toHaveCount(0)
  await page.goto('/menu')
  await page.getByRole('button', { name: 'العربية', exact: true }).click()
  await page.goto(`/bookings/${f.bookingId}`)
  await expect(page.getByRole('heading', { name: 'إدارة مباراتك', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'إضافة لاعب', exact: true }).click()
  await expect(page.getByLabel('ابحث باسم المستخدم', { exact: true })).toBeVisible()
  await fits(page)
  expect(f.errors).toEqual([])
  expect(f.unhandled).toEqual([])
})

test('owner cancellation remains available before anyone joins', async ({ page }) => {
  const f = await fixture(page)
  f.booking.booked_by_me = true
  f.booking.joined_count = 0
  let cancelled = 0
  await page.route('**/rpc/cancel_booking', route => {
    cancelled += 1
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: f.bookingId, status: 'cancelled' }) })
  })
  await f.login()
  await page.goto(`/bookings/${f.bookingId}`)
  await page.getByRole('button', { name: 'Cancel booking', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Cancel this booking?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel booking', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Choose your time' })).toBeVisible()
  expect(cancelled).toBe(1)
  expect(f.errors).toEqual([])
  expect(f.unhandled).toEqual([])
})

test('cancellation rechecks players who joined while confirmation was open', async ({ page }) => {
  const f = await fixture(page)
  f.booking.booked_by_me = true
  f.booking.joined_count = 0
  await f.login()
  await page.goto(`/bookings/${f.bookingId}`)
  await page.getByRole('button', { name: 'Cancel booking', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Cancel this booking?' })
  await expect(dialog).toBeVisible()
  f.booking.joined_count = 1
  await dialog.getByRole('button', { name: 'Cancel booking', exact: true }).click()
  await expect(page.locator('.cancellation-error')).toBeVisible()
  await expect(dialog).toHaveCount(0)
  expect(f.unhandled).toEqual([])
  expect(f.errors).toEqual([])
})

test('simple match list leads to details and shows join before the roster', async ({ page }) => {
  const f = await fixture(page)
  await f.login()
  await page.goto('/matches')
  await expect(page.getByRole('searchbox')).toHaveCount(0)
  await expect(page.getByRole('combobox')).toHaveCount(0)
  const link = page.getByRole('link', { name: /Join match:/ })
  await expect(link).toHaveCount(1)
  await page.screenshot({ path: test.info().outputPath('simple-matches.png'), fullPage: true })
  await link.click()
  const join = page.getByRole('button', { name: 'Join match', exact: true })
  const players = page.getByRole('heading', { name: 'Players', exact: true })
  await expect(join).toBeEnabled()
  expect((await join.boundingBox())!.y).toBeLessThan((await players.boundingBox())!.y)
  await expect(page.locator('.open-match-rules')).toContainText('no organizer approval')
  await fits(page)
  await page.screenshot({ path: test.info().outputPath('player-details.png'), fullPage: true })
  await page.goto('/menu')
  await page.getByRole('button', { name: 'العربية', exact: true }).click()
  await page.goto(`/bookings/${f.bookingId}`)
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('button', { name: 'انضم', exact: true })).toBeEnabled()
  await fits(page)
  expect(f.errors).toEqual([])
})

test('My Sports includes joined matches even without an owned booking', async ({ page }) => {
  const f = await fixture(page)
  await page.route('**/rpc/list_my_matches', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ ...f.booking, member_role: 'player', visibility: 'open', organizer_name: 'Test Organizer' }]) }))
  await f.login()
  await page.goto('/bookings')
  const joined = page.getByRole('region', { name: 'Matches you’re playing' })
  await expect(joined.getByRole('link', { name: /View match/ })).toHaveAttribute('href', `/bookings/${f.bookingId}`)
  await expect(joined.getByText('You’re playing', { exact: true })).toBeVisible()
  await expect(page.locator('.sports-summary')).toContainText('1Matches you joined')
  await fits(page)
  await page.screenshot({ path: test.info().outputPath('my-sports-joined.png'), fullPage: true })
  await joined.getByRole('link').click()
  await expect(page.getByRole('heading', { name: 'Match details' })).toBeVisible()
  expect(f.errors).toEqual([])
  expect(f.unhandled).toEqual([])
})

test('slot restrictions appear once and blocked slots use a neutral later action', async ({ page }) => {
  const f = await fixture(page)
  await page.route('**/rpc/list_my_bookings', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify([f.booking]) }))
  await page.route('**/rpc/get_pitch_availability', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify([0, 1, 2].map(offset => ({
    ...f.booking, booking_id: null, match_id: null, match_open: false, is_available: true,
    starts_at: new Date(Date.now() + (4 + offset) * 3600_000).toISOString(),
    ends_at: new Date(Date.now() + (5 + offset) * 3600_000).toISOString()
  }))) }))
  await f.login()
  await page.goto(`/pitch/${f.pitchId}`)
  const policy = page.locator('#booking-policy')
  await expect(policy).toHaveCount(1)
  await expect(policy).toContainText('You can book again from')
  await expect(policy).toContainText('You already have an upcoming or current booking.')
  await expect(policy.getByRole('link', { name: 'You can still join an open match' })).toHaveAttribute('href', '/matches')
  await expect(policy).toContainText(/\d{2}:\d{2}/)
  await expect(page.getByText('You can book again from', { exact: false })).toHaveCount(1)
  await expect(page.getByText('Available', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Book', exact: true })).toHaveCount(0)
  const later = page.getByRole('button', { name: 'Book later', exact: true })
  await expect(later).toHaveCount(3)
  for (const button of await later.all()) {
    await expect(button).toBeDisabled()
    await expect(button).toHaveAttribute('aria-describedby', 'booking-policy')
  }
  expect((await policy.boundingBox())!.y).toBeLessThan((await page.locator('article').first().boundingBox())!.y)
  await fits(page)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: test.info().outputPath('slots-policy-once.png'), fullPage: true })
  await page.goto('/menu')
  await page.getByRole('button', { name: 'العربية', exact: true }).click()
  await page.goto(`/pitch/${f.pitchId}`)
  await expect(page.locator('#booking-policy')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'احجز لاحقاً', exact: true })).toHaveCount(3)
  await fits(page)
  expect(f.errors).toEqual([])
  expect(f.unhandled).toEqual([])
})

test('booking frequency restricts creating a booking but still allows joining an open match', async ({ page }) => {
  const f = await fixture(page)
  f.facility.booking_frequency_enabled = true
  f.facility.booking_frequency_days = 7
  f.booking.booker_id = '99999999-9999-4999-8999-999999999999'
  const previousStart = new Date(Date.now() - 2 * 3600_000).toISOString()
  await page.route('**/rpc/list_my_bookings', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify([{
    ...f.booking, booking_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', starts_at: previousStart,
    ends_at: new Date(Date.now() - 3600_000).toISOString(), booked_by_me: true, lifecycle_status: 'completed'
  }]) }))
  let joins = 0
  await page.route('**/rpc/join_open_match', route => {
    expect(route.request().postDataJSON().p_match_id).toBe(f.booking.match_id)
    joins += 1
    f.booking.participant_by_me = true
    f.booking.joined_count += 1
    f.booking.spots_left -= 1
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ match_id: f.booking.match_id, user_id: '11111111-1111-4111-8111-111111111111' }) })
  })
  await f.login()
  await page.goto(`/pitch/${f.pitchId}`)
  const policy = page.locator('#booking-policy')
  await expect(policy).toContainText('This facility allows one booking every 7 days.')
  await expect(policy).toContainText('Choose a slot starting after')
  await expect(policy).toContainText('Slots appear 24 hours before they start.')
  await expect(page.getByRole('button', { name: 'Book later', exact: true })).toBeDisabled()
  await fits(page)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: test.info().outputPath('frequency-and-join.png'), fullPage: true })
  await policy.getByRole('link', { name: 'You can still join an open match' }).click()
  await page.getByRole('link', { name: /Join match:/ }).click()
  const join = page.getByRole('button', { name: 'Join match', exact: true })
  await expect(join).toBeEnabled()
  await join.click()
  await expect(page.getByText('You’re playing in this match', { exact: true })).toBeVisible()
  expect(joins).toBe(1)
  expect(f.errors).toEqual([])
  expect(f.unhandled).toEqual([])
})

test('compact slots, booking error recovery, grouped Menu and invite link fallback', async ({page}) => {
  const f = await fixture(page)
  await f.login()
  await expect(page.getByRole('heading',{name:'Play today'})).toBeVisible()
  await page.getByRole('link',{name:/View times/}).click()
  await expect(page.getByRole('heading',{name:'Choose your time'})).toBeVisible()
  const available = page.locator('article').filter({has:page.getByRole('button',{name:'Book',exact:true})})
  await expect(available).toBeVisible()
  await expect(page.getByText('Available', { exact: true })).toHaveCount(0)
  expect((await available.boundingBox())!.height).toBeLessThan(200)
  const card = (await available.boundingBox())!, action = (await available.getByRole('button',{name:'Book',exact:true}).boundingBox())!
  expect(action.width).toBeGreaterThan(card.width - 40)
  await fits(page)
  await available.getByRole('button',{name:'Book',exact:true}).click()
  const dialog = page.getByRole('dialog',{name:'Confirm booking'})
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button',{name:'Confirm Booking',exact:true}).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await dialog.getByRole('button',{name:'Close',exact:true}).click()
  await expect(dialog).not.toBeVisible()
  await page.getByRole('link',{name:'Menu',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Menu',exact:true})).toBeVisible()
  await expect(page.getByRole('navigation',{name:'Navigation menu'})).toHaveCount(0)
  await page.getByRole('button',{name:'Dark',exact:true}).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.getByRole('button',{name:'العربية',exact:true}).click()
  await expect(page.locator('html')).toHaveAttribute('dir','rtl')
  await fits(page)
  await page.evaluate(() => window.scrollTo(0,0))
  await page.screenshot({path:test.info().outputPath('menu-ar-dark.png'),fullPage:true})
  await page.getByRole('button',{name:'English',exact:true}).click()
  await page.getByRole('button',{name:'Light',exact:true}).click()
  await page.goto('/matches')
  await expect(page.getByRole('heading',{name:'Open matches',exact:true})).toBeVisible()
  await page.getByRole('link',{name:/Join match/}).click()
  await expect(page.getByRole('heading',{name:'Match details'})).toBeVisible()
  await page.evaluate(() => {
    Object.defineProperty(navigator,'share',{configurable:true,value:undefined})
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined})
  })
  await page.getByRole('button',{name:'Invite friends',exact:true}).click()
  await expect(page.getByRole('dialog',{name:'Match link'})).toBeVisible()
  await expect(page.getByRole('textbox')).toHaveValue(new URL(`/bookings/${f.bookingId}`,page.url()).href)
  await fits(page)
  await page.getByRole('dialog',{name:'Match link'}).getByRole('button',{name:'Close',exact:true}).click()
  await page.setViewportSize({width:320,height:568})
  await page.goto(`/pitch/${f.pitchId}`)
  await expect(page.getByRole('heading',{name:'Choose your time'})).toBeVisible()
  await fits(page)
  await page.screenshot({path:test.info().outputPath('pitch-320.png'),fullPage:true})
  expect(f.errors).toEqual([])
  expect(f.unhandled).toEqual([])
})

test('match invite returns to the shared booking after sign-in',async ({page}) => {
  const f = await fixture(page)
  await f.login(`/bookings/${f.bookingId}`)
  await expect(page).toHaveURL(new RegExp(`/bookings/${f.bookingId}$`))
  await expect(page.getByRole('button',{name:'Invite friends',exact:true})).toBeVisible()
  expect(f.unhandled).toEqual([])
  expect(f.errors).toEqual([])
})

test('admin routes share responsive controls and the facility dialog fits a short viewport',async ({page}) => {
  const f = await fixture(page,true)
  await f.login()
  await expect(page.getByRole('heading',{name:'Admin',exact:true})).toBeVisible()
  for (const route of ['bookings','users','verification','support','notifications','pitches']) {
    await page.goto(`/admin/${route}`)
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
    await fits(page)
  }
  await page.getByRole('button',{name:'Edit: University football pitch',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await page.setViewportSize({width:320,height:420})
  await fits(page)
  await expect.poll(async () => {
    const box=(await dialog.boundingBox())!
    return box.y >= 0 && box.y+box.height <= 421
  }).toBe(true)
  await expect.poll(() => dialog.locator('.ui-dialog-body').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
  await page.screenshot({path:test.info().outputPath('admin-facility-320.png'),fullPage:true})
  await dialog.getByRole('button',{name:'Close',exact:true}).click()
  expect(f.unhandled).toEqual([])
  expect(f.errors).toEqual([])
})
