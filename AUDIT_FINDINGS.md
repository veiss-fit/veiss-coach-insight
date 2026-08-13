# Supabase Integration Audit — veiss-coach-insight

**Date:** 2026-08-10 · **Scope:** Read-only investigation, no code changes · **Branch:** dashboard-design-overhaul

**Method:** Three parallel read-only research passes (auth/signup race conditions + orphaned state; error handling + RLS policy inventory; write-then-read races + partial-failure flows), synthesized here together with findings already confirmed via live debugging earlier this session (the `groups.sport`/`coach_user_id` incident, detailed in §2).

**A note on prior audit docs:** `SUPABASE_WIRING_AUDIT.md` and `SUPABASE_WIRING_ISSUES_SUMMARY.md` already exist at the repo root (dated April 2026). One research pass found they reference a migration file (`004_create_profiles_table.sql`) that does not exist in this repo, and their migration-ordering narrative doesn't match the actual tracked migrations. Treat those two files as an unreliable secondary source — useful for pointing at *categories* of prior concern, not as verified fact.

**A note on `database.ts`:** This file is hand-maintained, not generated from the live schema. It has already been proven wrong once this session (`groups.sport` and `groups.coach_user_id` were typed as real columns; neither exists live — confirmed via a `RETURNING *` in the Supabase SQL editor). Every column/table claim below that rests on `database.ts` alone is flagged as unverified; only claims corroborated by actual runtime behavior (error messages, working queries, code comments describing real incidents) are treated as reliable.

---

## 1. Auth & Signup Flow

### 1.1 — `initialize()` races unguarded against `AuthCallback.tsx`'s setup sequence
**File:** `src/contexts/AuthContext.tsx:73-124` (`initialize()`) vs. `src/pages/AuthCallback.tsx:9-82` (`handleCallback()`)

**What it does:** `AuthProvider` wraps the entire app, including the `/auth/callback` route (`src/App.tsx`). When a coach clicks the email-confirmation link, the browser does a full page load of `/auth/callback`, mounting both `AuthProvider` and `AuthCallback` simultaneously. `AuthProvider.initialize()` calls `supabase.auth.getSession()` and, if a session exists, immediately runs `setUser(...)` then `await loadProfile(session.user.id)` (lines 101-104) — **with no guard against running while `/auth/callback` is still performing its own setup.**

A pathname guard *does* exist in the codebase — but only inside the `onAuthStateChange` listener (`AuthContext.tsx:146-224`), whose own comment reads: *"AuthCallback.tsx owns the full setup sequence... If we race with it and fetch the profile before the upsert commits... the role check in loadProfile will force-logout the user."* This comment describes exactly the bug `initialize()` remains exposed to — the guard was added to one of the two paths that needed it, not both.

**Why it's risky:** If a Postgres trigger (`handle_new_user`, referenced only in code comments, not tracked in any migration — see §3) has already created a `profiles` row for the new `auth.users` insert with a role that isn't yet `'coach'` (the row `AuthCallback.tsx` Step 1 is supposed to authoritatively fix), `loadProfile()` hits:
```ts
// AuthContext.tsx:253-257
if (profileData.role !== 'coach') {
  console.error(...)
  await logout()
  throw new Error('User is not a coach')
}
```
`logout()` (`AuthContext.tsx:437-456`) does a **hard redirect** — `window.location.href = '/login'`, no query param, no error state — which kills `AuthCallback`'s in-flight async function mid-sequence (possibly before its own profile-fixing upsert even runs). The user experience: click the confirmation link → brief "Confirming your account..." spinner → silently dumped at a bare `/login` with zero explanation. `AuthContext.initialize()`'s code path (a single `SELECT ... single()`) is structurally much faster than `AuthCallback`'s full sequence (getSession → upsert profiles → select coaches → insert coaches → insert group → update profiles), so `initialize()` is likely to win this race whenever the trigger's default role isn't already `'coach'` — this may not be a rare edge case at all.

**Severity: Critical**

**Fix direction:** Add the same `window.location.pathname === '/auth/callback'` guard to `initialize()` that already exists in the `onAuthStateChange` listener, so it never calls `loadProfile()`/forces `logout()` while `AuthCallback` owns that route.

---

### 1.2 — No rollback on partial signup failure; retry masks the real cause
**File:** `src/contexts/AuthContext.tsx:333-424` (`signup()`, immediate-session path)

**What it does:** Sequentially awaits: `auth.signUp()` → `profiles` upsert → `coaches` insert → `groups` insert → `profiles.coach_id` update. If the `coaches` or `groups` insert fails, the error is caught and rethrown, surfacing as `{ success: false, error: error.message || 'An error occurred during signup' }`. **No compensating rollback of the already-committed `auth.users` row or `profiles` row is ever attempted.**

**Why it's risky:** The `auth.users` account and partial `profiles` row persist permanently. If the user retries signup with the same email, `supabase.auth.signUp()` rejects with an "already registered"-style error (exact wording depends on Supabase project confirmation settings), surfaced via the same generic toast path in `Signup.tsx`. The user sees a generic "already registered" or "Failed to create account" message with no indication their first attempt half-succeeded, and no self-service recovery path exists in the UI (no "resume setup," no "resend confirmation").

**Severity: High**

**Fix direction:** On coach/group insert failure, either compensate (delete the partial `profiles`/`auth.users` rows) or, more simply, make retry idempotent — detect "auth account exists but setup incomplete" on next login/signup attempt and resume setup rather than failing outright.

---

### 1.3 — `AuthCallback.tsx`'s coach-row check-then-insert is not atomic (possible duplicate `coaches` rows)
**File:** `src/pages/AuthCallback.tsx:42-53`

**What it does:** Checks for an existing `coaches` row via `.maybeSingle()`, then inserts if none is found. This check-then-act is not atomic. `supabase/migrations/001_add_user_id_to_coaches.sql` only creates a **non-unique index** on `coaches.user_id` — no migration anywhere adds a unique constraint.

**Why it's risky:** Two concurrent invocations of `handleCallback()` for the same user (double-clicking the confirmation link, opening it in two tabs, or a security scanner prefetching the link before the real click) could both observe `existing === null` and both insert, producing two `coaches` rows for one `user_id`. Whichever subsequent `profiles.coach_id` update runs last wins arbitrarily; the other `coaches` row becomes a permanent orphan.

**Severity: Medium** (requires a specific double-navigation trigger, not a single normal signup)

**Fix direction:** Add a unique constraint on `coaches.user_id` at the DB level so the second insert fails loudly instead of silently succeeding twice.

---

### 1.4 — Redundant re-fetch + arbitrary sleep in `login()` (symptom of §1.1, not a fix for it)
**File:** `src/contexts/AuthContext.tsx:294-310`

**What it does:** After `loadProfile()` already runs and sets state, `login()` waits an arbitrary 100ms, then calls `getUserProfile()` a *second* time directly, discarding whatever `loadProfile()` already fetched, purely to re-check `role === 'coach'`.

**Why it's risky:** This doesn't address any genuine commit-visibility race (login happens well after signup; `profiles.role` is long since committed by then). It reads as a defensive patch added after the signup-time race (§1.1) was misdiagnosed as a general "profile not visible yet" problem. It adds latency to every login without fixing the actual gap.

**Severity: Low** (doesn't itself cause failures, but is evidence the real bug in §1.1 has been patched around rather than fixed)

**Fix direction:** Remove once §1.1 is fixed; trust `loadProfile()`'s own result.

---

### 1.5 — `ProtectedRoute` gives no explanation on auth failure
**File:** `src/components/ProtectedRoute.tsx:15-32`

**What it does:** Shows a full-screen "Authenticating..." spinner while `loading` is true (capped at 15s via `ensureLoadingEnds`, `AuthContext.tsx:56-67`). Redirects to `/login` with `state: { from: location }` if no user — but `Login.tsx` never reads that state, so nothing is surfaced. Redirects to `/` (not `/login`) on role mismatch.

**Why it's risky:** A coach who hits §1.1's force-logout, or whose profile fetch times out, sees either an indefinite-feeling spinner or a silent bounce with zero explanation — contributing to the perceived "signup just failed" experience even though this component itself doesn't cause account-creation failures.

**Severity: Low-Medium**

**Fix direction:** Surface `location.state`'s reason on the login page; add a distinct error state instead of a silent redirect.

---

### 1.6 — `handle_new_user` trigger existence and behavior is unverifiable from source
**What it does:** Code comments in both `AuthContext.tsx` and `AuthCallback.tsx` reference a `handle_new_user` trigger that "may have already created" the `profiles` row. No migration in `supabase/migrations/` creates this trigger — it exists only live, out-of-band.

**Why it's risky:** Its exact behavior (what role it defaults to, whether it runs before or after the client's own upsert) directly determines whether §1.1 fires on every signup or only intermittently. This can't be confirmed from the repo.

**Severity:** N/A — informational, blocks full diagnosis of §1.1's frequency.

**Fix direction:** Pull the live trigger definition into a tracked migration so its behavior is auditable and versioned.

---

## 2. Team Creation Flow

### 2.1 — Historical bug (fixed this session): `groups.sport` / `groups.coach_user_id` never existed
**Files:** `src/components/TeamSportManager.tsx`, `src/contexts/AuthContext.tsx`, `src/pages/AuthCallback.tsx`, `src/types/database.ts`

For context on the rest of this section: the live `groups` table has exactly 5 columns — `id, name, created_at, invite_code, coach_id` (confirmed via `RETURNING *` on a manual insert in the Supabase SQL editor). `database.ts` incorrectly typed two additional columns, `sport` and `coach_user_id`, as real — and every `groups` insert in the app (the "Add Group" button, and the default-group insert in both signup paths) sent a `sport` value, causing every one of those inserts to fail with `PGRST204: Could not find the 'sport' column of 'groups' in the schema cache`. This was **fixed this session**: all three insert sites had `sport`/`coach_user_id` removed, `database.ts` was corrected to the real 5-column schema, and the dead `updateSportName()`/`getSportsList()`/`Validators.sport` functions (which referenced the same nonexistent column and were unused anywhere in the UI) were deleted.

**Why this belongs in the audit:** it's the clearest concrete evidence in the whole codebase that (a) `database.ts` cannot be trusted without independent verification, and (b) generic error handling (§4) made this indistinguishable from an RLS rejection or a not-null violation for a long time — a coach could not create a group and the UI just said "Failed to create group," with the real cause only visible via the Network tab's response body.

**Severity:** Resolved — documented for context, not an open item.

---

### 2.2 — `AuthCallback.tsx`'s default group is created with the wrong `coach_id`, becoming a permanent invisible orphan
**File:** `src/pages/AuthCallback.tsx:49-71` vs. `src/contexts/AuthContext.tsx:382-414`

*(Independently discovered by two separate research passes this session — auth-flow analysis and write/partial-failure analysis both converged on the same root cause from different angles, which is strong corroboration.)*

**What it does:** The two signup paths create the `coaches` row differently:

```ts
// AuthContext.tsx:382-391 (immediate-session path) — explicitly pins coaches.id
.from('coaches').insert({ id: userId, full_name: fullName, email, user_id: userId })
```
```ts
// AuthCallback.tsx:49-53 (email-confirmation path, the one nearly every coach takes) — no id set
.from('coaches').insert({ full_name: fullName, email, user_id: userId }).select().single();
```
`coaches.id` is optional/DB-generated per `database.ts`. In the `AuthContext.tsx` path, `coaches.id` is forced to equal `userId`, so every later reference to `coach_id: userId` is self-consistent. In the `AuthCallback.tsx` path, omitting `id` produces a **fresh, random `coaches.id`** — but the very next two writes still use `userId`, not the real generated id:

```ts
// AuthCallback.tsx:63-65 — uses userId, not coachData.id
.from('groups').insert({ name: `${fullName}'s Group`, coach_id: userId });
// AuthCallback.tsx:68-71 — same mismatch
.from('profiles').update({ coach_id: userId }).eq('id', userId);
```

**Why it's risky:** Every group-scoping query in the app resolves the coach via `coaches.id` looked up *by* `user_id` first (`getCoachId`/`getCoachTeamIds` in `playersService.ts`, and `TeamSportManager.loadTeams()` independently does the same lookup) — i.e., `SELECT id FROM coaches WHERE user_id = <uid>` → `SELECT * FROM groups WHERE coach_id = <that coaches.id>`. Since the default group was inserted with `coach_id = userId` (the auth id) instead of the real `coaches.id`, this query **never finds it**. The coach's auto-created "`<Name>`'s Group" is created in the DB, consumes an invite code, and is permanently invisible in Groups & Players, in group filter dropdowns (SendProgramming, Messages), and in roster queries. `profiles.coach_id` has the same wrong value, so `getUserProfile()`'s coach-relation lookup (`src/lib/supabase.ts:87`) also finds 0 rows — `profile.coach` stays `undefined` forever for these accounts (caught and silently degraded at `supabase.ts:97-99`, "Don't throw — return profile without coach data").

**What the user observes:** confirms email, lands on the dashboard, sees "No groups found" despite the app having attempted to create one — with zero error, since nothing in this path throws.

**Severity: High** — 100% reproducible on the primary (email-confirmation) signup path, completely silent, no cleanup path exists in the UI.

**Fix direction:** In `AuthCallback.tsx`, use the `coachData.id` returned from the insert's own `.select().single()` (already captured, currently unused for this purpose) instead of `userId` for both the `groups.coach_id` insert and the `profiles.coach_id` update.

---

### 2.3 — `handleAssignPlayers`: `Promise.all` partial failure is swallowed, leaving DB and UI inconsistent
**File:** `src/components/TeamSportManager.tsx:160-176`, `src/services/playersService.ts:326-356` (`assignPlayerToTeam`)

**What it does:**
```ts
await Promise.all(selectedPlayerIds.map(id => assignPlayerToTeam(id, teamIdToAssign)));
toast.success(`Assigned ${selectedPlayerIds.length} player(s) to ${groupName}`);
setSelectedPlayerIds([]);
await loadPlayers();
```
Each `assignPlayerToTeam` call is an independent, separately-committing `UPDATE players SET team_id = ...`. `Promise.all` rejects as soon as any one fails — but the others are already in flight and commit independently regardless (no transaction wraps the batch).

**Why it's risky:** If one assignment fails (stale team id, transient network blip, RLS edge case), every *other* assignment in the batch still commits, but the `catch` block fires instead of the success path — meaning `setSelectedPlayerIds([])` and `loadPlayers()` are skipped. The coach sees only `toast.error("Failed to assign players")` and the picker keeps showing pre-assignment state, with no indication that most of the selection actually moved. This is worse than a simple failure: the DB state is now inconsistent with what the UI is telling the user, and the coach may retry the whole batch, risking duplicate no-op updates.

**Severity: High**

**Fix direction:** Use `Promise.allSettled` instead of `Promise.all`; report exactly which assignments succeeded/failed; always reload player state regardless of partial failure.

---

### 2.4 — `handleDeleteTeam`'s error message is a guess, not a diagnosis
**File:** `src/components/TeamSportManager.tsx:141-150`, `src/services/playersService.ts:53-66` (`deleteTeam`)

**What it does:** `deleteTeam()` catches any error and returns `false`; the caller then always shows `toast.error("Cannot delete group (likely has players assigned)")` — regardless of whether the real cause is an FK violation (the guessed cause), an RLS rejection, a network failure, or a stale/already-deleted id. There's no pre-check (e.g. `SELECT count(*) FROM players WHERE team_id = ...`) to confirm the guess before displaying it.

**Why it's risky:** A coach hitting an RLS or network failure would be told to go check player assignments — the wrong diagnosis sends them chasing the wrong root cause.

**Severity: Medium**

**Fix direction:** Inspect `error.code` (Postgres FK-violation code `23503`) before choosing the message; fall back to a genuinely generic message only for unrecognized codes.

---

### 2.5 — `SendProgramming`'s per-date send loop shows a success toast that lies about how many dates actually sent
**File:** `src/pages/SendProgramming.tsx:634-646`

**What it does:**
```ts
let totalCount = 0
for (const date of selectedDates) {
  const result = await sendWorkoutPlan(selectedAthletes, coachDbId, date, planData)
  if (result.success) totalCount += result.count ?? 0
  else toast.error(result.error ?? `Failed to send for ${format(date, 'MMM d')}`)
}
if (totalCount > 0) {
  toast.success(`"${workoutName}" sent to ${selectedAthletes.length} athlete(s) across ${selectedDates.length} date(s)`)
  navigate('/')
}
```
(Note: each individual `sendWorkoutPlan` call *is* a single atomic bulk insert across all selected athletes for one date — that part is correctly all-or-nothing, per `workoutPlansService.ts:56-74`. The bug is in the loop *over dates*.)

**Why it's risky:** If, say, 4 of 5 selected dates succeed and 1 fails, the code shows an error toast for the failed date — then unconditionally shows a success toast hardcoding `selectedDates.length` (5, not 4) into the message, and immediately navigates away. The success message is actively wrong, not just missing a caveat, and the navigation removes the coach's only chance to notice the preceding error toast.

**Severity: High**

**Fix direction:** Track actual successful-date count separately from `selectedDates.length`; only navigate away if there were zero failures, or show a combined "4 of 5 dates sent, 1 failed" summary.

---

## 3. RLS Policies

**Ground truth:** only `supabase/migrations/003_fix_players_user_id.sql` defines any tracked RLS policy anywhere in this repo — for the `players` table only. Every other table's policies (if any) exist live, out-of-band, invisible from source.

| Table | Touched by | R/W | Tracked RLS? |
|---|---|---|---|
| `profiles` | AuthContext, AuthCallback, Profile.tsx, supabase.ts, workoutPlansService, messagesService | R+W | **None tracked** |
| `coaches` | AuthContext, AuthCallback, TeamSportManager, TemplatesContext, AthleteDashboard, supabase.ts, SendProgramming, Messages, playersService, workoutPlansService, Profile.tsx | R+W | **None tracked** — this is the trust anchor nearly every other scoping check depends on |
| `groups` | AuthContext, AuthCallback, TeamSportManager, SendProgramming, Messages, playersService | R+W | **None tracked** — already caused a real incident this session (§2.1) |
| `players` | playersService (incl. `assignPlayerToTeam`), statsService | R+W | **Yes** — but broken, see §3.1 below |
| `sessions`, `reps`, `workouts` | playersService, sessionsService, statsService, rosterMetricsService | Read-only from app | **None tracked** |
| `workout_plans` | TemplatesContext (templates are `workout_plans` rows with `is_template=true`), playersService, statsService, workoutPlansService, rosterMetricsService | R+W | **None tracked** — both real assigned plans and reusable templates share this table with no tracked policy for either |
| `messages` | messagesService | R+W | **None tracked** |
| `coach_feedback` | coachFeedbackService | R+W | **None tracked** |
| `avatars` (Storage bucket) | Profile.tsx (upload/getPublicUrl/remove) | R+W | **None tracked** — `Profile.tsx`'s own error message ("Make sure the 'avatars' storage bucket exists") suggests this has caused problems before |

### 3.1 — The one tracked RLS policy grants every coach access to every other coach's players
**File:** `supabase/migrations/003_fix_players_user_id.sql`

**What it does:** The SELECT policy on `players`:
```sql
CREATE POLICY "Coaches can view players in their team." ON public.players
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.coaches c WHERE c.user_id = auth.uid() AND c.team_id = players.team_id)
  OR
  EXISTS (SELECT 1 FROM public.coaches c WHERE c.user_id = auth.uid())   -- unconditional
);
```
The second `OR` branch has no `team_id` scoping at all — it evaluates to `true` for *any* authenticated coach, making the first (correctly-scoped) branch redundant. The comment above it indicates the intent was to allow visibility into unassigned (`team_id IS NULL`) players only, but the `WHERE` clause never checks for that. **The UPDATE and INSERT policies in the same migration have the identical unscoped check**, with no team-ownership condition at all.

**Why it's risky:** This is a genuine cross-tenant data-isolation vulnerability — not a reliability bug. Any authenticated coach can currently `SELECT`, `INSERT`, or `UPDATE` any player row belonging to *any other coach's* team via a direct Supabase client call. This is compounded at the application layer: `TeamSportManager.tsx:165` calls `assignPlayerToTeam(id, teamIdToAssign)` **without** the optional `coachUserId` parameter that `playersService.ts:326-356` uses to app-layer-verify the target team belongs to the calling coach — so this specific UI path has neither a DB-level nor an app-level boundary preventing one coach from reassigning another coach's players into their own group.

**Severity: Critical** — highest-severity finding in this entire audit; this is a live security vulnerability, not a UX/reliability issue.

**Fix direction:** Fix the second OR branch to `AND players.team_id IS NULL` (matching its own comment's stated intent); apply the same team-ownership scoping to the UPDATE/INSERT policies; pass `coachUserId` through in `TeamSportManager.tsx`'s call to `assignPlayerToTeam` as defense in depth.

---

### 3.2 — `groups`, `coaches`, `profiles`, `workout_plans`, `messages` have zero tracked RLS
Already itemized in the table above. Flagging as a distinct finding because untracked, undocumented policies are exactly what produces "works most of the time, fails intermittently" symptoms once they're later tightened or changed without a corresponding application-code update — which is precisely the mechanism behind §2.1's incident this session.

**Severity: High** (audit/process risk — not a specific bug, but the condition that let §2.1 and potentially others go undetected)

**Fix direction:** Pull every live policy into a tracked migration (`pg_dump --schema-only` with `\dp`/policy definitions, or Supabase's own migration-diff tooling) so future schema/policy drift is visible in code review instead of discovered via a coach's bug report.

---

## 4. Error Handling Patterns

### 4.1 — The one error-code-aware handler in the codebase is unused dead code
**File:** `src/lib/errorHandler.ts:12-51`

**What it does:** Defines `handleError()`, which inspects `error.code` (`23505`, `23503`, `PGRST116`, `42501`, `23502`) and maps each to a distinct, accurate user-facing message. **Zero call sites reference it anywhere in `src/`.**

**Why it's risky:** Every error site in the app reinvents (worse) ad-hoc handling instead, which is the direct mechanism behind findings like §2.1 (a schema-cache error, an RLS rejection, and a not-null violation all produced the identical "Failed to create group" toast, with no way to tell them apart without opening DevTools).

**Severity: Critical** (as a root-cause enabler — see the final section)

**Fix direction:** Wire `handleError()` into the generic catch blocks below, starting with the `groups`/`coaches`/`profiles` write paths.

---

### 4.2 — Bare `catch {}` blocks with no error binding, no logging, in `TeamSportManager.tsx`
**File:** `src/components/TeamSportManager.tsx:80-84, 93-95, 122-124, 147-149, 171-173`

**What it does:** Five separate `catch { toast.error("...") }` blocks — the error object isn't even bound to a variable, so it can't be logged even if someone wanted to. `loadTeams`/`loadPlayers`/`handleAssignPlayers` don't call `console.error` at all.

**Why it's risky:** On the exact table (`groups`) already proven to have live-schema drift this session, failures here are completely undiagnosable from the browser console — a developer would have to add logging just to start investigating.

**Severity: High**

**Fix direction:** Bind and log the error at minimum (`catch (error) { console.error(...); toast.error(...) }`); ideally route through `handleError()`.

---

### 4.3 — Some pages fail completely silently on load (no toast at all)
**Files:** `src/pages/SendProgramming.tsx:563-564`, `src/pages/Messages.tsx:78-79`, `src/pages/History.tsx:152-153`

**What it does:** Each page's `loadData`/`loadHistory` catch block only does `console.error(...)` — no toast, no error UI shown to the user.

**Why it's risky:** A coach opening any of these pages after an RLS or schema change sees an empty page (empty athlete list, empty group list, empty history) with zero indication anything went wrong — indistinguishable from "you legitimately have no data yet."

**Severity: High**

**Fix direction:** Add a visible error/retry state to each page, not just console logging.

---

### 4.4 — `TemplatesContext` CRUD failures are shown to the user as success
**Files:** `src/contexts/TemplatesContext.tsx` (all CRUD methods), `src/pages/SendProgramming.tsx:399-409` (`TemplatesTab.handleSave`)

**What it does:** Every `TemplatesContext` write method (`addTemplate`, `updateTemplate`, etc.) catches its own Supabase error, logs it, and returns `null`/silently — with no toast anywhere in that file. The caller in `SendProgramming.tsx`'s `handleSave` shows `toast.success('Template created'/'Template updated')` **unconditionally**, without checking whether the underlying call actually returned a real row or `null`.

**Why it's risky:** This is the most actively misleading finding in the error-handling audit — a failed write (RLS rejection, schema mismatch) is reported to the coach as a confirmed success. They'd have no reason to suspect the template wasn't actually saved until they look for it later and it's missing.

**Severity: High**

**Fix direction:** Check the return value of `addTemplate`/`updateTemplate` in `handleSave` before showing the success toast; show an error toast on `null`.

---

### 4.5 — `Profile.tsx`'s photo-upload catch collapses three independent failure modes into one guessed message
**File:** `src/pages/Profile.tsx:183-184`

**What it does:** A single bare `catch { toast.error("Failed to upload photo. Make sure the 'avatars' storage bucket exists in Supabase.") }` wraps three separate calls (file upload, `getPublicUrl`, auth metadata update) with no binding/logging.

**Why it's risky:** The message guesses at one specific cause (missing storage bucket) that may not be the real one (file-size limit, storage RLS, metadata-update failure would all show the identical message).

**Severity: Medium**

**Fix direction:** Bind and log the error; separate the three calls' error handling so the message matches the actual failing step.

---

### 4.6 — Full inventory reference
The research pass produced a complete file:line inventory of every Supabase-adjacent error site in the codebase (~35 sites across `AuthContext.tsx`, `AuthCallback.tsx`, `TeamSportManager.tsx`, `Profile.tsx`, `SendProgramming.tsx`, `Messages.tsx`, `AthleteDashboard.tsx`, `History.tsx`, `Login.tsx`, `Signup.tsx`, `lib/supabase.ts`, and every file in `src/services/`), classified by generic-message-only / logged-only / silently-swallowed. The five above are the highest-severity representative examples; the same "generic message masks real cause" pattern recurs in most of the remainder at Low-Medium severity.

---

## 5. Write-Then-Read Races

**General note:** this stack is a single Postgres primary behind PostgREST with no read-replica configuration found anywhere — sequential `await`ed calls on the same client are read-your-writes consistent under standard Postgres MVCC. The real risk in the patterns below is less "stale read" and more: (a) a second independent network call that can itself fail and leave the UI stuck after a premature success toast, and (b) doubled latency.

**Classified as SAFE** (use the write's own `RETURNING`-equivalent result to update local state, no separate re-read):
- `TemplatesContext.tsx` — `addTemplate`, `deleteTemplate`, `duplicateTemplate` (all use `.select().single()` and patch state directly)
- `AthleteDashboard.tsx` `handleAddNote` — prepends the `addCoachNote` return value directly, no reload

**Classified as RISKY (reload-based)** — fires a separate reload after a write and trusts it reflects the write, with no optimistic update as a fallback:

### 5.1 — `TeamSportManager.tsx`: create/update/delete all reload via `loadTeams()`, which can itself fail right after a success toast
**File:** `src/components/TeamSportManager.tsx:121, 135, 146` (calls into `loadTeams()`, whose own catch is `src/components/TeamSportManager.tsx:80-84`)

**Why it's risky:** If `loadTeams()`'s own query throws after a successful create/update/delete, the coach sees a **second, contradictory toast** ("Failed to load groups") immediately after "Group created" — confusing "did it actually work?" UX even though the write itself succeeded.

**Severity: Medium**

**Fix direction:** Use the insert's own returned row to optimistically patch local state (matching the `TemplatesContext` pattern), falling back to a reload only if that's not feasible.

---

### 5.2 — `Messages.tsx`: post-send reload can throw and overwrite a just-shown success toast with a failure toast, for the same action
**File:** `src/pages/Messages.tsx:132-171`

**What it does:** `send()` shows a success toast (lines 154-158) immediately after `sendMessage()` succeeds, then immediately re-fetches with `getCoachMessageHistory()` (line 160) to replace the `sent` feed state — inside the same outer `try` block, so if this second call throws, it's caught by the outer `catch` (line 165), which shows `"An error occurred while sending the announcement"`.

**Why it's risky:** The coach sees a success toast immediately followed by a failure toast for what was, in fact, a successful send — actively self-contradictory.

**Severity: Medium-High** (high confusion value, moderate likelihood)

**Fix direction:** Move the reload outside the send's own try/catch, or wrap it in its own catch that doesn't overwrite the already-confirmed success state.

---

### 5.3 — `Profile.tsx`: three sequential network calls for one "Save Changes" click
**File:** `src/pages/Profile.tsx:88-132`

**What it does:** Updates `profiles`, then (non-fatally) `coaches`, then calls `refreshProfile()` — which does its own fresh `profiles` SELECT (`AuthContext.tsx:458-474`, whose error is **not even captured**, let alone logged — a fully silent discard).

**Why it's risky:** If the final refresh SELECT fails or times out, the function throws and shows `"Failed to update profile"` even though both writes already committed successfully — a false-negative failure toast after a real success.

**Severity: Medium**

**Fix direction:** Update local state directly from the write's own response rather than re-fetching; at minimum, capture and log `refreshProfile`'s error instead of discarding it.

---

### 5.4 — Bulk-insert flows are correctly atomic (confirmed, not a bug)
**Files:** `src/services/workoutPlansService.ts:56-74` (`sendWorkoutPlan`), `src/services/messagesService.ts:49-64` (`sendMessage`)

Both build all per-recipient rows into a single array and send one bulk `.insert()` call — genuinely atomic at the Postgres level (all rows or none). The per-*date* loop in `SendProgramming.tsx` (§2.5) is a separate, real bug; the per-*recipient*/per-*athlete* batching within a single call is not.

**Severity:** N/A — documented to prevent double-counting against §2.5.

---

## 6. Orphaned / Partial-Failure State

### 6.1 — Primary example: `AuthCallback.tsx`'s coach-ID mismatch (full detail in §2.2)
The clearest orphaned-state bug found in this audit — a coach account that is fully functional (can log in, sees `role: 'coach'`) but has a `groups` row and a `profiles.coach_id` link that both point at the wrong id, permanently invisible to every part of the app that looks up "this coach's groups." See §2.2 for full mechanism and fix direction.

### 6.2 — No rollback anywhere in the signup flow (full detail in §1.2)
`auth.users` and partial `profiles` rows persist indefinitely on any mid-signup failure, with retry masking rather than revealing the original cause. See §1.2.

### 6.3 — Duplicate `coaches` rows possible on double-navigation (full detail in §1.3)
No unique constraint exists to prevent two concurrent signups-confirmations for the same user from both inserting a `coaches` row. See §1.3.

### 6.4 — `handleAssignPlayers` can leave the DB and UI disagreeing about what succeeded (full detail in §2.3)
A `Promise.all` batch where some assignments commit and others don't, reported to the user as uniform failure. See §2.3.

### 6.5 — Push-notification failures are invisible (new, lower-severity)
**Files:** `src/services/workoutPlansService.ts:82-111`, `src/services/messagesService.ts:71-82`

**What it does:** After the core `workout_plans`/`messages` insert succeeds (and is correctly reported as success), both services resolve recipient profile IDs and fire push notifications via `Promise.allSettled` — fire-and-forget, with `workoutPlansService` at least `console.error`-logging failures in a loop, while `messagesService` doesn't even do that.

**Why it's risky:** A coach sees "sent to N athletes" with the correct count, but zero push notifications may have actually gone out, with no coach-facing signal either way.

**Severity: Low-Medium** (notification loss, not data loss)

**Fix direction:** Surface a soft warning if all/most notification sends fail, distinct from the core send's success state.

---

## Suspected Root Cause of Intermittent "Failed to Create Account" Error

**Leading theory:** §1.1 — `AuthContext.tsx`'s `initialize()` has no guard preventing it from racing `AuthCallback.tsx`'s setup sequence when a coach clicks their email-confirmation link. `initialize()`'s single-query path is structurally faster than `AuthCallback`'s multi-step setup, so it can read a `profiles` row (created by an untracked `handle_new_user` trigger) whose `role` hasn't been corrected to `'coach'` yet, trigger a hard `logout()`, and silently redirect the user to a bare `/login` with **no error message at all** — mid-confirmation, before `AuthCallback` finishes setting up `coaches`/`groups`/the `profiles.coach_id` link. From the user's perspective this looks exactly like "I tried to sign up and it just failed," with nothing in the UI to explain why. A pathname guard already exists for the *same* race inside the `onAuthStateChange` listener (with a code comment describing this exact failure mode) — it was simply never applied to `initialize()` as well, which is why the fix is a small, targeted one.

**Compounding factor:** §4.1 — because the one error-classifying utility in the codebase (`errorHandler.ts`) is never called anywhere, every generic catch block in the signup path reports the same handful of vague strings regardless of root cause, which is why this bug (and others, like §2.1 this session) have been hard to pin down from user reports alone — "Failed to create account," "Failed to create group," and a dozen other messages all collapse distinct underlying failures into the same uninformative text.

**Secondary, distinct theory (produces a related-but-different symptom):** §2.2 — the `AuthCallback.tsx` coach-ID mismatch doesn't itself throw or block signup; a coach hitting *only* this bug completes signup successfully and can log in, but then sees "No groups found" with no group ever appearing, which is a different observable symptom ("my account works but nothing's in it") from "account creation failed outright." Worth keeping these two theories separate when validating against real user reports — they'd present differently to an affected coach.

**Recommended validation step:** reproduce a fresh signup end-to-end (new email, real confirmation click) with the browser console open, watching specifically for `AuthContext.tsx`'s `"🔴 [loadProfile]"`/`"User is not a coach"` log lines firing during the confirmation-click page load, which would directly confirm §1.1 is firing.
