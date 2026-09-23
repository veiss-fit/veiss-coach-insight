import type { Meta, StoryObj } from '@storybook/react-vite';
import { PlanCompletionTile } from './PlanCompletionTile';

const meta: Meta = {
  title: 'Home dashboard/PlanCompletionTile',
  parameters: {
    docs: {
      description: {
        component:
          'Team-pulse strip tile: this week completed / assigned plan count, pending count, change vs last week, 8-week completion % sparkline. Replaces the old Avg attendance tile. See temp/HOME_DASHBOARD_PLAN.md.',
      },
    },
  },
  decorators: [(Story) => <div style={{ maxWidth: 280 }}><Story /></div>],
};
export default meta;
type Story = StoryObj;

export const OnTrack: Story = {
  render: () => (
    <PlanCompletionTile
      completedThisWeek={34}
      assignedThisWeek={40}
      deltaPct={6}
      series={[62, 68, 71, 65, 74, 79, 81, 85]}
    />
  ),
};

export const Falling: Story = {
  render: () => (
    <PlanCompletionTile
      completedThisWeek={18}
      assignedThisWeek={40}
      deltaPct={-14}
      series={[81, 79, 76, 70, 65, 58, 52, 45]}
    />
  ),
};

export const AllCaughtUp: Story = {
  render: () => (
    <PlanCompletionTile
      completedThisWeek={22}
      assignedThisWeek={22}
      deltaPct={2}
      series={[90, 88, 92, 91, 95, 93, 97, 100]}
    />
  ),
};

export const NoDeltaFirstWeek: Story = {
  render: () => (
    <PlanCompletionTile
      completedThisWeek={12}
      assignedThisWeek={20}
      deltaPct={null}
      series={[60]}
    />
  ),
};

export const NothingAssigned: Story = {
  render: () => (
    <PlanCompletionTile
      completedThisWeek={0}
      assignedThisWeek={0}
      deltaPct={null}
      series={[]}
    />
  ),
};
