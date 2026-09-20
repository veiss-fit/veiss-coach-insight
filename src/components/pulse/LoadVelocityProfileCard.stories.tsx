import type { Meta, StoryObj } from '@storybook/react-vite';
import { LoadVelocityProfileCard } from './LoadVelocityProfileCard';
import { summarizeSession, type RepInput } from '@/lib/metrics/setVelocitySummary';
import type { HistorySession } from '@/lib/metrics/velocityVsBaseline';

const meta: Meta = {
  title: 'Metrics/SP-09 Load-velocity profile',
  parameters: {
    docs: {
      description: {
        component:
          'Copy of the Performance tab load-velocity card, with an exercise dropdown. One dot per load (the fastest valid rep across all sets at that load, last 8 weeks) and a dashed least-squares line. Stats detail shows R² and the velocity span between the lightest and heaviest load. Upper-body lifts also get an estimated 1RM (SP-10 prototype): the dashed line is extended to the minimum velocity the coach sets (default 0.16 m/s) and a ring marks the load. Squat and deadlift are not estimated. Needs at least 2 loads and a verified set load (weight unit not verified). See temp/METRIC_SPEC.md (SP-09, SP-10).',
      },
    },
  },
  decorators: [(Story) => <div style={{ maxWidth: 640 }}><Story /></div>],
};
export default meta;
type Story = StoryObj;

const TODAY = '2026-09-20T10:00:00Z';
const daysAgo = (n: number): string => new Date(Date.parse(TODAY) - n * 86_400_000).toISOString();

const reps = (exercise: string, set: number, speeds: (number | null)[], weight: number | null): RepInput[] =>
  speeds.map((v, i) => ({ exercise_name: exercise, set_number: set, rep_number: i + 1, average_rep_speed: v, weight }));

/** One session of one exercise: each entry is [load, speeds]. */
const session = (exercise: string, daysBack: number, sets: [number | null, number[]][]): HistorySession => ({
  date: daysAgo(daysBack),
  sets: summarizeSession(sets.flatMap(([w, sp], i) => reps(exercise, i + 1, sp, w)))[0].sets,
});

/** Speed falls as load rises; small scatter around a straight line. */
const SQUAT: HistorySession[] = [
  session('Back Squat', 3, [[135, [0.93, 0.9, 0.88]], [185, [0.76, 0.73, 0.7]], [225, [0.6, 0.57, 0.55]]]),
  session('Back Squat', 10, [[135, [0.91, 0.89]], [185, [0.78, 0.74, 0.71]], [245, [0.5, 0.47]]]),
  session('Back Squat', 24, [[155, [0.86, 0.83, 0.8]], [205, [0.68, 0.66, 0.62]], [225, [0.61, 0.58]]]),
  session('Back Squat', 40, [[185, [0.74, 0.72]], [265, [0.42, 0.4]]]),
  session('Back Squat', 80, [[135, [1.2, 1.1]]]),
];

const BENCH: HistorySession[] = [
  session('Bench Press', 4, [[135, [0.68, 0.66, 0.63]], [185, [0.5, 0.47, 0.45]]]),
  session('Bench Press', 17, [[115, [0.79, 0.76]], [165, [0.57, 0.55, 0.52]], [205, [0.4, 0.37]]]),
];

/** Two exercises with the picker. Open Stats detail. */
export const WithPicker: Story = {
  render: () => <LoadVelocityProfileCard today={TODAY} sessions={{ 'Back Squat': SQUAT, 'Bench Press': BENCH }} />,
};

/** Only two loads: a line is drawn, R² is not shown (always 1 with two dots). */
export const TwoLoads: Story = {
  render: () => (
    <LoadVelocityProfileCard
      today={TODAY}
      sessions={{ 'Power Clean': [session('Power Clean', 5, [[115, [1.6, 1.55]], [155, [1.3, 1.25]]])] }}
    />
  ),
};

/** One load only: the dot and a note, no line. */
export const OneLoad: Story = {
  render: () => (
    <LoadVelocityProfileCard today={TODAY} sessions={{ 'Back Squat': [session('Back Squat', 3, [[185, [0.76, 0.73]], [185, [0.72, 0.7]]])] }} />
  ),
};

/** No weight recorded: nothing to plot. */
export const NoLoadRecorded: Story = {
  render: () => (
    <LoadVelocityProfileCard today={TODAY} sessions={{ 'Back Squat': [session('Back Squat', 3, [[null, [0.76, 0.73]], [null, [0.72, 0.7]]])] }} />
  ),
};

/** Upper-body lift: ring marks the estimated 1RM, editable min velocity above the chart. Hover the ring. */
export const EstimatedOneRm: Story = {
  render: () => <LoadVelocityProfileCard today={TODAY} sessions={{ 'Bench Press': BENCH, 'Back Squat': SQUAT }} />,
};

/** Two loads only: estimate still drawn from the two-dot line. */
export const EstimateFromTwoLoads: Story = {
  render: () => (
    <LoadVelocityProfileCard
      today={TODAY}
      sessions={{ 'Bench Press': [session('Bench Press', 5, [[135, [0.68, 0.66]], [185, [0.5, 0.47]]])] }}
    />
  ),
};
