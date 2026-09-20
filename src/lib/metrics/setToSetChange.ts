import type { SetVelocitySummary } from "./setVelocitySummary";

/**
 * SP-03 Set-to-set velocity change (temp/METRIC_SPEC.md).
 *
 * change = (v_mean_last - v_mean_first) / v_mean_first * 100 over the sets of
 * one exercise that have at least one valid rep. Returned only when there are
 * at least 2 such sets and the loads of the first and last of them are known
 * and identical; a ramp-up or warm-up set is faster than a working set, so an
 * unmatched comparison mostly measures the load change. The sign is kept:
 * negative means slower. No judgement is attached.
 *
 * The spec says "the compared sets"; this compares the first and last set only.
 */
export type SetToSetChange =
  | {
      ok: true;
      /** Percent, unrounded, signed. */
      change: number;
      firstSet: number;
      lastSet: number;
      load: number;
    }
  | { ok: false; reason: string };

export function setToSetChange(sets: SetVelocitySummary[]): SetToSetChange {
  const usable = sets.filter((s) => s.n >= 1 && s.vMean != null);
  if (usable.length < 2) return { ok: false, reason: "fewer than 2 sets with valid reps" };
  const first = usable[0];
  const last = usable[usable.length - 1];
  if (first.load == null || last.load == null || first.load !== last.load) {
    return { ok: false, reason: "load not verified equal" };
  }
  const vFirst = first.vMean as number;
  const vLast = last.vMean as number;
  return {
    ok: true,
    change: ((vLast - vFirst) / vFirst) * 100,
    firstSet: first.set_number,
    lastSet: last.set_number,
    load: first.load,
  };
}
