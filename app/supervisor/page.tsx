import { redirect } from 'next/navigation'

// N12 — route reconcile. The supervisor dashboard duplicated the coordinator
// roster (and exceeded the spec's restricted scope with a fleet/defects panel).
// Coordinator and supervisor are both restricted-scope monitors, so they now
// share the single canonical /coordinator overview (which carries the OK/X
// compliance verdict). This eliminates the duplicate route.
export default function SupervisorPage() {
  redirect('/coordinator')
}
