import type { Meta, StoryObj } from '@storybook/react-vite';
import { RepTimingCards } from './RepTimingCard';
import { summarizeTimingSession } from '@/lib/metrics/repTiming';
import type { RepInput } from '@/lib/metrics/setVelocitySummary';

const meta: Meta = {
  title: 'Metrics/SP-07 Rep timing',
  parameters: {
    docs: {
      description: {
        component:
          'One stacked bar per set: mean concentric duration (bottom) and mean eccentric duration (top), seconds. A duration counts when the rep velocity is valid and the duration is above 0. Stats detail shows time under tension (TUT) for the exercise, mean durations, the E:C ratio and the concentric and eccentric change from first to last set. No colour judgement. See temp/METRIC_SPEC.md (SP-07).',
      },
    },
  },
  decorators: [(Story) => <div style={{ maxWidth: 560 }}><Story /></div>],
};
export default meta;
type Story = StoryObj;

/** Each entry is [velocity, concentric_s, eccentric_s]. */
const set = (exercise: string, n: number, data: [number | null, number | null, number | null][]): RepInput[] =>
  data.map(([v, c, e], i) => ({
    exercise_name: exercise,
    set_number: n,
    rep_number: i + 1,
    average_rep_speed: v,
    concentric_duration_s: c,
    eccentric_duration_s: e,
  }));

/** Concentric time creeps up across reps and sets as the athlete tires; eccentric stays near 2 s. Open Stats detail. */
export const TimingAcrossSets: Story = {
  render: () => (
    <RepTimingCards
      exercises={summarizeTimingSession([
        ...set('Back Squat', 1, [[0.71, 0.82, 2.1], [0.7, 0.84, 2.0], [0.69, 0.85, 2.1], [0.66, 0.9, 2.2], [0.61, 0.98, 2.1]]),
        ...set('Back Squat', 2, [[0.68, 0.88, 2.0], [0.66, 0.91, 2.1], [0.63, 0.96, 2.0], [0.6, 1.02, 2.2], [0.57, 1.1, 2.1]]),
        ...set('Back Squat', 3, [[0.66, 0.92, 2.1], [0.63, 0.97, 2.0], [0.6, 1.03, 2.1], [0.55, 1.12, 2.2], [0.52, 1.25, 2.1]]),
      ])}
    />
  ),
};

/** Some reps lack a duration: they drop out of the means. Eccentric missing entirely in one set, concentric missing in another. */
export const MissingDurations: Story = {
  render: () => (
    <RepTimingCards
      exercises={summarizeTimingSession([
        ...set('Bench Press', 1, [[0.55, 0.9, 1.8], [0.53, null, 1.9], [0.5, 1.0, null], [0.48, 1.05, 1.8]]),
        ...set('Bench Press', 2, [[0.54, 0.95, null], [0.51, 1.0, null], [0.47, 1.1, null]]),
        ...set('Bench Press', 3, [[0.52, null, 1.9], [0.49, null, 2.0], [0.45, null, 1.9]]),
      ])}
    />
  ),
};

/** No durations recorded at all. */
export const NoTiming: Story = {
  render: () => (
    <RepTimingCards exercises={summarizeTimingSession(set('Back Squat', 1, [[0.7, null, null], [0.68, null, null], [0.65, null, null]]))} />
  ),
};

/** One set only: no change pill. */
export const SingleSet: Story = {
  render: () => (
    <RepTimingCards exercises={summarizeTimingSession(set('Power Clean', 1, [[1.5, 0.45, 1.2], [1.47, 0.46, 1.1], [1.45, 0.47, 1.2]]))} />
  ),
};

export const SeveralExercises: Story = {
  render: () => (
    <RepTimingCards
      exercises={summarizeTimingSession([
        ...set('Back Squat', 1, [[0.71, 0.82, 2.1], [0.69, 0.86, 2.0], [0.64, 0.95, 2.2]]),
        ...set('Back Squat', 2, [[0.68, 0.88, 2.0], [0.63, 0.96, 2.1], [0.6, 1.05, 2.1]]),
        ...set('Bench Press', 1, [[0.55, 0.9, 1.8], [0.52, 0.97, 1.9], [0.49, 1.05, 1.8]]),
        ...set('Bench Press', 2, [[0.54, 0.93, 1.9], [0.51, 1.0, 1.8], [0.47, 1.1, 1.9]]),
      ])}
    />
  ),
};

/** Six sets: four are drawn at a time. The tiny blocks by the name show which (yellow); the arrows move the window one set. */
export const ManySets: Story = {
  decorators: [(Story) => <div style={{ width: 420 }}><Story /></div>],
  render: () => (
    <RepTimingCards
      exercises={summarizeTimingSession(
        [0.82, 0.86, 0.9, 0.95, 1.0, 1.08].flatMap((c, i) =>
          set('Back Squat', i + 1, [[0.7, c, 2.0], [0.68, c + 0.04, 2.1], [0.65, c + 0.08, 2.0]])
        )
      )}
    />
  ),
};
