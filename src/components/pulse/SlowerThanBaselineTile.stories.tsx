import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SlowerThanBaselineTile, type SlowerAthlete } from './SlowerThanBaselineTile';

const meta: Meta = {
  title: 'Home dashboard/SlowerThanBaselineTile',
  parameters: {
    docs: {
      description: {
        component:
          'Coach picks an exercise; shows the athletes slower than their own baseline on that lift by more than the drop threshold (default 10%), worst first, capped to 3 with "+N more" past the cap. Athletes filtered by who trained that lift in the 6-week baseline window (SP-04). Clicking filters the roster table. See temp/HOME_DASHBOARD_PLAN.md.',
      },
    },
  },
  decorators: [(Story) => <div style={{ maxWidth: 280 }}><Story /></div>],
};
export default meta;
type Story = StoryObj;

const EXERCISES = ['Back Squat', 'Bench Press', 'Deadlift', 'RDL'];

function Controlled(props: { athletesByExercise: Record<string, SlowerAthlete[]>; onOpenAthlete?: (a: SlowerAthlete, exercise: string) => void }) {
  const [ex, setEx] = useState(EXERCISES[0]);
  return (
    <SlowerThanBaselineTile
      exercises={EXERCISES}
      selectedExercise={ex}
      onExerciseChange={setEx}
      athletes={props.athletesByExercise[ex] ?? []}
      onOpenAthlete={props.onOpenAthlete}
    />
  );
}

const SQUAT: SlowerAthlete[] = [
  { playerId: 'p1', name: 'Sam Ortiz', change: -18.2, sessionId: 's1' },
  { playerId: 'p2', name: 'Priya Nair', change: -14.5, sessionId: 's2' },
  { playerId: 'p3', name: 'Jordan Ade', change: -11.1, sessionId: 's3' },
  { playerId: 'p4', name: 'Maya Chen', change: -3.4, sessionId: 's4' },
  { playerId: 'p5', name: 'Leo Fontaine', change: 2.1, sessionId: 's5' },
  { playerId: 'p6', name: 'Noa Reyes', change: 6.8, sessionId: 's6' },
];

export const SomeSlower: Story = {
  render: () => (
    <Controlled
      athletesByExercise={{
        'Back Squat': SQUAT,
        'Bench Press': SQUAT.slice(0, 4).map((a) => ({ ...a, change: a.change + 8 })),
        Deadlift: SQUAT,
        RDL: SQUAT.slice(0, 3),
      }}
      onOpenAthlete={(a, exercise) => console.log('open exercise', a.name, exercise, a.sessionId)}
    />
  ),
};

export const ManySlowerCapped: Story = {
  render: () => (
    <Controlled
      athletesByExercise={{
        'Back Squat': Array.from({ length: 8 }, (_, i) => ({
          playerId: `p${i}`,
          name: `Athlete ${i + 1}`,
          change: -12 - i * 2,
          sessionId: `s${i}`,
        })),
        'Bench Press': [],
        Deadlift: [],
        RDL: [],
      }}
    />
  ),
};

export const NoneSlower: Story = {
  render: () => (
    <Controlled
      athletesByExercise={{
        'Back Squat': [
          { playerId: 'p1', name: 'Sam Ortiz', change: -2, sessionId: 's1' },
          { playerId: 'p2', name: 'Priya Nair', change: 4, sessionId: 's2' },
        ],
        'Bench Press': [],
        Deadlift: [],
        RDL: [],
      }}
    />
  ),
};

export const NobodyTrainedIt: Story = {
  render: () => (
    <Controlled
      athletesByExercise={{
        'Back Squat': SQUAT,
        'Bench Press': [],
        Deadlift: [],
        RDL: [],
      }}
    />
  ),
};
