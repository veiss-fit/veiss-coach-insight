import type { Meta, StoryObj } from '@storybook/react-vite';
import { PowerBetaCard, type PowerSetPoint } from './PowerBetaCard';

const meta: Meta = {
  title: 'Beta/PowerBetaCard',
  parameters: {
    docs: {
      description: {
        component:
          "Group 2 — Power. Same grain and x-axis as SetVelocityBars/RepTimingCards: per set, one exercise, one session. New Sessions-tab view, not folded into Velocity. Nothing in the schema carries power today. All-mock data.",
      },
    },
  },
  decorators: [(Story) => <div style={{ maxWidth: 480 }}><Story /></div>],
};
export default meta;
type Story = StoryObj;

const SETS: PowerSetPoint[] = Array.from({ length: 4 }, (_, i) => {
  const f = i * 0.04;
  return { set: i + 1, meanW: Math.round(420 * (1 - f)), peakW: Math.round(610 * (1 - f * 1.1)) };
});

export const Interactive: Story = {
  render: () => <PowerBetaCard exercise="Bench Press" sessionDate="2026-09-22T10:00:00Z" sets={SETS} />,
};

export const Empty: Story = {
  render: () => <PowerBetaCard exercise="Bench Press" sessionDate="2026-09-22T10:00:00Z" sets={[]} />,
};
