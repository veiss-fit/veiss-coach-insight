import type { Meta, StoryObj } from '@storybook/react-vite';
import { UnitsNavMenu } from './UnitsNavMenu';
import { UnitsProvider } from '@/contexts/UnitsContext';

const meta: Meta = {
  title: 'Controls/Units nav menu',
  parameters: {
    docs: {
      description: {
        component:
          'Nav bar "Units" trigger. Opens a dropdown split into Primary (Distance, Weight) and Derived (Velocity, Power), each with a metric/imperial pick. Derived has an Auto toggle that locks it to mirror Distance’s system.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <UnitsProvider>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 40 }}>
        <UnitsNavMenu />
      </div>
    </UnitsProvider>
  ),
};
