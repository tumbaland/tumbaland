import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../pages/PaymentsHistoryPage', () => ({ default: () => <div>payments history page</div> }));

import PaymentsTab from './PaymentsTab';

it('renders PaymentsHistoryPage', () => {
  render(<PaymentsTab />);
  expect(screen.getByText('payments history page')).toBeInTheDocument();
});
