import type { Meta, StoryObj } from '@storybook/react-vite';
import { TeamPrsPanel, type TeamPrRow } from './TeamPrsPanel';

const meta: Meta = {
  title: 'Home dashboard/TeamPrsPanel',
  parameters: {
    docs: {
      description: {
        component:
          'SP-05 per athlete, team-wide: fastest rep at the heaviest load each athlete lifted in the last 8 weeks, one row per athlete + exercise, newest first. "PR" means best in 8 weeks, not all-time. Only reps with a recorded weight qualify. Capped to 8 visible rows with "show all". Row click opens the athlete. See temp/HOME_DASHBOARD_PLAN.md.',
      },
    },
  },
  decorators: [(Story) => <div style={{ maxWidth: 420 }}><Story /></div>],
};
export default meta;
type Story = StoryObj;

const TODAY = Date.parse('2026-09-23T10:00:00Z');
const daysAgo = (n: number): string => new Date(TODAY - n * 86_400_000).toISOString();

const ROWS: TeamPrRow[] = [
  { playerId: 'p0', name: 'Jordan Ade', exercise: 'Back Squat', load: 315, best: 1.12, date: daysAgo(0) },
  { playerId: 'p1', name: 'Maya Chen', exercise: 'Bench Press', load: 155, best: 0.94, date: daysAgo(1) },
  { playerId: 'p2', name: 'Sam Ortiz', exercise: 'Deadlift', load: 405, best: 0.81, date: daysAgo(1) },
  { playerId: 'p0', name: 'Jordan Ade', exercise: 'RDL', load: 275, best: 1.05, date: daysAgo(3) },
  { playerId: 'p3', name: 'Priya Nair', exercise: 'Back Squat', load: 225, best: 1.21, date: daysAgo(4) },
  { playerId: 'p4', name: 'Leo Fontaine', exercise: 'Bench Press', load: 185, best: 0.88, date: daysAgo(6) },
  { playerId: 'p5', name: 'Noa Reyes', exercise: 'Deadlift', load: 335, best: 0.97, date: daysAgo(8) },
  { playerId: 'p1', name: 'Maya Chen', exercise: 'RDL', load: 195, best: 1.15, date: daysAgo(10) },
  { playerId: 'p6', name: 'Ava Torres', exercise: 'Back Squat', load: 245, best: 1.08, date: daysAgo(13) },
  { playerId: 'p7', name: 'Kai Mensah', exercise: 'Bench Press', load: 205, best: 0.9, date: daysAgo(15) },
];

export const Interactive: Story = {
  render: () => <TeamPrsPanel rows={ROWS} onRowClick={(id) => console.log('open athlete', id)} />,
};

export const FewPrs: Story = {
  render: () => <TeamPrsPanel rows={ROWS.slice(0, 3)} onRowClick={(id) => console.log('open athlete', id)} />,
};

export const NoRowClick: Story = {
  render: () => <TeamPrsPanel rows={ROWS.slice(0, 4)} />,
};

export const Empty: Story = {
  render: () => <TeamPrsPanel rows={[]} />,
};
