import type { HistorySession } from "./velocityVsBaseline";

/**
 * SP-09 Load-velocity profile (temp/METRIC_SPEC.md), per exercise.
 *
 * One point per distinct set load: x = load, y = v_best of the fastest valid
 * rep across all sets at that load inside the window. A least-squares line is
 * fitted through the points. R^2, the number of points and the velocity span
 * between the lightest and the heaviest load are reported. No e1RM.
 *
 * Blocked on the `weight` unit and coverage: a set only contributes when it
 * has a verified load (SP-01 "Set load"). The precondition is at least 2
 * distinct loads.
 */

/** Uncalibrated. Same window as the existing Performance-tab chart (8 weeks). */
export const PROFILE_WINDOW_DAYS = 56;
export const MIN_LOADS = 2;

export interface ProfilePoint {
  /** Set load, unit not verified. */
  load: number;
  /** Fastest valid rep across sets at this load, m/s. */
  best: number;
  /** Number of sets at this load inside the window. */
  sets: number;
  /** ISO date of the most recent session with a set at this load. */
  latest: string;
}

export interface ProfileFit {
  slope: number;
  intercept: number;
  /** Coefficient of determination. With exactly 2 points it is 1 by construction. */
  r2: number;
}

export interface LoadVelocityProfile {
  /** Ascending by load. */
  points: ProfilePoint[];
  /** null with fewer than MIN_LOADS points. */
  fit: ProfileFit | null;
  /** best(lightest) - best(heaviest), m/s. null with fewer than MIN_LOADS points. */
  span: { lightest: number; heaviest: number; drop: number } | null;
}

export function loadVelocityProfile(sessions: HistorySession[], today: string): LoadVelocityProfile {
  const end = new Date(today).getTime();
  const start = end - PROFILE_WINDOW_DAYS * 86_400_000;
  const byLoad = new Map<number, ProfilePoint>();
  for (const session of sessions) {
    const t = new Date(session.date).getTime();
    if (t < start || t > end) continue;
    for (const s of session.sets) {
      if (s.load == null || s.vBest == null) continue;
      const cur = byLoad.get(s.load);
      if (!cur) {
        byLoad.set(s.load, { load: s.load, best: s.vBest, sets: 1, latest: session.date });
      } else {
        cur.sets += 1;
        if (s.vBest > cur.best) cur.best = s.vBest;
        if (new Date(session.date).getTime() > new Date(cur.latest).getTime()) cur.latest = session.date;
      }
    }
  }
  const points = [...byLoad.values()].sort((a, b) => a.load - b.load);
  if (points.length < MIN_LOADS) return { points, fit: null, span: null };

  const n = points.length;
  const sx = points.reduce((a, p) => a + p.load, 0);
  const sy = points.reduce((a, p) => a + p.best, 0);
  const sxy = points.reduce((a, p) => a + p.load * p.best, 0);
  const sxx = points.reduce((a, p) => a + p.load * p.load, 0);
  const denom = n * sxx - sx * sx;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  const meanY = sy / n;
  const ssTot = points.reduce((a, p) => a + (p.best - meanY) ** 2, 0);
  const ssRes = points.reduce((a, p) => a + (p.best - (intercept + slope * p.load)) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  const lightest = points[0];
  const heaviest = points[points.length - 1];
  return {
    points,
    fit: { slope, intercept, r2 },
    span: { lightest: lightest.load, heaviest: heaviest.load, drop: lightest.best - heaviest.best },
  };
}
