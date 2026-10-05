import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { UnitsSlotMachine } from './UnitsSlotMachine';
import { DEFAULT_UNIT_PREFS, type UnitPrefs } from './UnitsSelector';

const meta: Meta = {
  title: 'Not used/Units slot machine',
  parameters: {
    docs: {
      description: {
        component:
          'Style exploration: casino slot-reel styling for unit prefs. Click a reel to spin it to the other unit. Border glows gold when all four reels land on the same system (jackpot).',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState<UnitPrefs>(DEFAULT_UNIT_PREFS);
    return <UnitsSlotMachine value={value} onChange={setValue} />;
  },
};
