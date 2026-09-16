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

## 1. Load recommendation (Increase / Decrease / Maintain / New)

`src/services/playersService.ts` → `calculatePlayerStats`, bucketed for display
via `src/lib/targetEvaluation.ts` → `classifyLoadRec`.

**Formula**: velocity-based threshold on `avgVelocity` (flat mean of
`average_rep_speed` across every rep logged in the last 30 days, all
exercises pooled):
- `avgVelocity > 0.85` → **"Increase Load"**
- `avgVelocity < 0.40` → **"Decrease Load (Fatigue)"**
- otherwise → **"Maintain"**
- no sessions in the last 30 days → **"New"**

**Where it's shown**: `LoadRecChip` (`src/components/pulse/chips.tsx`) on
`AthleteCard.tsx`, `AthletePicker.tsx`; the "Load recommendation mix" donut +
legend on `Index.tsx` (3 buckets: Increase / Maintain / Reduce).

**Display fix kept from the earlier pass**: the chip and the donut both
classify via the shared `classifyLoadRec()` (prefix match on
`"increase"`/`"decrease"`, exact match on `"maintain"`) instead of the
original strict-equality bug that compared against literal strings
("Increase"/"Decrease") the engine never actually produced — that bug made
every athlete render as "Maintain" regardless of their real recommendation.
Fixed once, shared by both surfaces, so they can't independently drift out of
sync again.

**Limitation**: this is a flat, cross-exercise average with no per-exercise
anchor — an athlete who does one fast bodyweight movement and one slow heavy
squat in the same window gets one blended number compared against a single
global threshold pair that implicitly assumes one exercise/load context. A
target-velocity-range-based recommendation was built and then removed (see
git history) — there's currently no coach-set target for this to evaluate
against, so it's back to the threshold rule above.

---

## 2. Attendance — three independent, intentionally different numbers

There are three separate attendance/adherence calculations in this app.
**They are not expected to match** — they measure different things by
design. This section exists specifically to keep that from being
"discovered" as a bug again.

### (a) Roster-wide "Avg attendance" KPI — `Index.tsx`
**Source**: `rosterMetricsService.ts` → `RosterTeamMetrics.avgAttendance` +
`attSeries`.
**Formula**: `sum(is_completed) / count(*)` over every non-template
`workout_plans` row across the whole roster, in the current 8-week window —
**the exact same underlying rows** that `attSeries` buckets by week for the
sparkline/delta, so the headline number and its trend can never disagree.
Previously the headline number came from a completely different, all-time,
session-matching formula (`getAttendanceSummary`) than its own trend line —
now both come from one pipeline.
**DB fields**: `workout_plans.date`, `workout_plans.is_completed`,
`workout_plans.is_template` (`= false`).
**Rounding**: `Math.round(completed/total * 100)`.
**Does NOT** count self-logged sessions with no matching plan — pure plan
completion, matching the tile's own footnote copy ("plan completion, wk over
wk").

### (b) Per-athlete "Attendance" — `AthleteCard.tsx`, `AthleteTable.tsx`,
`AthleteDashboard.tsx` KPI strip
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
Internally self-consistent and correctly labeled.

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
the same moment, and none of them is "the bug" — this is documentation, not a
merge into one formula.

---

## 3. Velocity drop-off (within-session fatigue)

Two implementations exist, both correct and in agreement in their
partitioning logic:

### Roster-wide flag/priority score — `rosterMetricsService.ts`
`computeDropPctFromRows` — reimplements the same per-exercise partitioning as
(below) over raw `{exercise_name, set_number, average_rep_speed}` rows (a
roster-wide batched query can't afford a per-player `sessionsService` fetch).
**Formula**: group a session's reps by `exercise_name` (canonicalized — see
§4 below; excluding hardware artifact names — "Workout", "Exercise", etc.),
then within each exercise with ≥2 distinct `set_number`s, compute
`(firstSetAvg − lastSetAvg) / firstSetAvg`. Average that ratio across all
qualifying exercises in the session. Previously all reps in a session were
pooled by raw `set_number` regardless of exercise, so a squat's set 1 and a
bench's set 1 got averaged together — that partitioning bug is fixed.
**Where shown**: "Velocity drop N%" flag on `AthleteCard.tsx` focus cards
(`rosterFlags.ts`), and feeds `priorityScore` (sort order for "Worth a look").
**Rounding**: `Math.round`, clamped to [-100, 100].

### Athlete detail page — `athleteSummaryUtils.ts` → `sessionVelocityDropoff`
Same partitioning logic, operating on already-exercise-grouped `SessionData`
(no raw-row reimplementation needed here). Confirmed correct, not modified.
**Where shown**: AthleteDashboard KPI strip "Velocity drop-off", Readiness tab,
Sessions tab row summaries.

**Why two implementations at all**: the roster-wide path can't fetch full
per-exercise `SessionData` for every athlete (N+1 problem, deliberately
avoided — see `rosterMetricsService.ts` file comment), so it works from raw
rows instead. Keep the two in sync manually if the partitioning rule ever
changes; there's a comment in `rosterMetricsService.ts` pointing back here.

---

## 4. Exercise-name canonicalization

Two independent fixes to how `reps.exercise_name` gets grouped/matched, both
still in effect:

**Investigated, not assumed**: the `" - Medium"`/`" - Fast"`/`" - Slow"`
suffix pattern on `exercise_name` (present identically across Squat,
Deadlift, and Bench Press in live data) was suspected as a possible
auto-tagging artifact of the logging pipeline, based on the pattern repeating
across unrelated lifts and inconsistent spacing suggestive of templated
string generation. **Confirmed by the coach: deliberate.** Coaches
intentionally log tempo-specific variants this way for reference. **These are
NOT merged** — `"Bench Press - Fast"`, `"Bench Press - Medium"`,
`"Bench Press - Slow"`, and `"Bench Press"` remain four distinct exercises
everywhere. No suffix-stripping code was written.

**Explicit, hardcoded alias map** (`src/lib/targetEvaluation.ts` →
`EXERCISE_NAME_ALIASES`/`canonicalizeExerciseName`) for the two collisions
confirmed against live data — and *only* these two, not extrapolated to
anything else found while investigating:
- `"Squat"` / `"Squats"` → `"Back Squat"`
- `"rdl"` → `"Romanian Deadlift"`

Applied at read time, wherever a raw `exercise_name` is first grouped —
never rewrites `reps.exercise_name` in the database:
- `sessionsService.ts` — the per-session exercise grouping key (so "Squat"
  and "Squats" reps merge into one `ExerciseData` entry named "Back Squat").
  This is the highest-leverage point: every downstream consumer of
  `SessionData`/`ExerciseData` (avg velocity, drop-off, `ExerciseRangeChart`,
  the FV chart, Sessions tab) inherits the canonicalized name for free.
- `rosterMetricsService.ts` — `computeDropPctFromRows`'s raw-row grouping
  (this one operates on raw DB rows directly, not `SessionData`, so it needs
  its own canonicalization step).

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

## 5. Weight, weight unit, and per-set load

`src/services/sessionsService.ts` → `RepData.weight`.

**Formula**: each rep carries its **own** logged `weight` value (from
`reps.weight`), rather than the whole exercise showing one number taken from
its first set. Ramping/pyramid sets (different load per set) display each
set's own true weight — computed as the mean of that set's reps' weights (rows
within one set should share a weight; mean is defensive against any noise).

**Where shown**: per-set toggle-chip label in `RepTraceChart` (Sessions tab),
per-point load axis in the Load–velocity profile chart (Performance tab).

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

## 7. Unchanged, still-correct numbers (confirmed, not touched)

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
- **Roster "Velocity" column / focus-card "Velocity" tile / athlete
  "Avg velocity" KPI** — a raw cross-exercise flat average
  (`RosterAthleteMetrics.recentVel`, `PlayerWithStats.avgVelocity`), same as
  before any target-based system existed. No per-exercise split; see the
  limitation note in §1.
- **Sort-by-velocity** — `Index.tsx`'s roster sort dropdown ("Sort: Velocity")
  sorts by `recentVel`/`avgVelocity`, same field the roster table and focus
  cards display.

---

## 8. Removed dead code

- `src/data/mockData.ts` — zero importers, deleted.
- `src/services/statsService.ts` — deleted in full. `getTeamPerformanceSummary`,
  `getWeeklyActivity`, `getSessionCount` were never called anywhere
  (confirmed; `getTeamPerformanceSummary` was also internally broken — it
  filtered on `r.session_id`, a field its own `reps` query never selected).
  `getCoachDashboardStats` was called exactly once, by `Index.tsx`'s "Avg
  attendance" tile; that tile now sources its number from
  `rosterMetricsService` instead (§2a), which made this entire file's only
  live caller go away.
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
- `workout_plans.exercises[].targetVelocityMin/Max`, the "Targets Reached"
  evaluation system (`buildTargetsForExercises`/`evaluateRepsAgainstTargets`/
  `TargetsReached`/etc.), the target-based load-recommendation engine
  (`computeLoadRecommendation`), the "RTP" tab and `workout_plans.is_rehab`
  flag, and the never-applied migration `009_add_rehab_flag_to_workout_plans.sql`
  — built in an earlier pass, then explicitly removed. Not needed for now.
  `src/lib/targetEvaluation.ts` still exists but now holds only exercise-name
  canonicalization (§4) and `classifyLoadRec` (§1) — the parts that turned
  out to be useful independent of the target system.

---

## 9. Data isolation — coach `team_id`

Confirmed: `coaches.team_id` is a cached array column with exactly one reader
in the whole app (`TeamSportManager.tsx`, as a React effect dependency only).
Every real data-scoping path (`getCoachTeamIds`, `TeamSportManager.loadTeams`)
resolves a coach's groups live via `groups.coach_id`, never via the cached
array. A null or stale `coaches.team_id` has no effect on anything rendered.

---

## 10. Load-velocity profile / e1RM / readiness index — DEFERRED

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
not "one athlete is," until/unless that data is confirmed real.

**What would need to change before revisiting**: real athletes logging
weight on a meaningfully higher fraction of reps, organically, across
multiple sessions per exercise — not a lowered density bar, not synthetic
backfill.

**readiness index** (today's velocity-at-load vs. profile prediction) is
gated entirely behind the profile existing — not evaluated further while
this stays deferred.

---

## 11. Mechanical work / volume load — coverage-gated

`src/lib/athleteSummaryUtils.ts` → `sessionVolume()` (unchanged math),
`sessionWeightCoverage()`, `sessionVolumeGated()`, `periodVolume()`.

**The gate**: `VOLUME_COVERAGE_THRESHOLD = 0.8`. A session's weight coverage
= (reps with a real logged weight) / (total reps in that session, valid
exercises only). A volume number is only shown when that session individually
clears 80% coverage; below that, the UI shows **"Not enough load data
logged"** instead of a number — don't fabricate a number from mostly-missing
data. Sessions that don't clear the bar are excluded entirely from any period
rollup, never averaged in to smooth out an undercount.

**Where it's shown**:
- Per-session, in the Sessions tab row list (`SessionsTab`) — a "Volume"
  figure per session, or the "not enough data" message.
- Period rollup: "Load, last 7d" in the Sessions tab header, summing
  `sessionVolumeGated()` across the last 7 days' sessions via `periodVolume()`
  — deliberately labeled distinctly from the pre-existing "Weekly volume"
  card in the Performance tab, which means *session frequency* (a count), not
  mechanical work.

**Given current coverage (21.8% overall), expect "Not enough load data
logged" on most sessions today.** That's the correct, honest output — the
threshold is not tuned to make more tiles show a number, and should not be
lowered for that reason.

**Formula** (via `sessionVolume`, unchanged): Σ per-rep load across valid
exercises, where a rep with a real weight contributes that weight and a
bodyweight rep (weight = 0) contributes 1 (counts the rep without fabricating
a load). Same weightUnit caveat as §5 applies.

---

## 12. Peer comparison — removed

`AthleteDashboard.tsx`'s "vs group average" panel (`InsightRail`) is removed
entirely — not replaced with a self-only trend, since the KPI strip and
Performance tab already carry this athlete's own trends with nothing left to
duplicate. `groupPeers`/`groupComparison`/`GroupComparison` are gone;
`getRosterMetrics` is now called with just `[found]` (this athlete only)
instead of their team, since the only remaining consumer of that call is this
athlete's own `dropPct`/`lastSessionDate` (drives the header flags/chips), not
a group average. Pure logic/UI change — no schema change, consistent with the
earlier finding that this repo has no athlete-facing view for the "hide from
teammates" concern to apply to in the first place (coach-only dashboard).

---

## 13. Rep-by-rep velocity chart — line-per-set redesign

`src/components/pulse/charts.tsx` → `RepTraceChart`.

- **One shared y-axis** for the whole exercise, not one repeated per set —
  one continuous SVG with rep-within-set on the x-axis (every set's line
  starts at x=1, so fatigue curves overlay comparably).
- **Clean rounded tick increments** (`niceTicks()` — steps of 0.1/0.2/0.5
  m/s-scale) instead of ticks derived from the raw min/max of whatever data
  happened to be in view.
- **One connected line per set**, distinct color per set, toggle chips above
  the chart (labeled "Set N — weight" or "Set N — no load logged") to
  show/hide individual lines.
- **Target-status dot styling** (filled vs. hollow-with-warn-ring) and the
  shaded target band are still implemented in the component and accept an
  optional `target` prop — but **no current caller passes one** (the
  target-velocity-range system that would have supplied it was removed, §8),
  so in practice every dot renders as a plain filled marker and no band is
  ever drawn today. The prop is left in place as generic, inert capability
  rather than ripped out, in case a target source is reintroduced later.
- **Weight shown per set, every set** — the mean of that set's own logged rep
  weights, or the literal text **"no load logged"** when that set's coverage
  is too sparse to show a number — never silently omitted.
- Underlying query/data logic untouched — this was a presentation-layer
  rewrite of one chart component.
