import type { Meta, StoryObj } from '@storybook/react-vite';
import { RangeOfMotionCards } from './RangeOfMotionCard';
import { summarizeRomSession } from '@/lib/metrics/rangeOfMotion';
import type { RepInput } from '@/lib/metrics/setVelocitySummary';

const meta: Meta = {
  title: 'Metrics/SP-06 Vertical displacement',
  parameters: {
    docs: {
      description: {
        component:
          'One line per set, one point per counted rep: vertical displacement (cm) by rep number. A rep counts when its velocity is valid and rom_mm > 0. Stats detail shows the Vertical displacement change (first to last set, load not considered) and the rep-to-rep consistency (CV, median over sets). No colour judgement. See temp/METRIC_SPEC.md (SP-06).',
      },
    },
  },
  decorators: [(Story) => <div style={{ maxWidth: 560 }}><Story /></div>],
};
export default meta;
type Story = StoryObj;

/** Each entry is [velocity, rom_mm]. */
const set = (exercise: string, n: number, data: [number | null, number | null][]): RepInput[] =>
  data.map(([v, rom], i) => ({ exercise_name: exercise, set_number: n, rep_number: i + 1, average_rep_speed: v, rom_mm: rom }));

/** Vertical displacement wobbles a little rep to rep and drops over the last few reps as the athlete tires. Open Stats detail. */
export const RomDropsAcrossSets: Story = {
  render: () => (
    <RangeOfMotionCards
      exercises={summarizeRomSession([
        ...set('Back Squat', 1, [[0.71, 556], [0.7, 559], [0.69, 555], [0.68, 558], [0.66, 554], [0.64, 557], [0.61, 546], [0.58, 538]]),
        ...set('Back Squat', 2, [[0.68, 549], [0.67, 552], [0.66, 548], [0.64, 551], [0.62, 547], [0.6, 544], [0.57, 533], [0.54, 524]]),
        ...set('Back Squat', 3, [[0.66, 546], [0.65, 548], [0.63, 544], [0.61, 547], [0.59, 540], [0.56, 538], [0.53, 526], [0.5, 515]]),
      ])}
    />
  ),
};

/** Missing or zero vertical displacement and invalid velocity reps are left out; the line breaks at the gap. */
export const MissingRom: Story = {
  render: () => (
    <RangeOfMotionCards
      exercises={summarizeRomSession([
        ...set('Bench Press', 1, [[0.55, 421], [0.53, null], [0.5, 419], [0.48, 412]]),
        ...set('Bench Press', 2, [[0.54, 422], [0, 300], [0.5, 418], [0.47, 409]]),
        ...set('Bench Press', 3, [[0.52, 0], [0.49, null], [0.45, 0]]),
      ])}
    />
  ),
};

/** One set only: no Vertical displacement change; consistency still shows. */
export const SingleSet: Story = {
  render: () => (
    <RangeOfMotionCards exercises={summarizeRomSession(set('Power Clean', 1, [[1.5, 611], [1.47, 614], [1.45, 610], [1.42, 612], [1.4, 601]]))} />
  ),
};

/** No vertical displacement recorded at all. */
export const NoRom: Story = {
  render: () => (
    <RangeOfMotionCards exercises={summarizeRomSession(set('Back Squat', 1, [[0.7, null], [0.68, null], [0.65, null]]))} />
  ),
};

export const SeveralExercises: Story = {
  render: () => (
    <RangeOfMotionCards
      exercises={summarizeRomSession([
        ...set('Back Squat', 1, [[0.71, 558], [0.7, 561], [0.68, 557], [0.66, 560], [0.64, 549], [0.61, 541]]),
        ...set('Back Squat', 2, [[0.68, 552], [0.66, 555], [0.64, 551], [0.62, 553], [0.6, 541], [0.57, 533]]),
        ...set('Bench Press', 1, [[0.55, 421], [0.54, 424], [0.52, 420], [0.51, 423], [0.49, 416], [0.46, 411]]),
        ...set('Bench Press', 2, [[0.54, 419], [0.52, 422], [0.5, 418], [0.49, 420], [0.46, 412], [0.43, 407]]),
      ])}
    />
  ),
};
