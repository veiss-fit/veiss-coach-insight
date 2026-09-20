import { isValidVelocity, type RepInput } from "./setVelocitySummary";

/**
 * SP-06 Range of motion (temp/METRIC_SPEC.md), per exercise.
 *
 * A rep counts when its velocity is valid (SP-01 rule) and rom_mm > 0. A null
 * or zero rom_mm is excluded, never counted as zero. Stored in mm, shown in cm.
 * No judgement attached.
 */

export interface RomPoint {
  rep_number: number;
  /** Millimetres. */
  mm: number;
}

export interface SetRom {
  set_number: number;
  /** Counted reps only, ordered by rep_number. */
  points: RomPoint[];
  /** Mean ROM of the counted reps, mm. null when none. */
  meanMm: number | null;
  /** Rep-to-rep coefficient of variation, percent (sample SD / mean). null when fewer than 2 counted reps. */
  cvPct: number | null;
}

export interface ExerciseRom {
  exercise: string;
  sets: SetRom[];
}

export function summarizeRomSet(setNumber: number, reps: RepInput[]): SetRom {
  const points = [...reps]
    .sort((a, b) => a.rep_number - b.rep_number)
    .filter((r) => isValidVelocity(r.average_rep_speed) && typeof r.rom_mm === "number" && r.rom_mm > 0)
    .map((r) => ({ rep_number: r.rep_number, mm: r.rom_mm as number }));
  const n = points.length;
  const meanMm = n ? points.reduce((a, p) => a + p.mm, 0) / n : null;
  let cvPct: number | null = null;
  if (n >= 2 && meanMm != null) {
    const variance = points.reduce((a, p) => a + (p.mm - meanMm) ** 2, 0) / (n - 1);
    cvPct = (Math.sqrt(variance) / meanMm) * 100;
  }
  return { set_number: setNumber, points, meanMm, cvPct };
}

/** Groups one session's reps by exercise, then by set, in first-seen order. */
export function summarizeRomSession(reps: RepInput[]): ExerciseRom[] {
  const byExercise = new Map<string, Map<number, RepInput[]>>();
  for (const r of reps) {
    const key = r.exercise_name.trim();
    const sets = byExercise.get(key) ?? new Map<number, RepInput[]>();
    const list = sets.get(r.set_number) ?? [];
    list.push(r);
    sets.set(r.set_number, list);
    byExercise.set(key, sets);
  }
  return [...byExercise.entries()].map(([exercise, sets]) => ({
    exercise,
    sets: [...sets.entries()].sort(([a], [b]) => a - b).map(([n, rs]) => summarizeRomSet(n, rs)),
  }));
}

export type RomChange =
  | {
      ok: true;
      /** Percent, signed, unrounded. */
      change: number;
      firstSet: number;
      lastSet: number;
    }
  | { ok: false; reason: string };

/** Change in mean ROM from the first to the last set that has a counted rep. Load is not considered. */
export function romSetToSetChange(sets: SetRom[]): RomChange {
  const usable = sets.filter((s) => s.meanMm != null);
  if (usable.length < 2) return { ok: false, reason: "fewer than 2 sets with ROM" };
  const first = usable[0];
  const last = usable[usable.length - 1];
  return {
    ok: true,
    change: (((last.meanMm as number) - (first.meanMm as number)) / (first.meanMm as number)) * 100,
    firstSet: first.set_number,
    lastSet: last.set_number,
  };
}

/** Median of the per-set CVs (sets with at least 2 counted reps). null when no set qualifies. */
export function romConsistency(sets: SetRom[]): { medianCv: number; sets: number } | null {
  const cvs = sets.flatMap((s) => (s.cvPct == null ? [] : [s.cvPct])).sort((a, b) => a - b);
  if (cvs.length === 0) return null;
  const mid = Math.floor(cvs.length / 2);
  return { medianCv: cvs.length % 2 ? cvs[mid] : (cvs[mid - 1] + cvs[mid]) / 2, sets: cvs.length };
}
