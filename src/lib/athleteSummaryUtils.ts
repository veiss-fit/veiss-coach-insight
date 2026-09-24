import { subDays } from "date-fns";
import { SessionData } from "@/services/sessionsService";

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

// ─── Constants ──────────────────────────────────────────────────────────────

// Hardware labels that are not real exercise names.
const ARTIFACT_EXERCISE_NAMES = new Set([
  "Workout", "Exercise", "Movement", "Training", "Session",
]);

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Primary lift selection ─────────────────────────────────────────────────

export interface PrimaryExercise {
  name: string;
  repCount: number;
  lastSessionAt: number; // epoch ms, for the tie-break
}

/**
 * The exercise this athlete trained the most (by rep count) in the last N
 * days; ties broken by whichever was trained most recently. Shared by the
 * athlete page's Primary Lift Trend KPI tile.
 */
export function findPrimaryExercise(sessions: SessionData[], windowDays = 30): PrimaryExercise | null {
  const cutoff = subDays(new Date(), windowDays);
  const byName = new Map<string, PrimaryExercise>();
  for (const s of sessions) {
    const t = new Date(s.startedAt ?? s.createdAt);
    if (t < cutoff) continue;
    for (const ex of s.exercises) {
      if (!isValidExerciseName(ex.name)) continue;
      const reps = ex.repData.filter((r) => r.velocity > 0).length;
      if (reps === 0) continue;
      const existing = byName.get(ex.name);
      if (existing) {
        existing.repCount += reps;
        if (t.getTime() > existing.lastSessionAt) existing.lastSessionAt = t.getTime();
      } else {
        byName.set(ex.name, { name: ex.name, repCount: reps, lastSessionAt: t.getTime() });
      }
    }
  }
  const candidates = [...byName.values()];
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.repCount - a.repCount || b.lastSessionAt - a.lastSessionAt);
  return candidates[0];
}
