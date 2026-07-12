import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../pages/SubscriptionPage', () => ({ default: () => <div>subscription page</div> }));

import SubscriptionsTab from './SubscriptionsTab';

it('renders SubscriptionPage', () => {
  render(<SubscriptionsTab />);
  expect(screen.getByText('subscription page')).toBeInTheDocument();
});
