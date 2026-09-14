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
  latestValue: number | null;
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
  sessionId: string;
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

// Exported so rosterMetricsService can apply the same artifact-name filter when
// it reimplements this module's per-exercise partitioning over raw DB rows
// (roster-wide queries can't reuse the functions below directly — they operate
// on already-shaped SessionData, not raw rep rows).
export function isValidExerciseName(name: string | null | undefined): name is string {
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

export function sessionRomConsistency(s: SessionData): number | null {
  const vals = s.exercises
    .filter((e) => isValidExerciseName(e.name))
    .flatMap((e) => e.repData.map((r) => r.rom))
    .filter((v) => v > 0);
  if (vals.length < 2) return null;
  const mean = arrayMean(vals);
  if (mean === 0) return null;
  return (sampleStdDev(vals, mean) / mean) * 100;
}

export function sessionEccentricConcentricRatio(s: SessionData): number | null {
  const ratios: number[] = [];
  for (const exercise of s.exercises) {
    if (!isValidExerciseName(exercise.name)) continue;
    for (const rep of exercise.repData) {
      if (rep.eccentric > 0 && rep.tempo > 0) {
        ratios.push(rep.eccentric / rep.tempo);
      }
    }
  }
  return ratios.length > 0 ? arrayMean(ratios) : null;
}

export function sessionTUT(s: SessionData): number | null {
  let total = 0;
  let count = 0;
  for (const exercise of s.exercises) {
    if (!isValidExerciseName(exercise.name)) continue;
    for (const rep of exercise.repData) {
      if (rep.tempo > 0 || rep.eccentric > 0) {
        total += rep.tempo + rep.eccentric;
        count++;
      }
    }
  }
  return count > 0 ? total : null;
}

export function sessionVolume(s: SessionData): number | null {
  let total = 0;
  for (const exercise of s.exercises) {
    if (!isValidExerciseName(exercise.name)) continue;
    // Each rep carries its own logged weight (loads can vary set to set), so
    // this sums true per-rep load rather than assuming one flat weight for
    // the whole exercise.
    for (const rep of exercise.repData) {
      total += rep.weight > 0 ? rep.weight : 1; // bodyweight rep: count it, not zero it out
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
      latestValue: null,
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
    latestValue: allValues[allValues.length - 1] ?? null,
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
        tooltip: {
          what: "Average concentric velocity across every valid rep in the session.",
          how: "Mean of average_rep_speed for all reps with a valid exercise name and velocity > 0.",
          highlights: "A rising trend at the same prescribed load usually means the athlete is getting stronger/fresher. A falling trend can flag fatigue, poor recovery, or a load that's become too heavy for the velocity target.",
          minimum: "≥1 rep with recorded velocity.",
        },
      },
    ),
    buildIndicator(
      "ROM Consistency", "romConsistency", sessionRomConsistency, sorted,
      "%", (v) => `${v.toFixed(1)}%`,
      {
        tooltip: {
          what: "Coefficient of variation of range of motion across all reps in the session.",
          how: "Sample standard deviation divided by mean ROM, expressed as a percentage.",
          highlights: "Low CV means consistent movement depth. A rising trend means technique is breaking down — often before velocity is affected.",
          minimum: "≥2 reps with ROM data.",
        },
      },
    ),
    buildIndicator(
      "E:C Ratio", "eccentricConcentric", sessionEccentricConcentricRatio, sorted,
      "x", (v) => `${v.toFixed(1)}x`,
      {
        tooltip: {
          what: "Average ratio of eccentric to concentric duration per rep.",
          how: "eccentric_duration ÷ concentric_duration averaged across all reps with both values recorded.",
          highlights: "A 3:1 prescription should read ~3.0. A ratio drifting toward 1.0 means the athlete is rushing the eccentric — a fatigue and injury risk flag.",
          minimum: "≥1 rep with both eccentric and concentric duration recorded.",
        },
      },
    ),
    buildIndicator(
      "Time Under Tension", "tut", sessionTUT, sorted,
      "s", (v) => `${Math.round(v)}s`,
      {
        tooltip: {
          what: "Total time under load per session: sum of concentric + eccentric duration across all reps.",
          how: "Σ (concentric_duration + eccentric_duration) for every rep in the session.",
          highlights: "Tracks total mechanical stimulus. A declining TUT trend can indicate shorter sessions, reduced effort, or faster (potentially sloppy) reps.",
          minimum: "≥1 rep with tempo data.",
        },
      },
    ),
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
      return { date: format(parseISO(s.date), "MMM d"), value: v, sessionId: s.id };
    })
    .filter((p): p is SparklinePoint => p !== null);

  if (points.length < MIN_SESSIONS_FOR_SPARKLINE) {
    return { points, mean: null, insufficient: true };
  }

  return { points, mean: arrayMean(points.map((p) => p.value)), insufficient: false };
}

export const HIGHER_IS_BETTER: Record<string, boolean> = {
  velocity: true,
  romConsistency: false,
  eccentricConcentric: true,
  tut: true,
};

export function computeTrendLabel(
  points: SparklinePoint[],
  higherIsBetter: boolean,
): { label: string; direction: 'improving' | 'declining' | 'stable'; consecutiveCount: number } {
  if (points.length < 3) return { label: 'Not enough data', direction: 'stable', consecutiveCount: 0 };
  const last3 = points.slice(-3);
  const deltas = [last3[1].value - last3[0].value, last3[2].value - last3[1].value];
  const threshold = 0.005;
  const directions = deltas.map(d => Math.abs(d) < threshold ? 'stable' : d > 0 ? 'up' : 'down');
  let consecutive = 1;
  for (let i = points.length - 2; i >= 0; i--) {
    const d = points[i + 1].value - points[i].value;
    const dir = Math.abs(d) < threshold ? 'stable' : d > 0 ? 'up' : 'down';
    if (dir === directions[1]) consecutive++;
    else break;
  }
  const lastDir = directions[1];
  const improving = higherIsBetter ? lastDir === 'up' : lastDir === 'down';
  if (lastDir === 'stable') return { label: 'Stable', direction: 'stable', consecutiveCount: consecutive };
  if (improving) return { label: `Improving ${consecutive} session${consecutive > 1 ? 's' : ''}`, direction: 'improving', consecutiveCount: consecutive };
  return { label: `Declining ${consecutive} session${consecutive > 1 ? 's' : ''}`, direction: 'declining', consecutiveCount: consecutive };
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
      // True distinct set count (not the old Math.max(set_number) estimate).
      totalSets: s.exercises
        .filter((e) => isValidExerciseName(e.name))
        .reduce((sum, e) => sum + new Set(e.repData.map((r) => r.setNumber)).size, 0),
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
