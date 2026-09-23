import type { Meta, StoryObj } from '@storybook/react-vite';
import { ComingSoonMetricsCard, DEFAULT_COMING_SOON_METRICS } from './ComingSoonMetricsCard';

const meta: Meta = {
  title: 'Home dashboard/ComingSoonMetricsCard',
  parameters: {
    docs: {
      description: {
        component:
          "Metrics coaches asked for (2026-09-23 email) that we don't compute or show yet — cross-referenced against reps/sessions columns and src/lib/metrics/*. Not in the build plan yet; placement on the home dashboard is undecided.",
      },
    },
  },
  decorators: [(Story) => <div style={{ maxWidth: 420 }}><Story /></div>],
};
export default meta;
type Story = StoryObj;

export const Interactive: Story = {
  render: () => <ComingSoonMetricsCard metrics={DEFAULT_COMING_SOON_METRICS} />,
};

export const NoReasons: Story = {
  render: () => <ComingSoonMetricsCard metrics={DEFAULT_COMING_SOON_METRICS.slice(0, 6).map(({ name }) => ({ name }))} />,
};

export const Empty: Story = {
  render: () => <ComingSoonMetricsCard metrics={[]} />,
};
