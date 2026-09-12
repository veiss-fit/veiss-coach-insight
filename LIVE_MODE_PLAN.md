# Live Mode (Coach Floor Command Center) — Implementation Plan

**Status:** Planning complete, nothing implemented. No code, migrations, or schema changed as of this document.
**Created:** 2026-07-25
**Verified against live DB:** 2026-07-25 — see **§3.4**. Two assumptions in this document were
wrong; §3.4 supersedes them. **A live data exposure was found (§3.4.1) that is independent of
Live Mode and should be fixed first.**
**Owner repo:** `veiss-coach-insight` (this repo)

---

## 0. What this document is

A full-stack plan for a new **Live Mode** screen in the coach dashboard: a wall-displayable
"command center" showing which athletes are lifting at which rack right now, their current
exercise/set, and whether their bar speed is hitting the prescribed velocity target.

This is a **three-repo feature**. The coach dashboard alone cannot deliver it, because the
data it needs does not currently reach Supabase until an athlete finishes their entire
workout. Read §3 before assuming any part of this is a frontend task.

### Read this first if you are a fresh session

1. **§3.4 — verified live DB state.** Read this before §3.1–3.3, which predate it and contain
   two claims it corrects. §3.4.1 is a live security issue, not a Live Mode task.
2. §2 — decisions already made with the user. Do not re-litigate these.
3. §3 — the findings that constrain everything. Especially §3.2.
4. §9 — open questions that still block Phase 1.

---

## 1. The three repos

| Role | Path | Stack |
|---|---|---|
| Coach dashboard (this repo) | `C:\Users\Siddique\Desktop\veiss-coach-insight` | Vite + React 18 + TS, Supabase |
| Athlete phone app | `C:\Users\Siddique\Desktop\veiss-mobile-app` | Expo / React Native, Supabase |
| Device firmware | `C:\Users\Siddique\zephyrproject\SycamoreSmoothedZephyr` | Zephyr / nRF Connect SDK |

**Physical model:** one BLE device per rack. Up to 5 athlete phones may connect to one
device simultaneously, but only one can be actively lifting on it at a time (see §3.1).

### Design source

The screen was designed in Claude Design, project `019e2355-9f7c-7df5-8a60-b11436a97849`.

- Primary file: `Coach Live - Command Center (TV).html`
- Supporting mock data: `src/live-data.js`, `src/data.js`, `src/coach-data.js`
- Design tokens: `src/styles.css`
- Related unimplemented variants in the same project: `Coach Live - List Rows (TV).html`,
  `Coach Live - List Rows (iPad).html`, `Coach Live Dashboard - Sandbox.html`

Read these with the `DesignSync` tool (`method: get_file`), not WebFetch.

**Note:** the design's mock data is not a spec. Its generator sets `completed = R` with the
comment *"post-set analysis — the full set is logged"*, i.e. even the mock is a
last-completed-set board rather than a rep-by-rep stream. And it models multiple
simultaneously-active athletes per rack, which the firmware does not permit (§3.1).

---

## 2. Decisions locked with the user

| Decision | Answer |
|---|---|
| **Ingestion** | Rewrite the phone to write to Supabase **after every set**. User explicitly chose this over a side-channel table, conditional on nothing critical breaking — see §3.2 for why it is safe. |
| **Rack model** | Device ≡ rack. Coach can name racks and bind device IDs. Backed by a new `devices` table. |
| **Target velocity zone** | From the assigned `workout_plans` row. Implemented as a snapshot column on `reps` (§4.3) rather than a later join. |
| **Purpose** | Status board — "who do I walk to next". Not a ranked leaderboard. |
| **TV auth** | No kiosk mode. Live Mode is a fullscreen mode inside the normal coach dashboard; the coach screenshares that screen. |
| **Rack row states** | Three states: active / resting / flagged. Diverges from the design's two-state (zone/miss) rows. |
| **Scope** | Full stack, all three repos, one sequenced plan. |

---

## 3. Findings that constrain the design

All three were established by reading the actual repos. Cited so they can be re-verified.

### 3.1 Firmware: rack identity is solid, but only one athlete lifts per rack

**Rack identity exists and is durable.** Each unit composes its BLE name at boot as
`<prefix><NNN>` from a number persisted in NVS — `src/Provisioning.cpp:33-37`. Prefix is
compile-time (`V_` baseline, `VL_` lightboard); the number is set via the `SetName`
characteristic (`0000aac0`) or `scripts/provision_device.py`, and survives reboot and OTA.
`CONFIG_BT_DEVICE_NAME` in `prj.conf:38` is only a pre-init placeholder — the real name is
applied in `BLEManager::begin()` (`BLEManager.cpp:840-841`).

The BLE MAC is also stable — there is no `CONFIG_BT_PRIVACY` anywhere in the tree, so no
RPA rotation. Usable as a secondary key. There is **no** FICR serial or Device Information
Service exposed over GATT.

**The firmware computes nothing.** It streams raw 141-byte depth frames (13-byte header +
16 zones × 8 bytes) over the `RawTOF` characteristic (`0000feed`). No velocity, ROM, tempo,
rep index, or set index on the wire — the legacy metric characteristics were deliberately
removed. All VBT numbers are computed on the phone via `lib/veiss`.

**Exclusive-owner model — the constraint that reshapes the design.** Up to 5 phones connect
(`CONFIG_BT_MAX_CONN=5`, `prj.conf:40-41`), but the first to write `start_workout` becomes
`owner_conn` and is the **only** connection receiving rep data
(`BLEManager.cpp:13-18`, `635-637`, `662-667`). Non-owners get only a broadcast
`DevStatus` free/busy. So:

> **At most one athlete is actively lifting per rack at any moment.** Others connected to
> that rack are queued or resting. This is why we use three row states, not the design's two.

No athlete identity exists anywhere in the firmware protocol, and never will without a
firmware change. Attribution is a phone-side responsibility.

### 3.2 Phone app: nothing reaches Supabase until "Finish Workout"

**This is the single most important finding.** A `sessions` row is created only when the
athlete taps Finish, via `onFinishWorkout()` (`screens\workout.js:1326-1437`) →
`syncSingleSession()` (`services\workoutSyncService.js:146-390`), which inserts the session
at lines 226-247 and then loops every rep of every set at lines 314-354. Until then all
state lives in React refs and AsyncStorage.

Consequences:
- An in-progress session is **invisible to Supabase and every other client.**
- `status` is hardcoded `'completed'` — nothing ever writes `'in_progress'`.
- `ended_at` is hardcoded to `${dateISO}T23:59:59Z`, not a real end time.
- `sessions.team_id` and `coach_id` are **always null**. Coach-scoped queries must route via
  `player_id → players.team_id`. Filtering on `sessions.team_id` silently returns nothing.
- `machine_name` is **never populated** — zero matches repo-wide. The firmware's clean
  `V_NNN` rack identity dies on the phone (`contexts\BLEContext.js:22` holds it in state only).
- The BLE busy/free ownership signal (`hooks\useDeviceStatus.js`) is never mirrored
  server-side, so "who owns Rack 3" is currently unknowable from Supabase.
- Set boundaries are a **manual UI gesture** (`components\ExerciseCard.js:233-242`), not
  derived from hardware or timing.

**Why per-set writes are nonetheless low-risk.** The existing sync is already idempotent:
sessions dedup on `metrics @> {localSessionId}` (line 159-166) and every rep is
existence-checked before insert (line 322-330). So incremental writes become an *optimistic
fast path* while the unchanged end-of-session `autoSyncWorkout()` remains the reconciliation
backstop. Wi-Fi dropping mid-lift makes the live view stale but leaves history intact.

Two conditions: replace the per-rep SELECT-then-INSERT (2 round-trips/rep) with a unique
index and one batched upsert per set; and make incremental writes fire-and-forget so they
never block the athlete's UI.

**Also useful:** `players.id = profiles.id = auth.uid()` by design
(`004_auto_create_player.sql:27-39`). The dual-ID handling in this repo's
`playersService.ts:224` is therefore redundant, not a bug.

**Realtime is not a paid feature.** The mobile app already uses it on `messages`
(`013_enable_realtime.sql`), `workout_plans` (`015_...`), and `coach_feedback` (`019_...`).
The `Index.tsx:15` comment "Disabled for free tier" is mistaken.

> **CORRECTED 2026-07-25 by live DB query.** The original text here said Realtime "is simply
> not enabled on `sessions` or `reps`." **That was wrong.** `pg_publication_tables` shows the
> `supabase_realtime` publication already contains `messages`, `players`, `reps`, `sessions`,
> `validated_reps`, `workout_plans`, `workouts`. Realtime on `sessions` and `reps` is **already
> live** — and, because RLS is disabled on those tables (§3.3), it is already broadcasting
> without authorization. This inverts §4.4: there is no publication step left to do, only an
> urgent RLS step. See §3.4.

### 3.3 Coach dashboard: what exists and what is wrong

Reusable:
- `workout_plans.exercises[]` is `{name, sets, reps, weight, weightUnit, targetVelocity}` —
  written by `workoutPlansService.ts:42-49`, authored in `WorkoutBuilder.tsx:451`. The
  plan-derived target zone is viable from data already being written.
- `SessionDetailPanel.tsx:8` already renders velocity with a Recharts `ReferenceArea` target
  band. The spotlight chart is a reuse, not a rewrite.
- Recharts, TanStack Query, and date-fns are all already installed.

Problems on the critical path:
- **`sessionsService.ts:153` fabricates the target zone** as `avgVelocity ± 0.15` — the
  target is derived from what the athlete actually did, so "missed" is impossible by
  construction. Must be replaced by the real prescribed target.
- **`playersService.getAllPlayersWithStats` is N+1** — `calculatePlayerStats` runs ~4
  queries per athlete (`playersService.ts:141-153`, `207-304`). This must not go anywhere
  near a continuously-refreshing screen. Live Mode gets its own service.
- **RLS is broken — verified 2026-07-25, and it is worse than "missing."** See §3.4. The
  2026-04-11 audit said policies were absent; in fact policies **exist and are correct-looking
  but are not enforced**, because `relrowsecurity = false` on the tables that carry them.
  Postgres ignores policies entirely when RLS is disabled. This is more dangerous than no
  policies, because anyone auditing `pg_policies` sees a populated, sensible-looking policy set
  and concludes the data is protected.
- The commented-out `useDashboardSubscription` block at `Index.tsx:136-169` is unfiltered by
  coach/team. Do not simply uncomment it.

### 3.4 VERIFIED DB STATE (2026-07-25) — resolves the §9.1 blocker

Queried live via read-only MCP against project `xjyugqxdfrbluprtgftj`. These are facts, not
inferences from migration files. **This section supersedes any conflicting claim above.**

#### 3.4.1 Live data exposure — fix before any Live Mode work

Seven tables carry RLS policies with **RLS not enabled**, so the policies are inert:
`players`, `profiles`, `push_tokens`, `reps`, `sessions`, `workout_plans`, `workouts`.
Supabase's own linter flags every one as `policy_exists_rls_disabled` (ERROR) and
`rls_disabled_in_public` (ERROR).

Grants compound it — `has_table_privilege` confirms on all seven:

| Role | Privileges |
|---|---|
| `anon` | SELECT, INSERT |
| `authenticated` | SELECT, UPDATE, DELETE |

Confirmed by unauthenticated REST call using the publishable key that ships in the browser
bundle — no login required. Row counts returned: `sessions` 60, `reps` 2691, `players` 3,
`profiles` 6, `push_tokens` 2. `push_tokens.token` is flagged `sensitive_columns_exposed`.

So today: anyone with the public key can read every athlete's training history across every
coach, and insert rows. Any signed-in user can update or delete them. Tables **with** RLS
correctly enabled, for contrast: `coaches`, `groups`, `messages`, `notification_preferences`,
`validated_reps`, `firmware_releases`.

The fix is one line per table (`ALTER TABLE … ENABLE ROW LEVEL SECURITY`) — but it is not
zero-risk, because the moment RLS switches on, the existing policies start being enforced for
the first time ever. Any app query relying on unrestricted access breaks at that instant. It
needs staging verification, not a blind production apply.

Also flagged: six `SECURITY DEFINER` functions are `EXECUTE`-able by `anon`, including
`lookup_group_by_invite_code(bigint)` and `get_my_coach_team_id()`.

#### 3.4.2 Schema ground truth

| Plan assumption | Verified reality |
|---|---|
| `devices` table is new (§4.1) | Correct — no such table |
| `reps.target_velocity` needed (§4.3) | Correct — absent |
| `reps` unique-index columns exist (§4.3) | Correct — `session_id`, `exercise_name`, `set_number`, `rep_number` all present |
| `sessions` needs `device_id`/`last_set_at`/`owns_device` (§4.2) | Correct — all three absent |
| `reps.machine_name` "never populated" (§3.2) | Column **does** exist; unpopulated, so ready to use |
| Summary column shape TBD (§9.3) | `sessions.metrics` **jsonb already exists** — but is in use for `localSessionId` dedup |

Full column lists:
- `reps` — `id, session_id, player_id, exercise_name, machine_name, set_number, rep_number, weight, average_rep_speed, created_at, concentric_duration_s, eccentric_duration_s, rom_mm`
- `sessions` — `id, team_id, coach_id, name, started_at, ended_at, created_at, metrics, status, user_id, player_id`

#### 3.4.3 There is no `teams` table

`public` contains **no** `teams` table or view. The real table is `groups`
(`id, name, created_at, invite_code, coach_id`) — note `coach_id`, **not** `coach_user_id`.

This makes three things stale:
1. **`CLAUDE.md`** states "All queries filter by `teams.coach_user_id = auth.uid()`." Neither
   the table nor the column exists.
2. **`src/types/database.ts:51,60,69`** declares `coach_user_id` — regenerate from live schema.
3. The `getCoachTeamIds` "fall back if `coach_user_id` is missing" logic is guarding against a
   column that was never going to be there.

The **application code is correct** — it queries `groups` filtered by `coach_id` throughout
(`playersService.ts:37,56,75,108,469`, `AuthContext.tsx:376`, and the four builder components).
Only the docs and generated types drifted. §7's routing via `player_id → players.team_id`
remains valid; `players.team_id` exists and the RLS policies join on it.

---

## 4. Data model changes

### 4.1 `devices` — new rack registry

The missing link between firmware and dashboard.

| column | purpose |
|---|---|
| `id` uuid pk | |
| `device_name` text unique | the firmware's NVS `V_NNN` — the durable join key |
| `ble_mac` text null | secondary identifier; stable, no RPA configured |
| `label` text | coach-editable "Rack 1", "Platform 2" |
| `coach_id` / `group_id` | facility scoping |
| `grid_position` int | position in the 6-panel TV layout |
| `is_active` bool | retire a unit without deleting history |

### 4.2 `sessions` — additions

- `device_id` uuid FK → `devices`, plus raw `device_name` text as fallback for unregistered units
- `status` extended to allow `'in_progress'`
- `last_set_at` timestamptz — drives active/resting/stale classification
- `owns_device` bool — mirrors the firmware's BLE owner flag (§3.1)
- `team_id` populated at creation from `players.team_id`, so RLS and Realtime filters have
  something to filter on
- `ended_at` fixed to a real timestamp

Plus a rolling summary column for the Realtime strategy in §5 (current exercise, set n/total,
reps completed, last-set velocities, on-target/missed counts) — shape TBD, likely jsonb.

### 4.3 `reps` — two changes

1. **Unique index on `(session_id, exercise_name, set_number, rep_number)`.** Makes upserts
   idempotent and lets us delete the per-rep existence check entirely.
2. **`target_velocity` snapshot column**, written at insert time from the phone's
   `sessionPrescriptionsRef` (which already holds it —
   `veiss-mobile-app/services/workoutPlansService.js:68,137`, `workout.js:734`, currently
   display-only).

The snapshot is the important one. It eliminates exercise-name drift as a correctness
problem: no fuzzy-matching a rep back to a plan later, and the target stays historically
accurate even if the coach edits the plan afterward. It also lets us delete the fake zone in
`sessionsService.ts:153`.

There is no `plan_id` on `reps` or `workouts` today, and the only plan linkage is
`workout_plans.is_completed`. The snapshot approach sidesteps needing one.

### 4.4 RLS and Realtime

~~Policies on `sessions`, `reps`, `workout_plans`, `devices` — **then** add `sessions` to the
`supabase_realtime` publication. In that order, always.~~

**REVISED 2026-07-25.** The stated order is right in principle but describes work that has
already happened out of order in production. Per §3.4.1: policies already exist, the
publication already contains `sessions`/`reps`/`players`/`workout_plans`/`workouts`, and RLS
is off. So the actual remaining work is:

1. **Enable RLS** on the seven tables in §3.4.1 — verify against staging first, since this is
   the first time those policies will ever be enforced.
2. Re-run `get_advisors(security)`; confirm `policy_exists_rls_disabled` and
   `rls_disabled_in_public` are clear.
3. Only then write **new** policies for `devices`, and enable RLS on it at creation.
4. No publication change needed for `sessions`. Confirm whether `reps` should stay published
   at all — §5 argues the TV subscribes to `sessions` only, so `reps` in the publication may
   be unnecessary changefeed volume.

---

## 5. Realtime strategy: subscribe to sessions, not reps

Sixteen athletes × five reps per set is a lot of changefeed traffic for a wall display, and
the TV does not need rep granularity at a glance.

- The phone writes a **compact rolling summary onto the session row** on each set completion.
- The TV subscribes only to `sessions`, filtered by the coach's teams.
- Full rep detail is fetched **lazily** when the coach opens the spotlight overlay.

One row per athlete, one Realtime message per set, instead of one per rep.

---

## 6. Mobile app changes

1. **On device connect** — resolve BLE name → `devices` row; create the `in_progress` session
   with `device_id`, `team_id`, real `started_at`.
2. **On `workout:set:completed`** (`workout.js:910`) — batched upsert of that set's reps with
   `target_velocity` stamped, plus the session summary update. Fire-and-forget.
3. **On BLE ownership change** (`hooks\useDeviceStatus.js`) — mirror `owns_device` so the TV
   can distinguish the active lifter from those resting on the same rack.
4. **On Finish** — `status='completed'`, real `ended_at`. Existing full sync runs unchanged as
   the reconciler.
5. **Stale sessions** — an app killed mid-workout leaves `in_progress` rows forever. Needs a
   `last_set_at` staleness cutoff in the read query plus a server-side sweep.

---

## 7. Coach dashboard changes

- **`liveFloorService.ts`** — one scoped query (via `player_id → players.team_id`, *not*
  `sessions.team_id` — see §3.2) plus the Realtime hook. Deliberately separate from
  `playersService` because of its N+1.
- **Live Mode** — a mode on `/` entered by a button, using the Fullscreen API with the
  design's scale-to-fit 1920×1080 canvas (`fit()` in the design source). Screenshares cleanly
  at any resolution.
- **Rack grid** — three-state rows (active / resting / flagged), active lifter visually
  dominant in each panel.
- **Spotlight overlay** — reuses the `ReferenceArea` band pattern from
  `SessionDetailPanel.tsx:8`.
- **Device management UI** — label racks, bind `V_NNN`, set grid positions.
- **Token bridge** — the design ships raw CSS custom properties (`--surface-0`, `--ink-0`,
  `--good`, `--bad`, …); this app is Tailwind + shadcn HSL vars. Needs a **scoped** token
  layer. Do not import the design's `styles.css` globally — it sets bare `html, body, *`
  rules that would leak into every existing page.

---

## 8. Sequencing

| Phase | Work | Verifiable by |
|---|---|---|
| ~~0~~ | ~~Verify DB state (§9)~~ **DONE 2026-07-25** | see §3.4 |
| **-1** | **Enable RLS on the 7 exposed tables (§3.4.1). Ships alone, before any Live Mode work.** | `get_advisors` clean; anon REST call returns 0 rows |
| 1 | Migrations: `devices`, `sessions` cols, `reps` cols + unique index | columns present; duplicate rep upsert is a no-op |
| 2 | Mobile per-set writes | rows appearing in Supabase mid-lift |
| 3 | `liveFloorService` + Realtime hook | live data logged in the coach app |
| 4 | Live Mode UI | the screen itself |
| 5 | Device/rack management UI | coach can label a rack |
| 6 | Polish, `sessionsService.ts:153` cleanup | |

Phases 1–2 are independently verifiable by watching rows appear during a real lift, well
before any UI exists. Do not build UI first — it would be built against assumptions.

---

## 9. Open questions / blockers

1. ~~**DB read access.**~~ **RESOLVED 2026-07-25** — read-only Supabase MCP connected; full
   verified state in §3.4. The concern was justified: two of this document's assumptions were
   wrong (Realtime already published; RLS written-but-disabled rather than absent), and
   `teams` turned out not to exist at all.
2. **Session-summary Realtime approach (§5)** — confirmed as the right trade-off, or
   subscribe to `reps` directly and accept the volume? *Now also ask: should `reps` be
   **removed** from the publication, given it is already in it (§3.4.1)?*
3. Shape of the session summary column — jsonb blob vs discrete columns. *New input:
   `sessions.metrics` jsonb already exists but carries `localSessionId` for sync dedup
   (§3.2). Extending it couples live-view state to sync bookkeeping; a separate
   `live_summary jsonb` column keeps the concerns apart. Leaning separate column.*
4. **NEW — will enabling RLS break the apps?** The existing policies have never been enforced.
   `Users INSERT their sessions` / `Users INSERT their reps` have `qual = null`; their
   `WITH CHECK` clauses need reading before flipping the switch. The coach-side policies join
   `players → coaches` on `team_id`, so any coach whose `coaches.team_id` is null loses
   visibility of their own athletes the instant RLS turns on. Must be tested on a branch or
   staging copy first.

---

## 10. Risks

**Provisioning is an operational blocker.** Every unit ships as `V_000`, and unprovisioned
units are mutually indistinguishable. A rack-mapping pass with `scripts/provision_device.py`
must happen before any of this means anything on a real floor.

**Rack ownership is unauthenticated first-writer-wins.** Two phones tapping start
near-simultaneously can hand ownership to the wrong athlete, with no server-side
arbitration. `FIRMWARE_REVIEW.md` finding #4 also notes `shutdown` is not owner-gated, so any
connected phone can kill any rack's set. Both are firmware follow-ups, out of scope here.

**Free-text exercise names** (`workout.js:1231-1239`) will not match plans for ad-hoc lifts.
There is no shared enum between the coach's plan builder and the athlete's entry field. The
`target_velocity` snapshot makes these degrade gracefully — no zone shown — rather than
mismatching against the wrong target.

**Gym Wi-Fi.** Incremental writes must be fire-and-forget. The end-of-session reconciler is
the safety net; the live view going stale is an acceptable failure mode, a blocked UI is not.

**`frameId` is not a durable key.** It is `uint16_t`, wraps roughly every 36 minutes at 30 Hz,
and resets to 0 on every reboot (`main.cpp:553`, `FIRMWARE_REVIEW.md:87-89`).

---

## 11. Deliberate divergences from the design

Record these so nobody "fixes" them back:

1. **Three row states instead of two.** The design gives every athlete only zone/miss. The
   firmware's exclusive-owner model means only one athlete per rack is lifting at a time, so
   active/resting/flagged is the honest model. Without it the screen cannot distinguish
   someone mid-set from someone who finished ten minutes ago.
2. **No fixed `LAYOUT = [4,3,2,4,2,1]`.** Rack occupancy is derived from live data, not
   hardcoded.
3. **Target band is the prescribed zone**, not `target → target × 1.15` computed from mock
   seeds.
4. **Status board only.** No leaderboard/ranking mode, per §2.
