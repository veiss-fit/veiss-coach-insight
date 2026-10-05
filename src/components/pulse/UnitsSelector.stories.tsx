import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { UnitsSelector, DEFAULT_UNIT_PREFS, type UnitPrefs } from './UnitsSelector';

const meta: Meta = {
  title: 'Not used/Units selector',
  parameters: {
    docs: {
      description: {
        component:
          'Coach unit preferences for Distance, Weight, Velocity, Power. Each category toggles metric/imperial with a gold blob, same mechanic as BlobSelector. Two layouts: "grid" (all categories at once) and "tabs" (pick a category, edit its toggle).',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Grid: Story = {
  render: () => {
    const [value, setValue] = useState<UnitPrefs>(DEFAULT_UNIT_PREFS);
    return <UnitsSelector mode="grid" value={value} onChange={setValue} />;
  },
};

export const Tabs: Story = {
  render: () => {
    const [value, setValue] = useState<UnitPrefs>(DEFAULT_UNIT_PREFS);
    return <UnitsSelector mode="tabs" value={value} onChange={setValue} />;
  },
};
