import type { Meta, StoryObj } from '@storybook/react-vite';
import { DeviationBaselineCard } from './DeviationBaselineCard';
import type { DeviationIndicator, RAGStatus } from '@/lib/athleteSummaryUtils';

const meta: Meta = {
  title: 'Athlete page/Deviation from baseline',
  parameters: {
    docs: {
      description: {
        component:
          'The "Deviation from baseline" card from the athlete page Readiness tab, kept after the tab was removed. Four tiles, each with the latest value, the change against the athlete\'s own baseline, a status dot (z-score model in athleteSummaryUtils) and a sparkline. Not on any page right now. Sample values are made up.',
      },
    },
  },
  decorators: [(Story) => <div style={{ maxWidth: 520 }}><Story /></div>],
};
export default meta;
type Story = StoryObj;

const ind = (
  metric: string, label: string, value: number | null, deltaPercent: number | null,
  ragStatus: RAGStatus, formatFn: (v: number) => string,
): DeviationIndicator => ({
  metric, label, value, deltaPercent, ragStatus, formatFn,
  baseline: null, stdDev: null, latestValue: value, unit: '',
});

const SPARKS = {
  velocity: [0.71, 0.7, 0.72, 0.69, 0.66, 0.64],
  romConsistency: [4.1, 4.4, 4.0, 4.6, 5.1, 5.4],
  eccentricConcentric: [1.6, 1.5, 1.6, 1.7, 1.6, 1.5],
  tut: [38, 41, 40, 43, 42, 44],
};

export const Default: Story = {
  render: () => (
    <DeviationBaselineCard
      indicators={[
        ind('velocity', 'Avg velocity', 0.66, -6.4, 'amber', (v) => `${v.toFixed(2)} m/s`),
        ind('romConsistency', 'ROM consistency', 5.4, 12.5, 'red', (v) => `±${v.toFixed(1)} mm`),
        ind('eccentricConcentric', 'Ecc:Con ratio', 1.5, -1.2, 'green', (v) => v.toFixed(2)),
        ind('tut', 'Time under tension', 44, 4.8, 'green', (v) => `${v.toFixed(0)} s`),
      ]}
      sparks={SPARKS}
    />
  ),
};

/** Fewer than 7 sessions: the tile says so instead of drawing a trend. */
export const NotEnoughData: Story = {
  render: () => (
    <DeviationBaselineCard
      indicators={[
        ind('velocity', 'Avg velocity', 0.66, null, 'insufficient', (v) => `${v.toFixed(2)} m/s`),
        ind('romConsistency', 'ROM consistency', null, null, 'insufficient', (v) => `±${v.toFixed(1)} mm`),
        ind('eccentricConcentric', 'Ecc:Con ratio', null, null, 'insufficient', (v) => v.toFixed(2)),
        ind('tut', 'Time under tension', null, null, 'insufficient', (v) => `${v.toFixed(0)} s`),
      ]}
      sparks={{}}
    />
  ),
};
