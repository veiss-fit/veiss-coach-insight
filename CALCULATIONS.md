# CALCULATIONS.md

Authoritative reference for every number, chart, and badge rendered on the coach
dashboard: what it actually computes, where the inputs come from, and what its
known limitations are. Written as part of the fix for a prior data-correctness
audit of this dashboard (findings delivered in conversation, not checked into
the repo); this file is the living source of truth going forward, not a
one-time report.

Conventions used below:
- **DB/JSON fields** — the literal Supabase columns or `workout_plans.exercises`
  jsonb keys the number is built from.
- **Rounding** — exact rounding/formatting applied before display.
- **Limitations** — anything a coach should know before trusting the number.

---

## 1. Targets Reached (the new headline VBT metric)

Replaces raw cross-exercise average velocity everywhere it was previously shown
as a single blended number (team KPI, roster table, focus cards, athlete KPI
strip). Implemented in `src/lib/targetEvaluation.ts`.

**What it measures**: of all logged reps whose exercise has a coach-set target
velocity range, what fraction landed inside that range.

**Formula**:
1. A plan exercise counts as "targeted" only when the coach set **both**
   `targetVelocityMin` and `targetVelocityMax` on that exercise (in
   `workout_plans.exercises[]`, alongside the existing `perSet`/`weight`
   fields). A one-sided range is not evaluable and is treated as untargeted.
2. A rep is matched to a target by same-day plan + exercise name: take the
   session's date, look up that player's plan(s) for that date, find the
   exercise entry whose `name` matches the rep's `exercise_name`
   (case-insensitive, trimmed — see Limitations), and read its range.
3. A rep "hits" its target when `average_rep_speed` falls within
   `[min, max]` inclusive. A rep whose exercise has no target that day is
   **excluded from both numerator and denominator** — untracked, not a miss.
4. Aggregate as `inTarget / withTarget`, at whatever grouping is needed
   (session, athlete, team, week) — because every counted rep is normalized to
   its own exercise's range before aggregating, summing hits across different
   exercises is valid, unlike raw m/s.

**Rounding**: displayed percentage is `Math.round(inTarget / withTarget * 100)`.

**Empty state**: if `withTarget === 0` for the period being shown, the UI
renders **"No targets set"**, never "0%" — 0% would read as a failed session
when there was nothing to hit or miss in the first place.

**Where it's shown**:
| Location | Level | Window |
|---|---|---|
| `Index.tsx` "Targets reached" KPI tile | team | 8 weeks (rosterMetricsService) |
| `AthleteTable.tsx` "Targets reached" column | per athlete | 8 weeks |
| `AthleteCard.tsx` "Targets reached" tile | per athlete | 8 weeks |
| `AthleteDashboard.tsx` KPI strip "Targets reached" | per athlete | this athlete's full session history |
| `RepTraceChart` band in Sessions tab | per session, per exercise | that one session |

**Limitations**:
- **Name matching is fuzzy.** `reps.exercise_name` (set by whatever logged the
  session — hardware/mobile app) is matched against the coach-typed
  `workout_plans.exercises[].name` by case-insensitive trim only. If a coach
  types "Back Squat" and the logging side records "back squat " or a
  differently-spelled variant, the rep silently falls into "untracked" (safe
  failure — it never gets miscounted as a miss, it just doesn't count at all).
  There's no fuzzy/synonym matching.
- **Same-day-only matching.** If a plan is assigned for one date but the
  athlete actually logs the session on a different date, the reps won't match
  that plan's targets. This mirrors the same-day convention already used for
  attendance matching elsewhere in the app (`workoutAttendance.ts`).
- **Multiple same-day plans**: if a coach assigns more than one plan to the
  same athlete on the same date and both target the same exercise name
  differently, the later plan silently wins (no natural tie-break exists).
- Historical plans (sent before this feature shipped) have no target fields at
  all — those reps are always "untracked," not backfilled with a synthetic
  target. This is expected, not a bug.
- The athlete-level KPI-strip tile and the roster-wide tiles use **different
  windows** (this athlete's full history vs. the roster's fixed 8-week window)
  because they're fed by different services (`sessionsService`/local computation
  vs. the batched `rosterMetricsService`). They are not expected to match to
  the rep for the same athlete on the same day — they're two different
  aggregation windows by design, exactly like the pre-existing avgVelocity
  windows before this fix.

---

## 2. Load recommendation (Increase / Decrease / Maintain / No target set / New)

`src/services/playersService.ts` → `calculatePlayerStats`, classified via
`src/lib/targetEvaluation.ts` → `computeLoadRecommendation`.

**Formula** (exact rule):
1. Build every `(session, exercise)` pair the athlete has trained in the last
   30 days, with that pair's mean `average_rep_speed`.
2. Keep only the pairs whose exercise had a coach-set target on that specific
   session's date (same matching as Targets Reached above).
3. Take the **single most recent** such pair (by session date).
4. Classify:
   - mean velocity **above** `targetVelocityMax` → **"Increase Load"**
   - mean velocity **below** `targetVelocityMin` → **"Decrease Load (Fatigue)"**
   - otherwise → **"Maintain"**
5. If the athlete has sessions in the last 30 days but **none** of their
   trained exercises ever carried a target on the matching date →
   **"No target set"**.
6. If the athlete has **no sessions at all** in the last 30 days → **"New"**.

There is no fallback to a global velocity threshold (the old 0.85/0.40 m/s
constants are gone entirely) — an untargeted exercise reports "No target set,"
it never silently reuses a generic threshold.

**Where it's shown**: `LoadRecChip` (`src/components/pulse/chips.tsx`) on
`AthleteCard.tsx`, `AthletePicker.tsx`; the "Load recommendation mix" donut +
legend on `Index.tsx` (4 buckets now: Increase / Maintain / Reduce / No target,
via the shared `classifyLoadRec` classifier so the chip and the donut can never
independently drift out of sync the way the original bug did — see §7).

**Limitations**: "most recent" is by session date only, not by which exercise
was most recently *added* to a plan — an athlete who trained a stale, still-
targeted exercise yesterday and a freshly-targeted one last week will be
classified off yesterday's exercise. This is a deliberate, simple recency rule,
not a weighted or exercise-specific recommendation per lift.

---

## 3. Attendance — three independent, intentionally different numbers

There are three separate attendance/adherence calculations in this app after
this fix. **They are not expected to match** — they measure different things
by design. This section exists specifically to keep that from being
"discovered" as a bug again.

### (a) Roster-wide "Avg attendance" KPI — `Index.tsx`
**Source**: `rosterMetricsService.ts` → `RosterTeamMetrics.avgAttendance` +
`attSeries`.
**Formula**: `sum(is_completed) / count(*)` over every non-template
`workout_plans` row across the whole roster, in the current 8-week window —
**the exact same underlying rows** that `attSeries` buckets by week for the
sparkline/delta. This was the Part 1 item 3 fix: previously the headline
number came from a completely different, all-time, session-matching formula
(`getAttendanceSummary`) than its own trend line — they could disagree with no
explanation. Now both the number and its trend come from one pipeline, so they
always agree by construction.
**DB fields**: `workout_plans.date`, `workout_plans.is_completed`,
`workout_plans.is_template` (`= false`).
**Rounding**: `Math.round(completed/total * 100)`.
**Does NOT** count self-logged sessions with no matching plan — pure plan
completion, matching the tile's own footnote copy ("plan completion, wk over
wk").

### (b) Per-athlete "Attendance" — `AthleteCard.tsx`, `AthleteTable.tsx`,
`AthleteDashboard.tsx` KPI strip, `InsightRail`
**Source**: `playersService.ts` → `calculatePlayerStats` → `getAttendanceSummary`
(`src/lib/workoutAttendance.ts`).
**Formula**: richer than (a) — for each of this athlete's plans, resolves
status as completed/pending/missed (matching a session by `session_id` first,
then same-day-title fallback), then adds any **unmatched self-logged sessions**
(sessions with no corresponding plan) into both the numerator and denominator
as additional "completed, untracked-by-a-plan" workouts. All-time, not
windowed.
**DB fields**: `workout_plans.date/title/is_completed/session_id`,
`sessions.id/created_at/name/status`.
**Rounding**: `Math.round(completedTracked/totalTracked * 100)`.
**Why it differs from (a)**: different window (all-time vs. 8 weeks), different
scope (includes self-logged sessions vs. plan-only), different match logic.
This was flagged in the original audit as internally self-consistent and
correctly labeled — not changed by this fix.

### (c) Programming tab "Plan adherence" — `AthleteDashboard.tsx` → `ProgrammingTab`
**Source**: local calc in `AthleteDashboard.tsx`, `adherencePct`/`adherenceWeeks`.
**Formula**: `completed / assigned` over `workout_plans.is_completed`, last 30
days, bucketed by week for the bar rows. **No session matching at all** — pure
`is_completed` flag count, unlike (a) and (b).
**DB fields**: `workout_plans.date`, `workout_plans.is_completed`.
**Rounding**: `Math.round(...)`.

**Summary**: (a) is roster-wide/8-week/plan-only. (b) is per-athlete/all-time/
plan+self-logged-sessions. (c) is per-athlete/30-day/plan-only. All three are
legitimate, all three can show different percentages for the same athlete at
the same moment, and none of them is "the bug" — this is documented, not fixed
into one number, per explicit instruction.

---

## 4. Velocity drop-off (within-session fatigue)

Two implementations exist, now **both correct and in agreement in their
partitioning logic** (they were not before this fix):

### Roster-wide flag/priority score — `rosterMetricsService.ts`
`computeDropPctFromRows` — reimplements the same per-exercise partitioning as
(below) over raw `{exercise_name, set_number, average_rep_speed}` rows (a
roster-wide batched query can't afford a per-player `sessionsService` fetch).
**Formula**: group a session's reps by `exercise_name` (excluding hardware
artifact names — "Workout", "Exercise", etc.), then within each exercise with
≥2 distinct `set_number`s, compute `(firstSetAvg − lastSetAvg) / firstSetAvg`.
Average that ratio across all qualifying exercises in the session. **This is
the fix** — previously all reps in a session were pooled by raw `set_number`
regardless of exercise, so a squat's set 1 and a bench's set 1 got averaged
together.
**Where shown**: "Velocity drop N%" flag on `AthleteCard.tsx` focus cards
(`rosterFlags.ts`), and feeds `priorityScore` (sort order for "Worth a look").
**Rounding**: `Math.round`, clamped to [-100, 100].

### Athlete detail page — `athleteSummaryUtils.ts` → `sessionVelocityDropoff`
Same partitioning logic, operating on already-exercise-grouped `SessionData`
(no raw-row reimplementation needed here). **Unchanged by this fix** — it was
already correct; the audit confirmed it and explicitly said not to touch it.
**Where shown**: AthleteDashboard KPI strip "Velocity drop-off", Readiness tab,
Sessions tab row summaries.

**Why two implementations at all**: the roster-wide path can't fetch full
per-exercise `SessionData` for every athlete (N+1 problem, deliberately
avoided — see `rosterMetricsService.ts` file comment), so it works from raw
rows instead. Keep the two in sync manually if the partitioning rule ever
changes; there's a comment in `rosterMetricsService.ts` pointing back here.

---

## 5. Weight, weight unit, and per-set load

`src/services/sessionsService.ts` → `RepData.weight`.

**Formula**: each rep now carries its **own** logged `weight` value (from
`reps.weight`), rather than the whole exercise showing one number taken from
its first set. Ramping/pyramid sets (different load per set) now display each
set's own true weight — computed as the mean of that set's reps' weights (rows
within one set should share a weight; mean is defensive against any noise).

**Where shown**: per-set label in `RepTraceChart` (Sessions tab), per-point
load axis in the Load–velocity profile chart (Performance tab).

**weightUnit — UNVERIFIED, documented per instruction rather than guessed.**
`ExerciseData.weightUnit` is hardcoded to `'lbs'` everywhere weight is
displayed. The `reps` table has **no unit column at all**
(`src/types/database.ts`), so there is no DB signal to check this against, and
this session had no access to the mobile app's logging UI to confirm what unit
the athlete actually sees when entering a weight. **This is left as-is,
unverified** — do not assume it's correct. Whoever next has access to the
mobile repo should confirm the input label/unit shown to athletes when logging
a weight, and fix this hardcode if it's wrong.

---

## 6. Load–velocity profile chart (Performance tab)

`AthleteDashboard.tsx` → `fvByExercise` / `ForceVelocityChart`.

**Formula**: for the selected exercise only (see below), one point per set in
the last 56 days: `(mean set weight, mean set velocity)`, colored darker if
within the last 14 days. A least-squares regression line is drawn through the
selected exercise's own points only.

**Fix applied**: previously every exercise a session touched was plotted (and
regressed) on one shared chart — a squat's load-velocity pairs and a bench's
were mixed on the same axis and the same regression line, which has no
biomechanical meaning (load-velocity only exists within one exercise). Now the
chart is scoped to **one exercise at a time**, selected via buttons above the
chart (defaults to whichever exercise has the most data points in the window).
`unitLabel` is resolved from the selected exercise's own `weightUnit`, not
"whichever exercise the loop happened to process last."

**Limitation**: still subject to the weightUnit caveat in §5.

---

## 7. Load recommendation mix donut (Index.tsx)

**Fix applied**: previously compared `athlete.loadRec === "Increase"` /
`"Decrease"` by strict equality against strings the recommendation engine never
actually produced (it produced `"Increase Load (+5%)"` /
`"Fatigue: Decrease Load (-10%)"`), so every athlete fell into the `else`
branch and the donut always showed 100% Maintain regardless of the real mix.
Same root-cause bug existed independently in `LoadRecChip`. Both are now driven
by one shared classifier, `classifyLoadRec()` in `targetEvaluation.ts`, which
buckets by prefix (`"increase"...`/`"decrease"...`) or exact match
(`"maintain"`/`"no target set"`/`"new"`), so the chip and the donut can't
independently diverge the way they did before.

**4 buckets** (was 3): Increase / Maintain / Reduce / **No target** — "No
target set" is a distinct state from "Maintain" (one means "on pace against a
real target," the other means "nothing to evaluate yet") and was previously
invisible, folded silently into "Maintain."

---

## 8. Fixed "fake target" renderings

Two places previously drew a target line/band that had no connection to any
real coach-assigned target. Both now read the real
`targetVelocityMin`/`targetVelocityMax` from the matching plan exercise (same
matching as §1), and draw **nothing** when no real target exists for that
exercise instance — no placeholder line, no fabricated range.

- **`RepTraceChart` (Sessions tab)**: was `exercise avgVelocity − 0.15`
  (self-referential — an exercise was always being compared to a shifted
  version of its own average, so "in zone" was structurally guaranteed for
  reps near the mean and told a coach nothing about whether the athlete hit
  what was actually prescribed). Now draws a real shaded min/max band from the
  plan, or nothing.
- **12-week velocity trend chart (Performance tab)**: was a hardcoded
  `[0.55, 0.85]` band for every athlete regardless of exercise. This chart
  blends every exercise into one weekly average line, so — unlike the other
  two fixes — there is **no single valid target** that could ever apply to it
  (it isn't scoped to one exercise the way RepTraceChart or the FV chart are).
  The fix here is to **never draw a band on this chart at all**, and the
  caption now says so explicitly, pointing to the Targets Reached KPI and the
  per-exercise velocity range chart as the places to look for target-anchored
  numbers instead of trying to fabricate a per-chart target that can't exist.

---

## 9. Unchanged, still-correct numbers (confirmed, not touched)

Per explicit instruction, these were verified correct and left alone:

- **Per-exercise velocity range chart** (`ExerciseRangeChart`,
  AthleteDashboard Performance tab) — already correctly split by exercise
  name, min/max/avg per exercise over the last 4 weeks (falls back to
  all-time). Still the right place to look at raw velocity trends per lift.
- **Deviation-from-baseline / z-score anomaly panel**
  (`athleteSummaryUtils.ts` → `computeAnomalyIndicators`, Readiness tab) —
  confirmed correct formulas (baseline mean/SD over historical sessions vs.
  last-4-session mean, z-score RAG thresholds); tooltips in the UI already
  match the code exactly. Not modified.
- **Readiness score** (Readiness tab ring) — documented as a heuristic in its
  own UI copy, formula unchanged: `100 − drop×1.4 − min(daysSinceLast,30)×2`,
  clamped [20,100].
- **Group-vs-athlete comparison "Avg velocity" row** (InsightRail) — still a
  raw average (not target-based); this is a comparative/secondary number, not
  a headline metric, and wasn't in scope for replacement. `recentVel` remains
  available in `AthleteDashboard.tsx` for this one purpose.
- **Sort-by-velocity / "gain" flag** — `RosterAthleteMetrics.recentVel` /
  `velDelta` remain computed in `rosterMetricsService.ts` for the roster sort
  dropdown (now "Sort: Targets reached," see §10) and the "Velocity ↑" gain
  flag in `rosterFlags.ts`; not removed, just no longer shown as a headline
  number.

---

## 10. Removed dead code (Part 1 item 8)

- `src/data/mockData.ts` — zero importers, deleted.
- `src/services/statsService.ts` — deleted in full. `getTeamPerformanceSummary`,
  `getWeeklyActivity`, `getSessionCount` were never called anywhere
  (confirmed; `getTeamPerformanceSummary` was also internally broken — it
  filtered on `r.session_id`, a field its own `reps` query never selected).
  `getCoachDashboardStats` was called exactly once, by `Index.tsx`'s "Avg
  attendance" tile; that tile now sources its number from
  `rosterMetricsService` instead (§3a), which made this entire file's only
  live caller go away — deleting it is a direct consequence of the Part 1
  item 3 fix, not scope creep.
- `DashboardStats.avgTeamLoad` (was a literal alias for `avgAttendance`),
  `.topPerformer`, `.lowestAttendance` — computed, never rendered. Moot now
  that the whole type is deleted along with the file.
- `PlayerWithStats.engagement` — computed (`attendance≥90 && avgVelocity≥0.7 ?
  'High' : 'Moderate'`), never rendered anywhere. Removed.
- `ExerciseData.sets` (was `Math.max(set_number)`), `.reps` (was
  `Math.round(totalReps/sets)`), `.peakVelocity` (was `Math.max` of per-rep
  mean speeds, mislabeled as a true kinematic peak) — all confirmed dead (every
  live UI surface already used the correct inline calculation: true
  `repData.length`, `new Set(setNumbers).size`, or a locally-computed
  `Math.max` of the same rep velocities already being charted). Removed from
  `ExerciseData`. Two genuinely dead helper functions that happened to
  reference the removed exercise-level `.weight`/`.sets` fields
  (`sessionVolume`, `computeRecentSessions` in `athleteSummaryUtils.ts`) were
  fixed to use the correct per-rep/per-set data instead of being deleted, since
  they're plausible future-use utilities, not obviously-abandoned code.

---

## 11. Data isolation — coach `team_id`

Confirmed (re-verified, unchanged by this pass): `coaches.team_id` is a cached
array column with exactly one reader in the whole app
(`TeamSportManager.tsx`, as a React effect dependency only). Every real
data-scoping path (`getCoachTeamIds`, `TeamSportManager.loadTeams`) resolves a
coach's groups live via `groups.coach_id`, never via the cached array. A null
or stale `coaches.team_id` has no effect on anything rendered.

---

## 12. Load-velocity profile / e1RM / readiness index — DEFERRED

**Status: not built. Do not build until real weight-logging coverage improves
— this is a data-capture problem, not a scope item for any redesign pass.**

**The number to track going forward: overall `reps.weight` fill rate, last
measured at 21.8%** (214 of 981 reps in the last 90 days had a real logged
weight; velocity was populated on 100%). Re-run the query in
`supabase/analysis-data-quality.sql` periodically — when that number rises
meaningfully, re-run the regression-readiness query too and reconsider.

**Why, in detail:** of 11 athlete/exercise combinations with any load data at
all in the last 90 days, only 4 cleared a minimum regression bar (≥3 distinct
load points with a real range). Of those 4, 3 belonged to a single
`player_id`, and that athlete's numbers (round 5-unit load increments, near-
identical ~100-unit ranges across three unrelated exercises, 47/47/29 rep
counts) have the shape of seeded/test data rather than confirmed organic
training — treat this as **zero real athletes are profile-eligible today**,
not "one athlete is," until/unless that data is confirmed real. The 4th
combo (a different athlete's Bench Press, 20 reps, 3 distinct loads) is the
one plausibly-real data point in the whole roster, and one exercise for one
athlete is not enough to justify a profile-engine feature.

**What would need to change before revisiting**: real athletes logging
weight on a meaningfully higher fraction of reps, organically, across
multiple sessions per exercise — not a lowered density bar, not synthetic
backfill. This is a coaching/logging-workflow problem (get weight entered
consistently, whether that means a hardware capture step or a manual field
in whatever app logs the session) outside this repo's control.

**readiness index** (today's velocity-at-load vs. profile prediction) is
gated entirely behind the profile existing — not evaluated further while
Part 1 stays deferred.

---

## 13. Mechanical work / volume load — coverage-gated

`src/lib/athleteSummaryUtils.ts` → `sessionVolume()` (unchanged math),
`sessionWeightCoverage()`, `sessionVolumeGated()`, `periodVolume()` (new).

**The gate**: `VOLUME_COVERAGE_THRESHOLD = 0.8`. A session's weight coverage
= (reps with a real logged weight) / (total reps in that session, valid
exercises only). A volume number is only shown when that session individually
clears 80% coverage; below that, the UI shows **"Not enough load data
logged"** instead of a number — the same "don't fabricate, show the gap"
pattern as Targets Reached's "No targets set" empty state. Sessions that
don't clear the bar are excluded entirely from any period rollup, never
averaged in to smooth out an undercount.

**Where it's shown**:
- Per-session, in the Sessions tab row list (`SessionsTab`) — a "Volume"
  figure per session, or the "not enough data" message.
- Period rollup: "Load, last 7d" in the Sessions tab header, summing
  `sessionVolumeGated()` across the last 7 days' sessions via `periodVolume()`
  — deliberately labeled distinctly from the pre-existing "Weekly volume"
  card in the Performance tab, which means *session frequency* (a count), not
  mechanical work — those are two different meanings of "volume" that
  happened to collide in naming; this fix does not rename or touch that
  existing card.

**Given current coverage (21.8% overall), expect "Not enough load data
logged" on most sessions today.** That's the correct, honest output — the
threshold is not tuned to make more tiles show a number, and should not be
lowered for that reason.

**Formula** (via `sessionVolume`, unchanged): Σ per-rep load across valid
exercises, where a rep with a real weight contributes that weight and a
bodyweight rep (weight = 0) contributes 1 (counts the rep without fabricating
a load). Same weightUnit caveat as §5 applies — a volume number is only as
trustworthy as the unit assumption underneath it.

---

## 14. Peer comparison — removed

`AthleteDashboard.tsx`'s "vs group average" panel (`InsightRail`) is removed
entirely — not replaced with a self-only trend (the simpler of the two
options this was scoped to allow, since the KPI strip and Performance tab
already carry this athlete's own trends with nothing left to duplicate).
`groupPeers`/`groupComparison`/`GroupComparison` are gone; `getRosterMetrics`
is now called with just `[found]` (this athlete only) instead of their team,
since the only remaining consumer of that call is this athlete's own
`dropPct`/`lastSessionDate` (drives the header flags/chips), not a group
average. Pure logic/UI change — no schema change, consistent with the
earlier finding that this repo has no athlete-facing view for the "hide from
teammates" concern to apply to in the first place (coach-only dashboard).

---

## 15. Exercise-name canonicalization

**Investigated, not assumed**: the `" - Medium"`/`" - Fast"`/`" - Slow"`
suffix pattern on `exercise_name` (present identically across Squat,
Deadlift, and Bench Press in live data) was suspected as a possible
auto-tagging artifact of the logging pipeline, based on the pattern repeating
across unrelated lifts and inconsistent spacing suggestive of templated
string generation. **Confirmed by the coach: deliberate.** Coaches
intentionally log tempo-specific variants this way for reference. **These are
NOT merged** — `"Bench Press - Fast"`, `"Bench Press - Medium"`,
`"Bench Press - Slow"`, and `"Bench Press"` remain four distinct exercises
everywhere (Targets Reached matching, drop-off partitioning, RTP trend,
per-exercise charts). No suffix-stripping code was written.

**Explicit, hardcoded alias map** (`src/lib/targetEvaluation.ts` →
`EXERCISE_NAME_ALIASES`/`canonicalizeExerciseName`) for the two collisions
confirmed against live data — and *only* these two, not extrapolated to
anything else found while investigating:
- `"Squat"` / `"Squats"` → `"Back Squat"`
- `"rdl"` → `"Romanian Deadlift"`

Applied at read time, wherever a raw `exercise_name` is first grouped or
matched — never rewrites `reps.exercise_name` in the database:
- `sessionsService.ts` — the per-session exercise grouping key (so "Squat"
  and "Squats" reps merge into one `ExerciseData` entry named "Back Squat").
  This is the highest-leverage point: every downstream consumer of
  `SessionData`/`ExerciseData` (avg velocity, drop-off, `ExerciseRangeChart`,
  the FV chart, the RTP view, Sessions tab) inherits the canonicalized name
  for free.
- `rosterMetricsService.ts` — `computeDropPctFromRows`'s raw-row grouping
  (this one operates on raw DB rows directly, not `SessionData`, so it needs
  its own canonicalization step).
- `playersService.ts` — the `(session, exercise)` grouping used for the load
  recommendation rule.
- `targetEvaluation.normalizeExerciseName` itself now calls
  `canonicalizeExerciseName` first, so Targets Reached matching is covered
  even for a caller that didn't pre-canonicalize.

**Other likely duplicates found while investigating, reported but NOT merged**
(no confirmation obtained, so no alias added — do not add these without
separately confirming them the same way the two above were confirmed):
- `Barbell Row` — single instance, low signal, no obvious duplicate.
- `Quad extensions` — single instance, lowercase, low signal.
- `Tnf press` — unidentifiable; doesn't match any name in the coach-side
  `EXERCISE_LIBRARY`. Meaning unknown.
- `Belt squat` — plausibly a distinct movement from "Back Squat" (a belt
  squat is a different exercise, not just a casing variant), left alone
  deliberately, not merged.

**Extending this list**: only add an entry after separately confirming a
specific collision via the same method used here (inspect distinct
`exercise_name` values + rep/session counts, per
`supabase/analysis-data-quality.sql`'s items 2a/2b) — never by guessing, and
never as a general fuzzy-matching system.

---

## 16. Rehab / return-to-play tagging + trend view

**Schema**: `workout_plans.is_rehab boolean NOT NULL DEFAULT false`
(`supabase/migrations/009_add_rehab_flag_to_workout_plans.sql` — **this
migration has not been applied to the live database; this session has no
write access to Supabase. Someone with DB access needs to run it** before
this feature does anything beyond defaulting every plan to `false`).
Plan-level, not per-exercise or per-session: sessions are written by the
mobile app/hardware, never by this dashboard, so the flag lives on the one
table this app can actually write to that also has a coach-facing
creation/edit UI.

**Coach UI**: a "Rehab / return-to-play plan" checkbox in the Build tab
(`SendProgramming.tsx`, next to the program name field), sent through
`sendWorkoutPlan`'s `isRehab` field. Not exposed on templates — rehab status
describes a specific assignment period for a specific athlete, not a
reusable template characteristic.

**RTP trend view**: new "RTP" tab on the athlete detail page (`RtpTab` in
`AthleteDashboard.tsx`). A session counts as rehab-tagged when its date
matches at least one `is_rehab = true` plan for that athlete — the same
same-day matching convention already used for attendance and target
evaluation elsewhere in this app (no new relational link between
`workout_plans` and `sessions`). Within those sessions, one exercise at a
time (selector button row, defaults to whichever has the most rehab-tagged
data points), chronological velocity trend via the existing
`VelocityTrendChart` component fed per-session points instead of weekly
buckets. No team/peer comparison anywhere in this view. Exercise names are
already canonicalized upstream (§15), so a rehab block logged partly as
"Squat" and partly as "Squats" still trends as one continuous line.

**Empty states**: zero rehab-tagged sessions → explains how to start
tracking (tag a plan). Exactly one rehab-tagged session for the selected
exercise → explains a trend needs at least 2 points, rather than drawing a
misleading single-point line.

---

## 17. Rep-by-rep velocity chart — redesigned

`src/components/pulse/charts.tsx` → `RepTraceChart`. Sequenced after §15
(canonicalization) since bar coloring by target status depends on correct
exercise-name matching.

- **One shared y-axis** for the whole exercise, not one repeated per set —
  previously each set was its own mini-chart with its own axis/gridlines/
  chrome; now it's one continuous SVG with light dashed dividers between set
  groups and set-number labels along a shared x-axis.
- **Clean rounded tick increments** (`niceTicks()` — steps of 0.1/0.2/0.5
  m/s-scale) instead of ticks derived from the raw min/max of whatever data
  happened to be in view.
- **Bars colored by target status** — `var(--good)` in-zone / `var(--warn)`
  outside-zone — only when a real coach-set target range exists for that
  exercise instance (same source as §1/§8: `target_velocity_min/max` on the
  matching plan exercise). With no target, every bar is one neutral color
  (`var(--ink-3)`); the chart never implies a target exists when it doesn't.
- **Weight shown per set, every set** — the mean of that set's own logged rep
  weights, or the literal text **"no load logged"** when that set's coverage
  is too sparse to show a number — never silently omitted, matching §13's
  "show the gap" pattern rather than a blank space a coach might misread as
  "nothing to report."
- Underlying query/data logic untouched, per instruction — this is a
  presentation-layer rewrite of one chart component.
