/**
 * Exercise-name canonicalization + load-recommendation display bucketing.
 *
 * (The target-velocity-range "Targets Reached" system and the target-based
 * load recommendation that used to live in this file were removed — the
 * coach dashboard doesn't currently collect target_velocity_min/max, so
 * there's nothing for that system to evaluate against. What's left here is
 * infrastructure that's still load-bearing independent of that: the
 * confirmed exercise-name alias map, and the classifier that keeps the load
 * recommendation chip/donut from drifting out of sync with whatever strings
 * the recommendation engine actually produces.)
 */

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
 * rosterMetricsService) — never rewrites stored data.
 */
export function canonicalizeExerciseName(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim();
  return EXERCISE_NAME_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

/** Shared classifier for the loadRec chip + the roster donut, so a fix to one
 *  can't silently diverge from the other the way the original bug did (the
 *  chip and the donut used two different, both-wrong, string comparisons). */
export type LoadRecBucket = 'increase' | 'decrease' | 'maintain' | 'new' | 'unknown';

export function classifyLoadRec(rec: string | null | undefined): LoadRecBucket {
  const lower = (rec ?? '').trim().toLowerCase();
  if (lower.startsWith('increase')) return 'increase';
  if (lower.startsWith('decrease')) return 'decrease';
  if (lower === 'maintain') return 'maintain';
  if (lower === 'new') return 'new';
  return 'unknown';
}
