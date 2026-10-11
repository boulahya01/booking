import { expect, test } from '@playwright/test'
import { resolveAccountRoute } from '../../src/lib/accountResolver'
import type { AccountState } from '../../src/lib/types'

const approvedStudent: AccountState = {
  user_id: 'student-1',
  role: 'student',
  access_status: 'approved',
  email_kind: 'academic',
  identity_status: 'verified',
  student_id: 'S123456789',
  restriction_reason: null,
  can_use_sports: true,
  needs_identity_action: false
}

const pendingStudent: AccountState = {
  ...approvedStudent,
  access_status: 'pending',
  identity_status: 'required',
  can_use_sports: false,
  needs_identity_action: true
}

const suspendedStudent: AccountState = {
  ...pendingStudent,
  access_status: 'suspended',
  restriction_reason: 'manual_restriction'
}

function route(overrides: Partial<Parameters<typeof resolveAccountRoute>[0]>) {
  return resolveAccountRoute({
    hasSession: false,
    account: null,
    pathname: '/',
    recoveryActive: false,
    bootstrapError: null,
    welcomeSeen: false,
    ...overrides
  })
}

test('the resolver owns entry destinations for each account state', () => {
  expect(route({ hasSession: false, pathname: '/' })).toBeNull()
  expect(route({ hasSession: false, pathname: '/', welcomeSeen: true })).toBe('/login')
  expect(route({ hasSession: false, pathname: '/launch' })).toBe('/login')
  expect(route({ hasSession: true, account: approvedStudent, pathname: '/' })).toBe('/home')
  expect(route({ hasSession: true, account: { ...approvedStudent, role: 'admin' }, pathname: '/' })).toBe('/admin')
  expect(route({ hasSession: true, account: pendingStudent, pathname: '/' })).toBe('/home')
  expect(route({ hasSession: true, account: suspendedStudent, pathname: '/' })).toBe('/pending-approval')
})

test('protected entry failures do not fall through to the landing page', () => {
  expect(route({ hasSession: true, account: null, pathname: '/' })).toBe('/auth-error')
  expect(route({ hasSession: true, account: null, pathname: '/launch' })).toBe('/auth-error')
  expect(route({ hasSession: true, account: approvedStudent, pathname: '/auth-error' })).toBe('/home')
})
