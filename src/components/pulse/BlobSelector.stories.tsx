import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { BlobSelector, type BlobOption } from './BlobSelector';

const meta: Meta = {
  title: 'Controls/Blob selector',
  parameters: {
    docs: {
      description: {
        component:
          'Horizontal selector for the athlete page. A gold blob glides behind the active option with a smooth ease-out. Options: Performance, Velocity, Distance, Time. Placeholder styling, not final.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const OPTIONS: BlobOption[] = [
  { id: 'performance', label: 'Performance' },
  { id: 'velocity', label: 'Velocity' },
  { id: 'distance', label: 'Distance' },
  { id: 'time', label: 'Time' },
];

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState('performance');
    return <BlobSelector options={OPTIONS} value={value} onChange={setValue} />;
  },
};
