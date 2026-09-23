import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LeaderboardPanel, type LeaderboardMetric, type LeaderboardRow } from './LeaderboardPanel';
import type { DitherSettings } from './rankDither';
import { DITHER_ARGS, DITHER_ARG_TYPES } from './ditherStoryControls';

const meta: Meta = {
  title: 'Home dashboard/LeaderboardPanel',
  parameters: {
    docs: {
      description: {
        component:
          'Roster ranked by one metric, optionally scoped to one exercise. Metrics: best velocity at a load, change vs baseline, sessions count, plan completion. Sessions and plan completion ignore the exercise dropdown. See temp/HOME_DASHBOARD_PLAN.md.',
      },
    },
  },
  decorators: [(Story) => <div style={{ maxWidth: 420 }}><Story /></div>],
};
export default meta;
type Story = StoryObj;

const EXERCISES = ['Back Squat', 'Bench Press', 'Deadlift', 'RDL'];
const NAMES = ['Jordan Ade', 'Maya Chen', 'Sam Ortiz', 'Priya Nair', 'Leo Fontaine', 'Noa Reyes', 'Ava Torres', 'Kai Mensah', 'Ruth Solano', 'Theo Park'];

/** Jordan Ade tops 3 exercises, Maya Chen tops 1, nobody else tops any. */
const FIRST_PLACE_COUNTS: Record<string, number> = { p0: 3, p1: 1 };
const withStars = (rows: LeaderboardRow[]): LeaderboardRow[] =>
  rows.map((r) => ({ ...r, firstPlaceCount: FIRST_PLACE_COUNTS[r.playerId] }));

const DATA: Record<LeaderboardMetric, LeaderboardRow[]> = {
  velocity: withStars(NAMES.map((name, i) => ({ playerId: `p${i}`, name, value: 1.05 - i * 0.04 }))),
  baseline: withStars(NAMES.map((name, i) => ({ playerId: `p${i}`, name, value: 12 - i * 3 }))),
  sessions: withStars(NAMES.map((name, i) => ({ playerId: `p${i}`, name, value: 9 - i }))),
  completion: withStars(NAMES.map((name, i) => ({ playerId: `p${i}`, name, value: 100 - i * 6 }))),
};

function Controlled({ dither }: { dither: DitherSettings }) {
  const [metric, setMetric] = useState<LeaderboardMetric>('velocity');
  const [exercise, setExercise] = useState(EXERCISES[0]);
  return (
    <LeaderboardPanel
      exercises={EXERCISES}
      selectedExercise={exercise}
      onExerciseChange={setExercise}
      metric={metric}
      onMetricChange={setMetric}
      rows={DATA[metric]}
      onRowClick={(id) => console.log('open athlete', id)}
      dither={dither}
    />
  );
}

/** Dither speed / randomness are tunable in the Controls panel. */
export const Interactive: StoryObj<DitherSettings> = {
  argTypes: DITHER_ARG_TYPES,
  args: DITHER_ARGS,
  render: (args) => <Controlled dither={args} />,
};

export const ByVelocity: Story = {
  render: () => (
    <LeaderboardPanel
      exercises={EXERCISES}
      selectedExercise="Back Squat"
      onExerciseChange={() => {}}
      metric="velocity"
      onMetricChange={() => {}}
      rows={DATA.velocity}
    />
  ),
};

export const ByChangeVsBaseline: Story = {
  render: () => (
    <LeaderboardPanel
      exercises={EXERCISES}
      selectedExercise="Deadlift"
      onExerciseChange={() => {}}
      metric="baseline"
      onMetricChange={() => {}}
      rows={DATA.baseline}
    />
  ),
};

/** Sessions ignores the exercise dropdown, so it doesn't render. */
export const BySessions: Story = {
  render: () => (
    <LeaderboardPanel
      exercises={EXERCISES}
      selectedExercise="Back Squat"
      onExerciseChange={() => {}}
      metric="sessions"
      onMetricChange={() => {}}
      rows={DATA.sessions}
    />
  ),
};

export const ByPlanCompletion: Story = {
  render: () => (
    <LeaderboardPanel
      exercises={EXERCISES}
      selectedExercise="Back Squat"
      onExerciseChange={() => {}}
      metric="completion"
      onMetricChange={() => {}}
      rows={DATA.completion}
    />
  ),
};

export const Empty: Story = {
  render: () => (
    <LeaderboardPanel
      exercises={EXERCISES}
      selectedExercise="Back Squat"
      onExerciseChange={() => {}}
      metric="velocity"
      onMetricChange={() => {}}
      rows={[]}
    />
  ),
};
