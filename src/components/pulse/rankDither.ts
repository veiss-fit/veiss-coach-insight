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

export const DEFAULT_DITHER: DitherSettings = { stepMs: 30, spawnMs: 50, setGapMs: 600, randomness: 1, maxConcurrent: 3 };
