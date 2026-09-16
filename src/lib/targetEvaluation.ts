/**
 * Shared "Targets Reached" model — replaces raw cross-exercise average velocity
 * as the headline VBT number across the dashboard (see CALCULATIONS.md).
 *
 * A rep only counts once its plan exercise has a coach-set target_velocity_min
 * AND target_velocity_max (both required — a one-sided target isn't evaluable).
 * A rep whose exercise has no target is excluded from both numerator and
 * denominator: untracked, not a miss. Because every counted rep is normalized
 * to "in range / out of range" against its OWN exercise's target before
 * aggregation, summing hits across different exercises is valid — unlike
 * raw m/s, which only means something within one exercise.
 */

export interface ExerciseTargetRange {
  min: number;
  max: number;
}

/** One exercise entry as stored in workout_plans.exercises (jsonb). Only the
 *  fields this module cares about — the real shape carries more (sets, weight…). */
export interface PlanExerciseLike {
  name: string;
  targetVelocityMin?: number | null;
  targetVelocityMax?: number | null;
}

export interface RepForEval {
  exerciseName: string;
  velocity: number;
}

export interface TargetsReached {
  inTarget: number;
  withTarget: number;
}

export const ZERO_TARGETS: TargetsReached = { inTarget: 0, withTarget: 0 };

/**
 * Explicit, hardcoded alias map for raw exercise_name variants confirmed
 * against live data (Sept 2026) to be the SAME lift logged under different
 * names — not a general fuzzy-matching system, and not extrapolated to any
 * other pair someone merely suspects is a duplicate. Add an entry here only
 * after separately confirming a specific collision the same way (inspecting
 * distinct exercise_name values + rep/session counts), never by guessing.
 * Keys are lowercased+trimmed; values are the canonical name to use instead.
 */
const EXERCISE_NAME_ALIASES: Record<string, string> = {
  squat: 'Back Squat',
  squats: 'Back Squat',
  rdl: 'Romanian Deadlift',
};

/**
 * Resolves a raw exercise_name to its canonical form: alias lookup first
 * (trim+lowercase key match against EXERCISE_NAME_ALIASES), falling back to
 * the trimmed original when there's no known alias. Applied at read time
 * only, wherever reps.exercise_name is first grouped/keyed (sessionsService,
 * rosterMetricsService, playersService) — never rewrites stored data.
 */
export function canonicalizeExerciseName(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim();
  return EXERCISE_NAME_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

/** Case-insensitive, trimmed, alias-resolved — matches how reps.exercise_name
 *  (hardware/mobile label) is compared against workout_plans.exercises[].name
 *  (coach-typed). Runs canonicalizeExerciseName first so the two confirmed
 *  aliases above match correctly even if a caller passed a raw, un-canonicalized
 *  name straight through. Beyond those two, if the two diverge in spelling the
 *  rep is simply untracked (safe failure — see CALCULATIONS.md "known
 *  limitations"), never counted as a miss. */
export const normalizeExerciseName = (name: string | null | undefined): string =>
  canonicalizeExerciseName(name).toLowerCase();

/** Build a name → range lookup from one plan's exercises array. Skips entries
 *  missing either bound, or with an inverted/degenerate range. */
export function buildTargetsForExercises(
  exercises: PlanExerciseLike[] | null | undefined
): Map<string, ExerciseTargetRange> {
  const map = new Map<string, ExerciseTargetRange>();
  for (const ex of exercises ?? []) {
    const { targetVelocityMin: min, targetVelocityMax: max } = ex;
    if (min == null || max == null || !(min <= max)) continue;
    map.set(normalizeExerciseName(ex.name), { min, max });
  }
  return map;
}

/** Merge multiple same-day plans' target maps together (rare — a coach could
 *  assign more than one plan to a player on the same date). Later plans win on
 *  a name collision; this is an edge case with no natural tie-break. */
export function mergeTargetMaps(
  maps: Array<Map<string, ExerciseTargetRange>>
): Map<string, ExerciseTargetRange> {
  const out = new Map<string, ExerciseTargetRange>();
  for (const m of maps) for (const [k, v] of m) out.set(k, v);
  return out;
}

/** Evaluate a flat list of reps (any mix of exercises) against a single
 *  name → range lookup. Reps with velocity <= 0 (no valid recording) or whose
 *  exercise has no target are skipped entirely — not counted as misses. */
export function evaluateRepsAgainstTargets(
  reps: RepForEval[],
  targets: Map<string, ExerciseTargetRange>
): TargetsReached {
  let inTarget = 0;
  let withTarget = 0;
  for (const r of reps) {
    if (!(r.velocity > 0)) continue;
    const t = targets.get(normalizeExerciseName(r.exerciseName));
    if (!t) continue;
    withTarget++;
    if (r.velocity >= t.min && r.velocity <= t.max) inTarget++;
  }
  return { inTarget, withTarget };
}

export function addTargets(a: TargetsReached, b: TargetsReached): TargetsReached {
  return { inTarget: a.inTarget + b.inTarget, withTarget: a.withTarget + b.withTarget };
}

export function targetsPct(t: TargetsReached): number | null {
  return t.withTarget > 0 ? Math.round((t.inTarget / t.withTarget) * 100) : null;
}

/** "No targets set" per the empty-state rule — 0% would read as a failed
 *  session when there was nothing to hit or miss in the first place. */
export function formatTargetsReached(t: TargetsReached): string {
  const pct = targetsPct(t);
  if (pct == null) return 'No targets set';
  return `${t.inTarget}/${t.withTarget} reps (${pct}%)`;
}

// ─── Load recommendation (Part 2 #9) ────────────────────────────────────────

export type LoadRecommendation =
  | 'Increase Load'
  | 'Decrease Load (Fatigue)'
  | 'Maintain'
  | 'No target set'
  | 'New';

/** One exercise's mean velocity in one session, used to pick "the most recent
 *  targeted exercise session" for the load-recommendation rule. */
export interface ExerciseSessionMean {
  sessionDate: string; // ISO date, for ordering
  exerciseName: string;
  avgVelocity: number;
}

/**
 * Rule (see CALCULATIONS.md for the authoritative copy of this text):
 * Look at every (exercise, session) mean-velocity row the athlete has, keep
 * only the ones whose exercise has a coach-set target on that date, and take
 * the single most recent one. Classify: mean > target max → Increase Load;
 * mean < target min → Decrease Load (Fatigue); otherwise → Maintain. If the
 * athlete has sessions but none of their trained exercises ever carried a
 * target, → "No target set". If they have no sessions at all → "New".
 */
export function computeLoadRecommendation(
  rows: ExerciseSessionMean[],
  targetsByDate: Map<string, Map<string, ExerciseTargetRange>>,
  hasAnySessions: boolean
): LoadRecommendation {
  let latest: { date: string; range: ExerciseTargetRange; mean: number } | null = null;
  for (const row of rows) {
    const dayTargets = targetsByDate.get(row.sessionDate);
    const range = dayTargets?.get(normalizeExerciseName(row.exerciseName));
    if (!range) continue;
    if (!latest || row.sessionDate > latest.date) {
      latest = { date: row.sessionDate, range, mean: row.avgVelocity };
    }
  }
  if (!latest) return hasAnySessions ? 'No target set' : 'New';
  if (latest.mean > latest.range.max) return 'Increase Load';
  if (latest.mean < latest.range.min) return 'Decrease Load (Fatigue)';
  return 'Maintain';
}

/** Shared classifier for the loadRec chip + the roster donut, so a fix to one
 *  can't silently diverge from the other the way the original bug did (the
 *  chip and the donut used two different, both-wrong, string comparisons). */
export type LoadRecBucket = 'increase' | 'decrease' | 'maintain' | 'no-target' | 'new' | 'unknown';

export function classifyLoadRec(rec: string | null | undefined): LoadRecBucket {
  const lower = (rec ?? '').trim().toLowerCase();
  if (lower.startsWith('increase')) return 'increase';
  if (lower.startsWith('decrease')) return 'decrease';
  if (lower === 'maintain') return 'maintain';
  if (lower === 'no target set') return 'no-target';
  if (lower === 'new') return 'new';
  return 'unknown';
}
