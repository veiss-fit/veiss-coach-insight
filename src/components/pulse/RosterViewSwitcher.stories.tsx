import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { RosterViewSwitcher, type RosterView } from './RosterViewSwitcher';
import { INITIAL_DRAFT } from '@/lib/metrics/attentionFlags';
import type { LeaderboardMetric, LeaderboardRow } from './LeaderboardPanel';
import type { DitherSettings } from './rankDither';
import { DITHER_ARGS, DITHER_ARG_TYPES } from './ditherStoryControls';
import type { TrainingGridRow } from './TrainingGridPanel';
import type { TeamPrRow } from './TeamPrsPanel';
import type { PlayerWithStats } from '@/services/playersService';
import type { RosterSignals } from '@/lib/metrics/rosterSignals';

const meta: Meta = {
  title: 'Home dashboard/RosterViewSwitcher',
  parameters: {
    docs: {
      description: {
        component:
          'Tab bar above the roster section: Roster / Leaderboard / Training grid, switched with the blob selector. Replaces the plain roster table as the section content. See temp/HOME_DASHBOARD_PLAN.md.',
      },
    },
  },
  decorators: [(Story) => <div style={{ maxWidth: 1480, padding: '0 28px' }}><Story /></div>],
};
export default meta;
type Story = StoryObj;

const TODAY = Date.parse('2026-09-20T10:00:00Z');
const daysAgo = (n: number): string => new Date(TODAY - n * 86_400_000).toISOString();

const athlete = (id: string, name: string, group: string, attendance: number, last: number | null): PlayerWithStats =>
  ({
    id,
    name,
    jersey_number: null,
    group,
    attendance,
    avgVelocity: 0,
    avgROM: 0,
    avgTempo: 0,
    loadRec: 'maintain',
    lastWorkout: last != null ? { name: 'Session', date: daysAgo(last) } : null,
  }) as unknown as PlayerWithStats;

const ATHLETES: PlayerWithStats[] = [
  athlete('a1', 'Jordan Ade', 'Varsity', 92, 1),
  athlete('a2', 'Maya Chen', 'Varsity', 78, 3),
  athlete('a3', 'Sam Ortiz', 'JV', 55, 9),
  athlete('a4', 'Priya Nair', 'JV', 88, 2),
];

const SIGNALS = new Map<string, RosterSignals>();

const EXERCISES = ['Back Squat', 'Bench Press', 'Deadlift', 'RDL'];
/** Jordan Ade tops 2 exercises, Maya Chen tops 1, nobody else tops any. */
const FIRST_PLACE_COUNTS: Record<string, number> = { a1: 2, a2: 1 };
const LEADERBOARD_ROWS: LeaderboardRow[] = ATHLETES.map((a, i) => ({
  playerId: a.id,
  name: a.name,
  value: 1.05 - i * 0.06,
  firstPlaceCount: FIRST_PLACE_COUNTS[a.id],
}));
const DAY_LABELS = ['Wed 17', 'Thu 18', 'Fri 19', 'Sat 20', 'Sun 21', 'Mon 22', 'Tue 23'];
const GRID_ROWS: TrainingGridRow[] = ATHLETES.map((a, i) => ({
  playerId: a.id,
  name: a.name,
  countsByDay: Array.from({ length: 7 }, (_, d) => (i + d) % 3),
}));
const TEAM_PR_ROWS: TeamPrRow[] = ATHLETES.map((a, i) => ({
  playerId: a.id,
  name: a.name,
  exercise: EXERCISES[i % EXERCISES.length],
  load: 185 - i * 15,
  best: 0.62 - i * 0.04,
  date: daysAgo(i * 2 + 1),
}));

function Controlled({ dither }: { dither: DitherSettings }) {
  const [view, setView] = useState<RosterView>('roster');
  const [metric, setMetric] = useState<LeaderboardMetric>('velocity');
  const [exercise, setExercise] = useState(EXERCISES[0]);

  return (
    <RosterViewSwitcher
      view={view}
      onViewChange={setView}
      roster={{
        athletes: ATHLETES,
        signalsByPlayer: SIGNALS,
        draft: INITIAL_DRAFT,
        onDraftChange: () => {},
        onSelect: (a) => console.log('open athlete', a.id),
      }}
      leaderboard={{
        exercises: EXERCISES,
        selectedExercise: exercise,
        onExerciseChange: setExercise,
        metric,
        onMetricChange: setMetric,
        rows: LEADERBOARD_ROWS,
        onRowClick: (id) => console.log('open athlete', id),
        dither,
      }}
      grid={{
        dayLabels: DAY_LABELS,
        rows: GRID_ROWS,
        onRowClick: (id) => console.log('open athlete', id),
      }}
      teamPrs={{
        rows: TEAM_PR_ROWS,
        onRowClick: (id) => console.log('open athlete', id),
      }}
    />
  );
}

/** Leaderboard dither speed / randomness are tunable in the Controls panel. */
export const Interactive: StoryObj<DitherSettings> = {
  argTypes: DITHER_ARG_TYPES,
  args: DITHER_ARGS,
  render: (args) => <Controlled dither={args} />,
};
