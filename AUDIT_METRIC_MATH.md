# Athlete Metric Math — Audit (D44) & Rationale (D45)

**Scope:** every calculated metric shown on the athlete detail page (Readiness tab, Performance charts) and the roster-wide flags derived from the same underlying data. Read-only audit of formulas; one confirmed bug was fixed inline (noted below) since it directly explains a defect observed in the walkthrough.

---

## 🔴 Confirmed bug, fixed — Readiness score used the wrong session

**File:** [AthleteDashboard.tsx:190-201](src/pages/AthleteDashboard.tsx#L190-L201) (`ReadinessTab`)

**What was wrong:** `getPlayerSessions` ([sessionsService.ts:64-68](src/services/sessionsService.ts#L64-L68)) orders sessions **newest-first** (`.order('started_at', { ascending: false })`). `ReadinessTab` computed a `drops` array by mapping `sessionVelocityDropoff` straight over that array — preserving the newest-first order — then read `drops[drops.length - 1]` expecting that to be the *most recent* value. Because the array was never re-sorted, `drops[drops.length - 1]` was actually the **oldest** session's drop-off, not the newest. Every other function in `athleteSummaryUtils.ts` that needs chronological order explicitly re-sorts first ([athleteSummaryUtils.ts:308-313](src/lib/athleteSummaryUtils.ts#L308-L313), [:365-370](src/lib/athleteSummaryUtils.ts#L365-L370)) — this one spot didn't follow that convention.

**Why this matters:** the Readiness score card's "Velocity drop-off" row, and the score itself (`100 - drop * 1.4 - ...`), were driven by however-old the *first* logged session happened to be, not the athlete's actual current state. For an athlete whose oldest and newest sessions differ meaningfully, this produces a visibly wrong score — almost certainly what was flagged in the walkthrough ("one athlete's readiness score was visibly wrong").

**Fix applied:** sort `sessions` chronologically before extracting drop-off values, matching the convention already used everywhere else in this codebase. See the fix and comment at [AthleteDashboard.tsx:191-198](src/pages/AthleteDashboard.tsx#L191-L198).

---

## ⚠️ Found, not fixed — two different "velocity drop-off" definitions

Two separate formulas are both called "drop-off" and both weighted ×1.4, but they compute genuinely different things:

- **Roster-wide `dropPct`** ([rosterMetricsService.ts:162-172](src/services/rosterMetricsService.ts#L162-L172), feeds the roster flag chips and `priorityScore` in [rosterFlags.ts:53-57](src/lib/rosterFlags.ts#L53-L57)): first-set-average vs. last-set-average, computed across **all reps in the session regardless of exercise**. If a session has Back Squat then Bench Press, "first set" and "last set" can be different exercises entirely.
- **Athlete-detail `sessionVelocityDropoff`** ([athleteSummaryUtils.ts:147-167](src/lib/athleteSummaryUtils.ts#L147-L167), feeds the Readiness score and the "Deviation from baseline" indicators): computed **per exercise**, first-set vs. last-set within that exercise, then averaged across exercises in the session.

The per-exercise version is the more correct one for a multi-exercise session; the roster-wide version was very likely simplified for the batched-query performance model `rosterMetricsService.ts` is built around (CLAUDE.md: "fixed number of batched queries... never fetch per-player"), and matching the per-exercise logic there would require grouping by exercise across the whole roster in one pass. **This is a real inconsistency, but fixing it changes what triggers the roster-wide "Velocity drop X%" flag for every athlete at once** — that's a bigger blast radius than the bug above, and worth a deliberate decision rather than a silent change. Flagging for you to decide: leave as a known approximation (document it), or invest in the roster-wide per-exercise version.

---

## ✅ What's already documented (D45 is mostly already done)

Every deviation indicator already carries a structured, in-UI rationale via a `tooltip: { what, how, highlights, minimum }` object, surfaced as a ⓘ tooltip in the "Deviation from baseline" card ([athleteSummaryUtils.ts:8-13](src/lib/athleteSummaryUtils.ts#L8-L13) defines the shape; [:308-358](src/lib/athleteSummaryUtils.ts#L308-L358) is where each indicator is built). Before this pass:

| Metric | `what`/`how`/`highlights`/`minimum` documented? |
|---|---|
| ROM Consistency | ✅ already had one |
| E:C Ratio | ✅ already had one |
| Time Under Tension | ✅ already had one |
| Avg Velocity | ❌ had only a `warning` string, no tooltip |

**Fixed this pass:** added the missing tooltip for Avg Velocity ([athleteSummaryUtils.ts:316-326](src/lib/athleteSummaryUtils.ts#L316-L326)) — same four-part structure as the other three, so a coach can now see *why* and *how* for every deviation indicator, not three out of four.

The Readiness score itself has a one-line rationale already shown in the UI ("Heuristic: velocity drop-off, recency, and attendance" — [AthleteDashboard.tsx:209](src/pages/AthleteDashboard.tsx#L209)); the exact weights (`drop * 1.4`, `lastDaysCapped * 2`, floor of 20) aren't explained anywhere in-UI. Worth a short tooltip there too if you want full parity with the deviation indicators — didn't add one speculatively since the weighting rationale (why 1.4, why cap at 30 days, why floor at 20) isn't written down anywhere for me to surface accurately; that's a "why did we pick these numbers" question only your team can answer.

---

## Formula reference (for "why does this number say what it says")

| Metric | Formula | Location |
|---|---|---|
| Readiness score | `max(20, min(100, 100 − dropOff×1.4 − min(daysSinceLastSession,30)×2))` | [AthleteDashboard.tsx:197](src/pages/AthleteDashboard.tsx#L197) |
| Within-session drop-off (per set) | `(rep1Vel − lastRepVel) / rep1Vel × 100`, avg across qualifying sets (≥3 reps) | [athleteSummaryUtils.ts:119-142](src/lib/athleteSummaryUtils.ts#L119-L142) |
| Across-set drop-off (readiness/detail) | `(firstSetAvgVel − lastSetAvgVel) / firstSetAvgVel × 100` per exercise, averaged | [athleteSummaryUtils.ts:147-167](src/lib/athleteSummaryUtils.ts#L147-L167) |
| Roster-wide drop-off (flags) | Same shape, but mixes all exercises together — see inconsistency note above | [rosterMetricsService.ts:155-174](src/services/rosterMetricsService.ts#L155-L174) |
| ROM Consistency | Coefficient of variation: `sampleStdDev(ROM) / mean(ROM) × 100` | [athleteSummaryUtils.ts:190-199](src/lib/athleteSummaryUtils.ts#L190-L199) |
| E:C Ratio | `eccentric_duration / concentric_duration`, averaged per rep | [athleteSummaryUtils.ts:201-212](src/lib/athleteSummaryUtils.ts#L201-L212) |
| Time Under Tension | `Σ(concentric + eccentric)` across all reps in session | [athleteSummaryUtils.ts:214-227](src/lib/athleteSummaryUtils.ts#L214-L227) |
| Deviation RAG status | z-score of last-4-sessions mean vs. historical baseline mean; green ≤1σ, amber ≤2σ, red >2σ | [athleteSummaryUtils.ts:292-296](src/lib/athleteSummaryUtils.ts#L292-L296) |
| Priority score (roster attention ranking) | `dropPct×1.4 + max(0, 90−attendance) + min(daysSinceLastSession,30)×2` | [rosterFlags.ts:53-57](src/lib/rosterFlags.ts#L53-L57) |

---

## Not audited here

- **D46** (research/rank which stats are actually useful) — a product/domain research question, not something derivable from reading the code. Out of scope for a math audit.
- **D51** ("average velocity across sets and reps" questionability) — this is the same `sessionAvgVelocity`/roster `avgVelocity` metric documented above; whether it's the *right* metric to show (given target velocity differs by exercise/set) is a product judgment call, not a math bug. The code does what it says; whether "what it says" is useful is D46/D51's open question.
