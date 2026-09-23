/** Tuning for the leaderboard's top-3 row dither animation (see RankRowDither in LeaderboardPanel). */
export interface DitherSettings {
  /** Travel speed: ms per step as a lit block moves one cell left (lower = faster). */
  stepMs: number;
  /** Within a set: average ms between one light and the next lighting up (lower = tighter group). */
  spawnMs: number;
  /** Between sets: average ms from one set starting to the next, even while earlier sets still travel (lower = more sets on screen). */
  setGapMs: number;
  /** Randomness 0-1: 0 keeps every gap on a steady beat; 1 makes each gap anywhere from 0 to 2x its average. */
  randomness: number;
  /** Max lights per set (1-3); each set picks 1..this many at random. */
  maxConcurrent: number;
}

export const DEFAULT_DITHER: DitherSettings = { stepMs: 30, spawnMs: 50, setGapMs: 150, randomness: 1, maxConcurrent: 3 };

/** Multiplies 1st place's setGapMs for 2nd and 3rd, so the top row reads busiest and each rank below is visibly quieter. */
const RANK_GAP_MULTIPLIER: Record<number, number> = { 1: 0.3, 2: 1.8, 3: 3.5 };

export const ditherForRank = (rank: number, base: DitherSettings = DEFAULT_DITHER): DitherSettings => ({
  ...base,
  setGapMs: Math.round(base.setGapMs * (RANK_GAP_MULTIPLIER[rank] ?? 1)),
});

/** How far left each rank's bar reaches, as % of row width — 1st goes furthest, each rank below feathers out sooner. */
export const RANK_DITHER_WIDTH_PCT: Record<number, number> = { 1: 50, 2: 38, 3: 28 };
