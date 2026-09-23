import type { Meta, StoryObj } from '@storybook/react-vite';
import { SessionSummaryBetaCard } from './SessionSummaryBetaCard';

const meta: Meta = {
  title: 'Beta/SessionSummaryBetaCard',
  parameters: {
    docs: {
      description: {
        component:
          'Group 6b — heart rate / calories, split from the old "Effort & readiness" card. Per session, from a wearable — a different grain and input path than RIR/RPE. All-mock data.',
      },
    },
  },
  decorators: [(Story) => <div style={{ maxWidth: 420 }}><Story /></div>],
};
export default meta;
type Story = StoryObj;

export const Interactive: Story = {
  render: () => (
    <SessionSummaryBetaCard sessionName="Tuesday lift" sessionDate="2026-09-22T10:00:00Z" stats={{ avgHeartRateBpm: 148, caloriesKcal: 312 }} />
  ),
};
