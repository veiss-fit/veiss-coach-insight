import type { Meta, StoryObj } from '@storybook/react-vite';
import { SessionsTile } from './SessionsTile';
import { Skeleton } from '@/components/ui/skeleton';

/** Mirrors the real skeleton used in Index.tsx's Suspense fallback for this tile. */
const SessionsTileSkeleton = () => (
  <div className="v-card padded" style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, height: "100%", boxSizing: "border-box", overflow: "hidden" }}>
    <div className="row" style={{ justifyContent: "space-between" }}>
      <Skeleton className="animate-pulse" style={{ height: 11, width: 56 }} />
      <Skeleton className="animate-pulse" style={{ height: 11, width: 28 }} />
    </div>
    <Skeleton className="animate-pulse" style={{ height: 22, width: 40, marginTop: 2 }} />
    <div className="row" style={{ alignItems: "flex-end", gap: 4, marginTop: "auto", height: 30 }}>
      {[14, 22, 10, 26, 18, 8, 20].map((h, i) => (
        <Skeleton key={i} className="animate-pulse" style={{ height: h, width: "100%" }} />
      ))}
    </div>
  </div>
);

const meta: Meta = {
  title: 'Home dashboard/SessionsTile',
  parameters: {
    docs: {
      description: {
        component:
          'Team-pulse strip tile: sessions logged this week, change vs last week, Mon-Sun mini bars. See temp/HOME_DASHBOARD_PLAN.md.',
      },
    },
  },
  decorators: [(Story) => <div style={{ maxWidth: 280 }}><Story /></div>],
};
export default meta;
type Story = StoryObj;

export const Busy: Story = {
  render: () => (
    <SessionsTile sessionsThisWeek={28} sessionsLastWeek={22} sessionsByDay={[6, 5, 4, 6, 3, 3, 1]} />
  ),
};

export const Quieter: Story = {
  render: () => (
    <SessionsTile sessionsThisWeek={14} sessionsLastWeek={22} sessionsByDay={[3, 2, 1, 3, 2, 2, 1]} />
  ),
};

export const NoChange: Story = {
  render: () => (
    <SessionsTile sessionsThisWeek={20} sessionsLastWeek={20} sessionsByDay={[4, 4, 3, 4, 3, 2, 0]} />
  ),
};

export const NoSessionsYet: Story = {
  render: () => (
    <SessionsTile sessionsThisWeek={0} sessionsLastWeek={0} sessionsByDay={[0, 0, 0, 0, 0, 0, 0]} />
  ),
};

export const WeekendHeavy: Story = {
  render: () => (
    <SessionsTile sessionsThisWeek={16} sessionsLastWeek={9} sessionsByDay={[1, 0, 1, 0, 1, 7, 6]} />
  ),
};

/** The Suspense fallback shown while the real tile's chunk is loading (Index.tsx). */
export const LazyLoading: Story = {
  render: () => <SessionsTileSkeleton />,
};
