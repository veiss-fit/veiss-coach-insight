import type { Meta, StoryObj } from '@storybook/react-vite';
import { SetEffortBetaCard, type SetEffortPoint } from './SetEffortBetaCard';

const meta: Meta = {
  title: 'Beta/SetEffortBetaCard',
  parameters: {
    docs: {
      description: {
        component:
          'Group 6a — RIR/RPE, split from the old "Effort & readiness" card. Athlete-reported per set, same grain as SetVelocityBars/RepTimingCards. Not collected today. All-mock data.',
      },
    },
  },
  decorators: [(Story) => <div style={{ maxWidth: 420 }}><Story /></div>],
};
export default meta;
type Story = StoryObj;

const SETS: SetEffortPoint[] = [
  { set: 1, rir: 4, rpe: 6 },
  { set: 2, rir: 3, rpe: 7 },
  { set: 3, rir: 1, rpe: 8.5 },
  { set: 4, rir: 0, rpe: 9.5 },
];

export const Interactive: Story = {
  render: () => <SetEffortBetaCard exercise="Back Squat" sessionDate="2026-09-22T10:00:00Z" sets={SETS} />,
};

export const Empty: Story = {
  render: () => <SetEffortBetaCard exercise="Back Squat" sessionDate="2026-09-22T10:00:00Z" sets={[]} />,
};
