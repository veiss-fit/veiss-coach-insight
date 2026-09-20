import type { Meta, StoryObj } from '@storybook/react-vite';
import { WorkoutPicker, type PickerPlan } from './WorkoutPicker';

const meta: Meta = {
  title: 'Athlete page/Workout picker',
  parameters: {
    docs: {
      description: {
        component:
          'Programming tab: a date button that opens a month calendar, and a dropdown of the workouts on that date (same look as the exercise picker in the load-velocity card). Dots on a date: green completed, red missed, grey queued. No workout card yet: the page decides what to show for the chosen workout. Placeholder styling, not final. Sample plans are made up; today is fixed to 2026-09-20.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const TODAY = '2026-09-20';

const ex = (name: string, sets: number, reps: number, weight?: number, target?: number) => ({
  name,
  perSet: Array.from({ length: sets }, () => ({ reps, targetVelocity: target ?? null })),
  weight,
  weightUnit: 'lbs' as const,
});

const PLANS: PickerPlan[] = [
  { id: 'a', date: '2026-09-08', title: 'Lower A', is_completed: true, exercises: [ex('Back Squat', 4, 5, 225, 0.6), ex('Romanian Deadlift', 3, 8, 185)] },
  { id: 'b', date: '2026-09-10', title: 'Upper A', is_completed: true, exercises: [ex('Bench Press', 4, 5, 155, 0.5), ex('Bent Over Row', 3, 8, 135)] },
  { id: 'c', date: '2026-09-15', title: 'Lower B', is_completed: false, exercises: [ex('Trap Bar Deadlift', 4, 3, 275, 0.45), ex('Split Squat', 3, 8)] },
  { id: 'd', date: '2026-09-17', title: 'Upper B', is_completed: true, exercises: [ex('Overhead Press', 4, 5, 95, 0.5), ex('Pull-Up', 3, 6)] },
  { id: 'e', date: '2026-09-17', title: 'Speed work', is_completed: false, exercises: [ex('Box Jump', 5, 3), ex('Med Ball Throw', 4, 5)] },
  { id: 'f', date: '2026-09-22', title: 'Lower A', is_completed: false, exercises: [ex('Back Squat', 4, 5, 230, 0.6), ex('Romanian Deadlift', 3, 8, 190)] },
  { id: 'g', date: '2026-09-24', title: 'Upper A', is_completed: false, exercises: [ex('Bench Press', 4, 5, 160, 0.5), ex('Bent Over Row', 3, 8, 140)] },
];

export const Default: Story = {
  render: () => <WorkoutPicker plans={PLANS} today={TODAY} />,
};

/** Sep 17 has two workouts: the dropdown lists both. */
export const TwoWorkoutsInADay: Story = {
  render: () => <WorkoutPicker plans={PLANS} today={TODAY} initialDate="2026-09-17" />,
};

/** Sep 17: "Speed work" has no data, so it is greyed out in the dropdown and cannot be picked. */
export const WorkoutWithoutData: Story = {
  render: () => (
    <WorkoutPicker
      plans={PLANS.map((p) => (p.id === 'e' ? { ...p, hasData: false } : p))}
      today={TODAY}
      initialDate="2026-09-17"
    />
  ),
};

/** A date with no workout says so and hides the dropdown. */
export const DateWithNoWorkout: Story = {
  render: () => <WorkoutPicker plans={PLANS} today={TODAY} initialDate="2026-09-19" />,
};

export const Empty: Story = {
  render: () => <WorkoutPicker plans={[]} today={TODAY} />,
};
