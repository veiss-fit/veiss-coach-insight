import type { Meta, StoryObj } from '@storybook/react-vite';
import { PulseAthleteTable } from './AthleteTable';
import { RosterSignalsTable } from './RosterSignalsTable';
import { summarizeSession, type RepInput } from '@/lib/metrics/setVelocitySummary';
import { summarizeTimingSession } from '@/lib/metrics/repTiming';
import { rosterSignals, type ExerciseSignalInput, type RosterSignals } from '@/lib/metrics/rosterSignals';
import type { HistorySession } from '@/lib/metrics/velocityVsBaseline';
import type { PlayerWithStats } from '@/services/playersService';
import type { RosterAthleteMetrics } from '@/services/rosterMetricsService';

const meta: Meta = {
  title: 'Metrics/SP-12 Roster table',
  parameters: {
    docs: {
      description: {
        component:
          'SP-12 roster table. The Velocity column of the existing roster table is replaced by SP-12 and SP-13. The two advanced columns are not part of it. The Velocity column is replaced by two signals per athlete: biggest drop vs the athlete own baseline on any exercise (with the load change), and slowest tempo shift (largest concentric slowdown from first to last set of the latest session, on any exercise). Signals are plain text. SP-13: an athlete crossing any coach-set cut-off (top right, Flag settings; empty box = off; starting numbers uncalibrated) gets a light red row with the crossing cell darker, flagged rows are pinned first, and the coach picks the sort key. No composite score. The rest of the table is unchanged. Stories build each row from raw reps. See temp/METRIC_SPEC.md (SP-12).',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const TODAY = Date.parse('2026-09-20T10:00:00Z');
const daysAgo = (n: number): string => new Date(TODAY - n * 86_400_000).toISOString();

const athlete = (
  id: string,
  name: string,
  jersey: number | null,
  group: string,
  attendance: number,
  avgVelocity: number,
  avgROM: number,
  avgTempo: number,
  last: [string, number] | null,
): PlayerWithStats =>
  ({
    id,
    name,
    jersey_number: jersey,
    group,
    attendance,
    avgVelocity,
    avgROM,
    avgTempo,
    loadRec: 'maintain',
    lastWorkout: last ? { name: last[0], date: daysAgo(last[1]) } : null,
  }) as unknown as PlayerWithStats;

const ATHLETES: PlayerWithStats[] = [
  athlete('a1', 'Jordan Reyes', 12, 'Varsity', 92, 0.71, 520, 1.4, ['Lower body power', 1]),
  athlete('a2', 'Sam Okafor', 7, 'Varsity', 78, 0.64, 495, 1.6, ['Upper body strength', 3]),
  athlete('a3', 'Alex Kim', 23, 'JV', 100, 0.82, 540, 1.2, ['Lower body power', 1]),
  athlete('a4', 'Taylor Brooks', null, 'JV', 55, 0.58, 480, 1.9, ['Full body', 9]),
  athlete('a5', 'Morgan Ellis-Whitfield', 4, 'Freshman', 85, 0.69, 505, 1.5, ['Upper body strength', 4]),
  athlete('a6', 'Casey Nguyen', 31, 'Freshman', 0, 0, 0, 0, null),
];

const METRICS = new Map<string, RosterAthleteMetrics>(
  (
    [
      ['a1', 0.71, 0.04],
      ['a2', 0.64, -0.06],
      ['a3', 0.82, 0.0],
      ['a4', 0.58, -0.02],
      ['a5', 0.69, null],
    ] as [string, number, number | null][]
  ).map(([id, v, d]) => [
    id,
    {
      playerId: id,
      velSeries: [],
      sessSeries: [],
      sessionsThisWeek: 0,
      recentVel: v,
      velDelta: d,
      dropPct: null,
      lastSessionDate: null,
    },
  ]),
);

/** Same max width and side padding as the real page's <main> (Index.tsx), so the story is a close stand-in for the truth. */
const wrap = (children: React.ReactNode) => (
  <div style={{ maxWidth: 1480, margin: '0 auto', padding: '0 28px', width: '100%' }}>
    <div className="v-card flush v-scroll" style={{ overflow: 'auto' }}>
      {children}
    </div>
  </div>
);

/** One set: load, speeds, optional concentric seconds per rep. */
type SetSpec = [number | null, number[], number[]?];

const build = (exercise: string, daysBack: number, sets: SetSpec[]) => {
  const reps: RepInput[] = sets.flatMap(([weight, speeds, conc], si) =>
    speeds.map((v, i) => ({
      exercise_name: exercise,
      set_number: si + 1,
      rep_number: i + 1,
      average_rep_speed: v,
      weight,
      concentric_duration_s: conc ? conc[i] : null,
      eccentric_duration_s: conc ? 1.5 : null,
    })),
  );
  return {
    date: daysAgo(daysBack),
    sets: summarizeSession(reps)[0].sets,
    timing: summarizeTimingSession(reps)[0].sets,
  };
};

const history = (exercise: string, sessions: [number, SetSpec[]][]): HistorySession[] =>
  sessions.map(([d, sets]) => {
    const s = build(exercise, d, sets);
    return { date: s.date, sets: s.sets };
  });

const input = (exercise: string, latestDaysBack: number, latest: SetSpec[], hist: [number, SetSpec[]][]): ExerciseSignalInput => ({
  exercise,
  latest: build(exercise, latestDaysBack, latest),
  history: history(exercise, hist),
});

/** A set whose speed falls steadily from the first rep; the last rep is lossPct below it. */
const fade = (load: number | null, first: number, lossPct: number, reps = 5): SetSpec => {
  const speeds = Array.from({ length: reps }, (_, i) => +(first * (1 - (lossPct / 100) * (i / (reps - 1)))).toFixed(3));
  return [load, speeds];
};

const SIGNALS = new Map<string, RosterSignals>([
  // Loss creeping up across sessions, load went up, concentric slows a lot.
  [
    'a1',
    rosterSignals([
      input(
        'Back Squat',
        1,
        [
          [205, [0.7, 0.66, 0.6, 0.55, 0.5], [0.9, 0.95, 1.05, 1.15, 1.3]],
          [205, [0.66, 0.6, 0.55, 0.5, 0.45], [1.0, 1.1, 1.25, 1.4, 1.6]],
        ],
        [
          [5, [fade(185, 0.8, 8), fade(185, 0.79, 9)]],
          [9, [fade(185, 0.8, 10), fade(185, 0.78, 11)]],
          [13, [fade(185, 0.81, 13), fade(185, 0.8, 14)]],
          [17, [fade(185, 0.8, 16), fade(185, 0.78, 15)]],
          [21, [fade(185, 0.8, 18), fade(185, 0.79, 19)]],
        ],
      ),
      input(
        'Bench Press',
        3,
        [
          [135, [0.62, 0.6, 0.58, 0.56, 0.54], [0.9, 0.9, 0.95, 0.95, 1.0]],
          [135, [0.6, 0.58, 0.56, 0.54, 0.52], [0.95, 0.95, 1.0, 1.0, 1.05]],
        ],
        [[10, [fade(135, 0.62, 12), fade(135, 0.6, 12)]]],
      ),
    ]),
  ],
  // Loss falling, no load change, a small drop.
  [
    'a2',
    rosterSignals([
      input(
        'Bench Press',
        3,
        [fade(135, 0.62, 8), fade(135, 0.6, 8)],
        [
          [7, [fade(135, 0.66, 14), fade(135, 0.64, 15)]],
          [11, [fade(135, 0.67, 17), fade(135, 0.65, 16)]],
          [15, [fade(135, 0.68, 20), fade(135, 0.66, 21)]],
        ],
      ),
    ]),
  ],
  // Speed up on the latest session: no drop, no tempo slowdown.
  [
    'a3',
    rosterSignals([
      input(
        'Power Clean',
        1,
        [
          [null, [1.5, 1.48, 1.45], [0.5, 0.5, 0.5]],
          [null, [1.5, 1.47, 1.44], [0.5, 0.5, 0.5]],
        ],
        [
          [7, [[null, [1.38, 1.36, 1.34]]]],
          [14, [[null, [1.36, 1.34, 1.3]]]],
        ],
      ),
    ]),
  ],
  // First session: no baseline, one point of loss only.
  ['a4', rosterSignals([input('Back Squat', 9, [fade(155, 0.66, 10)], [])])],
  // Long exercise name, load unknown so no load line.
  [
    'a5',
    rosterSignals([
      input(
        'Single Arm Dumbbell Incline Press',
        4,
        [
          [null, [0.5, 0.48, 0.45, 0.42], [1.0, 1.1, 1.2, 1.3]],
          [null, [0.48, 0.45, 0.42, 0.4], [1.2, 1.3, 1.5, 1.7]],
        ],
        [
          [10, [[null, [0.56, 0.54, 0.52, 0.5]]]],
          [17, [[null, [0.57, 0.55, 0.53, 0.51]]]],
        ],
      ),
    ]),
  ],
  // a6 has no data: no entry.
]);

/** Velocity column replaced by biggest drop vs baseline and slowest tempo shift. */
export const Default: Story = {
  render: () => wrap(<RosterSignalsTable today={new Date(TODAY).toISOString()} athletes={ATHLETES} signalsByPlayer={SIGNALS} />),
};

export const Empty: Story = {
  render: () => wrap(<RosterSignalsTable athletes={[]} signalsByPlayer={new Map()} />),
};

/** The table as it is on the page today, for comparison. */
export const OriginalTable: Story = {
  render: () => wrap(<PulseAthleteTable athletes={ATHLETES} metricsByPlayer={METRICS} showAdvanced={false} />),
};
