import type { SetVelocitySummary } from "./setVelocitySummary";
import { BASELINE_DAYS, commonLoad, velocityVsBaseline, type HistorySession } from "./velocityVsBaseline";
import { concentricSetToSetChange, type SetTiming } from "./repTiming";

/**
 * SP-12 roster row signals (temp/METRIC_SPEC.md), one athlete. Each signal is
 * a fact about the athlete's own data, with no verdict attached:
 *   - biggestDrop: the exercise with the largest fall against the athlete's
 *     own baseline (SP-04), with the load of the latest and the previous session.
 *   - slowestTempo: the exercise whose concentric time grew most from the
 *     first to the last set of the latest session (SP-07).
 */

export interface ExerciseSignalInput {
  exercise: string;
  /** Latest session of this exercise. `sessionId` lets the UI open that session. */
  latest: { sessionId?: string; date: string; sets: SetVelocitySummary[]; timing: SetTiming[] };
  /** Earlier sessions of this exercise (any age; the baseline window is applied inside). */
  history: HistorySession[];
}

export interface RosterSignals {
  biggestDrop: {
    exercise: string;
    /** Session the change was measured on (the latest session of this exercise). */
    sessionId: string | null;
    /** Percent, negative. */
    change: number;
    /** Load of the most recent earlier session in the window and of the latest session, when known. */
    loadFrom: number | null;
    loadTo: number | null;
  } | null;
  slowestTempo: {
    exercise: string;
    sessionId: string | null;
    /** Percent, positive (slower). */
    change: number;
    firstSet: number;
    lastSet: number;
  } | null;
}

/** One entry per exercise the athlete trained. */
export function rosterSignals(exercises: ExerciseSignalInput[]): RosterSignals {
  let biggestDrop: RosterSignals["biggestDrop"] = null;
  let slowestTempo: RosterSignals["slowestTempo"] = null;
  for (const e of exercises) {
    // Pooled on purpose: a load-matched baseline cannot see a fall caused by a heavier load.
    const c = velocityVsBaseline(e.latest.sets, e.latest.date, e.history, { pooled: true });
    if (c.ok === true && c.change < 0 && (!biggestDrop || c.change < biggestDrop.change)) {
      const end = new Date(e.latest.date).getTime();
      const prior = e.history
        .filter((h) => {
          const t = new Date(h.date).getTime();
          return t < end && t >= end - BASELINE_DAYS * 86_400_000 && commonLoad(h.sets) != null;
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      const loadTo = commonLoad(e.latest.sets);
      const loadFrom = prior ? commonLoad(prior.sets) : null;
      biggestDrop = {
        exercise: e.exercise,
        sessionId: e.latest.sessionId ?? null,
        change: c.change,
        loadFrom,
        loadTo,
      };
    }
    const t = concentricSetToSetChange(e.latest.timing);
    if (t.ok === true && t.change > 0 && (!slowestTempo || t.change > slowestTempo.change)) {
      slowestTempo = { exercise: e.exercise, sessionId: e.latest.sessionId ?? null, change: t.change, firstSet: t.firstSet, lastSet: t.lastSet };
    }
  }
  return { biggestDrop, slowestTempo };
}
