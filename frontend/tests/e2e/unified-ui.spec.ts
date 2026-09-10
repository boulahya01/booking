import { test, expect, type Page } from '@playwright/test'

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
  const account = { user_id: uid, id: uid, full_name: 'Yasmine El Amrani', username: 'yasmine', student_id: 'S123', role: admin ? 'admin' : 'student', access_status: 'approved', status: 'approved', email_kind: 'personal', identity_status: 'verified', can_use_sports: true, needs_identity_action: false, created_at: now, updated_at: now }
  const facility = { id: pitchId, name: 'University football pitch', location: 'University campus · Student sports centre', capacity: 22, sport_type: 'football', open_time: '08:00', close_time: '22:00', timezone: 'Africa/Casablanca', booking_frequency_enabled: false, booking_frequency_days: 1, slot_duration_minutes: 60, booking_window_hours: 24, cancellation_cutoff_minutes: 0, is_active: true, sort_order: 0 }
  const booking = { booking_id: bookingId, pitch_id: pitchId, pitch_name: facility.name, pitch_location: facility.location, pitch_capacity: 22, pitch_timezone: facility.timezone, location: facility.location, timezone: facility.timezone, starts_at: starts, ends_at: ends, booking_status: 'scheduled', lifecycle_status: 'upcoming', booker_id: uid, booker_name: 'Mohammed El Idrissi', booker_username: 'mohammed_el_idrissi', capacity: 22, booked_by_me: false, match_id: '66666666-6666-4666-8666-666666666666', match_open: true, match_visibility: 'open', reserved_spots: 3, joined_count: 5, spots_left: 13, participant_by_me: false, reserved_by_me: false, created_at: now }
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
  }
  return { login, errors, unhandled, pitchId, bookingId }
}

async function fits(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    layoutWidth: innerWidth,
    noOverflow: document.documentElement.scrollWidth <= innerWidth
  }))).toEqual({layoutWidth:page.viewportSize()!.width,noOverflow:true})
}

test('compact slots, booking error recovery, grouped Menu and invite link fallback', async ({page}) => {
  const f = await fixture(page)
  await f.login()
  await expect(page.getByRole('heading',{name:'Play today'})).toBeVisible()
  await page.getByRole('link',{name:/View times/}).click()
  await expect(page.getByRole('heading',{name:'Choose your time'})).toBeVisible()
  const available = page.locator('article').filter({has:page.getByText('Available',{exact:true})})
  await expect(available).toBeVisible()
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
  await page.getByRole('link',{name:'View match',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Booking details'})).toBeVisible()
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
