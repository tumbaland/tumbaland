import type { Meta, StoryObj } from '@storybook/react';
import { ErrorPage } from './ErrorPage';
import { WifiOff, ErrorOutline } from '@mui/icons-material';

const meta: Meta<typeof ErrorPage> = {
  title: 'Components/ErrorPage',
  component: ErrorPage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'A customizable error page component that displays error information with an optional retry action.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    title: {
      control: 'text',
      description: 'The main error title to display',
    },
    message: {
      control: 'text',
      description: 'The error message content',
    },
    showRetry: {
      control: 'boolean',
      description: 'Whether to show the retry button',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Configuration Error',
    message: 'Failed to load application configuration. Please check your network connection and try again.',
    showRetry: true,
  },
};

export const NetworkError: Story = {
  args: {
    title: 'Connection Failed',
    message: 'Unable to connect to the server. Please check your internet connection and try again.',
    icon: <WifiOff sx={{ fontSize: 80, color: 'error.main' }} />,
    showRetry: true,
  },
};

export const AccessDenied: Story = {
  args: {
    title: 'Access Denied',
    message: 'You don\'t have permission to view this page.',
    icon: <ErrorOutline sx={{ fontSize: 80, color: 'warning.main' }} />,
    showRetry: false,
  },
};

export const CustomError: Story = {
  args: {
    title: 'Something went wrong',
    message: (
      <div>
        <p>An unexpected error occurred while processing your request.</p>
        <p>Please try again later or contact support if the problem persists.</p>
      </div>
    ),
    showRetry: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Error page with custom React element message content.',
      },
    },
  },
};
