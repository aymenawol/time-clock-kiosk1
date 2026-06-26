// Provision real login accounts for the seeded test drivers.
//
// WHY: seed.sql only inserts `employees` rows (no auth accounts), but login
// requires a Supabase auth user and the driver dashboard resolves the active
// shift via employees.auth_user_id. This script creates an auth user for each
// test driver, links it to the EXISTING employees row (preserving seniority,
// employee_id, etc.), sets app_metadata.role, the email used for kiosk login,
// and the profiles row — mirroring createEmployeeAction but for existing rows.
//
// Idempotent: a driver that already has auth_user_id is skipped.
//
// RUN (Node 20.6+ / you have v22):
//   node --env-file=.env.local scripts/link-test-logins.mjs
//
// Then sign in at /login (Employee ID tab): ID = 1001, password = Test1234!

import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run with: node --env-file=.env.local scripts/link-test-logins.mjs')
  process.exit(1)
}

const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Edit this list to provision more test roles. email/password are test creds.
const TEST_ACCOUNTS = [
  { employee_id: '1001', email: 'driver1001@test.local', password: 'Test1234!', role: 'driver' },
  { employee_id: '1234', email: 'driver1234@test.local', password: 'Test1234!', role: 'driver' },
]

async function findAuthUserByEmail(email) {
  // listUsers is paginated; scan a few pages for the matching email.
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (hit) return hit
    if (data.users.length < 200) break
  }
  return null
}

async function provision(acct) {
  // 1. Locate the existing employees row.
  const { data: emp, error: empErr } = await admin
    .from('employees')
    .select('id, employee_id, name, auth_user_id')
    .eq('employee_id', acct.employee_id)
    .single()

  if (empErr || !emp) {
    return { ...acct, status: 'SKIPPED', reason: `no employees row for ${acct.employee_id}` }
  }
  if (emp.auth_user_id) {
    return { ...acct, status: 'SKIPPED', reason: 'already linked', auth_user_id: emp.auth_user_id }
  }

  // 2. Create the auth user (or reuse an existing one with this email).
  let authUserId
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: acct.email,
    password: acct.password,
    email_confirm: true,
    app_metadata: { role: acct.role },
    user_metadata: { name: emp.name, employee_id: acct.employee_id },
  })

  if (createErr) {
    const existing = await findAuthUserByEmail(acct.email)
    if (!existing) return { ...acct, status: 'ERROR', reason: createErr.message }
    authUserId = existing.id
    // Make sure role + password are correct on the reused account.
    await admin.auth.admin.updateUserById(authUserId, {
      password: acct.password,
      app_metadata: { role: acct.role },
    })
  } else {
    authUserId = created.user.id
  }

  // 3. Link the employees row (email is required for kiosk Employee-ID login).
  const { error: linkErr } = await admin
    .from('employees')
    .update({
      auth_user_id: authUserId,
      email: acct.email,
      role: acct.role,
      status: 'active',
      is_active: true,
    })
    .eq('id', emp.id)
  if (linkErr) return { ...acct, status: 'ERROR', reason: `link failed: ${linkErr.message}` }

  // 4. Upsert the profiles row.
  const { error: profErr } = await admin
    .from('profiles')
    .upsert({ id: authUserId, employee_id: acct.employee_id, role: acct.role, is_active: true })
  if (profErr) console.warn(`  profiles upsert warning for ${acct.employee_id}: ${profErr.message}`)

  return { ...acct, status: 'LINKED', auth_user_id: authUserId }
}

console.log(`Provisioning ${TEST_ACCOUNTS.length} test login(s)...\n`)
for (const acct of TEST_ACCOUNTS) {
  try {
    const r = await provision(acct)
    const tag = r.status === 'LINKED' ? '✓' : r.status === 'SKIPPED' ? '–' : '✗'
    console.log(`${tag} ${acct.employee_id} (${acct.role}): ${r.status}${r.reason ? ' — ' + r.reason : ''}`)
    if (r.status === 'LINKED') console.log(`    login: Employee ID ${acct.employee_id} / password ${acct.password}`)
  } catch (e) {
    console.log(`✗ ${acct.employee_id}: ERROR — ${e.message}`)
  }
}
console.log('\nDone. Sign in at /login → Employee ID tab.')
