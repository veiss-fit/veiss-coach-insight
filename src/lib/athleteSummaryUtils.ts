import { format, parseISO } from "date-fns";
import { SessionData, RepData } from "@/services/sessionsService";

// ─── Public types ───────────────────────────────────────────────────────────

export type RAGStatus = "green" | "amber" | "red" | "insufficient";

export interface IndicatorTooltip {
  what: string;
  how: string;
  highlights: string;
  minimum: string;
}

export interface DeviationIndicator {
  label: string;
  metric: string;
  value: number | null;
  baseline: number | null;
  stdDev: number | null;
  deltaPercent: number | null;
  ragStatus: RAGStatus;
  unit: string;
  formatFn: (v: number) => string;
  // Set when the metric is computable but interpretation is unreliable.
  warning?: string;
  // Inline documentation shown via ⓘ tooltip in the UI.
  tooltip?: IndicatorTooltip;
}

export interface SparklinePoint {
  date: string;
  value: number;
}

export interface SparklineData {
  points: SparklinePoint[];
  mean: number | null;
  insufficient: boolean;
}

export interface TrendLineData {
  points: SparklinePoint[];
  insufficient: boolean;
}

export interface RecentSessionRow {
  id: string;
  date: string;
  exerciseNames: string[];
  totalSets: number;
  totalReps: number;
  velocityDropoffPct: number | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────

// Need RECENT_SESSION_COUNT "current" + at least 3 historical for a non-degenerate SD.
const MIN_SESSIONS_FOR_BASELINE = 7;
const MIN_SESSIONS_FOR_SPARKLINE = 3;
const RECENT_SESSION_COUNT = 4;
export const SPARKLINE_SESSION_COUNT = 8;
export const MIN_SESSIONS_FOR_TREND = 5;

// Hardware labels that are not real exercise names.
const ARTIFACT_EXERCISE_NAMES = new Set([
  "Workout", "Exercise", "Movement", "Training", "Session",
]);

// ─── Helpers ────────────────────────────────────────────────────────────────

function arrayMean(vals: number[]): number {
  return vals.reduce((a, b) => a + b) / vals.length;
}

// Sample (Bessel-corrected) standard deviation — more accurate for small n.
function sampleStdDev(vals: number[], m: number): number {
  if (vals.length < 2) return 0;
  return Math.sqrt(
    vals.map((v) => (v - m) ** 2).reduce((a, b) => a + b) / (vals.length - 1),
  );
}

function isValidExerciseName(name: string | null | undefined): name is string {
  if (!name) return false;
  if ((name.match(/[a-zA-Z]/g) ?? []).length < 2) return false;
  if (ARTIFACT_EXERCISE_NAMES.has(name)) return false;
  return true;
}

function groupRepsBySet(reps: RepData[]): Map<number, RepData[]> {
  const bySet = new Map<number, RepData[]>();
  for (const rep of reps) {
    if (rep.velocity <= 0) continue;
    const bucket = bySet.get(rep.setNumber) ?? [];
    bucket.push(rep);
    bySet.set(rep.setNumber, bucket);
  }
  return bySet;
}

// ─── Per-session metric extractors ──────────────────────────────────────────

export function sessionAvgVelocity(s: SessionData): number | null {
  const vals = s.exercises
    .filter((e) => isValidExerciseName(e.name))
    .map((e) => e.avgVelocity)
    .filter((v) => v > 0);
  return vals.length > 0 ? arrayMean(vals) : null;
}

// ── Within-set fatigue ───────────────────────────────────────────────────────
// Per set: (rep 1 velocity − last rep velocity) / rep 1 velocity × 100.
// Averaged across all qualifying sets in the session.
// A set qualifies if it has ≥3 reps with valid velocity.
// The session qualifies if ≥2 sets pass that threshold.
export function sessionWithinSetDropoff(s: SessionData): number | null {
  const setDropoffs: number[] = [];

  for (const exercise of s.exercises) {
    if (!isValidExerciseName(exercise.name)) continue;

    const bySet = groupRepsBySet(exercise.repData);

    for (const reps of bySet.values()) {
      if (reps.length < 3) continue; // set must have ≥3 valid reps

      const sorted = [...reps].sort((a, b) => a.repNumber - b.repNumber);
      const rep1Vel  = sorted[0].velocity;
      const lastVel  = sorted[sorted.length - 1].velocity;
      if (rep1Vel === 0) continue;

      setDropoffs.push(((rep1Vel - lastVel) / rep1Vel) * 100);
    }
  }

  if (setDropoffs.length < 2) return null; // need ≥2 qualifying sets
  const result = arrayMean(setDropoffs);
  return Math.min(100, Math.max(-100, result));
}

// ── Across-set fatigue ───────────────────────────────────────────────────────
// Per exercise: (avgVel(set 1) − avgVel(last set)) / avgVel(set 1) × 100.
// Averaged across exercises. Requires ≥2 sets per exercise.
export function sessionVelocityDropoff(s: SessionData): number | null {
  const perExercise: number[] = [];

  for (const exercise of s.exercises) {
    if (!isValidExerciseName(exercise.name)) continue;

    const bySet = groupRepsBySet(exercise.repData);
    const setNums = Array.from(bySet.keys()).sort((a, b) => a - b);
    if (setNums.length < 2) continue;

    const firstSetAvg = arrayMean(bySet.get(setNums[0])!.map((r) => r.velocity));
    const lastSetAvg  = arrayMean(bySet.get(setNums[setNums.length - 1])!.map((r) => r.velocity));
    if (firstSetAvg === 0) continue;

    perExercise.push(((firstSetAvg - lastSetAvg) / firstSetAvg) * 100);
  }

  if (perExercise.length === 0) return null;
  const result = arrayMean(perExercise);
  return Math.min(100, Math.max(-100, result));
}

// ── First rep velocity ───────────────────────────────────────────────────────
// Set 1, rep 1 velocity averaged across all exercises in the session.
// Represents the athlete's "freshest" rep — uncontaminated by within-session fatigue.
export function sessionFirstRepVelocity(s: SessionData): number | null {
  const vals: number[] = [];
  for (const exercise of s.exercises) {
    if (!isValidExerciseName(exercise.name)) continue;
    const rep = exercise.repData.find((r) => r.setNumber === 1 && r.repNumber === 1);
    if (rep && rep.velocity > 0) vals.push(rep.velocity);
  }
  return vals.length > 0 ? arrayMean(vals) : null;
}

export function sessionAvgTempo(s: SessionData): number | null {
  const vals = s.exercises
    .filter((e) => isValidExerciseName(e.name))
    .map((e) => e.avgTempo)
    .filter((t) => t > 0);
  return vals.length > 0 ? arrayMean(vals) : null;
}

export function sessionVolume(s: SessionData): number | null {
  let total = 0;
  for (const exercise of s.exercises) {
    if (!isValidExerciseName(exercise.name)) continue;
    const weight = exercise.weight ?? 0;
    const bySet = new Map<number, RepData[]>();
    for (const rep of exercise.repData) {
      const setNum = rep.setNumber ?? 1;
      if (!bySet.has(setNum)) bySet.set(setNum, []);
      bySet.get(setNum)!.push(rep);
    }
    for (const reps of bySet.values()) {
      if (weight > 0) {
        total += reps.length * weight; // sets × reps × weight per set
      } else {
        total += reps.length;          // bodyweight: count reps only
      }
    }
  }
  return total > 0 ? total : null;
}

// ─── Indicator builder ──────────────────────────────────────────────────────

function buildIndicator(
  label: string,
  metric: string,
  extractFn: (s: SessionData) => number | null,
  sorted: SessionData[], // oldest → newest
  unit: string,
  formatFn: (v: number) => string,
  opts: { warning?: string; tooltip?: IndicatorTooltip } = {},
): DeviationIndicator {
  const allValues = sorted.map(extractFn).filter((v): v is number => v !== null);

  if (allValues.length < MIN_SESSIONS_FOR_BASELINE) {
    return {
      label, metric,
      value: null, baseline: null, stdDev: null, deltaPercent: null,
      ragStatus: "insufficient",
      unit, formatFn, ...opts,
    };
  }

  // Historical baseline = all except the most recent RECENT_SESSION_COUNT sessions.
  // Keeping recent sessions OUT of the baseline prevents the baseline from chasing
  // the very anomaly we're trying to detect, which suppresses the z-score.
  const historicalValues = allValues.slice(0, -RECENT_SESSION_COUNT);
  const recentValues     = allValues.slice(-RECENT_SESSION_COUNT);

  const baselineMean = arrayMean(historicalValues);
  const baselineSd   = sampleStdDev(historicalValues, baselineMean);
  const recentMean   = arrayMean(recentValues);

  // Percentage change is undefined when the baseline is zero or when recent and
  // historical means have opposite signs (sign flip makes the formula explode and
  // flip polarity — e.g. baseline −7 % → recent +11 % = −258 %).
  // RAG uses z-score directly and is independent of deltaPercent.
  const deltaPercent = (baselineMean !== 0 && Math.sign(recentMean) === Math.sign(baselineMean))
    ? ((recentMean - baselineMean) / baselineMean) * 100
    : null;

  let ragStatus: Exclude<RAGStatus, "insufficient"> = "green";
  if (baselineSd > 0) {
    const z = Math.abs(recentMean - baselineMean) / baselineSd;
    ragStatus = z > 2 ? "red" : z > 1 ? "amber" : "green";
  }

  return {
    label, metric,
    value: recentMean, baseline: baselineMean, stdDev: baselineSd, deltaPercent,
    ragStatus, unit, formatFn, ...opts,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function computeAnomalyIndicators(sessions: SessionData[]): DeviationIndicator[] {
  const sorted = [...sessions].sort(
    (a, b) =>
      new Date(a.startedAt ?? a.createdAt).getTime() -
      new Date(b.startedAt ?? b.createdAt).getTime(),
  );

  return [
    buildIndicator(
      "Avg Velocity", "velocity", sessionAvgVelocity, sorted,
      "m/s", (v) => `${v.toFixed(2)} m/s`,
      {
        warning: "Cross-exercise avg — reliable only if exercise selection is consistent across sessions",
      },
    ),
    buildIndicator(
      "Within-Set Fatigue", "withinSetDropoff", sessionWithinSetDropoff, sorted,
      "%", (v) => `${v.toFixed(1)}%`,
      {
        tooltip: {
          what: "How much velocity drops from the first to last rep within a single set.",
          how: "Rep 1 velocity minus last rep velocity, divided by rep 1 velocity. Averaged across all qualifying sets in recent sessions.",
          highlights: "Acute neuromuscular fatigue within a set — a rising trend suggests the athlete may benefit from shorter sets or more rest between reps.",
          minimum: "≥3 reps per set, ≥2 qualifying sets per session.",
        },
      },
    ),
    buildIndicator(
      "Session Fatigue", "sessionFatigue", sessionVelocityDropoff, sorted,
      "%", (v) => `${v.toFixed(1)}%`,
      {
        tooltip: {
          what: "How much velocity drops from the first to last set within a session.",
          how: "Average velocity of set 1 minus average velocity of the last set, divided by set 1 average. Computed per exercise then averaged across exercises.",
          highlights: "Cumulative session fatigue — a rising trend suggests the athlete is accumulating more fatigue across sets than usual.",
          minimum: "≥2 sets per session.",
        },
      },
    ),
    buildIndicator(
      "Concentric Tempo", "tempo", sessionAvgTempo, sorted,
      "s", (v) => `${v.toFixed(2)}s`,
    ),
    (() => {
      const hasWeight = sessions.some((s) =>
        s.exercises.some((e) => isValidExerciseName(e.name) && (e.weight ?? 0) > 0),
      );
      const unit = hasWeight ? "lbs" : "reps";
      return buildIndicator(
        "Volume", "volume", sessionVolume, sorted,
        unit, (v) => `${Math.round(v)} ${unit}`,
      );
    })(),
  ];
}

export function computeSparkline(
  sessions: SessionData[],
  extractFn: (s: SessionData) => number | null,
  windowSize = SPARKLINE_SESSION_COUNT,
): SparklineData {
  const sorted = [...sessions]
    .sort(
      (a, b) =>
        new Date(a.startedAt ?? a.createdAt).getTime() -
        new Date(b.startedAt ?? b.createdAt).getTime(),
    )
    .slice(-windowSize);

  const points: SparklinePoint[] = sorted
    .map((s) => {
      const v = extractFn(s);
      if (v === null) return null;
      return { date: format(parseISO(s.date), "MMM d"), value: v };
    })
    .filter((p): p is SparklinePoint => p !== null);

  if (points.length < MIN_SESSIONS_FOR_SPARKLINE) {
    return { points, mean: null, insufficient: true };
  }

  return { points, mean: arrayMean(points.map((p) => p.value)), insufficient: false };
}

// First-rep trend uses ALL sessions (not a fixed window) and has no mean reference —
// it's a raw fitness signal tracked chronologically.
export function computeFirstRepTrend(sessions: SessionData[]): TrendLineData {
  const sorted = [...sessions].sort(
    (a, b) =>
      new Date(a.startedAt ?? a.createdAt).getTime() -
      new Date(b.startedAt ?? b.createdAt).getTime(),
  );

  const points: SparklinePoint[] = sorted
    .map((s) => {
      const v = sessionFirstRepVelocity(s);
      if (v === null) return null;
      return { date: format(parseISO(s.date), "MMM d"), value: v };
    })
    .filter((p): p is SparklinePoint => p !== null);

  return { points, insufficient: points.length < MIN_SESSIONS_FOR_TREND };
}

export function computeRecentSessions(sessions: SessionData[], count = 5): RecentSessionRow[] {
  return [...sessions]
    .sort(
      (a, b) =>
        new Date(b.startedAt ?? b.createdAt).getTime() -
        new Date(a.startedAt ?? a.createdAt).getTime(),
    )
    .slice(0, count)
    .map((s) => ({
      id: s.id,
      date: s.date,
      exerciseNames: s.exercises.map((e) => e.name).filter(isValidExerciseName),
      totalSets: s.exercises
        .filter((e) => isValidExerciseName(e.name))
        .reduce((sum, e) => sum + e.sets, 0),
      totalReps: s.exercises
        .filter((e) => isValidExerciseName(e.name))
        .reduce((sum, e) => sum + e.repData.length, 0),
      velocityDropoffPct: sessionVelocityDropoff(s),
    }));
}

export function computeDistinctExercises(sessions: SessionData[]): string[] {
  const seen = new Set<string>();
  sessions.forEach((s) =>
    s.exercises.forEach((e) => {
      if (isValidExerciseName(e.name)) seen.add(e.name);
    }),
  );
  return Array.from(seen).sort();
}
