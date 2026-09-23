import type { Meta, StoryObj } from '@storybook/react-vite';
import { RepTimingBetaCard, type RepTimingSetPoint } from './RepTimingBetaCard';

const meta: Meta = {
  title: 'Beta/RepTimingBetaCard',
  parameters: {
    docs: {
      description: {
        component:
          "Group 4 — Rep timing, new fields. Same grain and x-axis as the shipped RepTimingCards: per set, one exercise, one session. Meant to sit alongside that card's existing concentric/eccentric/TUT bars, not replace it. Time to peak power also needs group 2 (Power). All-mock data.",
      },
    },
  },
  decorators: [(Story) => <div style={{ maxWidth: 480 }}><Story /></div>],
};
export default meta;
type Story = StoryObj;

const SETS: RepTimingSetPoint[] = Array.from({ length: 4 }, (_, i) => ({
  set: i + 1,
  toPeakVelocityS: +(0.32 + i * 0.02).toFixed(2),
  toPeakPowerS: +(0.4 + i * 0.03).toFixed(2),
}));

export const Interactive: Story = {
  render: () => <RepTimingBetaCard exercise="Deadlift" sessionDate="2026-09-22T10:00:00Z" sets={SETS} />,
};

export const Empty: Story = {
  render: () => <RepTimingBetaCard exercise="Deadlift" sessionDate="2026-09-22T10:00:00Z" sets={[]} />,
};
