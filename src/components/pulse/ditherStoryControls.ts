import type { ArgTypes } from '@storybook/react-vite';
import { DEFAULT_DITHER, type DitherSettings } from './rankDither';

/** Storybook Controls for the leaderboard's top-3 row dither, shared by every story that renders LeaderboardPanel. */
export const DITHER_ARG_TYPES: ArgTypes<DitherSettings> = {
  stepMs: {
    name: 'Speed (ms per step)',
    control: { type: 'range', min: 30, max: 400, step: 10 },
    description: 'How fast a lit block travels left: ms per cell. Lower = faster.',
  },
  spawnMs: {
    name: 'Within set (ms between lights)',
    control: { type: 'range', min: 50, max: 2000, step: 50 },
    description: 'Average ms between lights of the same set lighting up. Lower = tighter group.',
  },
  setGapMs: {
    name: 'Between sets (ms)',
    control: { type: 'range', min: 200, max: 6000, step: 100 },
    description: 'Average ms from one set starting to the next, even while earlier sets are still traveling. Lower = more sets on screen.',
  },
  randomness: {
    name: 'Randomness',
    control: { type: 'range', min: 0, max: 1, step: 0.05 },
    description: '0 = steady beat; 1 = each gap anywhere from 0 to 2x the light-up rate. Row choice is always random.',
  },
  maxConcurrent: {
    name: 'Max lights per set',
    control: { type: 'range', min: 1, max: 3, step: 1 },
    description: 'Each set lights 1 to this many blocks, picked at random.',
  },
};

export const DITHER_ARGS: DitherSettings = DEFAULT_DITHER;
