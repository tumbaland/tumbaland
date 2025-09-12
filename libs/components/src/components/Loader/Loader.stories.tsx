import type { Meta, StoryObj } from '@storybook/react';
import { Loader } from './Loader';

const meta: Meta<typeof Loader> = {
  title: 'Components/Loader',
  component: Loader,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A flexible loading component that displays a circular progress indicator with an optional message.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    message: {
      control: 'text',
      description: 'The loading message to display below the spinner',
    },
    size: {
      control: { type: 'number', min: 20, max: 100 },
      description: 'Size of the loading spinner in pixels',
    },
    fullHeight: {
      control: 'boolean',
      description: 'Whether to take full viewport height or auto height',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    message: 'Loading...',
    size: 48,
    fullHeight: true,
  },
};

export const CustomMessage: Story = {
  args: {
    message: 'Saving your changes...',
    size: 48,
    fullHeight: true,
  },
};

export const SmallLoader: Story = {
  args: {
    message: 'Processing...',
    size: 24,
    fullHeight: false,
  },
};

export const InlineLoader: Story = {
  args: {
    message: 'Loading data...',
    size: 32,
    fullHeight: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'An inline loader that doesn\'t take full height, useful for loading states within content.',
      },
    },
  },
};
