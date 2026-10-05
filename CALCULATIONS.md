# CALCULATIONS.md

Full re-audit of the current working tree (2026-09-25). The previous version of
this file described an architecture that has since been substantially rewritten
— an old anomaly/readiness system (`computeAnomalyIndicators`, the athlete-page
Readiness tab) has been removed entirely and replaced by a new numbered metric
library (`src/lib/metrics/*.ts`, referencing an internal spec `temp/METRIC_SPEC.md`
as "SP-01" through "SP-13"). This file replaces the old one and reflects what the
code actually does today, not what it did when the old doc was written.

Every section below was verified by reading the real source on disk, not
inferred from comments or the old doc. Where the code's own comments flag a
number as unverified/uncalibrated/mock, that's carried through here verbatim.

---

## Part 0 — How to read this doc

**Pipeline shape**, same for almost every number on this dashboard:

```
Supabase tables (sessions, reps, workout_plans, players, groups, messages)
        │
        ▼
Row-shaping layer  (sessionsService.ts, sessionAdapters.ts, rosterMetricsService's
                     own inline batch queries, playersService's batch queries)
        │
        ▼
Metric functions   (src/lib/metrics/*.ts for single-session VBT math,
                     src/lib/workoutAttendance.ts for attendance,
                     rosterMetricsService.ts / rosterSignals.ts / athleteFacts.ts /
                     attentionFlags.ts for roster-wide aggregation)
        │
        ▼
Page-level assembly (Index.tsx, AthleteDashboard.tsx, SendProgramming.tsx, History.tsx,
                      Messages.tsx — some inline math lives here too, undocumented
                      until now)
        │
        ▼
Card components    (src/components/pulse/*.tsx)
```

**Every rep-level calc excludes invalid data the same way**: a rep only counts
toward a velocity calc if `average_rep_speed` is not null and `> 0`; toward a
ROM calc if `rom_mm > 0`; toward a timing calc if the relevant duration `> 0`.
A stored `0` is treated as "no reading," never as a real zero. This rule is
implemented independently in several places (see Part 6, "known duplication")
rather than shared from one function — worth knowing if it's ever changed.

**Exercise names are canonicalized** at read time via
`src/lib/targetEvaluation.ts` → `canonicalizeExerciseName`/`EXERCISE_NAME_ALIASES`
(`"Squat"`/`"Squats"` → `"Back Squat"`, `"rdl"` → `"Romanian Deadlift"` — only
these two, confirmed against live data, not extrapolated). Applied in
`sessionsService.ts` (session grouping), `sessionAdapters.ts` (re-applied,
harmlessly redundant since it's idempotent), and `rosterMetricsService.ts`'s
own raw-row grouping. Names failing `isValidExerciseName` (fewer than 2 letters,
or a hardware artifact label — `"Workout"`, `"Exercise"`, `"Movement"`,
`"Training"`, `"Session"`) are excluded everywhere.

---

## Part 1 — Row shaping: DB rows → session/exercise/rep objects

### `sessionsService.ts` → `getPlayerSessions`, `buildExercises`
- **DB inputs**: `sessions.id/started_at/created_at/status/name`, `reps.exercise_name/set_number/rep_number/average_rep_speed/rom_mm/concentric_duration_s/eccentric_duration_s/weight`. Falls back to `workouts` table (names only, zeroed metrics) when a session has zero `reps` rows.
- **Formula**: fetches reps per session (chunked `.in()` up to 200 ids, paginated 1000/page up to 20 pages). Groups reps by canonicalized exercise name into `ExerciseData`. Computes `ExerciseData.avgVelocity` (mean valid `average_rep_speed`, `.toFixed(2)`), `.avgROM` (mean valid `rom_mm`, `Math.round`), `.avgTempo` (mean valid `concentric_duration_s`, `.toFixed(2)`) — **but these three pre-computed averages are not consumed by any of the Part 2 metric functions**, which all recompute their own means from raw `RepData` independently. Likely dead weight on `ExerciseData`, not fully confirmed dead app-wide.
- **Timezone note**: session date extracted via local-timezone conversion (`toLocalDateString`) specifically to avoid a UTC day-shift bug — deliberate, documented in code.
- **Feeds**: everything in Part 2, via `sessionAdapters.ts`.

### `sessionAdapters.ts` — shape adapter
- Converts `SessionData`/`ExerciseData`/`RepData` into the metric library's `RepInput[]` shape: `repInputs`, `sessionSets`, `sessionRom`, `sessionTiming`, `sessionMoment`, `byMoment`, `historyByExercise`, `exposureInputs`.
- Re-applies `isValidExerciseName`/`canonicalizeExerciseName` (redundant but harmless, see Part 0). Nulls out `weight` when `≤ 0` ("no load recorded"). `historyByExercise` sorts by session count descending (most-trained exercise opens first in the exercise picker).
- Not a card itself — the glue `AthleteDashboard.tsx` uses throughout.

### `rosterMetricsService.ts`'s own inline row shaping
- Independent batched queries (sessions/reps/plans for the *whole roster* at once, chunked/paginated the same way) — deliberately **not** reusing `sessionsService.ts`, since that would mean one query per athlete (N+1). See Part 4.

### `playersService.ts` → `getPlayerStatsBatch`
- Same N+1-avoidance pattern as above, its own independent batched queries. See Part 3.

---

## Part 2 — Single-session / per-exercise / per-set VBT metrics

All of these live in `src/lib/metrics/*.ts`, operate on one athlete's own
sessions, and are the numbers shown on the athlete detail page's Sessions and
Performance tabs.

### SP-01 — Set velocity summary
**File**: `metrics/setVelocitySummary.ts` → `summarizeSet`, `summarizeSession`
**Formula**: per set, `vBest = max(valid rep velocities)`, `vMean = mean(valid rep velocities)`. `load` = the set's shared weight if every valid rep in it has the same weight `> 0`, else `null`.
**Rendered by**: `SetVelocityBars.tsx` (bars/swatches), `PersonalRecordsCard.tsx` (indirectly, via SP-05), and every downstream SP-02/03/04/05 function.
**Page**: AthleteDashboard → Sessions tab (Velocity view), Performance tab.

### SP-02 — Within-set velocity loss
**File**: `metrics/withinSetVelocityLoss.ts` → `withinSetVelocityLoss`, `exerciseLossSummary`
**Formula**: `(vBest − vLast) / vBest × 100`, `vLast` = valid rep with the highest `rep_number`. Session-level summary = **median** (not mean) of per-set losses. Requires `MIN_VALID_REPS = 2` (spec default was 3, lowered by product decision).
**Rendered by**: `SetVelocityBars.tsx` (per-set loss text, median-loss pill).
**Page**: AthleteDashboard → Sessions tab, Velocity view.

### SP-03 — Set-to-set velocity change
**File**: `metrics/setToSetChange.ts` → `setToSetChange`
**Formula**: `(vMean_last − vMean_first) / vMean_first × 100` between the first and last set with a valid rep — **only when both sets' loads are known and identical** (an unmatched-load comparison mostly measures the load change, not fatigue, per code comment). Needs ≥2 usable sets.
**Rendered by**: `SetVelocityBars.tsx` ("set-to-set" pill).
**Page**: AthleteDashboard → Sessions tab, Velocity view.

### SP-04 — Velocity vs. own baseline
**File**: `metrics/velocityVsBaseline.ts` → `commonLoad`, `velocityVsBaseline`
**Formula**: session value = mean `vBest` over qualifying sets (Tier A: latest session's sets share one known load, only same-load sets counted across history; Tier B: load unknown/mixed → all sets pooled, flagged "not load-matched"). Baseline = **exponential moving average** over earlier sessions within `BASELINE_DAYS = 42` days (`EMA_ALPHA = 0.3`, seeded at the oldest session in-window) — spec called for a plain mean, product owner asked for an EMA instead. `change = (latest − baseline) / baseline × 100`.
**Uncalibrated constants** (code's own words): `BASELINE_DAYS`, `EMA_ALPHA`.
**Rendered by**: `SetVelocityBars.tsx` (dashed target line, "vs target ±N%" pill, "not load-matched" badge). Also reused roster-wide (Part 4).
**Page**: AthleteDashboard → Sessions tab, Velocity view.

### SP-05 — Velocity personal record
**File**: `metrics/velocityRecords.ts` → `fastestAtHeaviestLoad`
**Formula**: across all history, per exercise: heaviest ever verified `load`, then fastest `vBest` among sets at that load. Ties on load → earliest session wins. All-time, no window.
**Dead field**: `LoadRecord.isNew` is computed but never read by any component (self-documented `TODO(cleanup)`, confirmed).
**Rendered by**: `PersonalRecordsCard.tsx`.
**Page**: AthleteDashboard → Performance tab.

### SP-06 — Range of motion / vertical displacement
**File**: `metrics/rangeOfMotion.ts` → `summarizeRomSet`, `summarizeRomSession`, `romSetToSetChange`, `romConsistency`
**Formula**: `meanMm` = mean of counted reps' `rom_mm`; `cvPct` = sample SD/mean × 100 (needs ≥2 counted reps). `romSetToSetChange` = `(lastSet − firstSet)/firstSet × 100` between first/last set with data (load **not** considered, unlike SP-03). `romConsistency` = median of per-set CVs.
**Rendered by**: `RangeOfMotionCard.tsx` (`RangeOfMotionCards`, `RomLines` chart).
**Page**: AthleteDashboard → Sessions tab, "Distance" view.

### SP-07 — Rep timing (TUT / E:C ratio)
**File**: `metrics/repTiming.ts` → `summarizeTimingSet`, `summarizeTimingSession`, `exerciseTimingSummary`, `concentricSetToSetChange`, `eccentricSetToSetChange`
**Formula**: `tut` = Σ(concentric + eccentric) over reps with both durations present. `ecRatio` = Σeccentric/Σconcentric. Session-level `tut` is **summed** across sets (not averaged); `conc`/`ecc`/`ecRatio` are averaged. Set-to-set change = first-vs-last set with data, no load-matching.
**Rendered by**: `RepTimingCard.tsx` (`RepTimingCards`).
**Page**: AthleteDashboard → Sessions tab, "Time" view.

### SP-08 — Training exposure (sessions/week, days since last) — **DEAD CODE**
**File**: `metrics/trainingExposure.ts` → `trainingExposure`; `sessionAdapters.ts` → `exposureInputs`
**Formula**: buckets sessions with ≥1 valid rep into 8 Monday-starting weeks; `daysSinceLast` = calendar days to today.
**Status**: zero production callers. Its only consumer, `TrainingExposureCard.tsx`, is itself Storybook-only (self-documented `TODO(cleanup)`, confirmed by grep — only `.stories.tsx` imports it). The live "Weekly sessions" panel on AthleteDashboard's Performance tab (see Part 5) reimplements the same weekly-bucketing logic **independently, inline** — a second, undocumented implementation of "sessions per week" that could silently drift from this one since neither calls the other.

### SP-09 — Load-velocity profile
**File**: `metrics/loadVelocityProfile.ts` → `loadVelocityProfile`
**Formula**: one point per distinct load within `PROFILE_WINDOW_DAYS = 56` days: `best = max(vBest at that load)`. Least-squares linear fit (`slope`, `intercept`, `r2`) when ≥2 loads (`MIN_LOADS = 2`; `r2 = 1` by construction with exactly 2 points). `span` = velocity drop from lightest to heaviest load tested.
**Rendered by**: `LoadVelocityProfileCard.tsx` (scatter + fit line + R² + span pills).
**Page**: AthleteDashboard → Performance tab.
**Note**: scoped to one exercise at a time by design (no cross-exercise mixing) — this design principle survives from the old doc even though the implementation was rewritten.

### SP-10 — Estimated 1RM (prototype)
**File**: `metrics/estimatedOneRm.ts` → `isUpperBodyExercise`, `estimateOneRm`
**Formula**: `oneRm = (mvt − intercept) / slope` off the SP-09 fit line. `mvt` (minimum velocity threshold) is coach-editable, default `0.16` m/s ("lowest of three published bench values: 0.16, 0.165, 0.23" — code's own words). Requires `slope < 0` and a positive result. Restricted to exercises matching a hardcoded upper-body name-keyword regex — **"a guess, not a validated list"** per code comment.
**Rendered by**: `LoadVelocityProfileCard.tsx` (estimate dot, tooltip, editable min-velocity input).
**Page**: AthleteDashboard → Performance tab.
**Caveat carried from old doc**: overall weight-logging coverage was measured at 21.8% (see Part 8) — this feature exists despite that low-coverage caveat, and the UI marks the estimate "rough" when extrapolating past the heaviest load actually tested.

### Primary exercise selection
**File**: `athleteSummaryUtils.ts` → `findPrimaryExercise`, `isValidExerciseName`
**Formula**: exercise with the most valid reps in the last 30 days, ties broken by most recently trained.
**Used for**: selecting the default exercise for `CompositeScoreBetaCard` (a mock-data card — see Part 7). This is the only surviving function from the old doc's §14 fix; its original purpose (anchoring the anomaly-indicator baseline) no longer applies since that system was removed.

### Deviation/anomaly indicators — **REMOVED FROM PRODUCTION, TYPES ONLY REMAIN**
`athleteSummaryUtils.ts` still exports the `RAGStatus`/`DeviationIndicator`/`IndicatorTooltip` **types**, but the functions that used to compute them (`computeAnomalyIndicators`, `velocityIndicatorSource`, `compositeRagStatus`) do not exist anywhere in the current codebase. The one component that still imports these types, `DeviationBaselineCard.tsx`, is self-documented dead (`TODO(cleanup): Storybook-only, no production caller currently — the athlete page's readiness tab was removed`), confirmed by grep. There is no live "Readiness" score or z-score anomaly panel anywhere in this app today.

---

## Part 3 — Per-athlete stats used outside the session detail (roster row, cards, chip)

### `playersService.ts` → `getPlayerStatsBatch` (batched, avoids N+1)
Computes, per player, over the **last 30 days**' reps (all exercises pooled, no canonicalization):
- **`avgVelocity`** = mean `average_rep_speed`, `.toFixed(2)`.
- **`avgROM`** = mean `rom_mm`, `Math.round`.
- **`avgTempo`** = mean `concentric_duration_s`, `.toFixed(2)`.
- **`loadRec`**: `avgVelocity > 0.85` → `"Increase Load"`; `< 0.40` → `"Decrease Load (Fatigue)"`; else `"Maintain"`; `"New"` if zero sessions in the last 30 days.
- **`attendance`** — see Part 6(b), computed over an **8-week** window (`ATTENDANCE_WINDOW_WEEKS = 8`, same constant name intent as `rosterMetricsService`'s `WEEKS`, explicitly kept in sync per code comment "A4.3: one attendance definition").
- **`lastWorkout`** — most recent session's `{name, date}`.

**Rendered by**: `LoadRecChip` (`chips.tsx`) — live callers are `SendProgramming.tsx` and `AthletePicker.tsx` only. (`AthleteCard.tsx` also references these fields but has zero importers anywhere in the app — see Part 9.)
**Limitation** (carried from old doc, still true): flat cross-exercise average with no per-exercise anchor — an athlete doing one fast bodyweight movement and one slow heavy squat gets one blended number against a single global threshold.

---

## Part 4 — Roster-wide / team-wide aggregates

Everything here comes from `rosterMetricsService.ts` → `getRosterMetrics`, called once per page load for the whole roster (never per-athlete — deliberately avoids N+1). 8-week window (`WEEKS = 8`) unless noted.

### Per-athlete series (`RosterAthleteMetrics`) — **mostly dead code**
- `velSeries`, `sessSeries`, `sessionsThisWeek` (per-athlete), `recentVel`, `velDelta` — all real computations (weekly-bucketed mean velocity / session counts / last-3-vs-prior delta), but their **only consumer**, `AthleteTable.tsx`, is imported **only** by `AthleteTable.stories.tsx` (Storybook fixture, confirmed by grep — zero production callers).
- `RosterTeamMetrics.velSeries` (team-wide weekly velocity) has **zero readers anywhere**, not even Storybook.
- `dropPct` (within-session first-set-vs-last-set drop, canonicalized-exercise-partitioned, `Math.round`, clamped [-100,100]) feeds `rosterFlags.ts` → `flagsFor`, whose only consumer, `AthleteCard.tsx`, has **no importer at all in the app** — not even a Storybook story. This is deader than the file's own `TODO(cleanup)` comments claim.
- **Practical effect**: none of these five fields currently reach a coach's screen. If you're changing this file's math, these five are safe to ignore for user-facing impact (but are exercised by Storybook, so changing their shape breaks `npm run storybook` fixtures).

### The live roster-wide "attention" system (SP-12 / SP-13) — **not in the old doc at all**
This replaced `rosterFlags.ts` and is what coaches actually see today:

1. **`rosterSignals.ts`** (SP-12) — per athlete, per canonicalized exercise, compares the **latest session** against a **pooled EMA baseline** (reuses SP-04's `velocityVsBaseline`, deliberately pooled/not load-matched — "a load-matched baseline cannot see a fall caused by a heavier load"). Two facts surface per athlete:
   - `biggestDrop` — the exercise with the largest negative change vs. baseline, plus `loadFrom`/`loadTo` when known.
   - `slowestTempo` — the exercise with the largest positive concentric-time change (SP-07's `concentricSetToSetChange`) in the latest session.
2. **`athleteFacts.ts`** (SP-13) — packages 4 facts per athlete: `daysSince` (last session), `drop` (`|biggestDrop.change|`), `tempo` (`slowestTempo.change`), `attendance` (from Part 3).
3. **`attentionFlags.ts`** (SP-13) — compares each fact to a **coach-editable threshold** (defaults: `days: 7, drop: 10%, tempo: 20%, attendance: 70%`; only the "7 days" default is carried over from old code, the rest have "no source" per the code's own comment). **No composite score** — a row flags if *any one* signal crosses its own cutoff; the coach picks the sort key (`orderByAttention`, stable sort, flagged rows pinned first when enabled).
4. **`exerciseBaseline`** — same SP-04 pooled-baseline math, but retained **per exercise** (not reduced to one worst exercise per athlete) for the team-wide "Slower than baseline" tile and the Leaderboard's "baseline" metric.

**Rendered by**: `RosterSignalsTable.tsx` (the "Biggest drop vs baseline" / "Slowest tempo shift" columns — its own file comment claims "Storybook only," which is **stale**: `Index.tsx` wires it live as the default "roster" tab of `RosterViewSwitcher`), `FollowedAthleteCard.tsx` (same facts, "Drop vs baseline"/"Tempo shift" rows), `NeedsAttentionTile.tsx` / `SlowerThanBaselineTile.tsx` on `Index.tsx`.
**Page(s)**: `Index.tsx` (roster table default tab, attention counts), `FollowedAthletesPanel.tsx` (mounted outside `<Routes>` in `App.tsx`, so visible on every page for followed athletes).

### Leaderboard (`leaderboard`)
- `velocityByExercise` — max single-rep velocity per canonicalized exercise per athlete, any weight, in-window.
- `sessionsByPlayer` — session count per athlete.
- `completionByPlayer` — per-athlete `getAttendanceSummary` result (Part 6), only set when the athlete has ≥1 plan.
- `firstPlaceCounts` — count of exercises where an athlete holds/ties the max in `velocityByExercise`.
**Rendered by**: `LeaderboardPanel.tsx`, `Index.tsx`'s "leaderboard" tab (branches on metric: velocity / baseline / sessions / completion).

### Team PRs (`teamPrs`)
Per athlete + canonicalized exercise: heaviest verified `weight` ever logged, fastest `average_rep_speed` at that weight (ties → faster rep wins). All-time within the 8-week fetch window. **Rendered by**: `TeamPrsPanel.tsx`, `Index.tsx`'s "team-prs" tab.

### Training grid (`trainingGrid`)
Sessions per athlete per day-of-current-week only (Mon–Sun). **Rendered by**: `TrainingGridPanel.tsx`, `Index.tsx`'s "grid" tab.

### Team volume (`volumeSeries` / `volumeCoveragePct`) — SP-08-adjacent, distinct from Part 8's gated per-session volume
- `volumeSeries[week].totalLbs` = raw sum of `reps.weight` (weight `> 0` only) across **every athlete, every exercise, no canonicalization/artifact filtering** — a different, looser inclusion rule than `computeDropPctFromRows`/`computeSignals` use.
- `volumeCoveragePct` = `round(repsWithWeight / repsInWindow × 100)` over the whole 8-week rep set.
- **Rendered by**: `WeeklyVolumePanel.tsx` on `Index.tsx`. **`tonnageLbs` is real; `totalWorkKj`/`distanceM` are fabricated** — see Part 7, this is the highest-risk mock-data finding in this audit (no Beta badge, unlike the athlete-page equivalent).
- **No relation to** the per-session 80%-coverage-gated volume in Part 8 — two independent "volume" concepts exist in this app and neither cross-references the other.

### Team KPIs (`avgAttendance`, `attSeries`, `sessionsThisWeek`, `sessionsLastWeek`, `sessionsByDay`, `assignedThisWeek`, `completedThisWeek`, `planCompletionDeltaPct`)
See Part 6(a) for the attendance figures. Session counts/day-of-week rendered by `SessionsTile.tsx`, `Index.tsx`. `assignedThisWeek`/`completedThisWeek`/`planCompletionDeltaPct` are computed but no direct render call site was confirmed in this audit — flagged as a possible-dead-code follow-up, not asserted dead.

---

## Part 5 — Inline page-level math (previously undocumented)

These live directly inside page components rather than a lib/service function — easy to miss, so listed explicitly.

### AthleteDashboard.tsx — "Weekly sessions" summary stats
`avg = mean(weekly8[].v).toFixed(1)`, `onTarget = count(weekly8[].v >= SESSIONS_TARGET)` (SESSIONS_TARGET = 4, from `vbtZones.ts`). Real data, computed inline, independently of SP-08 (see Part 2 — two implementations of "sessions per week" that don't share code).
**Rendered on**: Performance tab, "Weekly sessions" card.

### AthleteDashboard.tsx — "Plan adherence" (Programming tab)
`adherencePct = round(completed-in-last-30-days / total-in-last-30-days × 100)`, pure `is_completed` flag count — **no session matching**, unlike Part 6's `getAttendanceSummary`. Bucketed by week for the "This wk / Last wk / 2 wks / 3 wks" rows.
**Rendered on**: Programming tab, "Plan adherence · last 30 days" card.

### AthleteDashboard.tsx — `planStatus` (upcoming/recent plan list)
A **fourth**, independent plan-status classifier (`is_completed` → completed; else date-in-past → missed; else queued) — doesn't reuse `getWorkoutPlanStatus` from `workoutAttendance.ts`. Feeds the completed/missed/queued chips on each plan row in the same Programming tab as the adherence calc above. Not itself a percentage, but worth knowing there are now four independent plan-status implementations in this app (`getWorkoutPlanStatus`, the adherence calc, this one, and the roster-wide `toPlanLike`/attendance pipeline).

### Index.tsx — `volumeData` (feeds WeeklyVolumePanel)
`tonnageLbs` real (from `rosterMetricsService.volumeSeries`). `totalWorkKj = tonnageLbs × 0.013`, `distanceM = round(tonnageLbs × 0.0966)` — **both fabricated**, linearly scaled off tonnage "to keep the bars roughly proportionate" (code's own comment). **Not Beta-badged** — see Part 7 for why this is the top risk finding of this audit.

### Index.tsx — `attentionCounts`
Loops the roster calling `attentionFlags(athleteFacts(...))` (Part 4) and tallies flagged counts per reason. Pure orchestration over already-documented logic, not new math.

### SendProgramming.tsx
Only UI-input clamps (`Math.max(1, Math.min(20, n))` on a "number of sets" field) and static `.toFixed(2)` display formatting — no build-stats aggregation, no template-usage counts, nothing else computed here.

---

## Part 6 — Attendance / plan completion (four independent implementations)

**They are not expected to match.** This is intentional — they measure different things — but two of the descriptions below have **drifted from what the code actually does** since they were last documented; drift is called out explicitly.

### (a) Roster-wide "Avg attendance" KPI — `Index.tsx`
**Source**: `rosterMetricsService.ts` → `team.avgAttendance` / `attSeries`.
**Formula, as of now**: `getAttendanceSummary(allPlanRows, allSessionRows).attendancePercent` over the whole roster's 8-week window — i.e. the **full session-matching algorithm** from (b) below, including folding in unmatched self-logged sessions, **not** a plain `is_completed` ratio.
**⚠ Drift from the previous doc**: the previous version of this file described this as `sum(is_completed)/count(*)` with an explicit "does NOT count self-logged sessions" note. That is **no longer true** — the code was changed (per its own comment, "A4.3: one attendance definition") to route through the same richer algorithm as (b), just scoped to the whole roster instead of one athlete. The headline number and its sparkline still can't disagree with each other (same underlying rows), but the formula itself changed.
**DB fields**: `workout_plans.date/is_completed/is_template(=false)/session_id/title`, `sessions.id/created_at/name`.

### (b) Per-athlete "Attendance" — roster table, athlete cards, `LoadRecChip` context
**Source**: `playersService.ts` → `getPlayerStatsBatch` → `getAttendanceSummary` (`workoutAttendance.ts`).
**Formula**: for each plan, resolve completed/pending/missed (session-id link first, then same-day exact-title match, then the sole unnamed same-day session as a fallback); fold in unmatched self-logged sessions as additional "completed, untracked" entries in both numerator and denominator. `Math.round(completedTracked/totalTracked × 100)`.
**⚠ Drift from the previous doc**: previously documented as "all-time, not windowed." It is now an **8-week window** (`ATTENDANCE_WINDOW_WEEKS = 8`), deliberately aligned with `rosterMetricsService`'s own window per an explicit code comment. Still correctly self-consistent, just not all-time anymore.

### (c) Programming tab "Plan adherence" — `AthleteDashboard.tsx`
`completed / assigned` over `workout_plans.is_completed`, last 30 days, **no session matching at all**. Matches the previous doc's description exactly — no drift here.

### (d) `planStatus` in `AthleteDashboard.tsx`'s plan list
A fourth, simpler completed/missed/queued classifier for the plan-row chips (see Part 5) — not a percentage, but an independent status decision that can disagree with (b) and (c) for the same plan row since it skips session matching entirely.

**Bottom line**: (a) and (b) now share the same underlying matching engine (just different scope/window) where they previously didn't — that's a real, meaningful change from what was last documented, worth confirming is intentional if you didn't already know about it.

---

## Part 7 — Mock / Beta / placeholder data (explicit disclosure)

Several cards render **hardcoded or partially-fabricated numbers**, not live calculations. Listed here so none of them get mistaken for real data:

| Card | Status | Detail |
|---|---|---|
| `VelocityBetaCard`, `PowerBetaCard`, `RepTimingBetaCard`, `SetEffortBetaCard`, `SessionSummaryBetaCard`, `CompositeScoreBetaCard`, `WeeklyLoadVolumeBetaCard` | Fully mock, Beta-badged | Fed hardcoded `BETA_*` constants from `AthleteDashboard.tsx`, explicitly comment-flagged "All-mock data — see BetaBadge." Coach sees a visible "Beta" badge. |
| `WeeklyLoadVolumeBetaCard`'s `coveragePct={22}` | Hardcoded literal | Not computed from any rep data, unlike the real `volumeCoveragePct` in `rosterMetricsService.ts`. Coincidentally close to the real historic 21.8% figure (Part 8) but is a literal, not live. Low risk since it's Beta-badged. |
| **`WeeklyVolumePanel` on `Index.tsx`** — `totalWorkKj`, `distanceM` | **Fabricated, NOT Beta-badged** | Linear scale-up of real tonnage (`× 0.013`, `× 0.0966`). This is the **highest-risk finding in this audit**: it renders on the main dashboard with no visual disclosure that two of its three numbers are synthetic, unlike every other mock-data surface in this app. |
| `ComingSoonMetricsCard` | Static roadmap list | No calculation at all, just a "not built yet" list. Rendered live via `RosterSignalsTable.tsx`. |

---

## Part 8 — Volume / load coverage gating (per-session, athlete-page)

`athleteSummaryUtils.ts` → `sessionVolume`, `sessionWeightCoverage`, `sessionVolumeGated`, `periodVolume` (unchanged from the previous doc, re-confirmed present and still called).
**Gate**: a session's weight coverage (reps with a real logged weight / total valid-exercise reps) must clear **80%** (`VOLUME_COVERAGE_THRESHOLD`) before a volume number is shown; otherwise the UI shows "Not enough load data logged." Sessions below the bar are excluded from period rollups entirely, never averaged in.
**Formula**: Σ per-rep load, where a real-weight rep contributes its weight and a bodyweight rep (weight = 0) contributes `1` (counts the rep, doesn't fabricate a load).
**Historic coverage figure** (last measured, not re-verified this pass): 21.8% of reps overall had a real logged weight — expect "not enough data" on most sessions.
**Rendered by**: Sessions tab row list (`SessionsTab`, per-session), "Load, last 7d" header rollup.
**Distinct from** Part 4's roster-wide `volumeSeries`/`volumeCoveragePct`, which has no 80% gate and pools everyone ungated. Neither of the two "volume" systems is aware of the other.

---

## Part 9 — Dead code inventory

Confirmed by grepping for real importers/callers, not inferred from comments alone:

1. **`trainingExposure()` / `exposureInputs()`** (`metrics/trainingExposure.ts`, `sessionAdapters.ts`) — only caller (`TrainingExposureCard.tsx`) is Storybook-only.
2. **`TrainingExposureCard.tsx`** — self-documented Storybook-only, confirmed.
3. **`DeviationBaselineCard.tsx`** — self-documented Storybook-only, confirmed; the anomaly-computation functions it would need don't exist anymore anyway (Part 2).
4. **`LoadRecord.isNew`** (`velocityRecords.ts`) — computed, never read.
5. **`RosterAthleteMetrics.velSeries` / `.sessSeries` / `.sessionsThisWeek` / `.recentVel` / `.velDelta` / `.dropPct`** — all real math, all consumed only by `AthleteTable.tsx`/`AthleteCard.tsx`, both effectively unreachable in production (`AthleteTable` only via Storybook fixture; `AthleteCard` has **zero importers anywhere**, not even Storybook).
6. **`RosterTeamMetrics.velSeries`** (team-wide) — zero readers at all, stronger than the per-athlete case above.
7. **`rosterFlags.ts` → `flagsFor`** — dead (only called from dead `AthleteCard.tsx`). `lastDaysFor` from the same file is still live (`AthleteDashboard.tsx` header chip).
8. **`ExerciseData.avgVelocity/.avgROM/.avgTempo`** (`sessionsService.ts`) — computed, not consumed by any Part 2 metric function (each recomputes independently); not fully confirmed dead app-wide, flagged for follow-up.
9. **`assignedThisWeek`/`completedThisWeek`/`planCompletionDeltaPct`** (`rosterMetricsService.ts`) — no confirmed render call site found this pass; flagged for follow-up, not asserted dead.

**Stale self-descriptions found in code comments** (the comment says one thing, reality is another):
- `RosterSignalsTable.tsx`'s own header comment claims "Storybook only" — it is the live production roster table on `Index.tsx`.

---

## Part 10 — Card → calculation quick reference

| Card component | Calculation(s) it renders | Source |
|---|---|---|
| `SetVelocityBars.tsx` | SP-01, SP-02, SP-03, SP-04 | `metrics/setVelocitySummary.ts`, `withinSetVelocityLoss.ts`, `setToSetChange.ts`, `velocityVsBaseline.ts` |
| `RangeOfMotionCard.tsx` | SP-06 | `metrics/rangeOfMotion.ts` |
| `RepTimingCard.tsx` | SP-07 | `metrics/repTiming.ts` |
| `PersonalRecordsCard.tsx` | SP-05 | `metrics/velocityRecords.ts` |
| `LoadVelocityProfileCard.tsx` | SP-09, SP-10 | `metrics/loadVelocityProfile.ts`, `metrics/estimatedOneRm.ts` |
| `RosterSignalsTable.tsx` | SP-12, SP-13, Part 3 attendance | `rosterSignals.ts`, `athleteFacts.ts`, `attentionFlags.ts` |
| `FollowedAthleteCard.tsx` | SP-12, SP-13 | same as above |
| `NeedsAttentionTile.tsx`, `SlowerThanBaselineTile.tsx` | Part 4 attention/baseline aggregates | `rosterMetricsService.ts`, `attentionFlags.ts` |
| `LeaderboardPanel.tsx` | Part 4 leaderboard | `rosterMetricsService.ts` |
| `TeamPrsPanel.tsx` | Part 4 team PRs | `rosterMetricsService.ts` |
| `TrainingGridPanel.tsx` | Part 4 training grid | `rosterMetricsService.ts` |
| `WeeklyVolumePanel.tsx` | Part 4 volume (tonnage real, work/distance **fake**) | `rosterMetricsService.ts` + `Index.tsx` inline math |
| `SessionsTile.tsx` | Part 4 team session counts | `rosterMetricsService.ts` |
| `KpiTile` ("Avg attendance"), `Index.tsx` | Part 6(a) | `rosterMetricsService.ts` → `workoutAttendance.ts` |
| `chips.tsx` (`LoadRecChip`) | Part 3 `loadRec` | `playersService.ts` |
| `HistoryPanel.tsx` | Workout/announcement batching, "Total reach" | `workoutPlansService.ts`, `messagesService.ts` |
| `*BetaCard.tsx` (7 cards) | None — mock data | `AthleteDashboard.tsx` hardcoded constants |
| `DeviationBaselineCard.tsx`, `TrainingExposureCard.tsx`, `AthleteCard.tsx`, `AthleteTable.tsx` | Dead/Storybook-only | see Part 9 |

---

## Part 11 — Risk-ranked summary of drift/findings from this audit

1. **High** — `Index.tsx`'s `WeeklyVolumePanel` shows two fabricated numbers (`totalWorkKj`, `distanceM`) with no Beta disclosure, on the main dashboard.
2. **High** — Roster-wide "Avg attendance" (Part 6a) now uses a completely different formula (full session-matching engine) than what was previously documented (plain `is_completed` ratio).
3. **Medium** — Per-athlete attendance (Part 6b) is now 8-week-windowed, not all-time as previously documented.
4. **Medium** — Four independent plan-status/attendance implementations coexist (Part 6), only three previously documented.
5. **Medium** — The entire live SP-12/SP-13 roster attention system (Part 4) was completely undocumented before this pass — it's what actually drives coach-facing "who needs attention" today, superseding the `rosterFlags.ts` heuristics still referenced in old comments.
6. **Low** — Several roster per-athlete series fields (Part 9, #5–6) are fully unreachable in production despite being computed on every page load — safe to leave, but a real (small) wasted-computation cost, and worth knowing before changing their shape.
7. **Low/cosmetic** — `WeeklyLoadVolumeBetaCard`'s `coveragePct={22}` is a hardcoded literal masquerading as a live stat, though it's Beta-badged so low practical risk.
