import { test } from '@playwright/test';
import assert from 'node:assert/strict';
// Network fixtures exercise real screens and adapters without touching hosted data.
test('notifications update across routes, roll back failed dismissals and clear on logout', async ({ page }) => {
    const uid = '11111111-1111-4111-8111-111111111111';
    const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'fixture@usmba.ac.ma', email_confirmed_at: new Date().toISOString(), app_metadata: { provider: 'email' }, user_metadata: {} };
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = [{ alg: 'HS256', typ: 'JWT' }, { sub: uid, aud: 'authenticated', role: 'authenticated', exp }, 'fixture'].map(x => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url')).join('.');
    const session = { access_token: token, refresh_token: 'fixture-refresh', expires_in: 3600, expires_at: exp, token_type: 'bearer', user };
    const announcements = [{ id: '22222222-2222-4222-8222-222222222222', title_en: 'Evening football', title_ar: 'كرة القدم مساءً', body_en: 'The main pitch is open until 22:00.', body_ar: 'الملعب الرئيسي مفتوح حتى 22:00.', published_at: '2026-09-06T09:00:00Z', expires_at: null }, { id: '33333333-3333-4333-8333-333333333333', title_en: 'Court maintenance', title_ar: 'صيانة الملعب', body_en: 'Tennis resumes tomorrow morning.', body_ar: 'تستأنف مباريات التنس صباح الغد.', published_at: '2026-09-05T09:00:00Z', expires_at: null }];
    const dismissed = new Set();
    const counts: Record<string, number> = {};
    const unhandled: string[] = [];
    const errors: string[] = [];
    let releaseDismiss: (() => void) | undefined;
    let failRefresh = false;
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*.supabase.co/**', async (route) => {
        const u = new URL(route.request().url());
        const key = u.pathname;
        counts[key] = (counts[key] || 0) + 1;
        const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
        if (key.endsWith('/auth/v1/token'))
            return json(session);
        if (key.endsWith('/auth/v1/user'))
            return json(user);
        if (key.endsWith('/auth/v1/logout'))
            return route.fulfill({ status: 204 });
        if (key.endsWith('/rpc/get_my_session_context'))
            return json([{ user_id: uid, full_name: 'Yasmine El Amrani', username: 'yasmine', student_id: null, role: 'student', access_status: 'approved', email_kind: 'academic', identity_status: 'not_required', can_use_sports: true, needs_identity_action: false, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' }]);
        if (key.endsWith('/rpc/get_next_booking'))
            return json([]);
        if (key.endsWith('/pitches'))
            return json([{ id: 'p1', name: 'Main football pitch', location: 'University campus', capacity: 22, sport_type: 'football', open_time: '08:00', close_time: '22:00' }]);
        if (key.endsWith('/announcements'))
            return failRefresh ? json({ message: 'Simulated unavailable', code: '503' }, 503) : json(announcements);
        if (key.endsWith('/announcement_dismissals')) {
            if (route.request().method() === 'GET')
                return json([...dismissed].map(announcement_id => ({ announcement_id })));
            const id = route.request().postDataJSON().announcement_id;
            if (id === '22222222-2222-4222-8222-222222222222') {
                await new Promise<void>(resolve => releaseDismiss = resolve);
                dismissed.add(id);
                return route.fulfill({ status: 201, body: '' });
            }
            return json({ code: '42501', message: 'Simulated permission failure' }, 403);
        }
        unhandled.push(key);
        return json({ message: 'Unhandled fixture ' + key }, 400);
    });
    await page.goto('/login');
    await page.getByLabel('Email address', { exact: true }).fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill('Fixture123!');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('heading', { name: 'Play today' }).waitFor();
    const bell = page.getByRole('link', { name: 'Notifications, 2 new', exact: true });
    await bell.waitFor();
    assert.equal(counts['/rest/v1/announcements'], 1);
    await bell.click();
    await page.getByRole('heading', { name: 'Evening football', exact: true }).waitFor();
    assert.equal(counts['/rest/v1/announcements'], 1);
    await page.getByRole('button', { name: 'Dismiss: Evening football', exact: true }).click();
    await page.waitForFunction(() => !document.body.textContent.includes('Evening football'));
    await page.getByRole('link', { name: 'Notifications, 1 new', exact: true }).waitFor();
    assert.equal(typeof releaseDismiss, 'function');
    releaseDismiss!();
    await page.getByRole('button', { name: 'Dismiss: Court maintenance', exact: true }).click();
    await page.getByRole('heading', { name: 'Court maintenance', exact: true }).waitFor();
    await page.getByRole('alert').filter({ hasText: 'Couldn’t dismiss' }).waitFor();
    failRefresh = true;
    await page.getByRole('button', { name: 'Refresh notifications', exact: true }).click();
    await page.getByText('Couldn’t refresh updates.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Court maintenance' }).count(), 1);
    failRefresh = false;
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForFunction(() => !document.body.textContent.includes('Couldn’t refresh updates.'));
    await page.goto('/logout');
    await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
    assert.equal(await page.getByRole('link', { name: /Notifications/ }).count(), 0);
    assert.deepEqual(unhandled, []);
    assert.deepEqual(errors, []);
});
