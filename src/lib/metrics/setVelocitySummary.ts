/**
 * SP-01 Set velocity summary (temp/METRIC_SPEC.md).
 *
 * Per set: fastest rep, average, and how many valid reps. Grain is the set,
 * scoped per exercise. No judgement, no rounding (round for display only).
 *
 * Valid rep = average_rep_speed is not null and > 0. A rep failing that is
 * excluded from the statistics and counted as invalid. That rule is a spec
 * design decision that depends on an open firmware question (what a stored 0
 * means), so it lives in one place, `isValidVelocity`.
 */

export interface RepInput {
  exercise_name: string;
  set_number: number;
  rep_number: number;
  average_rep_speed: number | null;
  /** reps.weight. Unit unverified (assumed lbs, about 22% of reps carry one). */
  weight?: number | null;
  /** reps.rom_mm, millimetres. Used by SP-06. */
  rom_mm?: number | null;
  /** reps.concentric_duration_s, seconds. Used by SP-07. */
  concentric_duration_s?: number | null;
  /** reps.eccentric_duration_s, seconds. Used by SP-07. Reliability is firmware question 7. */
  eccentric_duration_s?: number | null;
}

export interface RepSlot {
  rep_number: number;
  /** null when the rep is invalid. */
  velocity: number | null;
}

export interface SetVelocitySummary {
  set_number: number;
  /** Every rep of the set, ordered by rep_number, valid or not. */
  reps: RepSlot[];
  /** Count of valid reps. */
  n: number;
  /** Count of invalid reps. */
  invalid: number;
  /** Fastest valid rep, m/s. null when n = 0. */
  vBest: number | null;
  /** Mean of valid reps, m/s. null when n = 0. */
  vMean: number | null;
  /**
   * Set load: reps.weight when every valid rep of the set has the same weight
   * greater than 0, otherwise null (spec section 1, "Set load").
   */
  load: number | null;
}

export interface ExerciseSets {
  exercise: string;
  sets: SetVelocitySummary[];
}

export const isValidVelocity = (v: number | null | undefined): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;

export function summarizeSet(setNumber: number, reps: RepInput[]): SetVelocitySummary {
  const ordered = [...reps].sort((a, b) => a.rep_number - b.rep_number);
  const slots: RepSlot[] = ordered.map((r) => ({
    rep_number: r.rep_number,
    velocity: isValidVelocity(r.average_rep_speed) ? r.average_rep_speed : null,
  }));
  const valid = slots.flatMap((s) => (s.velocity == null ? [] : [s.velocity]));
  const weights = ordered.filter((r) => isValidVelocity(r.average_rep_speed)).map((r) => r.weight);
  const first = weights[0];
  const load =
    weights.length > 0 && typeof first === "number" && first > 0 && weights.every((w) => w === first) ? first : null;
  return {
    set_number: setNumber,
    reps: slots,
    n: valid.length,
    invalid: slots.length - valid.length,
    vBest: valid.length ? Math.max(...valid) : null,
    vMean: valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null,
    load,
  };
}

/**
 * Groups one session's reps by exercise, then by set. Exercises appear in the
 * order first seen. Exercise names are used as given: the spec's alias map and
 * artifact-name filter are not implemented here.
 */
export function summarizeSession(reps: RepInput[]): ExerciseSets[] {
  const byExercise = new Map<string, Map<number, RepInput[]>>();
  for (const r of reps) {
    const key = r.exercise_name.trim();
    const sets = byExercise.get(key) ?? new Map<number, RepInput[]>();
    const list = sets.get(r.set_number) ?? [];
    list.push(r);
    sets.set(r.set_number, list);
    byExercise.set(key, sets);
  }
  return [...byExercise.entries()].map(([exercise, sets]) => ({
    exercise,
    sets: [...sets.entries()]
      .sort(([a], [b]) => a - b)
      .map(([setNumber, setReps]) => summarizeSet(setNumber, setReps)),
  }));
}
