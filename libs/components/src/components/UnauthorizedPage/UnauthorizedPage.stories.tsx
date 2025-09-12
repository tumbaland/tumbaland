import type { Meta, StoryObj } from '@storybook/react';
import { UnauthorizedPage } from './UnauthorizedPage';

const meta: Meta<typeof UnauthorizedPage> = {
  title: 'Components/UnauthorizedPage',
  component: UnauthorizedPage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'A reusable unauthorized access page component that displays an access restriction message with a login button.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    onLogin: {
      action: 'login clicked',
      description: 'Callback function to execute when the login button is clicked',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onLogin: () => console.log('Login button clicked'),
  },
};

export const WithAuthService: Story = {
  args: {
    onLogin: () => {
      // Simulate auth service redirect
      console.log('Redirecting to login...');
      alert('This would redirect to your authentication service');
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Example of how the component would be used with an actual auth service.',
      },
    },
  },
};
