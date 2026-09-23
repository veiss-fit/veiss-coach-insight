import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CompositeScoreBetaCard, type CompositeScoreWeekPoint } from './CompositeScoreBetaCard';

const meta: Meta = {
  title: 'Beta/CompositeScoreBetaCard',
  parameters: {
    docs: {
      description: {
        component:
          "Group 7 — Composite scores. Per exercise, over a rolling weekly window — never blended across exercises or team-wide, and not per session (day-level velocity estimates are unreliable). Two views: Current (rings, this week) and Over time (per-week points, legend toggles each score, hover a point for its value + change vs prev week, drag across the chart to zoom in with a Reset button to return — same pattern as the shipped RangeOfMotionCard, plus drag-zoom). Blocked on a verified load-velocity profile, not just Velocity + Power. Efficiency % dropped — no formula defined. All-mock data.",
      },
    },
  },
  decorators: [(Story) => <div style={{ maxWidth: 420 }}><Story /></div>],
};
export default meta;
type Story = StoryObj;

const EXERCISES = ['Back Squat', 'Bench Press', 'Deadlift'];

const WEEKS: CompositeScoreWeekPoint[] = ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5', 'Wk 6'].map((label, i) => ({
  label,
  strength: 62 + i * 3,
  speed: 70 - i * 1.5,
  total: 66 + i * 1,
}));

function Controlled(props: { weeks: CompositeScoreWeekPoint[] }) {
  const [exercise, setExercise] = useState(EXERCISES[0]);
  return (
    <CompositeScoreBetaCard
      exercise={exercise}
      exercises={EXERCISES}
      onExerciseChange={setExercise}
      weeks={props.weeks}
    />
  );
}

export const Interactive: Story = {
  render: () => <Controlled weeks={WEEKS} />,
};

export const NotEnoughData: Story = {
  render: () => <Controlled weeks={WEEKS.slice(0, 1)} />,
};
