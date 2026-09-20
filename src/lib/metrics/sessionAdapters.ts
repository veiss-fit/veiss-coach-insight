import type { SessionData } from "@/services/sessionsService";
import { isValidExerciseName } from "@/lib/athleteSummaryUtils";
import { canonicalizeExerciseName } from "@/lib/targetEvaluation";
import { summarizeSession, isValidVelocity, type ExerciseSets, type RepInput } from "./setVelocitySummary";
import type { HistorySession } from "./velocityVsBaseline";
import { summarizeRomSession, type ExerciseRom } from "./rangeOfMotion";
import { summarizeTimingSession, type ExerciseTiming } from "./repTiming";
import type { SessionInput } from "./trainingExposure";

/** Athlete-page sessions to the metric library's inputs. */

const when = (s: SessionData) => s.startedAt ?? s.createdAt;

/** The session's reps in the metric library's shape, under canonical exercise names. Weight 0 or missing is null (no load recorded). */
function repInputs(s: SessionData): RepInput[] {
  const reps: RepInput[] = [];
  for (const ex of s.exercises) {
    if (!isValidExerciseName(ex.name)) continue;
    const name = canonicalizeExerciseName(ex.name);
    for (const r of ex.repData) {
      reps.push({
        exercise_name: name,
        set_number: r.setNumber,
        rep_number: r.repNumber,
        average_rep_speed: r.velocity,
        weight: r.weight > 0 ? r.weight : null,
        rom_mm: r.rom,
        concentric_duration_s: r.tempo,
        eccentric_duration_s: r.eccentric,
      });
    }
  }
  return reps;
}

/** One entry per exercise done in the session, with its sets summarised. */
export function sessionSets(s: SessionData): ExerciseSets[] {
  return summarizeSession(repInputs(s));
}

/** SP-06: vertical displacement per exercise of the session. */
export function sessionRom(s: SessionData): ExerciseRom[] {
  return summarizeRomSession(repInputs(s));
}

/** SP-07: mean concentric and eccentric time per exercise of the session. */
export function sessionTiming(s: SessionData): ExerciseTiming[] {
  return summarizeTimingSession(repInputs(s));
}

/** The moment a session is dated by: the same value `historyByExercise` uses, so a session never counts as its own baseline. */
export const sessionMoment = when;

/**
 * Sessions per canonical exercise name, most-trained exercise first (so a card that
 * opens on the first key opens on the exercise with the most history).
 */
export function historyByExercise(sessions: SessionData[]): Record<string, HistorySession[]> {
  const out = new Map<string, HistorySession[]>();
  for (const s of sessions) {
    for (const e of sessionSets(s)) {
      const list = out.get(e.exercise) ?? [];
      list.push({ date: when(s), sets: e.sets });
      out.set(e.exercise, list);
    }
  }
  return Object.fromEntries([...out.entries()].sort((a, b) => b[1].length - a[1].length));
}

/** One entry per session with its count of valid reps (velocity above 0). */
export function exposureInputs(sessions: SessionData[]): SessionInput[] {
  return sessions.map((s) => ({
    date: when(s),
    validReps: s.exercises.reduce((n, ex) => n + ex.repData.filter((r) => isValidVelocity(r.velocity)).length, 0),
  }));
}
