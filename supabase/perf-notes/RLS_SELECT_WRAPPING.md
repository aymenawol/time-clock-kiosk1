# RLS performance: wrap `auth.*` / `has_role()` in scalar sub-selects

⛔ **For the DB agent. This is NOT a migration** (it lives outside
`supabase/migrations/` on purpose) and must be reviewed + tested against the live
database before any policy is changed. RLS is security-critical — a wrong rewrite
can expose rows. Author the actual migration from this spec, then verify with
`EXPLAIN ANALYZE` and a row-visibility test per role.

## The problem

Postgres evaluates an RLS `USING` / `WITH CHECK` expression **per row**. When a
policy calls a function or `auth.*` helper directly, the planner re-invokes it for
every candidate row:

```sql
-- current pattern (per-row evaluation)
CREATE POLICY "employees: admin full access"
  ON public.employees FOR ALL
  USING (public.has_role(ARRAY['admin','management']));
```

`has_role()` is `STABLE`, but in a `USING` clause it is still called once per row.
Wrapping the call in a scalar sub-select makes the planner treat it as an
**initPlan** — evaluated **once per query** and cached:

```sql
-- optimized (once per query)
CREATE POLICY "employees: admin full access"
  ON public.employees FOR ALL
  USING ((SELECT public.has_role(ARRAY['admin','management'])));
```

Same rule for bare `auth.uid()` / `auth.jwt()` inside policies →
`(SELECT auth.uid())`, `(SELECT auth.jwt())`. This is the
[documented Supabase RLS perf guidance](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select).

## Mechanical transformation

For every policy in `public`:
- `public.has_role(ARRAY[...])` → `(SELECT public.has_role(ARRAY[...]))`
- `auth.uid()` → `(SELECT auth.uid())`
- `auth.jwt() -> ...` → `(SELECT auth.jwt()) -> ...`
- `get_my_employee_id()` / `get_my_role()` → wrap likewise.

The result set is **identical** — this only changes evaluation frequency, not
semantics. Verify that claim with a per-role visibility test before/after.

Get the full inventory to transform (do not rely on this doc being exhaustive):

```sql
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

## Highest-impact policies to do first

1. **`employees`** — `has_role(...)` in admin/staff/tech/driver policies
   (`20260520000003_v2_phase1_rls_overhaul.sql:46-69`). Hottest table; read on
   nearly every page.
2. **`shifts` / `breaks`** — read on every dispatcher/board/driver load.
3. **Broad `IN (SELECT …)` subquery policies** — rewrite so the correlated
   subquery is not re-run per row:
   - `counting_rows` (`20260525000006_v2_phase2_rls.sql:~140`)
   - `inspection_items` (`20260525000006_v2_phase2_rls.sql:~177`)
   ```sql
   -- before: subquery re-evaluated per counting_rows row
   USING (
     public.has_role(ARRAY['driver']) AND
     sheet_id IN (SELECT id FROM public.counting_sheets
                  WHERE driver_id = public.get_my_employee_id())
   );
   -- after: helper hoisted to initplan; keep the IN (planner makes it a semijoin)
   USING (
     (SELECT public.has_role(ARRAY['driver'])) AND
     sheet_id IN (SELECT id FROM public.counting_sheets
                  WHERE driver_id = (SELECT public.get_my_employee_id()))
   );
   ```

## Verification (required before merge)

- `EXPLAIN ANALYZE` a representative `SELECT` on `employees`, `shifts`, `breaks`,
  `counting_rows` as each role; confirm the helper shows as an InitPlan / one-time
  filter, not a per-row `SubPlan`.
- Row-visibility regression: for each role, confirm the rows returned pre- and
  post-change are identical (semantics must not change).
- Confirm `WITH CHECK` clauses on writable policies were wrapped too (not just
  `USING`).
```

NOTE: pair this with `supabase/migrations/20260622000001_v2_perf_indexes.sql`
(the additive index coverage) — apply indexes first, then this RLS pass.
