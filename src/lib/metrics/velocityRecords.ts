import type { SetVelocitySummary } from "./setVelocitySummary";
import type { HistorySession } from "./velocityVsBaseline";

/**
 * SP-05 Velocity personal record (temp/METRIC_SPEC.md), per exercise:
 * the fastest rep at the heaviest load ever lifted.
 *
 * A set counts when it has at least one valid rep and a verified set load.
 * The record load is the heaviest such load; the record speed is the highest
 * v_best among all sets at that load. Ties keep the earliest session. The
 * latest session is included; `isNew` is true when it holds the record and an
 * earlier set exists to compare with. Blocked on the `weight` unit and
 * coverage (about 22% of reps carry one). No judgement attached.
 */

export type LoadRecord =
  | {
      ok: true;
      /** Heaviest verified set load, unit not verified. */
      load: number;
      /** Fastest valid rep at that load, m/s, unrounded. */
      best: number;
      /** ISO date of the session that holds the record. */
      date: string;
      set: number;
      /** TODO(cleanup): unused by any component. */
      isNew: boolean;
    }
  | { ok: false; reason: string };

export function fastestAtHeaviestLoad(
  latestSets: SetVelocitySummary[],
  latestDate: string,
  history: HistorySession[],
): LoadRecord {
  const candidates = [{ date: latestDate, sets: latestSets, latest: true }, ...history.map((h) => ({ ...h, latest: false }))]
    .flatMap((session) =>
      session.sets
        .filter((s) => s.vBest != null && s.load != null)
        .map((s) => ({ date: session.date, set: s.set_number, load: s.load as number, v: s.vBest as number, latest: session.latest })),
    )
    // Earliest first, so a tie keeps the session that reached it first.
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (candidates.length === 0) return { ok: false, reason: "No load recorded" };

  const maxLoad = Math.max(...candidates.map((c) => c.load));
  const top = candidates.filter((c) => c.load === maxLoad).reduce((a, b) => (b.v > a.v ? b : a));
  return {
    ok: true,
    load: maxLoad,
    best: top.v,
    date: top.date,
    set: top.set,
    isNew: top.latest && candidates.some((c) => !c.latest),
  };
}
