import type { Meta, StoryObj } from '@storybook/react-vite';
import { TrainingExposureCard } from './TrainingExposureCard';
import type { SessionInput } from '@/lib/metrics/trainingExposure';

const meta: Meta = {
  title: 'Metrics/SP-08 Training exposure',
  parameters: {
    docs: {
      description: {
        component:
          'The Weekly volume card from the athlete Performance tab, copied as is: the same chart, header, target line and stat row, fed with SP-08 weekly counts (last 8 weeks, weeks start on Monday, a session counts when it has at least one valid rep). One stat is added: days since the last session. See temp/METRIC_SPEC.md (SP-08).',
      },
    },
  },
  decorators: [(Story) => <div style={{ maxWidth: 640 }}><Story /></div>],
};
export default meta;
type Story = StoryObj;

/** Friday 19 Sep 2026. */
const TODAY = '2026-09-19T10:00:00Z';
const daysAgo = (n: number): string => new Date(Date.parse(TODAY) - n * 86_400_000).toISOString();
const sess = (...ago: number[]): SessionInput[] => ago.map((n) => ({ date: daysAgo(n), validReps: 20 }));

/** Roughly 3 sessions a week, one lighter week. */
export const SteadyTraining: Story = {
  render: () => (
    <TrainingExposureCard
      today={TODAY}
      sessions={sess(1, 3, 4, 8, 10, 12, 15, 17, 19, 22, 24, 26, 30, 31, 33, 36, 38, 40, 43, 45, 47, 50, 52, 54)}
    />
  ),
};

/** Sessions tail off across the weeks. */
export const TrainingDropsOff: Story = {
  render: () => (
    <TrainingExposureCard
      today={TODAY}
      sessions={sess(2, 9, 16, 17, 23, 24, 25, 30, 31, 32, 37, 38, 39, 44, 45, 46, 47, 51, 52, 53)}
    />
  ),
};

/** Sessions with no valid reps do not count. */
export const SessionsWithoutValidReps: Story = {
  render: () => (
    <TrainingExposureCard
      today={TODAY}
      sessions={[
        ...sess(2, 9, 16, 23, 30, 37, 44, 51),
        { date: daysAgo(1), validReps: 0 },
        { date: daysAgo(5), validReps: 0 },
      ]}
    />
  ),
};

/** Nothing in the last 8 weeks, older sessions only. */
export const LongBreak: Story = {
  render: () => <TrainingExposureCard today={TODAY} sessions={sess(70, 74, 80)} />,
};

export const NoSessions: Story = {
  render: () => <TrainingExposureCard today={TODAY} sessions={[]} />,
};
