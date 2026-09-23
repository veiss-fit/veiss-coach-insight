import type { Meta, StoryObj } from '@storybook/react-vite';
import { NeedsAttentionTile } from './NeedsAttentionTile';

const meta: Meta = {
  title: 'Home dashboard/NeedsAttentionTile',
  parameters: {
    docs: {
      description: {
        component:
          '"n of m" flagged, counts per reason (inactive, velocity drop, tempo shift, attendance) using the roster table\'s own thresholds (SP-13). Clicking a reason filters the roster table to those athletes. See temp/HOME_DASHBOARD_PLAN.md.',
      },
    },
  },
  decorators: [(Story) => <div style={{ maxWidth: 280 }}><Story /></div>],
};
export default meta;
type Story = StoryObj;

export const MixedReasons: Story = {
  render: () => (
    <NeedsAttentionTile
      flaggedCount={6}
      totalCount={18}
      reasonCounts={{ days: 2, drop: 3, tempo: 1, attendance: 2 }}
      onReasonClick={(r) => console.log('filter roster by', r)}
    />
  ),
};

export const NoneFlagged: Story = {
  render: () => (
    <NeedsAttentionTile
      flaggedCount={0}
      totalCount={18}
      reasonCounts={{ days: 0, drop: 0, tempo: 0, attendance: 0 }}
      onReasonClick={(r) => console.log('filter roster by', r)}
    />
  ),
};

export const AllOneReason: Story = {
  render: () => (
    <NeedsAttentionTile
      flaggedCount={5}
      totalCount={18}
      reasonCounts={{ days: 0, drop: 0, tempo: 0, attendance: 5 }}
      onReasonClick={(r) => console.log('filter roster by', r)}
    />
  ),
};

export const NotClickable: Story = {
  render: () => (
    <NeedsAttentionTile
      flaggedCount={4}
      totalCount={18}
      reasonCounts={{ days: 1, drop: 2, tempo: 0, attendance: 1 }}
    />
  ),
};
