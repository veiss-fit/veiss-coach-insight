# Supabase Integration Audit — veiss-coach-insight dashboard

**Scope:** read-only audit of every Supabase touchpoint in this repo (client setup, auth, data access, realtime, error handling, redirects, RLS assumptions, performance). No code was modified.

**Method:** static review of `src/`, `scripts/`, `supabase/migrations/`, and config files, cross-referenced against the live `pg_policies` state captured earlier in this project's working session (see §7 for what's confirmed-live vs. inferred-from-migrations-only).

---

## 1. Client setup

**Single client instantiation:** [src/lib/supabase.ts:13-19](src/lib/supabase.ts#L13-L19)

```ts
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
})
```

Every other file imports this one instance (`import { supabase } from '@/lib/supabase'`) — no second client is constructed anywhere in `src/`.

**Env vars (client / Vercel):**
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — read once, at [src/lib/supabase.ts:5-6](src/lib/supabase.ts#L5-L6) via `import.meta.env`. This is the *only* place `import.meta.env` is read anywhere in `src/` (confirmed by repo-wide grep).
- If either is missing, the client throws at import time: [src/lib/supabase.ts:8-10](src/lib/supabase.ts#L8-L10) — `throw new Error('Missing Supabase environment variables...')`. On Vercel this means a misconfigured deployment fails hard at first page load rather than degrading silently, which is the correct behavior.
- Both vars must be set in Vercel's Project → Settings → Environment Variables using the `VITE_` prefix (required for Vite to expose them client-side). Nothing in the repo enforces this at build time beyond the runtime throw above.
- `.env` and `.env.local` are both gitignored ([.gitignore](.gitignore): `.env`, `.env.local`, `.env.production`) and confirmed **not** tracked in git (`git ls-files` returns nothing for either). Locally, `.env.local` holds both vars; `.env` is present but empty of `VITE_` keys.

**Critical security check — service_role key client-side exposure:**
✅ **Clean.** A repo-wide search for `service_role`/`SERVICE_ROLE`/`SUPABASE_SERVICE` and for JWT-shaped strings (`eyJhbGciOi...`) turned up exactly one hit, and it is not in the client bundle:

- [scripts/seed-fahad.mjs:16](scripts/seed-fahad.mjs#L16) — a standalone Node seed script (not imported by anything in `src/`, not run by any `npm run` script in `package.json`). It takes the service_role key as a CLI argument (`process.argv[2]`) — never hardcoded, never committed, never read from an env var that could leak into a client build. Usage is documented at the top of the file: `node scripts/seed-fahad.mjs <SERVICE_ROLE_KEY>`.

No `.env*` file, no `vercel.json`, and no `src/` file references a service_role key. `vercel.json` itself ([vercel.json](vercel.json)) contains only an SPA rewrite rule (`/(.*)` → `/index.html`) — no env or secret handling there.

**Supabase JS version:** `@supabase/supabase-js@^2.89.0` (`package.json`).

---

## 2. Auth flows

| Flow | File | Notes |
|---|---|---|
| Sign in | [src/pages/Login.tsx](src/pages/Login.tsx) → `login()` in [AuthContext.tsx:289-343](src/contexts/AuthContext.tsx#L289-L343) | `signInWithPassword` → `loadProfile()`, which enforces `role === 'coach'` and logs out + throws otherwise ([AuthContext.tsx:264-268](src/contexts/AuthContext.tsx#L264-L268)). |
| Sign up | [src/pages/Signup.tsx](src/pages/Signup.tsx) → `signup()` in [AuthContext.tsx:345-420](src/contexts/AuthContext.tsx#L345-L420) | Handles three sub-cases: immediate session, email-confirmation-required (`needsConfirmation`), and "already registered" resume (re-signs-in and calls `ensureCoachSetup` idempotently — [AuthContext.tsx:369-385](src/contexts/AuthContext.tsx#L369-L385)). |
| Email confirmation callback | [src/pages/AuthCallback.tsx](src/pages/AuthCallback.tsx) | Owns the full DB setup sequence (`ensureCoachSetup` in [src/lib/coachSetup.ts](src/lib/coachSetup.ts)) for users arriving via the confirmation link. `AuthContext`'s `initialize()` and `onAuthStateChange` listener both explicitly skip profile-loading while `location.pathname === '/auth/callback'` ([AuthContext.tsx:110-113](src/contexts/AuthContext.tsx#L110-L113), [:173-175](src/contexts/AuthContext.tsx#L173-L175)) to avoid racing that setup. |
| Forgot password | [src/pages/ForgotPassword.tsx](src/pages/ForgotPassword.tsx) | Calls `supabase.auth.resetPasswordForEmail` directly (not via the `AuthContext.resetPassword` wrapper — see §4 inconsistency note). |
| Reset password | [src/pages/ResetPassword.tsx](src/pages/ResetPassword.tsx) | Gates the form behind a `PASSWORD_RECOVERY` auth event ([ResetPassword.tsx:17-24](src/pages/ResetPassword.tsx#L17-L24)) before showing the new-password form — sensible, since arriving on this route without that event means the recovery link's token hasn't been exchanged yet. |
| Session handling | [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx) | `initialize()` ([:71-135](src/contexts/AuthContext.tsx#L71-L135)) calls `getSession()` once on mount; `onAuthStateChange` ([:154-235](src/contexts/AuthContext.tsx#L154-L235)) handles `SIGNED_OUT`, `TOKEN_REFRESHED` (updates `user` only, does **not** reload profile — correct, avoids redundant refetches), and sign-in/session events. `persistSession`/`autoRefreshToken` are on by default (§1), so supabase-js handles the actual token refresh; the app only reacts to the resulting events. |
| Route guard | [src/components/ProtectedRoute.tsx](src/components/ProtectedRoute.tsx) | See below. |

**Does the route guard check session before rendering?** Yes, but with one gap:
- While `loading` is true, it renders a full-screen "Authenticating..." overlay and nothing else ([ProtectedRoute.tsx:15-17](src/components/ProtectedRoute.tsx#L15-L17)) — no premature render.
- If `!user`, it redirects to `/login` ([:20-22](src/components/ProtectedRoute.tsx#L20-L22)).
- **Gap:** the role check only runs `if (allowedRoles && profile)` ([:26-32](src/components/ProtectedRoute.tsx#L26-L32)). If `loading` has already flipped to `false` but `profile` is still `null` (e.g. `loadProfile` failed silently, or the profile fetch is mid-flight in a state this component doesn't observe), a role-restricted route (`/history`, `/athlete/:id`, `/messages`, `/send-programming`) renders its children with **no role check performed at all** — the condition is simply skipped rather than treated as "deny." In practice this is narrow (AuthContext keeps `loading: true` until `loadProfile` settles), but it's not structurally guaranteed by `ProtectedRoute` itself.

---

## 3. Every table/RPC touchpoint

**RPC calls: none.** A repo-wide search for `.rpc(` returned zero matches. There is no invite-code RPC, `SECURITY DEFINER` client call, or any other Postgres function invoked via `supabase.rpc()` anywhere in `src/`. The `groups.invite_code` column ([src/types/database.ts:52](src/types/database.ts#L52), integer, nullable) is read as a **plain table column** — [TeamSportManager.tsx:301](src/components/TeamSportManager.tsx#L301) (`team.invite_code`) — not generated or validated by any RPC. If an invite-code RPC exists live in Supabase, it is not called from this codebase; worth confirming directly in the dashboard whether one exists and is orphaned, or whether the premise of a code-side RPC was mistaken.

**Table touchpoints, by file.** "Scope" = whether the query filters by `coach_id`/group/player ownership in the query itself, vs. relying entirely on RLS.

### `src/lib/coachSetup.ts` (account bootstrap)
| Line | Table | Op | Scope |
|---|---|---|---|
| 42 | `profiles` | upsert | `id = userId` (own row) |
| 62 | `coaches` | select | `user_id = userId` |
| 72 | `coaches` | insert | own row (`user_id`) |
| 88 | `profiles` | update | `id = userId` (own row) |

### `src/lib/supabase.ts`
| Line | Table | Op | Scope |
|---|---|---|---|
| 48 | `profiles` | select | `id = userId` (own row) |
| 89 | `coaches` | select | `id = profile.coach_id` |

### `src/services/playersService.ts` (primary roster service)
| Line | Table | Op | Scope |
|---|---|---|---|
| 39 | `groups` | update | `id = teamId` — **not** coach-scoped in the query; relies on RLS (`groups_all_coach`) to reject if the caller doesn't own it |
| 55 | `groups` | delete | same as above — RLS-dependent |
| 68 | `coaches` | select | `user_id = coachUserId` |
| 84 | `groups` | select | `coach_id = coachId` (resolved via `getCoachId`) |
| 106 | `groups` | select | `coach_id = coachId` (new `getCoachGroups`, added this session) |
| 131 | `players` | select | `.in('team_id', teamIds)` when `teamIds` provided; **if `teamIds` is `undefined`, no filter at all** — see §7 |
| 166 | `players` | select | `.in('team_id', teamIds)` |
| 207 | `players` | select | `.eq('id', playerId)` (single player, no coach scope in-query — RLS-dependent) |
| 217 | `workout_plans` | select | `.eq('player_id', playerId)` — no coach scope in-query |
| 225 | `sessions` | select | `.in('user_id', sessionOwnerIds)` |
| 242 | `sessions` | select | `.in('user_id', sessionOwnerIds)` |
| 258 | `reps` | select | `.in('session_id', sessionIds)` |
| 359 | `players` | update | `.eq('id', playerId)` — app-layer ownership check happens *before* this call at [:349-355](src/services/playersService.ts#L349-L355) (`getCoachTeamIds` + `.includes(teamId)`), but only when `coachUserId` is passed |
| 398 | `players` | select | `.in('team_id', teamIds)` |
| 432 | `players` | select | `.in('team_id', teamIds)` |
| 462 | `players` | select | `.eq('id', playerId)` — RLS-dependent |

### `src/services/rosterMetricsService.ts` (batched roster series)
| Line | Table | Op | Scope |
|---|---|---|---|
| 95 | `sessions` | select | `.in('user_id', userIds)` where `userIds` derives from the coach's own player list |
| 114 | `reps` | select | `.in('session_id', sessionIds)`, paginated (`.range()`) |
| 136 | `workout_plans` | select | `.in('player_id', playerIds)` |

### `src/services/sessionsService.ts`
| Line | Table | Op | Scope |
|---|---|---|---|
| 65 | `sessions` | select | `.in('user_id', ownerIds)` |
| 111 | `reps` | select | `.eq('session_id', sessionId)` |
| 127 | `workouts` | select | `.eq('session_id', sessionId)` (fallback path) |
| 251 | `sessions` | select | `.eq('user_id', playerId)` |
| 271 | `reps` | select | `.in('session_id', sessionIds)` |
| 323 | `sessions` | select | `.eq('id', sessionId)` — RLS-dependent |

### `src/services/statsService.ts`
| Line | Table | Op | Scope |
|---|---|---|---|
| 35 | `players` | select | `.in('team_id', teamIds)` |
| 64 | `workout_plans` | select | `.in('player_id', playerIds)` |
| 76 | `sessions` | select | `.or(orParts)` — hand-built OR filter over `user_id`/`player_id` lists (see §8 note) |
| 168, 210, 261 | `players` | select | `.eq('team_id', teamId)` — **these three call sites (`getSessionCount`, `getWeeklyActivity`, `getTeamPerformanceSummary`) are dead code**: no caller anywhere in `src/` (confirmed by grep). Only `getCoachDashboardStats` (line 17) is actually used, by `Index.tsx`. |
| 179, 221, 276, 289 | `sessions`/`reps` | select | same three unused functions |

### `src/services/workoutPlansService.ts`
| Line | Table | Op | Scope |
|---|---|---|---|
| 78 | `workout_plans` | insert | rows carry `coach_id`/`player_id` from caller args, not re-validated against the caller's actual groups in-query |
| 90 | `profiles` | select | `.in('player_id', playerIds)` |
| 147 | `workout_plans` | select | `.eq('player_id', playerId)` — RLS-dependent |
| 172 | `workout_plans` | select | `.eq('coach_id', coachId)` |
| 210 | `workout_plans` | update | `.eq('id', planId)` — RLS-dependent |
| 232 | `workout_plans` | delete | `.eq('id', planId)` — RLS-dependent |
| 261 | `workout_plans` | select | `.in('player_id', playerIds)` |
| 288 | `workout_plans` | select | `.eq('id', planId)` — RLS-dependent |
| 313 | `coaches` | select | `.eq('user_id', userId)` |
| 321 | `workout_plans` | select | `.eq('coach_id', coach.id)` |

### `src/services/messagesService.ts`
| Line | Table | Op | Scope |
|---|---|---|---|
| 38 | `profiles` | select | `.in('player_id', recipientIds)` |
| 69 | `messages` | insert | rows carry `sender_id` from caller arg |
| 126 | `messages` | select | `.eq('sender_id', senderId)` |
| 136 | `messages` | update | `.in('id', ids)` scoped to ids already filtered by `sender_id` above |
| 156 | `messages` | select | `.eq('sender_id', senderId)` |
| 183 | `messages` | select | `.eq('receiver_id', recipientId)` |
| 212 | `messages` | update | `.eq('id', messageId)` — RLS-dependent |
| 234 | `messages` | update | `.eq('id', messageId)` — RLS-dependent |
| 256 | `messages` | delete | `.eq('id', messageId)` — RLS-dependent |
| 278 | `messages` | select (count) | `.eq('receiver_id', recipientId)` |
| 302 | `messages` | select | `.eq('id', messageId)` — RLS-dependent |
| 328, 334, 340 | `messages` | select (count) | `.eq('sender_id', senderId)` |
| 363 | `messages` | select | `.eq('sender_id', userId)` |

### `src/services/coachFeedbackService.ts`
| Line | Table | Op | Scope |
|---|---|---|---|
| 23 | `coach_feedback` | select | `.eq('player_id', playerId)` — not coach-scoped in-query |
| 49 | `coach_feedback` | insert | row carries `coach_id`/`player_id` from caller args |

### `src/contexts/TemplatesContext.tsx`
| Line | Table | Op | Scope |
|---|---|---|---|
| 58, 94, 176 | `coaches` | select | `.eq('user_id', user.id)` |
| 69 | `workout_plans` | select | `.eq('coach_id', coach.id).eq('is_template', true)` |
| 102 | `workout_plans` | insert | carries `coach_id: coach.id` |
| 131 | `workout_plans` | update | `.eq('id', id).eq('is_template', true)` — RLS-dependent for ownership |
| 158 | `workout_plans` | delete | `.eq('id', id).eq('is_template', true)` — RLS-dependent |
| 184 | `workout_plans` | insert | carries `coach_id: coach.id` |

### `src/components/TeamSportManager.tsx`
| Line | Table | Op | Scope |
|---|---|---|---|
| 68, 116 | `coaches` | select | `.eq('user_id', user.id)` |
| 73-77 | `groups` | select | `.eq('coach_id', coachRow.id)` when resolved; **falls back to unfiltered `supabase.from('groups').select('*')`** at line 73 if `coachRow?.id` is falsy — see §7 |
| 130 | `groups` | insert | carries `coach_id: coachRow.id` (guarded — see [:120-125](src/components/TeamSportManager.tsx#L120-L125), refuses to insert with a null coach id) |

### `src/pages/Messages.tsx` / `src/pages/SendProgramming.tsx` (identical pattern, both files)
| Line | Table | Op | Scope |
|---|---|---|---|
| Messages.tsx:63, SendProgramming.tsx:569 | `coaches` | select | `.eq('user_id', user.id)` |
| Messages.tsx:70-71, SendProgramming.tsx:578-579 | `groups` | select | `.eq('coach_id', coachRow.id)` when resolved; **unfiltered `supabase.from('groups').select('id, name')` fallback** when not — see §7 |

### `src/pages/Profile.tsx`
| Line | Table | Op | Scope |
|---|---|---|---|
| 83 | `profiles` | update | `.eq('id', user.id)` (own row) |
| 97 | `coaches` | update | `.eq('user_id', user.id)` (own row) |
| 169, 189, 220 | `avatars` (storage bucket, not a table) | upload/getPublicUrl/remove | keyed by `${user.id}/avatar` path |

### `src/pages/AthleteDashboard.tsx`
| Line | Table | Op | Scope |
|---|---|---|---|
| 550 | `coaches` | select | `.eq('user_id', user.id)` |

**Roster query (N+1) check** — requested specifically: see §8. Short answer: **the N+1 is still present**, just relocated. `rosterMetricsService.ts` (the batched series used for KPIs/sparklines) is genuinely fixed. But the base `avgVelocity`/`attendance`/`loadRec`/`avgROM`/`avgTempo` fields every `PlayerWithStats` row carries — the ones the roster table itself renders — still come from `calculatePlayerStats()` called once per player inside `Promise.all(players.map(...))` at [playersService.ts:140-151](src/services/playersService.ts#L140-L151), and `calculatePlayerStats` itself issues 4 sequential queries per player ([playersService.ts:204-309](src/services/playersService.ts#L204-L309): `workout_plans`, `sessions` ×2, `reps`). For N players that's 1 + 4N queries on every dashboard load.

**Invite-code RPC check** — requested specifically: there is no RPC to check. See the "RPC calls: none" note above.

---

## 4. Error handling

**Pattern used almost everywhere:** destructure `{ data, error }`, check `if (error)`, `console.error` + either `return` a fallback/failure shape or `throw`. This is consistent across `playersService.ts`, `messagesService.ts`, `workoutPlansService.ts`, `sessionsService.ts`, `coachFeedbackService.ts`, `TemplatesContext.tsx`, and `AuthContext.tsx`.

**Calls that destructure `error` but never check it** (assume success):
- [statsService.ts:63](src/services/statsService.ts#L63) — `const { data: allWorkoutPlans } = await supabase.from('workout_plans')...` — no `error` destructured at all, silently proceeds with `undefined` data on failure.
- [statsService.ts:125](src/services/statsService.ts#L135) region — `allSessions` fetch ([:74-79](src/services/statsService.ts#L74-L79)) also drops `error`.
- [statsService.ts:167](src/services/statsService.ts#L167), [209](src/services/statsService.ts#L209), [260](src/services/statsService.ts#L260) (in the three dead functions noted in §3) — `const { data: players } = await supabase...` with no error check.
- [statsService.ts:220](src/services/statsService.ts#L220), [275](src/services/statsService.ts#L275), [288](src/services/statsService.ts#L288) — same pattern (dead code, lower priority).
- [messagesService.ts:125](src/services/messagesService.ts#L125) (`deliverScheduledMessages`) — `const { data: pending } = await supabase...` drops the error; a failed query is indistinguishable from "no pending messages," so it just returns `0` either way. Not dangerous (it's a background poll, retried every 60s per `Index.tsx`), but silent.
- [messagesService.ts:135](src/services/messagesService.ts#L135-L138) — the follow-up `update` in the same function also drops its error.
- [playersService.ts:216-219](src/services/playersService.ts#L216-L219), [223-228](src/services/playersService.ts#L223-L228), [240-246](src/services/playersService.ts#L240-L246) — inside `calculatePlayerStats`, three of the four queries (`workout_plans`, `sessions` ×2) don't check their `error`; only the `players` lookup ([:206-213](src/services/playersService.ts#L206-L213)) and the `reps` query ([:257-261](src/services/playersService.ts#L257-L261)) are unchecked-but-at-least-typed. A failed sub-query here silently produces zeroed-out stats for that player rather than surfacing anything — the outer `catch` only fires on a thrown error, and these don't throw.
- [AuthContext.tsx:449-457](src/contexts/AuthContext.tsx#L449-L457) — `refreshProfile` **does** check its error (this was fixed per the code comment referencing §5.3) — included here as a positive contrast to the pattern above.

**Inconsistency worth flagging:** `ForgotPassword.tsx` calls `supabase.auth.resetPasswordForEmail` directly ([ForgotPassword.tsx:20-22](src/pages/ForgotPassword.tsx#L20-L22)) instead of going through `AuthContext.resetPassword` → `src/lib/supabase.ts`'s `resetPassword` helper ([supabase.ts:137-154](src/lib/supabase.ts#L137-L154)), which wraps the same call in try/catch with a friendlier fallback message. Both do check `error`, so this isn't a bug, but it's a duplicated code path that could drift.

---

## 5. Realtime subscriptions

**File:** [src/hooks/useRealtimeSubscriptions.ts](src/hooks/useRealtimeSubscriptions.ts) — defines five hooks: `useMessagesSubscription`, `useSessionsSubscription`, `useWorkoutPlansSubscription`, `usePlayersSubscription`, and `useDashboardSubscription` (a combined multi-channel version), covering `messages`, `sessions`, `workout_plans`, and `players` tables via `postgres_changes`.

**This entire file is dead code.** A repo-wide search for `useRealtimeSubscriptions`, `useMessagesSubscription`, `useSessionsSubscription`, `useWorkoutPlansSubscription`, `usePlayersSubscription`, and `useDashboardSubscription` found **zero imports anywhere in `src/`** — only mentions in two documentation files (`COMPREHENSIVE_CODE_REVIEW.md`, `CODE_MAP.md`), not in any component or page. No realtime channel is actually opened by the running app.

**Cleanup, if it were used:** correctly implemented — every hook's `useEffect` returns a cleanup function calling `supabase.removeChannel(channel)` ([useRealtimeSubscriptions.ts:31-33](src/hooks/useRealtimeSubscriptions.ts#L31-L33), [:63-65](src/hooks/useRealtimeSubscriptions.ts#L63-L65), [:95-97](src/hooks/useRealtimeSubscriptions.ts#L95-L97), [:127-129](src/hooks/useRealtimeSubscriptions.ts#L127-L129), [:226-230](src/hooks/useRealtimeSubscriptions.ts#L226-L230) for the multi-channel version). If this hook is ever wired up, the cleanup logic itself doesn't need rework.

**Actual "live-ish" data refresh mechanism in use today** is polling, not realtime: [Index.tsx:154-159](src/pages/Index.tsx#L154-L159) calls `deliverScheduledMessages` on mount and every 60 seconds via `setInterval`, with proper `clearInterval` cleanup.

---

## 6. Email/redirect config

**The literal string `coach.veiss.fit` does not appear anywhere in this codebase** (confirmed by repo-wide search). Every redirect target is computed at runtime from the browser's own location — none are hardcoded to a specific domain:

- [AuthContext.tsx:355](src/contexts/AuthContext.tsx#L355) — `emailRedirectTo: `${window.location.origin}/auth/callback`` (signup confirmation link)
- [src/lib/supabase.ts:140](src/lib/supabase.ts#L140) — `redirectTo: `${window.location.origin}/auth/reset-password`` (password reset, via the `AuthContext.resetPassword` path)
- [ForgotPassword.tsx:21](src/pages/ForgotPassword.tsx#L21) — same, on the direct-call path noted in §4

Because these use `window.location.origin`, they automatically resolve to whatever domain actually served the page — `coach.veiss.fit` in production, `localhost:5173` in dev, or a Vercel preview URL — with zero configuration needed per environment. This is env-agnostic by construction rather than being "env-driven" via an explicit `VITE_APP_URL`-style variable; there is no such variable in this repo.

**One thing to verify outside the repo:** Supabase's own **Auth → URL Configuration** settings (Site URL / Redirect URLs allow-list) live in the Supabase dashboard, not in this codebase. If `coach.veiss.fit` isn't in that allow-list, the `redirectTo`/`emailRedirectTo` values above would be rejected by Supabase regardless of what the code sends — this audit can't confirm that allow-list from source alone.

---

## 7. Queries that assume a specific RLS policy

For each, the "assumed policy" is named where it's been confirmed live in this project's Supabase instance (via `pg_policies`, captured earlier this session while working on the `coaches.team_id` migration); others are inferred from the migrations tracked in `supabase/migrations/` only and should be spot-checked against the live policy set.

| Query | File:line | Assumed policy | Confirmed live? |
|---|---|---|---|
| Unfiltered `players` select when `teamIds` is `undefined` | [playersService.ts:131-135](src/services/playersService.ts#L131-L135) | `players_select_coach`: `team_id IN (my_coach_group_ids()) OR (team_id IS NULL AND is_coach())` — must return **zero** rows for a coach whose `my_coach_group_ids()` is empty, otherwise this call leaks every player in the DB to any authenticated coach | ✅ yes (migration 006, confirmed live) |
| Unfiltered `groups` select fallback (`coachRow?.id` falsy) | [TeamSportManager.tsx:73](src/components/TeamSportManager.tsx#L73), [Messages.tsx:71](src/pages/Messages.tsx#L71), [SendProgramming.tsx:579](src/pages/SendProgramming.tsx#L579) | `groups_all_coach`: `FOR ALL USING (id IN (my_coach_group_ids()))` — same requirement: a coach with no `coaches` row must see zero groups, not all groups | ✅ yes (migration 006, confirmed live) |
| `groups` update/delete by id only, no coach filter | [playersService.ts:38-44,50-60](src/services/playersService.ts#L38-L44) (`updateTeam`, `deleteTeam`) | same `groups_all_coach` policy, `USING`/`WITH CHECK` side — must reject writes to a group the caller doesn't own | ✅ yes |
| `players` update by id only (`assignPlayerToTeam`'s DB call) | [playersService.ts:358-361](src/services/playersService.ts#L358-L361) | `players_update_coach`: `USING`/`WITH CHECK` both require `team_id IN (my_coach_group_ids())` | ✅ yes — and this one is defended twice: the caller also does an app-layer check via `getCoachTeamIds` at [:349-355](src/services/playersService.ts#L349-L355) when `coachUserId` is passed |
| `reps`/`sessions`/`workouts` selects by session/player id only | e.g. [sessionsService.ts:111](src/services/sessionsService.ts#L111), [:65](src/services/sessionsService.ts#L65) | "Coaches can manage/read their players `<table>`" policies, now routed through `my_coach_player_ids()` | ✅ yes (rewritten this session in migration `008_coaches_team_id_array.sql`) |
| `coaches` select by id (`profile.coach_id`) | [supabase.ts:89](src/lib/supabase.ts#L89), [AthleteDashboard.tsx:550](src/pages/AthleteDashboard.tsx#L550), etc. | "Coaches can update/view own row" policies (`auth.uid() = user_id`) | ✅ yes |
| `workout_plans` select/update/delete by id only | e.g. [workoutPlansService.ts:210](src/services/workoutPlansService.ts#L210), [:232](src/services/workoutPlansService.ts#L232), [:288](src/services/workoutPlansService.ts#L288) | An assumed `workout_plans` RLS policy scoping by `coach_id`/`player_id` ownership | ⚠️ **not confirmed live this session** — no `pg_policies` dump for `workout_plans` was captured. Recommend running `SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'workout_plans';` to verify before trusting these unscoped client queries. |
| `messages` update/delete by id only | e.g. [messagesService.ts:212](src/services/messagesService.ts#L212), [:256](src/services/messagesService.ts#L256) | An assumed `messages` RLS policy scoping by `sender_id`/`receiver_id` | ⚠️ **not confirmed live this session** — same recommendation, swap `tablename = 'messages'` |
| `profiles` select joins (`messages_receiver_id_fkey` etc.) | [messagesService.ts:157](src/services/messagesService.ts#L157), [:184](src/services/messagesService.ts#L184), [:303](src/services/messagesService.ts#L303) | `profiles_select_coach_players` (migration 006): `player_id IN (my_coach_player_ids())` | ✅ yes, for the coach-reads-player-profile direction. The reverse embed (message sender's own profile via `messages_sender_id_fkey`) relies on "Users can view their own profile" instead — also confirmed by migration 006's comments, not re-verified live this session. |
| `coach_feedback` select/insert by `player_id` only | [coachFeedbackService.ts:23](src/services/coachFeedbackService.ts#L23), [:49](src/services/coachFeedbackService.ts#L49) | An assumed `coach_feedback` RLS policy scoping by coach ownership of the player | ⚠️ **not confirmed live this session** — recommend the same `pg_policies` check, `tablename = 'coach_feedback'` |

**Bottom line:** the two most-exposed unscoped-query patterns (`players` with no team filter, `groups` with no coach filter) are backed by confirmed-live RLS that correctly denies rather than leaks. The ones flagged ⚠️ above (`workout_plans`, `messages`, `coach_feedback`) follow the identical client-side pattern — unscoped-in-query, RLS-dependent — but this audit could not verify their live policies from the repo alone, since (per `AUDIT_FINDINGS.md`'s own note) several policies in this project were created directly in the Supabase dashboard and were never committed as tracked migrations. Worth a direct `pg_policies` check on those three tables before treating them as equally safe.

---

## 8. Data fetch performance

**Confirmed N+1 patterns:**

1. **Roster load, still N+1 despite the partial fix.** `getPlayersWithStatsByCoach` → `getAllPlayersWithStats` ([playersService.ts:126-158](src/services/playersService.ts#L126-L158)) fetches all players in one query, then calls `calculatePlayerStats(player.id)` per player inside `Promise.all` ([:140-151](src/services/playersService.ts#L140-L151)). `calculatePlayerStats` ([:204-309](src/services/playersService.ts#L204-L309)) itself issues **4 sequential queries per player** (`workout_plans`, `sessions` ×2 — one for "last workout," one for a 30-day window, and `reps`). For a roster of N players, that's 1 + 4N round trips on every dashboard load. `rosterMetricsService.ts`'s batched approach (fixed, 3 queries total regardless of N — [rosterMetricsService.ts:5-9](src/services/rosterMetricsService.ts#L5-L9)) covers the *sparkline/KPI* numbers (`recentVel`, `velSeries`, etc.) but not the base `avgVelocity`/`attendance`/`loadRec`/`avgROM`/`avgTempo` fields the roster table itself displays — those still go through the unfixed per-player path. `getPlayersByTeamIds` ([:163-192](src/services/playersService.ts#L163-L192)) has the identical pattern.

2. **`AthleteDashboard.tsx` compounds it.** Opening a single athlete's page calls `getPlayersWithStatsByCoach(user.id)` to load the coach's **entire roster** ([AthleteDashboard.tsx:540](src/pages/AthleteDashboard.tsx#L540)) — triggering the full N+1 above — purely to find one player by id and compute their group peers. A coach with 40 players pays for 40 players' worth of `calculatePlayerStats` calls to open one athlete's detail view.

3. **`getPlayerSessions` is its own N+1**, scoped to one athlete's session history: [sessionsService.ts:81-95](src/services/sessionsService.ts#L81-L95) does `Promise.all(sessions.map(async (session) => { const exercises = await getSessionExercises(session.id); ... }))` — one query per session to pull that session's reps/workouts. For an athlete with 50 logged sessions, that's 50 additional queries on top of the initial sessions fetch.

**Unbounded / missing-pagination queries:**
- `getCoachMessages` ([messagesService.ts:150-172](src/services/messagesService.ts#L150-L172)) and `getPlayerMessages` ([:177-204](src/services/messagesService.ts#L177-L204)) — `getCoachMessages` at least has a `limit` param (default 50, [:152](src/services/messagesService.ts#L152)); `getPlayerMessages` has no limit or pagination at all — a long-lived account's full message history is fetched in one shot every time.
- `getCoachMessageHistory` ([messagesService.ts:360-394](src/services/messagesService.ts#L360-L394)) — no limit; used by both `Messages.tsx` and `History.tsx` per the History page's data source.
- `getCoachWorkoutHistory` ([workoutPlansService.ts:310-362](src/services/workoutPlansService.ts#L310-L362)) — no limit either.
- `getPlayerWorkoutPlans` ([workoutPlansService.ts:142-162](src/services/workoutPlansService.ts#L142-L162)) — no limit; every plan ever sent to a player loads at once.

**Already-fixed / not a concern:**
- `rosterMetricsService.ts`'s `reps` fetch explicitly paginates past PostgREST's 1000-row cap via `.range()` ([rosterMetricsService.ts:112-130](src/services/rosterMetricsService.ts#L112-L130), `MAX_PAGES = 20`, `PAGE_SIZE = 1000`) — the one place in the codebase that handles the cap correctly rather than silently truncating.
- `statsService.ts`'s `getCoachDashboardStats` ([:69-79](src/services/statsService.ts#L69-L79)) builds a hand-crafted PostgREST `.or()` filter string by joining UUID arrays directly into the filter syntax (`user_id.in.(${sessionOwnerIds.join(',')})`). Not an injection risk here specifically (the values are DB-sourced UUIDs, not user input), but it's a fragile pattern — worth switching to `.in()` twice + a client-side union if this code is touched again, rather than hand-building filter syntax.
- Dead code noted in §3 (`getSessionCount`, `getWeeklyActivity`, `getTeamPerformanceSummary` in `statsService.ts`) has its own per-team sequential-query patterns, but since nothing calls these functions, they cost nothing today. Candidate for deletion.

---

## Summary of items worth acting on

1. **Confirm the invite-code RPC premise** — no RPC exists in this codebase; either the SECURITY DEFINER function was never wired up client-side, or it's dead in Supabase. Worth checking the Supabase dashboard directly.
2. **`ProtectedRoute`'s role check has a `profile == null` gap** ([ProtectedRoute.tsx:26](src/components/ProtectedRoute.tsx#L26)) — low severity given how `loading` is managed today, but not structurally guaranteed.
3. **The roster N+1 is not actually fixed** — only the KPI/sparkline series were batched; the base per-player stats still cost 4 queries × N players, and `AthleteDashboard.tsx` pays for the *entire* roster's worth of that just to open one athlete.
4. **`useRealtimeSubscriptions.ts` is entirely dead code** — five unused hooks, zero imports. Either wire it up or delete it.
5. **Three unscoped-and-RLS-dependent tables couldn't be verified this session** (`workout_plans`, `messages`, `coach_feedback`) — recommend a direct `pg_policies` check before assuming they're as safe as the confirmed ones.
6. **A handful of Supabase error objects are silently dropped** (§4) — mostly in `statsService.ts`'s dead functions (low priority) but also in `calculatePlayerStats`'s three unchecked sub-queries, which affects every roster load.
7. **No pagination on several history/message list queries** (§8) — fine at current data volumes, will degrade as message/workout history grows per coach.
