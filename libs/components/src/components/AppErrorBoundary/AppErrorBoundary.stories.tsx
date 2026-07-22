import type { Meta, StoryObj } from '@storybook/react';
import { AppErrorBoundary } from './AppErrorBoundary';

function Bomb(): never {
  throw new Error('Storybook demo error');
}

const meta: Meta<typeof AppErrorBoundary> = {
  title: 'Components/AppErrorBoundary',
  component: AppErrorBoundary,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Catches render-time errors in its subtree, reports them via captureException, and shows ErrorPage instead of an unhandled blank screen.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Healthy: Story = {
  args: {
    children: <div style={{ padding: 24 }}>Children render normally when nothing throws.</div>,
  },
};

export const CaughtError: Story = {
  args: {
    component: 'storybook-demo',
    children: <Bomb />,
  },
  parameters: {
    docs: {
      description: {
        story: 'The wrapped child throws during render; the boundary shows ErrorPage instead.',
      },
    },
  },
};

export const CustomFallback: Story = {
  args: {
    title: 'Custom title',
    message: 'Custom fallback message for this app.',
    children: <Bomb />,
  },
};
