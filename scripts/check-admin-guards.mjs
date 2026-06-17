// Security gate (audit finding S1): every Server Action that uses the
// service-role admin client (createSupabaseAdmin) — which BYPASSES RLS — must
// perform its own authorization. This static check fails CI if any exported
// function in a `'use server'` module calls createSupabaseAdmin without an
// authorization signal in the same function.
//
// C2 (updateBusStatusAction) and C3 (writePerformanceSnapshotAction) were both
// missing-authz-on-the-admin-client bugs. This prevents that whole class from
// recurring as new actions are added.
//
// An "authorization signal" is ONE of:
//   1. a call to a guard helper:  require*/assert*/ensure*  (e.g. requireAdminRole,
//      requireRole, requireUser, assertAdmin, ensureRole, requireChatAccess)
//   2. an inline role check that reads `app_metadata` (e.g. user.app_metadata?.role)
//   3. an explicit entry in ALLOWLIST below, with a written justification.
//
// NOTE: requireUser() counts as a signal because the actions that use it scope
// every write to the caller's own record (auth.user.id). If you add a new
// requireUser-only action that operates on an arbitrary client-supplied id,
// that is a real finding — add a role check, do not allowlist it blindly.
//
// Run: node scripts/check-admin-guards.mjs   (wire into CI / pre-deploy)

import ts from 'typescript'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')
const SCAN_DIRS = ['app', 'actions']
const ADMIN_FACTORY = 'createSupabaseAdmin'

// `${relativePosixPath}#${functionName}` -> reason. Each entry is a reviewed
// decision that this admin-client function is safe without a role/app_metadata
// check. Keep this list short; every addition should be justified in review.
const ALLOWLIST = {
  'app/login/actions.ts#signInWithEmployeeId':
    'Pre-auth: resolves Employee ID -> email before a session exists; rate-limited.',
}

function walkFiles(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walkFiles(full, out)
    else if (/\.tsx?$/.test(name)) out.push(full)
  }
  return out
}

// Is this a `'use server'` module (top-of-file directive)?
function isServerActionModule(sourceFile) {
  for (const stmt of sourceFile.statements) {
    if (
      ts.isExpressionStatement(stmt) &&
      ts.isStringLiteral(stmt.expression) &&
      stmt.expression.text === 'use server'
    ) {
      return true
    }
    // Allow leading imports/comments before the directive is impossible in TS,
    // but a non-directive statement means there is no top-level 'use server'.
    if (!ts.isExpressionStatement(stmt) || !ts.isStringLiteral(stmt.expression)) {
      return false
    }
  }
  return false
}

// Scan one function node's subtree for the three signals.
function inspectFunction(node) {
  let hasAdmin = false
  let hasGuardCall = false
  let hasAppMeta = false

  const visit = (n) => {
    if (ts.isCallExpression(n)) {
      const callee = n.expression
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : null
      if (name === ADMIN_FACTORY) hasAdmin = true
      if (name && /^(require|assert|ensure)[A-Z]/.test(name)) hasGuardCall = true
    }
    if (
      (ts.isIdentifier(n) || ts.isPropertyAccessExpression(n)) &&
      n.getText().includes('app_metadata')
    ) {
      hasAppMeta = true
    }
    ts.forEachChild(n, visit)
  }
  if (node.body) visit(node.body)
  return { hasAdmin, authorized: hasGuardCall || hasAppMeta }
}

function functionName(node, decl) {
  if (node.name && ts.isIdentifier(node.name)) return node.name.text
  if (decl && ts.isIdentifier(decl.name)) return decl.name.text
  return '<anonymous>'
}

const violations = []
const allowlistUsed = new Set()

for (const d of SCAN_DIRS) {
  for (const file of walkFiles(join(ROOT, d))) {
    const src = readFileSync(file, 'utf8')
    if (!src.includes(ADMIN_FACTORY)) continue
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true)
    if (!isServerActionModule(sf)) continue // pages/helpers are out of scope

    const rel = relative(ROOT, file).split(sep).join('/')

    const considered = [] // { name, node }
    for (const stmt of sf.statements) {
      if (ts.isFunctionDeclaration(stmt) && stmt.body) {
        considered.push({ name: functionName(stmt), node: stmt })
      } else if (ts.isVariableStatement(stmt)) {
        for (const decl of stmt.declarationList.declarations) {
          const init = decl.initializer
          if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
            considered.push({ name: functionName(init, decl), node: init })
          }
        }
      }
    }

    for (const { name, node } of considered) {
      const { hasAdmin, authorized } = inspectFunction(node)
      if (!hasAdmin) continue
      const key = `${rel}#${name}`
      if (ALLOWLIST[key]) {
        allowlistUsed.add(key)
        continue
      }
      if (!authorized) violations.push({ key, rel, name })
    }
  }
}

// Report.
if (violations.length > 0) {
  console.error('\n✖ Admin-client authorization check FAILED\n')
  console.error(
    'These Server Action functions use the service-role admin client (RLS-bypassing)\n' +
      'but contain no authorization (no require*/assert*/ensure* guard and no\n' +
      'app_metadata role check). Add a role guard, or allowlist with a reason in\n' +
      'scripts/check-admin-guards.mjs if the function is genuinely safe without one.\n'
  )
  for (const v of violations) console.error(`  - ${v.key}`)
  console.error('')
  process.exit(1)
}

// Flag stale allowlist entries so the list cannot rot.
const stale = Object.keys(ALLOWLIST).filter((k) => !allowlistUsed.has(k))
if (stale.length > 0) {
  console.error('\n✖ Stale ALLOWLIST entries (function not found / no longer uses admin client):\n')
  for (const k of stale) console.error(`  - ${k}`)
  console.error('\nRemove them from scripts/check-admin-guards.mjs.\n')
  process.exit(1)
}

console.log('✓ Admin-client authorization check passed (all admin-client Server Actions are guarded).')
