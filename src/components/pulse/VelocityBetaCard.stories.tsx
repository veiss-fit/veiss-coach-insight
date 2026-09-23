import type { Meta, StoryObj } from '@storybook/react-vite';
import { VelocityBetaCard, type VelocitySetPoint } from './VelocityBetaCard';

const meta: Meta = {
  title: 'Beta/VelocityBetaCard',
  parameters: {
    docs: {
      description: {
        component:
          "Group 1 — Velocity. Same grain as the shipped SetVelocityBars: per set, within one exercise, one session. Previews a variable picker (Mean/Peak/Eccentric mean/Propulsive/At 100ms) rather than 5 lines on one axis. Mean is already real; the rest need a per-rep waveform. All-mock data.",
      },
    },
  },
  decorators: [(Story) => <div style={{ maxWidth: 480 }}><Story /></div>],
};
export default meta;
type Story = StoryObj;

/** Fatigue drift across 4 sets: every variable eases down set to set. */
const SETS: VelocitySetPoint[] = Array.from({ length: 4 }, (_, i) => {
  const f = i * 0.05;
  return {
    set: i + 1,
    values: {
      mean: +(0.85 - f).toFixed(2),
      peak: +(1.08 - f * 1.1).toFixed(2),
      eccMean: +(0.52 - f * 0.5).toFixed(2),
      propulsive: +(0.9 - f * 0.9).toFixed(2),
      at100ms: +(0.38 - f * 0.3).toFixed(2),
    },
  };
});

export const Interactive: Story = {
  render: () => <VelocityBetaCard exercise="Back Squat" sessionDate="2026-09-22T10:00:00Z" sets={SETS} />,
};

export const Empty: Story = {
  render: () => <VelocityBetaCard exercise="Back Squat" sessionDate="2026-09-22T10:00:00Z" sets={[]} />,
};
