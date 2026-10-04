import { render, screen } from '@testing-library/react';
import { vi } from 'vite-plus/test';

vi.mock('../../pages/PlansPage', () => ({ default: () => <div>plans page</div> }));

import PlansTab from './PlansTab';

it('renders PlansPage', () => {
  render(<PlansTab />);
  expect(screen.getByText('plans page')).toBeInTheDocument();
});
