import type { Meta, StoryObj } from '@storybook/react-vite';
import { WeeklyVolumePanel, type WeeklyVolumePoint } from './WeeklyVolumePanel';

const meta: Meta = {
  title: 'Home dashboard/WeeklyVolumePanel',
  parameters: {
    docs: {
      description: {
        component:
          'SP-08: total lbs lifted per week (load x reps), team-wide, 8 weeks. Only reps with a recorded weight count, so the coverage % is shown alongside the bars — about 22% team-wide per METRIC_SPEC.md, unit not verified. See temp/HOME_DASHBOARD_PLAN.md.',
      },
    },
  },
  decorators: [(Story) => <div style={{ maxWidth: 420, height: 300 }}><Story /></div>],
};
export default meta;
type Story = StoryObj;

const WEEK_LABELS = ['Jul 28', 'Aug 4', 'Aug 11', 'Aug 18', 'Aug 25', 'Sep 1', 'Sep 8', 'Sep 15'];
const rowsOf = (totals: number[]): WeeklyVolumePoint[] =>
  WEEK_LABELS.map((label, i) => ({
    label,
    tonnageLbs: totals[i],
    totalWorkKj: +(totals[i] * 0.013).toFixed(1),
    distanceM: Math.round(totals[i] * 0.0966),
  }));

export const Interactive: Story = {
  render: () => (
    <WeeklyVolumePanel
      data={rowsOf([8200, 9100, 7600, 10400, 11800, 9900, 12600, 13100])}
      coveragePct={22}
    />
  ),
};

export const LowCoverage: Story = {
  render: () => (
    <WeeklyVolumePanel
      data={rowsOf([1200, 900, 1600, 800, 2100, 1400, 1900, 1100])}
      coveragePct={6}
    />
  ),
};

export const HighVolume: Story = {
  render: () => (
    <WeeklyVolumePanel
      data={rowsOf([42000, 38500, 45200, 51000, 47800, 53100, 49600, 58200])}
      coveragePct={64}
    />
  ),
};

export const Empty: Story = {
  render: () => <WeeklyVolumePanel data={[]} coveragePct={0} />,
};
