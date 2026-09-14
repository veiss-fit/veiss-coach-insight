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
