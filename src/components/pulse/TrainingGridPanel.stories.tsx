import type { Meta, StoryObj } from '@storybook/react-vite';
import { TrainingGridPanel, type TrainingGridRow } from './TrainingGridPanel';

const meta: Meta = {
  title: 'Home dashboard/TrainingGridPanel',
  parameters: {
    docs: {
      description: {
        component:
          'Rolling last 7 days, layout B: one row per athlete, one column per date, cell shaded by session count that day. Capped to 10 visible rows with "show all". Row click opens the athlete. See temp/HOME_DASHBOARD_PLAN.md.',
      },
    },
  },
  decorators: [(Story) => <div style={{ maxWidth: 520 }}><Story /></div>],
};
export default meta;
type Story = StoryObj;

const DAY_LABELS = ['Wed 17', 'Thu 18', 'Fri 19', 'Sat 20', 'Sun 21', 'Mon 22', 'Tue 23'];

const names = ['Jordan Ade', 'Maya Chen', 'Sam Ortiz', 'Priya Nair', 'Leo Fontaine', 'Noa Reyes'];
const rowsOf = (counts: number[][]): TrainingGridRow[] =>
  names.slice(0, counts.length).map((name, i) => ({ playerId: `p${i}`, name, countsByDay: counts[i] }));

export const SmallRoster: Story = {
  render: () => (
    <TrainingGridPanel
      dayLabels={DAY_LABELS}
      rows={rowsOf([
        [1, 0, 1, 0, 1, 0, 1],
        [0, 1, 0, 1, 0, 1, 0],
        [2, 1, 0, 0, 1, 1, 1],
        [0, 0, 0, 0, 0, 1, 1],
        [1, 1, 1, 1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
      ])}
      onRowClick={(id) => console.log('open athlete', id)}
    />
  ),
};

export const LargeRosterCapped: Story = {
  render: () => (
    <TrainingGridPanel
      dayLabels={DAY_LABELS}
      rows={Array.from({ length: 24 }, (_, i) => ({
        playerId: `p${i}`,
        name: `Athlete ${i + 1}`,
        countsByDay: Array.from({ length: 7 }, (_, d) => (i + d) % 3),
      }))}
      onRowClick={(id) => console.log('open athlete', id)}
    />
  ),
};

export const Empty: Story = {
  render: () => <TrainingGridPanel dayLabels={DAY_LABELS} rows={[]} />,
};
