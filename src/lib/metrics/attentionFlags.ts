/**
 * SP-13 Attention list (temp/METRIC_SPEC.md).
 *
 * Four separate facts per athlete, each compared with a coach-set cut-off.
 * There is no composite score: a row is flagged when at least one fact crosses
 * its own cut-off, and the coach chooses the sort key. A cut-off of null turns
 * that signal off.
 *
 * The default cut-offs are uncalibrated. Only "7 days" is carried over from
 * the existing code; the spec found no source for any cut-off.
 */

export interface AttentionThresholds {
  /** Flag when days since the last session is above this. */
  days: number | null;
  /** Flag when the drop against own baseline is at least this many percent (positive number). */
  drop: number | null;
  /** Flag when the concentric slowdown is at least this many percent. */
  tempo: number | null;
  /** Flag when attendance is below this percent. */
  attendance: number | null;
}

export const DEFAULT_THRESHOLDS: AttentionThresholds = { days: 7, drop: 10, tempo: 20, attendance: 70 };

export type AttentionSignal = keyof AttentionThresholds;

/** One athlete's facts. A missing fact is null and never flags. All percentages are positive magnitudes. */
export interface AttentionFacts {
  daysSince: number | null;
  drop: number | null;
  tempo: number | null;
  /** Attendance percent as shown in the table (0 to 100). */
  attendance: number | null;
}

export interface AttentionResult {
  days: boolean;
  drop: boolean;
  tempo: boolean;
  attendance: boolean;
  flagged: boolean;
}

export function attentionFlags(f: AttentionFacts, t: AttentionThresholds): AttentionResult {
  const days = t.days != null && f.daysSince != null && f.daysSince > t.days;
  const drop = t.drop != null && f.drop != null && f.drop >= t.drop;
  const tempo = t.tempo != null && f.tempo != null && f.tempo >= t.tempo;
  const attendance = t.attendance != null && f.attendance != null && f.attendance < t.attendance;
  return { days, drop, tempo, attendance, flagged: days || drop || tempo || attendance };
}

export type ThresholdDraft = Record<AttentionSignal, string>;
export const INITIAL_DRAFT = Object.fromEntries(
  (Object.keys(DEFAULT_THRESHOLDS) as AttentionSignal[]).map((k) => [k, String(DEFAULT_THRESHOLDS[k])])
) as ThresholdDraft;

const toThreshold = (v: string): number | null => {
  const n = parseFloat(v);
  return v.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
};

/** Cut-off text boxes to numbers (an empty or invalid box turns that signal off). */
export const thresholdsFromDraft = (draft: ThresholdDraft): AttentionThresholds =>
  Object.fromEntries(
    (Object.keys(DEFAULT_THRESHOLDS) as AttentionSignal[]).map((k) => [k, toThreshold(draft[k])])
  ) as unknown as AttentionThresholds;

export type SortKey = "default" | "days" | "drop" | "tempo" | "attendance";

const FACT_OF: Record<Exclude<SortKey, "default">, keyof AttentionFacts> = {
  days: "daysSince",
  drop: "drop",
  tempo: "tempo",
  attendance: "attendance",
};

/**
 * Orders rows. With `pinFlagged`, flagged rows come first. Inside each group
 * the coach's sort key applies (largest first, lowest first for attendance, missing last); "default" keeps
 * the incoming order. Stable.
 */
export function orderByAttention<T>(
  rows: T[],
  factsOf: (row: T) => AttentionFacts,
  flaggedOf: (row: T) => boolean,
  sort: SortKey,
  pinFlagged: boolean,
): T[] {
  const indexed = rows.map((row, i) => ({ row, i }));
  const value = (row: T): number => {
    if (sort === "default") return 0;
    const v = factsOf(row)[FACT_OF[sort]];
    if (v == null) return Number.NEGATIVE_INFINITY;
    // Attendance is worse when low, so the lowest sorts first.
    return sort === "attendance" ? -v : v;
  };
  indexed.sort((a, b) => {
    if (pinFlagged) {
      const fa = flaggedOf(a.row) ? 1 : 0;
      const fb = flaggedOf(b.row) ? 1 : 0;
      if (fa !== fb) return fb - fa;
    }
    const d = value(b.row) - value(a.row);
    // -Infinity - -Infinity is NaN: treat as equal.
    return Number.isNaN(d) || d === 0 ? a.i - b.i : d;
  });
  return indexed.map((x) => x.row);
}
