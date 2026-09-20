import type { Meta, StoryObj } from '@storybook/react-vite';
import { SetVelocityBlocks } from './SetVelocityBars';
import { summarizeSession, type RepInput } from '@/lib/metrics/setVelocitySummary';
import type { HistorySession } from '@/lib/metrics/velocityVsBaseline';

const meta: Meta = {
  title: 'Metrics/SP-01 to SP-04 Set summary, loss, change and baseline',
  parameters: {
    docs: {
      description: {
        component:
          'Per set: fastest rep (gold bar), mean (light bar) and last valid rep (dark bar). The velocity loss = (fastest - last) / fastest is written inside the last-rep bar, centered. Sets with fewer than 2 valid reps are dashed with no loss. A dashed line at the right marks the baseline (exponentially weighted average of the fastest rep over earlier sessions in 42 days, SP-04). The Stats detail button opens an overlay with median loss, set-to-set change (first set to last set, only when both used the same known load) and the baseline change. The load sits next to each set label. No colour judgement. See temp/METRIC_SPEC.md.',
      },
    },
  },
  decorators: [(Story) => <div style={{ maxWidth: 560 }}><Story /></div>],
};
export default meta;
type Story = StoryObj;

/** weight defaults to 225 (unit unverified); pass null for an unrecorded load. */
const reps = (exercise: string, set: number, speeds: (number | null)[], weight: number | null = 225): RepInput[] =>
  speeds.map((v, i) => ({ exercise_name: exercise, set_number: set, rep_number: i + 1, average_rep_speed: v, weight }));

const TODAY = '2026-09-19T10:00:00Z';
const daysAgo = (n: number) => new Date(Date.parse(TODAY) - n * 86_400_000).toISOString();

/** One earlier session of a single exercise: each speeds array is one set. */
const past = (exercise: string, daysBack: number, sets: number[][], weight: number | null = 225): HistorySession => ({
  date: daysAgo(daysBack),
  sets: summarizeSession(sets.flatMap((sp, i) => reps(exercise, i + 1, sp, weight)))[0].sets,
});

const squatToday = (weight: number | null) => [
  ...reps('Back Squat', 1, [0.71, 0.69, 0.66, 0.64], weight),
  ...reps('Back Squat', 2, [0.68, 0.66, 0.63, 0.6], weight),
  ...reps('Back Squat', 3, [0.66, 0.63, 0.6, 0.55], weight),
];

/** Everything on: same load in every set and earlier session, so the baseline and set-to-set change show. Open Stats detail. */
export const FullCard: Story = {
  render: () => (
    <SetVelocityBlocks
      sessionDate={TODAY}
      exercises={summarizeSession(squatToday(225))}
      history={{
        'Back Squat': [
          past('Back Squat', 30, [[0.8, 0.77, 0.74], [0.78, 0.75, 0.7]]),
          past('Back Squat', 21, [[0.78, 0.75, 0.72], [0.76, 0.72, 0.7]]),
          past('Back Squat', 14, [[0.79, 0.76, 0.73], [0.77, 0.74, 0.7]]),
          past('Back Squat', 7, [[0.77, 0.75, 0.72], [0.75, 0.72, 0.68]]),
        ],
      }}
    />
  ),
};

/** Zero and missing velocities: greyed squares, excluded from the numbers. */
export const InvalidReps: Story = {
  render: () => (
    <SetVelocityBlocks
      exercises={summarizeSession([
        ...reps('Back Squat', 1, [0.71, 0.69, 0, 0.64, 0.6]),
        ...reps('Back Squat', 2, [0.68, null, 0.63, 0.6, 0.57]),
        ...reps('Back Squat', 3, [0.66, 0.63, 0.6, 0, 0]),
      ])}
    />
  ),
};

/** A one-rep set is dashed with no loss; a set with no valid reps says so. */
export const TooFewValidReps: Story = {
  render: () => (
    <SetVelocityBlocks
      exercises={summarizeSession([
        ...reps('Trap Bar Deadlift', 1, [0.45]),
        ...reps('Trap Bar Deadlift', 2, [0.43, 0.4]),
        ...reps('Trap Bar Deadlift', 3, [0, 0, null]),
      ])}
    />
  ),
};

/** Load changes between sets (a ramp-up): the set-to-set pill says the load is not verified equal. */
export const LoadsDiffer: Story = {
  render: () => (
    <SetVelocityBlocks
      exercises={summarizeSession([
        ...reps('Back Squat', 1, [0.9, 0.88, 0.86], 135),
        ...reps('Back Squat', 2, [0.72, 0.7, 0.67], 185),
        ...reps('Back Squat', 3, [0.55, 0.52, 0.5], 225),
      ])}
    />
  ),
};

/** No weight recorded: load shows a dash, the baseline pools all sets and is marked not load-matched. */
export const LoadUnknown: Story = {
  render: () => (
    <SetVelocityBlocks
      sessionDate={TODAY}
      exercises={summarizeSession(squatToday(null))}
      history={{
        'Back Squat': [
          past('Back Squat', 20, [[0.76, 0.72, 0.7], [0.74, 0.7, 0.66]], null),
          past('Back Squat', 9, [[0.75, 0.72, 0.7], [0.73, 0.7, 0.66]], null),
        ],
      }}
    />
  ),
};

/** Four sets in a half-width grid cell (about 420px): the card compresses to fit one cell. */
export const FourSetsInAGridCell: Story = {
  decorators: [(Story) => <div style={{ width: 420 }}><Story /></div>],
  render: () => (
    <SetVelocityBlocks
      sessionDate={TODAY}
      exercises={summarizeSession([
        ...reps('Back Squat', 1, [0.71, 0.69, 0.66, 0.64], 225),
        ...reps('Back Squat', 2, [0.68, 0.66, 0.63, 0.6], 225),
        ...reps('Back Squat', 3, [0.66, 0.63, 0.6, 0.55], 225),
        ...reps('Back Squat', 4, [0.64, 0.6, 0.57, 0.52], null),
      ])}
      history={{
        'Back Squat': [
          past('Back Squat', 14, [[0.79, 0.76, 0.73], [0.77, 0.74, 0.7]]),
          past('Back Squat', 7, [[0.77, 0.75, 0.72], [0.75, 0.72, 0.68]]),
        ],
      }}
    />
  ),
};

/** Six sets: three are drawn at a time. The tiny blocks by the name show which (yellow); the arrows next to them move the window one set. The bars stay where they are. */
export const ManySets: Story = {
  decorators: [(Story) => <div style={{ width: 420 }}><Story /></div>],
  render: () => (
    <SetVelocityBlocks
      sessionDate={TODAY}
      exercises={summarizeSession(
        [0.72, 0.7, 0.68, 0.65, 0.62, 0.58].flatMap((v, i) => reps('Back Squat', i + 1, [v, v - 0.03, v - 0.06], 225))
      )}
      history={{
        'Back Squat': [past('Back Squat', 14, [[0.79, 0.76, 0.73], [0.77, 0.74, 0.7]]), past('Back Squat', 7, [[0.77, 0.75, 0.72], [0.75, 0.72, 0.68]])],
      }}
    />
  ),
};
