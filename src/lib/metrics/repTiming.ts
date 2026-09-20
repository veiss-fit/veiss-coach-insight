import { isValidVelocity, type RepInput } from "./setVelocitySummary";

/**
 * SP-07 Rep timing (temp/METRIC_SPEC.md), per exercise.
 *
 * A duration counts when the rep's velocity is valid (SP-01 rule) and the
 * duration is greater than 0. A null or zero duration is excluded, never
 * counted as zero. Seconds throughout.
 *   Mean concentric / eccentric: over the reps that have that duration.
 *   Time under tension (TUT): sum of concentric + eccentric over the reps
 *   where both are present.
 *   E:C ratio: eccentric / concentric over the reps where both are present.
 * No judgement attached.
 */

export interface SetTiming {
  set_number: number;
  /** Mean concentric duration, s. null when no rep has one. */
  concMean: number | null;
  /** Mean eccentric duration, s. null when no rep has one. */
  eccMean: number | null;
  /** Reps with a concentric duration. */
  nConc: number;
  /** Reps with an eccentric duration. */
  nEcc: number;
  /** Reps with both. */
  nBoth: number;
  /** Time under tension, s. null when no rep has both. */
  tut: number | null;
  /** Eccentric / concentric over reps with both. null when no rep has both. */
  ecRatio: number | null;
}

export interface ExerciseTiming {
  exercise: string;
  sets: SetTiming[];
}

const positive = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function summarizeTimingSet(setNumber: number, reps: RepInput[]): SetTiming {
  const valid = reps.filter((r) => isValidVelocity(r.average_rep_speed));
  const conc = valid.flatMap((r) => (positive(r.concentric_duration_s) ? [r.concentric_duration_s] : []));
  const ecc = valid.flatMap((r) => (positive(r.eccentric_duration_s) ? [r.eccentric_duration_s] : []));
  const both = valid.flatMap((r) =>
    positive(r.concentric_duration_s) && positive(r.eccentric_duration_s)
      ? [{ c: r.concentric_duration_s, e: r.eccentric_duration_s }]
      : [],
  );
  const cSum = sum(both.map((b) => b.c));
  return {
    set_number: setNumber,
    concMean: conc.length ? sum(conc) / conc.length : null,
    eccMean: ecc.length ? sum(ecc) / ecc.length : null,
    nConc: conc.length,
    nEcc: ecc.length,
    nBoth: both.length,
    tut: both.length ? cSum + sum(both.map((b) => b.e)) : null,
    ecRatio: both.length ? sum(both.map((b) => b.e)) / cSum : null,
  };
}

/** Groups one session's reps by exercise, then by set, in first-seen order. */
export function summarizeTimingSession(reps: RepInput[]): ExerciseTiming[] {
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
    sets: [...sets.entries()].sort(([a], [b]) => a - b).map(([n, rs]) => summarizeTimingSet(n, rs)),
  }));
}

const meanOf = (xs: number[]): number | null => (xs.length ? sum(xs) / xs.length : null);

export interface ExerciseTimingSummary {
  /** Mean of the set means, s. */
  conc: number | null;
  ecc: number | null;
  /** Mean of the per-set E:C ratios. */
  ecRatio: number | null;
  /** Time under tension summed over all sets, s. null when no set has one. */
  tut: number | null;
  /** Sets that contributed to `tut`. */
  tutSets: number;
}

export function exerciseTimingSummary(sets: SetTiming[]): ExerciseTimingSummary {
  const tuts = sets.flatMap((s) => (s.tut == null ? [] : [s.tut]));
  return {
    conc: meanOf(sets.flatMap((s) => (s.concMean == null ? [] : [s.concMean]))),
    ecc: meanOf(sets.flatMap((s) => (s.eccMean == null ? [] : [s.eccMean]))),
    ecRatio: meanOf(sets.flatMap((s) => (s.ecRatio == null ? [] : [s.ecRatio]))),
    tut: tuts.length ? sum(tuts) : null,
    tutSets: tuts.length,
  };
}

export type TimingChange =
  | {
      ok: true;
      /** Percent, signed, unrounded. */
      change: number;
      firstSet: number;
      lastSet: number;
    }
  | { ok: false; reason: string };

/** Change in a mean duration from the first to the last set that has one. Load is not considered. */
function durationChange(sets: SetTiming[], key: "concMean" | "eccMean"): TimingChange {
  const usable = sets.filter((s) => s[key] != null);
  if (usable.length < 2) return { ok: false, reason: "fewer than 2 sets with timing" };
  const first = usable[0];
  const last = usable[usable.length - 1];
  const f = first[key] as number;
  const l = last[key] as number;
  return { ok: true, change: ((l - f) / f) * 100, firstSet: first.set_number, lastSet: last.set_number };
}

export const concentricSetToSetChange = (sets: SetTiming[]) => durationChange(sets, "concMean");
export const eccentricSetToSetChange = (sets: SetTiming[]) => durationChange(sets, "eccMean");
