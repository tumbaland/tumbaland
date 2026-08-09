import type { Meta, StoryObj } from '@storybook/react';
import { UsageMeter } from './UsageMeter';

const GB = 1024 * 1024 * 1024;

const meta: Meta<typeof UsageMeter> = {
  title: 'Entitlements/UsageMeter',
  component: UsageMeter,
  parameters: {
    docs: {
      description: {
        component:
          'What you have used, out of what your plan allows. Purely presentational — it takes numbers and never fetches them, so the same component serves the album dashboard, the ticker list, the group member list and the pricing table.'
      }
    }
  }
};

export default meta;
type Story = StoryObj<typeof UsageMeter>;

export const Comfortable: Story = {
  args: { label: 'Storage', used: 340 * 1024 * 1024, limit: GB, unit: 'bytes' }
};

/** Past 80% the bar turns amber and, given a handler, offers the upgrade. */
export const NearingTheLimit: Story = {
  args: { label: 'Storage', used: 0.9 * GB, limit: GB, unit: 'bytes', onUpgrade: () => {}, upgradeLabel: 'See plans' }
};

export const AtTheLimit: Story = {
  args: { label: 'Tracked tickers', used: 3, limit: 3, onUpgrade: () => {} }
};

/**
 * Staff and comped accounts. No bar at all: a full one would read as "at your
 * limit", an empty one implies a ceiling that does not exist.
 */
export const Unlimited: Story = {
  args: { label: 'Storage', used: 9 * GB, limit: -1, unit: 'bytes' }
};

/** For a meter sitting in a list row rather than a card. */
export const Dense: Story = {
  args: { label: 'Seats', used: 2, limit: 5, dense: true }
};
