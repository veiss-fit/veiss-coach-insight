import type { Preview } from '@storybook/react-vite';
import '../src/index.css';
import { UnitsProvider } from '../src/contexts/UnitsContext';

const preview: Preview = {
  parameters: {
    layout: 'padded',
    a11y: { test: 'todo' },
  },
  decorators: [(Story) => <UnitsProvider><Story /></UnitsProvider>],
};

export default preview;
