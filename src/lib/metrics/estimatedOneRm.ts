import type { LoadVelocityProfile } from "./loadVelocityProfile";

/**
 * SP-10 Estimated 1RM (temp/METRIC_SPEC.md). The spec defers it and gives no
 * formula; this is a prototype.
 *
 * Method: take the SP-09 load-velocity line and read the load where it reaches
 * the exercise's minimum velocity (MVT). Upper-body lifts only (the spec says
 * squat and deadlift estimation is not supported).
 */

/**
 * Uncalibrated default. Published bench values are 0.16, 0.165 and 0.23 m/s
 * (spec SP-10), so this is the lowest of them. The coach can change it.
 */
export const DEFAULT_MVT = 0.16;

/** Name keywords for upper-body lifts. Guess, not a validated list. */
const UPPER_BODY = /bench|press|row|pull|chin|dip|push|fly|curl|extension/i;
const LOWER_BODY = /squat|deadlift|lunge|leg|clean|snatch|hip thrust|rdl|good morning/i;

/** Upper-body when the name matches an upper keyword and no lower keyword. */
export function isUpperBodyExercise(name: string): boolean {
  return UPPER_BODY.test(name) && !LOWER_BODY.test(name);
}

export type OneRmEstimate =
  | {
      ok: true;
      /** Load at which the fitted line reaches `mvt`, same unit as the set load (unverified). */
      oneRm: number;
      mvt: number;
      /** How far past the heaviest load tested the estimate sits, in load units (0 when inside). */
      beyondHeaviest: number;
    }
  | { ok: false; reason: string };

export function estimateOneRm(profile: LoadVelocityProfile, mvt: number): OneRmEstimate {
  if (!profile.fit) return { ok: false, reason: "Needs at least 2 different loads" };
  if (!(mvt > 0)) return { ok: false, reason: "Minimum velocity must be above 0" };
  const { slope, intercept } = profile.fit;
  if (!(slope < 0)) return { ok: false, reason: "Speed does not fall as load rises" };
  const oneRm = (mvt - intercept) / slope;
  if (!(oneRm > 0)) return { ok: false, reason: "Line does not reach that velocity at a positive load" };
  const heaviest = profile.points[profile.points.length - 1].load;
  return { ok: true, oneRm, mvt, beyondHeaviest: Math.max(0, oneRm - heaviest) };
}
