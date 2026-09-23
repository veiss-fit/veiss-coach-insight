import type { Meta, StoryObj } from '@storybook/react-vite';
import { WeeklyLoadVolumeBetaCard, type WeeklyLoadVolumePoint } from './WeeklyLoadVolumeBetaCard';

const meta: Meta = {
  title: 'Beta/WeeklyLoadVolumeBetaCard',
  parameters: {
    docs: {
      description: {
        component:
          "Group 3 (Load & volume) + group 5's cumulative distance, merged per review: e1RM dropped (already real, per exercise, on LoadVelocityProfileCard). Tonnage/Total work/Bar distance are all weekly totals across every exercise — one athlete, Performance tab, same shape as the shipped WeeklyVolumePanel. All-mock data.",
      },
    },
  },
  decorators: [(Story) => <div style={{ maxWidth: 420 }}><Story /></div>],
};
export default meta;
type Story = StoryObj;

const WEEK_LABELS = ['Jul 28', 'Aug 4', 'Aug 11', 'Aug 18', 'Aug 25', 'Sep 1', 'Sep 8', 'Sep 15'];
const WEEKS: WeeklyLoadVolumePoint[] = WEEK_LABELS.map((label, i) => ({
  label,
  tonnageLbs: 3200 + i * 220,
  totalWorkKj: 4.2 + i * 0.3,
  distanceM: Math.round((0.18 + i * 0.02) * 1609.34),
}));

export const Interactive: Story = {
  render: () => <WeeklyLoadVolumeBetaCard athleteName="Jordan Ade" weeks={WEEKS} coveragePct={22} />,
};

export const Empty: Story = {
  render: () => <WeeklyLoadVolumeBetaCard athleteName="Jordan Ade" weeks={[]} coveragePct={0} />,
};
