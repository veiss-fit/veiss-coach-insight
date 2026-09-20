import type { Meta, StoryObj } from '@storybook/react-vite';
import { PersonalRecordsCard } from './PersonalRecordsCard';
import { summarizeSession, type RepInput } from '@/lib/metrics/setVelocitySummary';
import type { HistorySession } from '@/lib/metrics/velocityVsBaseline';

const meta: Meta = {
  title: 'Metrics/SP-05 Velocity personal records',
  parameters: {
    docs: {
      description: {
        component:
          'Roster-style table, one row per exercise: the heaviest set load ever lifted and the fastest rep at that load, with date and set. Needs a verified weight (unit not verified), so exercises with no recorded weight show No load recorded. "new record" appears when the latest session holds it. No colour judgement. See temp/METRIC_SPEC.md (SP-05).',
      },
    },
  },
  decorators: [(Story) => <div style={{ maxWidth: 560 }}><Story /></div>],
};
export default meta;
type Story = StoryObj;

const reps = (exercise: string, set: number, speeds: (number | null)[], weight: number | null = 225): RepInput[] =>
  speeds.map((v, i) => ({ exercise_name: exercise, set_number: set, rep_number: i + 1, average_rep_speed: v, weight }));

const TODAY = '2026-09-19T10:00:00Z';
const daysAgo = (n: number) => new Date(Date.parse(TODAY) - n * 86_400_000).toISOString();

const past = (exercise: string, daysBack: number, sets: number[][], weight: number | null = 225): HistorySession => ({
  date: daysAgo(daysBack),
  sets: summarizeSession(sets.flatMap((sp, i) => reps(exercise, i + 1, sp, weight)))[0].sets,
});

/** Squat record is old; bench sets a new record today. */
export const OldAndNewRecords: Story = {
  render: () => (
    <PersonalRecordsCard
      sessionDate={TODAY}
      exercises={summarizeSession([
        ...reps('Back Squat', 1, [0.71, 0.69, 0.66]),
        ...reps('Back Squat', 2, [0.68, 0.66, 0.63]),
        ...reps('Bench Press', 1, [0.62, 0.6, 0.57], 155),
      ])}
      history={{
        'Back Squat': [
          past('Back Squat', 90, [[0.74, 0.7], [0.72, 0.69]]),
          past('Back Squat', 30, [[0.7, 0.68], [0.69, 0.66]]),
        ],
        'Bench Press': [past('Bench Press', 12, [[0.58, 0.55], [0.6, 0.56]], 155)],
      }}
    />
  ),
};

/** Heaviest load is 225: the faster 135 rep does not count. */
export const HeavierLoadWins: Story = {
  render: () => (
    <PersonalRecordsCard
      sessionDate={TODAY}
      exercises={summarizeSession(reps('Back Squat', 1, [0.66, 0.63, 0.6], 225))}
      history={{
        'Back Squat': [
          past('Back Squat', 40, [[0.95, 0.9]], 135),
          past('Back Squat', 20, [[0.7, 0.66]], 225),
        ],
      }}
    />
  ),
};

/** No weight recorded: nothing to rank. */
export const NoLoadRecorded: Story = {
  render: () => (
    <PersonalRecordsCard
      sessionDate={TODAY}
      exercises={summarizeSession(reps('Back Squat', 1, [0.66, 0.63, 0.6], null))}
      history={{ 'Back Squat': [past('Back Squat', 20, [[0.72, 0.7]], null)] }}
    />
  ),
};

/** First recorded session: nothing to beat, so no "new record" wording. */
export const FirstSession: Story = {
  render: () => (
    <PersonalRecordsCard sessionDate={TODAY} exercises={summarizeSession(reps('Power Clean', 1, [1.5, 1.45, 1.4], 135))} />
  ),
};
