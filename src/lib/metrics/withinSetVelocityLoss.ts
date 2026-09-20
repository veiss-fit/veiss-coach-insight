import type { SetVelocitySummary } from "./setVelocitySummary";

/**
 * SP-02 Within-set velocity loss (temp/METRIC_SPEC.md).
 *
 * VL = (v_best - v_last) / v_best * 100, where v_best is the fastest valid rep
 * of the set and v_last is the valid rep with the highest rep_number.
 * No judgement is attached to the value.
 *
 * MIN_VALID_REPS is uncalibrated: no paper read gives a minimum. The spec's
 * default was 3; the product owner set it to 2 (a loss needs at least two reps
 * to compare).
 */
export const MIN_VALID_REPS = 2;

export type VelocityLoss =
  | {
      ok: true;
      /** Percent, unrounded. */
      loss: number;
      /** Fastest valid rep, m/s. */
      vBest: number;
      /** Last valid rep, m/s. */
      vLast: number;
      /** rep_number of the fastest valid rep (first one if tied). */
      refRep: number;
      /** rep_number of the last valid rep. */
      lastRep: number;
      n: number;
    }
  | { ok: false; reason: string; n: number };

export function withinSetVelocityLoss(set: SetVelocitySummary): VelocityLoss {
  if (set.n < MIN_VALID_REPS || set.vBest == null) {
    return { ok: false, reason: `fewer than ${MIN_VALID_REPS} valid reps`, n: set.n };
  }
  const valid = set.reps.filter((r): r is { rep_number: number; velocity: number } => r.velocity != null);
  const best = valid.reduce((a, b) => (b.velocity > a.velocity ? b : a));
  const last = valid[valid.length - 1];
  return {
    ok: true,
    loss: ((best.velocity - last.velocity) / best.velocity) * 100,
    vBest: best.velocity,
    vLast: last.velocity,
    refRep: best.rep_number,
    lastRep: last.rep_number,
    n: set.n,
  };
}

export interface ExerciseLossSummary {
  /** Median loss over sets that passed the gate, percent, unrounded. */
  median: number;
  min: number;
  max: number;
  /** Number of sets that contributed. */
  sets: number;
}

/**
 * Median (not mean) so one odd set does not move it. Spec: design decision,
 * no evidence claimed. Returns null when no set passed the gate.
 */
export function exerciseLossSummary(sets: SetVelocitySummary[]): ExerciseLossSummary | null {
  const losses = sets.flatMap((s) => {
    const l = withinSetVelocityLoss(s);
    return l.ok ? [l.loss] : [];
  });
  if (losses.length === 0) return null;
  const sorted = [...losses].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { median, min: sorted[0], max: sorted[sorted.length - 1], sets: sorted.length };
}
