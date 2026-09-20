import type { SetVelocitySummary } from "./setVelocitySummary";

/**
 * SP-04 Velocity vs own baseline (temp/METRIC_SPEC.md), per exercise.
 *
 * Session value x_s = mean over the qualifying sets of v_best.
 *   Tier A: the latest session used one known load L on every set that has a
 *           valid rep. Only sets at L count, in every session.
 *   Tier B: load unknown or mixed. All sets pooled; the result is flagged
 *           "not load-matched".
 * Baseline B = exponentially weighted average of x_s over earlier sessions
 * inside BASELINE_DAYS (oldest first, newest weighs most). The spec says plain
 * mean; the product owner asked for an exponential average.
 * Change = (x_latest - B) / B * 100, signed. No judgement is attached.
 */

/** Uncalibrated. Spec default 42, from Metric's 6-week comparison (no stated source). */
export const BASELINE_DAYS = 42;
/**
 * EMA smoothing factor per session: B_k = ALPHA * x_k + (1 - ALPHA) * B_(k-1),
 * seeded with the oldest session. Uncalibrated, no source. Higher = newest
 * sessions count more.
 */
export const EMA_ALPHA = 0.3;

export interface HistorySession {
  /** ISO date or datetime of the session. */
  date: string;
  sets: SetVelocitySummary[];
}

export type BaselineComparison =
  | {
      ok: true;
      tier: "A" | "B";
      /** Verified load for tier A, null for tier B. */
      load: number | null;
      /** Latest session value x_latest, m/s. */
      latest: number;
      /** Baseline B, exponentially weighted average, m/s. */
      baseline: number;
      /** Percent, signed, unrounded. */
      change: number;
      /** Number of earlier sessions in the baseline. */
      nBaseline: number;
      /** x_s per session, oldest first, latest last. */
      series: number[];
    }
  | { ok: false; reason: string };

const usable = (sets: SetVelocitySummary[]) => sets.filter((s) => s.vBest != null);

/** The one load shared by every usable set, or null when unknown or mixed. */
export function commonLoad(sets: SetVelocitySummary[]): number | null {
  const loads = usable(sets).map((s) => s.load);
  const first = loads[0];
  return loads.length > 0 && typeof first === "number" && loads.every((l) => l === first) ? first : null;
}

function sessionValue(sets: SetVelocitySummary[], load: number | null): number | null {
  const chosen = usable(sets).filter((s) => load == null || s.load === load);
  if (chosen.length === 0) return null;
  return chosen.reduce((a, s) => a + (s.vBest as number), 0) / chosen.length;
}

export function velocityVsBaseline(
  latestSets: SetVelocitySummary[],
  latestDate: string,
  history: HistorySession[],
  /** Force tier B (all sets pooled, not load-matched) even when the latest load is known. */
  options?: { pooled?: boolean },
): BaselineComparison {
  const load = options?.pooled ? null : commonLoad(latestSets);
  const latest = sessionValue(latestSets, load);
  if (latest == null) return { ok: false, reason: "no valid reps" };

  const end = new Date(latestDate).getTime();
  const start = end - BASELINE_DAYS * 86_400_000;
  const earlier = history
    .filter((h) => {
      const t = new Date(h.date).getTime();
      return t < end && t >= start;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .flatMap((h) => {
      const x = sessionValue(h.sets, load);
      return x == null ? [] : [x];
    });

  if (earlier.length === 0) return { ok: false, reason: "No baseline yet" };

  const baseline = earlier.reduce((b, x) => EMA_ALPHA * x + (1 - EMA_ALPHA) * b);
  const change = ((latest - baseline) / baseline) * 100;
  return {
    ok: true,
    tier: load == null ? "B" : "A",
    load,
    latest,
    baseline,
    change,
    nBaseline: earlier.length,
    series: [...earlier, latest],
  };
}
